// memory/helper.js
// Domain helpers for AgentMemory: recall routing, naive summarization, and
// the one-time migration from the legacy JSON stores into SQLite.
import fs from "fs";
import { logger } from "../utils/index.js";

export const DEFAULT_RECALL_PATTERNS = [
  /(handled|seen|encountered) (before|previously)/i,
  /alert.*(before|previous|old|last time)/i,
  /rule.*(which|what).*(use|create)/i,
  /remember( the| it)?/i,
  /like (last time|yesterday|last week)/i,
  /alert[_\s-]?id\s*[:=]?\s*\w+/i,
  /rule[_\s-]?id\s*[:=]?\s*\w+/i,
];

export function matchesRecall(patterns, userMessage) {
  return patterns.some((re) => re.test(userMessage));
}

// Naive fallback: truncated concat of dropped turns (used when no summarizer
// is configured or the summarizer itself fails).
export function naiveSummary(oldMessages) {
  return oldMessages
    .map((m) => `${m.role}: ${String(m.content).slice(0, 100)}`)
    .join(" | ");
}

// One-time import of the legacy JSON stores (data/agent-memory.json,
// data/agent-sessions.json). Only runs when the DB is still empty; on success
// the original files are renamed to *.migrated (kept as backup).
export function migrateLegacyJsonFiles({ db, stmts, dbFile, factsFile, sessionsFile }) {
  const hasFacts = fs.existsSync(factsFile);
  const hasSessions = fs.existsSync(sessionsFile);
  if (!hasFacts && !hasSessions) return false;

  const isEmpty =
    stmts.countSessions.get().c === 0 &&
    stmts.countAlerts.get().c === 0 &&
    stmts.countNotes.get().c === 0;
  if (!isEmpty) return false;

  const now = Date.now();
  if (hasFacts) {
    try {
      const raw = JSON.parse(fs.readFileSync(factsFile, "utf-8"));
      for (const [id, v] of Object.entries(raw.seenAlerts || {})) {
        stmts.upsertAlert.run(id, v?.ruleId ?? null, v?.action ?? null, v?.ts ?? now);
      }
      for (const [name, value] of Object.entries(raw.resolvedGroups || {})) {
        stmts.insertGroup.run(name, JSON.stringify(value));
      }
      for (const n of raw.notes || []) {
        const note = typeof n === "string" ? n : n?.note;
        if (note) stmts.insertNote.run(note, n?.ts ?? now);
      }
    } catch (err) {
      logger.error({ err: err.message, file: factsFile }, "[Memory] Failed to migrate facts JSON");
    }
  }

  if (hasSessions) {
    try {
      const raw = JSON.parse(fs.readFileSync(sessionsFile, "utf-8"));
      for (const [id, v] of Object.entries(raw)) {
        // backward-compat: old format was a bare array of messages
        const entry = Array.isArray(v) ? { messages: v } : v;
        // Bump lastActiveAt: legacy sessions can be older than
        // sessionIdleTtlMs and would be pruned on this same boot.
        db
          .prepare("INSERT OR IGNORE INTO sessions (id, messages, last_active_at) VALUES (?, ?, ?)")
          .run(id, JSON.stringify(entry.messages || []), now);
      }
    } catch (err) {
      logger.error({ err: err.message, file: sessionsFile }, "[Memory] Failed to migrate sessions JSON");
    }
  }

  for (const file of [hasFacts && factsFile, hasSessions && sessionsFile].filter(Boolean)) {
    try {
      fs.renameSync(file, `${file}.migrated`); // originals kept as backup
    } catch (err) {
      logger.warn({ err: err.message, file }, "[Memory] Could not rename migrated JSON file");
    }
  }

  logger.info({ dbFile }, "[Memory] Migrated legacy JSON memory store to SQLite");
  return true;
}
