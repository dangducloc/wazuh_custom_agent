// memory/recall.js
// Recall routing: decides whether related facts need to be "recalled" into
// the context (using regex first, cheap, avoiding always stuffing all facts
// into the prompt), and builds the final messages[] to send to the model.
import { logger } from "../utils/index.js";
import { matchesRecall } from "./helper.js";

// Extracts alert_id / rule_id from the message for direct lookup,
// no vector search needed since the data has a clear structure.
export function searchFacts(stmts, userMessage) {
  const alertIdMatch = userMessage.match(/alert[_\s-]?id\s*[:=]?\s*(\S+)/i);
  const ruleIdMatch = userMessage.match(/rule[_\s-]?id\s*[:=]?\s*(\S+)/i);

  const result = {};
  if (alertIdMatch) {
    const id = alertIdMatch[1].replace(/[",.]$/, "");
    const row = stmts.getAlert.get(id);
    result.alert = row ? { id: row.alert_id, ruleId: row.rule_id, action: row.action, ts: row.ts } : null;
  }
  if (ruleIdMatch) {
    const ruleId = ruleIdMatch[1].replace(/[",.]$/, "");
    result.matchingAlerts = stmts.getAlertsByRule.all(ruleId)
      .map((row) => ({ id: row.alert_id, ruleId: row.rule_id, action: row.action, ts: row.ts }));
  }
  if (!alertIdMatch && !ruleIdMatch && stmts.countNotes.get().c) {
    result.recentNotes = stmts.recentNotes.all(5).reverse();
  }
  return result;
}

// Builds the messages[] for the model from the facade's public API
// (needsRecall / searchFacts / getHistory).
export function buildContext(memory, sessionId, systemPrompt, userMessage) {
  const messages = [{ role: "system", content: systemPrompt }];

  if (memory.needsRecall(userMessage)) {
    const facts = memory.searchFacts(userMessage);
    if (Object.keys(facts).length) {
      messages.push({
        role: "system",
        content: `[Related memory]: ${JSON.stringify(facts)}`,
      });
      logger.info({ sessionId, facts }, "[Memory] Injected recalled facts");
    }
  }

  messages.push(...memory.getHistory(sessionId));
  messages.push({ role: "user", content: userMessage });
  return messages;
}
