// memory/agent-memory.js
// AgentMemory facade (SQLite-backed), composing the stores:
// - Short-term: conversation history per sessionId (SessionStore, sessions table).
// - Long-term: key-value facts (FactsStore, seen_alerts/resolved_groups/notes).
// - Routing: regex-first recall of related facts into the context (recall.js).
//
// SQLite plumbing lives in ./utils.js, recall/summary/migration helpers in
// ./helper.js; this module wires everything together and owns the DB handle.
import path from "path";
import { openDatabase, prepareStatements } from "./utils.js";
import { DEFAULT_RECALL_PATTERNS, matchesRecall, migrateLegacyJsonFiles } from "./helper.js";
import { SessionStore } from "./sessions.js";
import { FactsStore } from "./facts.js";
import { searchFacts, buildContext } from "./recall.js";

export class AgentMemory {
  constructor({
    dbFile = null,
    factsFile = path.resolve("./data/agent-memory.json"),
    sessionsFile = path.resolve("./data/agent-sessions.json"),
    maxHistoryMessages = 20,
    recallPatterns = DEFAULT_RECALL_PATTERNS,
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
    // factsFile/sessionsFile are legacy JSON paths: used to derive the SQLite
    // location and as one-time migration sources.
    this.dbFile = dbFile
      || (factsFile.toLowerCase().endsWith(".json")
        ? factsFile.replace(/\.json$/i, ".db")
        : `${factsFile}.db`);
    this.factsFile = factsFile;
    this.sessionsFile = sessionsFile;
    this.maxHistoryMessages = maxHistoryMessages;
    this.recallPatterns = recallPatterns;

    this.alertTtlMs = alertTtlMs;
    this.noteTtlMs = noteTtlMs;
    this.maxNotes = maxNotes;
    this.sessionIdleTtlMs = sessionIdleTtlMs;
    this.maxSessions = maxSessions;
    this.summarizer = summarizer;

    this._db = openDatabase(this.dbFile);
    this._stmts = prepareStatements(this._db);
    migrateLegacyJsonFiles({
      db: this._db,
      stmts: this._stmts,
      dbFile: this.dbFile,
      factsFile: this.factsFile,
      sessionsFile: this.sessionsFile,
    });

    this._sessions = new SessionStore({
      db: this._db,
      stmts: this._stmts,
      maxHistoryMessages,
      sessionIdleTtlMs,
      maxSessions,
      summarizer,
    });
    this._facts = new FactsStore({
      db: this._db,
      stmts: this._stmts,
      alertTtlMs,
      noteTtlMs,
      maxNotes,
    });

    this._pruneExpired(); // best-effort cleanup on boot
  }

  // ── Short-term: session history (delegates to SessionStore) ──────────────
  getHistory(sessionId) {
    return this._sessions.getHistory(sessionId);
  }

  listSessions() {
    return this._sessions.listSessions();
  }

  deleteSession(sessionId) {
    return this._sessions.deleteSession(sessionId);
  }

  addTurn(sessionId, role, content) {
    return this._sessions.addTurn(sessionId, role, content);
  }

  // ── Long-term: facts (delegates to FactsStore) ───────────────────────────
  rememberAlert(alertId, meta = {}) {
    return this._facts.rememberAlert(alertId, meta);
  }

  hasSeenAlert(alertId) {
    return this._facts.hasSeenAlert(alertId);
  }

  forgetAlert(alertId) {
    return this._facts.forgetAlert(alertId);
  }

  addNote(note) {
    return this._facts.addNote(note);
  }

  // ── Routing: do we need to recall facts into the context? ───────────────
  needsRecall(userMessage) {
    return matchesRecall(this.recallPatterns, userMessage);
  }

  searchFacts(userMessage) {
    return searchFacts(this._stmts, userMessage);
  }

  buildContext(sessionId, systemPrompt, userMessage) {
    return buildContext(this, sessionId, systemPrompt, userMessage);
  }

  /** Remove alerts/notes/sessions past their TTL. Called on boot and can be run on a cron. */
  _pruneExpired() {
    this._facts.prune();
    this._sessions.prune();
  }

  /** Force a WAL checkpoint, e.g. on graceful shutdown. Writes are already committed. */
  async flush() {
    this._db.pragma("wal_checkpoint(TRUNCATE)");
  }

  /** Close the database and release file locks (graceful shutdown). */
  close() {
    if (this._db && this._db.open) this._db.close();
  }
}

export const agentMemory = new AgentMemory({
  dbFile: path.resolve("./data/agent-memory.db"),
  factsFile: path.resolve("./data/agent-memory.json"),
  sessionsFile: path.resolve("./data/agent-sessions.json"),
  // Plug in a real summarizer, e.g. calling a small local model:
  // summarizer: async (msgs) => (await callSmallModel(msgs)).text,
});
