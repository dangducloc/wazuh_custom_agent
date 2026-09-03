// memory/agent-memory.js
import fs from "fs";
import path from "path";
import { logger } from "../utils/index.js";

// ─────────────────────────────────────────────────────────────────────────────
// AgentMemory
// - Short-term: conversation history per sessionId, persisted to a JSON file.
// - Long-term: key-value facts persisted to a JSON file (seenAlerts, notes, ...).
// - Routing: decides whether related facts need to be "recalled" into the context,
//   using regex first (cheap), avoiding always stuffing all facts into the prompt.
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
  } = {}) {
    this.factsFile = factsFile;
    this.sessionsFile = sessionsFile;
    this.maxHistoryMessages = maxHistoryMessages;
    this.recallPatterns = recallPatterns;
    this.saveDebounceMs = saveDebounceMs;
    this._saveTimer = null;

    this.sessions = this._loadSessions(); // sessionId -> [{role, content}, ...]
    this.facts = this._loadFacts();
  }

  // ── Short-term: session history (persisted to file) ─────────────────────
  _loadSessions() {
    try {
      if (fs.existsSync(this.sessionsFile)) {
        const raw = JSON.parse(fs.readFileSync(this.sessionsFile, "utf-8"));
        return new Map(Object.entries(raw));
      }
    } catch (err) {
      logger.error({ err: err.message }, "[Memory] Failed to load sessions file, starting fresh");
    }
    return new Map();
  }

  // Debounce so we don't write the file on every turn when requests flood in
  _scheduleSaveSessions() {
    if (this._saveTimer) clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => this._saveSessionsNow(), this.saveDebounceMs);
  }

  _saveSessionsNow() {
    fs.mkdirSync(path.dirname(this.sessionsFile), { recursive: true });
    const obj = Object.fromEntries(this.sessions);
    fs.writeFileSync(this.sessionsFile, JSON.stringify(obj, null, 2));
  }

  getHistory(sessionId) {
    if (!this.sessions.has(sessionId)) this.sessions.set(sessionId, []);
    return this.sessions.get(sessionId);
  }

  listSessions() {
    return [...this.sessions.keys()];
  }

  deleteSession(sessionId) {
    this.sessions.delete(sessionId);
    this._scheduleSaveSessions();
  }

  addTurn(sessionId, role, content) {
    const history = this.getHistory(sessionId);
    history.push({ role, content });

    if (history.length > this.maxHistoryMessages) {
      const dropped = history.splice(0, history.length - this.maxHistoryMessages);
      const summary = this._summarize(dropped);
      history.unshift({ role: "system", content: `[Previous conversation summary]: ${summary}` });
      logger.info({ sessionId }, "[Memory] Trimmed session history");
    }

    this._scheduleSaveSessions();
  }

  // ── Long-term: facts persisted to file ──────────────────────────────────
  _loadFacts() {
    try {
      if (fs.existsSync(this.factsFile)) {
        return JSON.parse(fs.readFileSync(this.factsFile, "utf-8"));
      }
    } catch (err) {
      logger.error({ err: err.message }, "[Memory] Failed to load facts file, starting fresh");
    }
    return { seenAlerts: {}, resolvedGroups: {}, notes: [] };
  }

  _saveFacts() {
    fs.mkdirSync(path.dirname(this.factsFile), { recursive: true });
    fs.writeFileSync(this.factsFile, JSON.stringify(this.facts, null, 2));
  }

  rememberAlert(alertId, { ruleId, action } = {}) {
    this.facts.seenAlerts[alertId] = { ruleId, action, ts: Date.now() };
    this._saveFacts();
  }

  hasSeenAlert(alertId) {
    return Object.prototype.hasOwnProperty.call(this.facts.seenAlerts, alertId);
  }

  addNote(note) {
    this.facts.notes.push({ note, ts: Date.now() });
    this._saveFacts();
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

  _summarize(oldMessages) {
    // Simple: concatenate the text and truncate. In production, use a small
    // model to generate a real summary.
    return oldMessages
      .map((m) => `${m.role}: ${String(m.content).slice(0, 100)}`)
      .join(" | ");
  }
}

export const agentMemory = new AgentMemory({
  factsFile: path.resolve("./data/agent-memory.json"),
  sessionsFile: path.resolve("./data/agent-sessions.json"),
});
