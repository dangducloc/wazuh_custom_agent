// memory/sessions.js
// Short-term store: conversation history per sessionId (sessions table),
// with history trimming + summarization and session cap/TTL enforcement.
import { logger } from "../utils/index.js";
import { naiveSummary } from "./helper.js";

export class SessionStore {
  constructor({
    db,
    stmts,
    maxHistoryMessages = 20,
    sessionIdleTtlMs = 7 * 24 * 60 * 60 * 1000, // drop sessions idle 7 days
    maxSessions = 1000,
    // Optional async fn(oldMessages) => string, for real summarization.
    // Falls back to a naive truncated concat if not provided.
    summarizer = null,
  }) {
    this.db = db;
    this.stmts = stmts;
    this.maxHistoryMessages = maxHistoryMessages;
    this.sessionIdleTtlMs = sessionIdleTtlMs;
    this.maxSessions = maxSessions;
    this.summarizer = summarizer;
  }

  getHistory(sessionId) {
    this.stmts.touchSession.run(sessionId, Date.now());
    return JSON.parse(this.stmts.getSession.get(sessionId).messages);
  }

  listSessions() {
    return this.db
      .prepare("SELECT id FROM sessions ORDER BY last_active_at ASC")
      .all()
      .map((r) => r.id);
  }

  deleteSession(sessionId) {
    this.stmts.deleteSession.run(sessionId);
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

    this.stmts.saveSession.run(JSON.stringify(history), Date.now(), sessionId);
    this.enforceCap();
  }

  /** Drop oldest idle sessions beyond maxSessions / sessionIdleTtlMs. */
  enforceCap() {
    this.stmts.deleteIdleSessions.run(Date.now() - this.sessionIdleTtlMs);
    const count = this.stmts.countSessions.get().c;
    if (count > this.maxSessions) {
      this.stmts.deleteOldestSessions.run(count - this.maxSessions);
    }
  }

  /** Drop sessions idle past sessionIdleTtlMs. Part of boot-time pruning. */
  prune() {
    this.stmts.deleteIdleSessions.run(Date.now() - this.sessionIdleTtlMs);
  }

  async _summarize(oldMessages) {
    if (this.summarizer) {
      try {
        return await this.summarizer(oldMessages);
      } catch (err) {
        logger.error({ err: err.message }, "[Memory] summarizer failed, falling back to naive summary");
      }
    }
    return naiveSummary(oldMessages);
  }
}
