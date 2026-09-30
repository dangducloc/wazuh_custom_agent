// memory/utils.js
// Low-level SQLite helpers for the AgentMemory store: open the DB with the
// right pragmas, create the schema, and prepare all statements once.
import fs from "fs";
import path from "path";
import Database from "better-sqlite3";

const SCHEMA_DDL = `
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    messages TEXT NOT NULL DEFAULT '[]',
    last_active_at INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS seen_alerts (
    alert_id TEXT PRIMARY KEY,
    rule_id TEXT,
    action TEXT,
    ts INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS resolved_groups (
    name TEXT PRIMARY KEY,
    value TEXT
  );
  CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    note TEXT NOT NULL,
    ts INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_seen_alerts_rule ON seen_alerts(rule_id);
  CREATE INDEX IF NOT EXISTS idx_sessions_last_active ON sessions(last_active_at);
  CREATE INDEX IF NOT EXISTS idx_notes_ts ON notes(ts);
`;

export function openDatabase(dbFile) {
  fs.mkdirSync(path.dirname(dbFile), { recursive: true });
  const db = new Database(dbFile);
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");
  db.exec(SCHEMA_DDL);
  return db;
}

export function prepareStatements(db) {
  return {
    // sessions (short-term history)
    touchSession: db.prepare(
      "INSERT INTO sessions (id, messages, last_active_at) VALUES (?, '[]', ?) " +
      "ON CONFLICT(id) DO UPDATE SET last_active_at = excluded.last_active_at"
    ),
    getSession: db.prepare("SELECT messages FROM sessions WHERE id = ?"),
    saveSession: db.prepare(
      "UPDATE sessions SET messages = ?, last_active_at = ? WHERE id = ?"
    ),
    deleteSession: db.prepare("DELETE FROM sessions WHERE id = ?"),
    deleteIdleSessions: db.prepare("DELETE FROM sessions WHERE last_active_at < ?"),
    deleteOldestSessions: db.prepare(
      "DELETE FROM sessions WHERE id IN (SELECT id FROM sessions ORDER BY last_active_at ASC LIMIT ?)"
    ),
    countSessions: db.prepare("SELECT COUNT(*) AS c FROM sessions"),

    // seen_alerts (long-term facts)
    upsertAlert: db.prepare(
      "INSERT INTO seen_alerts (alert_id, rule_id, action, ts) VALUES (?, ?, ?, ?) " +
      "ON CONFLICT(alert_id) DO UPDATE SET rule_id = excluded.rule_id, action = excluded.action, ts = excluded.ts"
    ),
    getAlert: db.prepare("SELECT alert_id, rule_id, action, ts FROM seen_alerts WHERE alert_id = ?"),
    getAlertsByRule: db.prepare("SELECT alert_id, rule_id, action, ts FROM seen_alerts WHERE rule_id = ?"),
    hasAlert: db.prepare("SELECT 1 FROM seen_alerts WHERE alert_id = ?"),
    deleteAlert: db.prepare("DELETE FROM seen_alerts WHERE alert_id = ?"),
    deleteExpiredAlerts: db.prepare("DELETE FROM seen_alerts WHERE ts < ?"),
    countAlerts: db.prepare("SELECT COUNT(*) AS c FROM seen_alerts"),

    // notes (long-term facts) + resolved_groups
    insertNote: db.prepare("INSERT INTO notes (note, ts) VALUES (?, ?)"),
    recentNotes: db.prepare("SELECT note, ts FROM notes ORDER BY id DESC LIMIT ?"),
    deleteExpiredNotes: db.prepare("DELETE FROM notes WHERE ts < ?"),
    trimNotes: db.prepare(
      "DELETE FROM notes WHERE id NOT IN (SELECT id FROM notes ORDER BY id DESC LIMIT ?)"
    ),
    countNotes: db.prepare("SELECT COUNT(*) AS c FROM notes"),
    insertGroup: db.prepare("INSERT OR IGNORE INTO resolved_groups (name, value) VALUES (?, ?)"),
  };
}
