// memory/facts.js
// Long-term store: key-value facts (seen_alerts, resolved_groups, notes
// tables) with TTL/size pruning.
export class FactsStore {
  constructor({
    db,
    stmts,
    alertTtlMs = 30 * 24 * 60 * 60 * 1000,   // keep seenAlerts 30 days
    noteTtlMs = 90 * 24 * 60 * 60 * 1000,    // keep notes 90 days
    maxNotes = 500,
  }) {
    this.db = db;
    this.stmts = stmts;
    this.alertTtlMs = alertTtlMs;
    this.noteTtlMs = noteTtlMs;
    this.maxNotes = maxNotes;
  }

  rememberAlert(alertId, { ruleId, action } = {}) {
    this.stmts.upsertAlert.run(alertId, ruleId ?? null, action ?? null, Date.now());
  }

  hasSeenAlert(alertId) {
    return !!this.stmts.hasAlert.get(alertId);
  }

  forgetAlert(alertId) {
    this.stmts.deleteAlert.run(alertId);
  }

  addNote(note) {
    this.stmts.insertNote.run(note, Date.now());
    this.stmts.trimNotes.run(this.maxNotes);
  }

  /** Drop alerts/notes past their TTL. Part of boot-time pruning. */
  prune() {
    const now = Date.now();
    this.stmts.deleteExpiredAlerts.run(now - this.alertTtlMs);
    this.stmts.deleteExpiredNotes.run(now - this.noteTtlMs);
  }
}
