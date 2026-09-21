// memory/agent-memory.js
import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import { logger } from "../utils/index.js";

// ─────────────────────────────────────────────────────────────────────────────
// AgentMemory
// - Short-term: conversation history per sessionId, persisted to a JSON file.
// - Long-term: key-value facts persisted to a JSON file (seenAlerts, notes, ...).
// - Routing: decides whether related facts need to be "recalled" into the context,
//   using regex first (cheap), avoiding always stuffing all facts into the prompt.
//
// Changes vs. v1:
//   - Async + atomic writes (tmp file + rename) so a crash mid-write never
//     corrupts the JSON store.
//   - TTL-based pruning for seenAlerts, notes, and idle sessions, so the
//     store doesn't grow unbounded under high Wazuh alert volume.
//   - Pluggable `summarizer` function instead of a hardcoded TODO.
//   - Shared load/save helpers (DRY), plus a `forgetAlert`/`forgetNote` API.
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_RECALL_PATTERNS = [
  /(handled|seen|encountered) (before|previously)/i,
  /alert.*(before|previous|old|last time)/i,
  /rule.*(which|what).*(use|create)/i,
  /remember( the| it)?/i,
  /like (last time|yesterday|last week)/i,
  /alert[_\s-]?id\s*[:=]?\s*\w+/i,
  /rule[_\s-]?id\s*[:=]?\s*\w+/i,
];

export class AgentMemory {
  constructor({
    factsFile = path.resolve("./data/agent-memory.json"),
    sessionsFile = path.resolve("./data/agent-sessions.json"),
    maxHistoryMessages = 20,
    recallPatterns = DEFAULT_RECALL_PATTERNS,
    saveDebounceMs = 500,
    // Pruning / retention config
    alertTtlMs = 30 * 24 * 60 * 60 * 1000,   // keep seenAlerts 30 days
    noteTtlMs = 90 * 24 * 60 * 60 * 1000,    // keep notes 90 days
    maxNotes = 500,
    sessionIdleTtlMs = 7 * 24 * 60 * 60 * 1000, // drop sessions idle 7 days
    maxSessions = 1000,
    // Optional async fn(oldMessages) => string, for real summarization.
    // Falls back to a naive truncated concat if not provided.
    summarizer = null,
  } = {}) {
    this.factsFile = factsFile;
    this.sessionsFile = sessionsFile;
    this.maxHistoryMessages = maxHistoryMessages;
    this.recallPatterns = recallPatterns;
    this.saveDebounceMs = saveDebounceMs;

    this.alertTtlMs = alertTtlMs;
    this.noteTtlMs = noteTtlMs;
    this.maxNotes = maxNotes;
    this.sessionIdleTtlMs = sessionIdleTtlMs;
    this.maxSessions = maxSessions;
    this.summarizer = summarizer;

    this._sessionSaveTimer = null;
    this._factsSaveTimer = null;
    this._factsDirty = false;

    // sessionId -> { messages: [{role, content}], lastActiveAt: number }
    this.sessions = this._loadJsonSync(this.sessionsFile, () => new Map(), (raw) => {
      const map = new Map();
      for (const [id, v] of Object.entries(raw)) {
        // backward-compat: old format was a bare array of messages
        map.set(id, Array.isArray(v) ? { messages: v, lastActiveAt: Date.now() } : v);
      }
      return map;
    });

    this.facts = this._loadJsonSync(
      this.factsFile,
      () => ({ seenAlerts: {}, resolvedGroups: {}, notes: [] }),
      (raw) => raw
    );

    this._pruneExpired(); // best-effort cleanup on boot
  }

  // ── Shared load/save helpers ─────────────────────────────────────────────
  _loadJsonSync(file, makeDefault, transform) {
    try {
      if (fs.existsSync(file)) {
        const raw = JSON.parse(fs.readFileSync(file, "utf-8"));
        return transform(raw);
      }
    } catch (err) {
      logger.error({ err: err.message, file }, "[Memory] Failed to load file, starting fresh");
    }
    return makeDefault();
  }

  async _atomicWrite(file, data) {
    const dir = path.dirname(file);
    await fsp.mkdir(dir, { recursive: true });
    const tmp = path.join(dir, `.${path.basename(file)}.${process.pid}.tmp`);
    await fsp.writeFile(tmp, JSON.stringify(data, null, 2));
    await fsp.rename(tmp, file); // atomic on same filesystem
  }

  // ── Short-term: session history (persisted to file) ─────────────────────
  _scheduleSaveSessions() {
    if (this._sessionSaveTimer) clearTimeout(this._sessionSaveTimer);
    this._sessionSaveTimer = setTimeout(() => {
      this._saveSessionsNow().catch((err) =>
        logger.error({ err: err.message }, "[Memory] Failed to persist sessions")
      );
    }, this.saveDebounceMs);
  }

  async _saveSessionsNow() {
    const obj = Object.fromEntries(this.sessions);
    await this._atomicWrite(this.sessionsFile, obj);
  }

  /** Force-flush pending writes, e.g. on graceful shutdown. */
  async flush() {
    if (this._sessionSaveTimer) clearTimeout(this._sessionSaveTimer);
    if (this._factsSaveTimer) clearTimeout(this._factsSaveTimer);
    await this._saveSessionsNow();
    if (this._factsDirty) await this._saveFactsNow();
  }

  getHistory(sessionId) {
    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, { messages: [], lastActiveAt: Date.now() });
    }
    const entry = this.sessions.get(sessionId);
    entry.lastActiveAt = Date.now();
    return entry.messages;
  }

  listSessions() {
    return [...this.sessions.keys()];
  }

  deleteSession(sessionId) {
    this.sessions.delete(sessionId);
    this._scheduleSaveSessions();
  }

  async addTurn(sessionId, role, content) {
    const history = this.getHistory(sessionId);
    history.push({ role, content });

    if (history.length > this.maxHistoryMessages) {
      const dropped = history.splice(0, history.length - this.maxHistoryMessages);
      const summary = await this._summarize(dropped);
      history.unshift({ role: "system", content: `[Previous conversation summary]: ${summary}` });
      logger.info({ sessionId }, "[Memory] Trimmed session history");
    }

    this._enforceSessionCap();
    this._scheduleSaveSessions();
  }

  /** Drop oldest idle sessions beyond maxSessions / sessionIdleTtlMs. */
  _enforceSessionCap() {
    const now = Date.now();
    for (const [id, entry] of this.sessions) {
      if (now - entry.lastActiveAt > this.sessionIdleTtlMs) this.sessions.delete(id);
    }
    if (this.sessions.size > this.maxSessions) {
      const sorted = [...this.sessions.entries()].sort(
        (a, b) => a[1].lastActiveAt - b[1].lastActiveAt
      );
      const excess = sorted.length - this.maxSessions;
      for (let i = 0; i < excess; i++) this.sessions.delete(sorted[i][0]);
    }
  }

  // ── Long-term: facts persisted to file ──────────────────────────────────
  _scheduleSaveFacts() {
    this._factsDirty = true;
    if (this._factsSaveTimer) clearTimeout(this._factsSaveTimer);
    this._factsSaveTimer = setTimeout(() => {
      this._saveFactsNow().catch((err) =>
        logger.error({ err: err.message }, "[Memory] Failed to persist facts")
      );
    }, this.saveDebounceMs);
  }

  async _saveFactsNow() {
    await this._atomicWrite(this.factsFile, this.facts);
    this._factsDirty = false;
  }

  rememberAlert(alertId, { ruleId, action } = {}) {
    this.facts.seenAlerts[alertId] = { ruleId, action, ts: Date.now() };
    this._scheduleSaveFacts();
  }

  hasSeenAlert(alertId) {
    return Object.prototype.hasOwnProperty.call(this.facts.seenAlerts, alertId);
  }

  forgetAlert(alertId) {
    delete this.facts.seenAlerts[alertId];
    this._scheduleSaveFacts();
  }

  addNote(note) {
    this.facts.notes.push({ note, ts: Date.now() });
    if (this.facts.notes.length > this.maxNotes) {
      this.facts.notes.splice(0, this.facts.notes.length - this.maxNotes);
    }
    this._scheduleSaveFacts();
  }

  /** Remove alerts/notes past their TTL. Called on boot and can be run on a cron. */
  _pruneExpired() {
    const now = Date.now();
    let changed = false;

    for (const [id, v] of Object.entries(this.facts.seenAlerts)) {
      if (now - v.ts > this.alertTtlMs) {
        delete this.facts.seenAlerts[id];
        changed = true;
      }
    }
    const keptNotes = this.facts.notes.filter((n) => now - n.ts <= this.noteTtlMs);
    if (keptNotes.length !== this.facts.notes.length) {
      this.facts.notes = keptNotes;
      changed = true;
    }
    if (changed) this._scheduleSaveFacts();

    for (const [id, entry] of this.sessions) {
      if (now - entry.lastActiveAt > this.sessionIdleTtlMs) this.sessions.delete(id);
    }
  }

  // ── Routing: do we need to recall facts into the context? ───────────────
  needsRecall(userMessage) {
    return this.recallPatterns.some((re) => re.test(userMessage));
  }

  // Extracts alert_id / rule_id from the message for direct lookup,
  // no vector search needed since the data has a clear structure.
  searchFacts(userMessage) {
    const alertIdMatch = userMessage.match(/alert[_\s-]?id\s*[:=]?\s*(\S+)/i);
    const ruleIdMatch = userMessage.match(/rule[_\s-]?id\s*[:=]?\s*(\S+)/i);

    const result = {};
    if (alertIdMatch) {
      const id = alertIdMatch[1].replace(/[",.]$/, "");
      result.alert = this.facts.seenAlerts[id] ? { id, ...this.facts.seenAlerts[id] } : null;
    }
    if (ruleIdMatch) {
      const ruleId = ruleIdMatch[1].replace(/[",.]$/, "");
      result.matchingAlerts = Object.entries(this.facts.seenAlerts)
        .filter(([, v]) => v.ruleId === ruleId)
        .map(([id, v]) => ({ id, ...v }));
    }
    if (!alertIdMatch && !ruleIdMatch && this.facts.notes.length) {
      result.recentNotes = this.facts.notes.slice(-5);
    }
    return result;
  }

  // ── Helper: build the final messages[] to send to the model ─────────────
  buildContext(sessionId, systemPrompt, userMessage) {
    const messages = [{ role: "system", content: systemPrompt }];

    if (this.needsRecall(userMessage)) {
      const facts = this.searchFacts(userMessage);
      if (Object.keys(facts).length) {
        messages.push({
          role: "system",
          content: `[Related memory]: ${JSON.stringify(facts)}`,
        });
        logger.info({ sessionId, facts }, "[Memory] Injected recalled facts");
      }
    }

    messages.push(...this.getHistory(sessionId));
    messages.push({ role: "user", content: userMessage });
    return messages;
  }

  async _summarize(oldMessages) {
    if (this.summarizer) {
      try {
        return await this.summarizer(oldMessages);
      } catch (err) {
        logger.error({ err: err.message }, "[Memory] summarizer failed, falling back to naive summary");
      }
    }
    return oldMessages
      .map((m) => `${m.role}: ${String(m.content).slice(0, 100)}`)
      .join(" | ");
  }
}

export const agentMemory = new AgentMemory({
  factsFile: path.resolve("./data/agent-memory.json"),
  sessionsFile: path.resolve("./data/agent-sessions.json"),
  // Plug in a real summarizer, e.g. calling a small local model:
  // summarizer: async (msgs) => (await callSmallModel(msgs)).text,
});
