// test/chat-memory.test.js
// End-to-end: seed a fact into memory, then ask the chat if it recalls it.
// Requires a working model gateway (Cloudflare/NVIDIA) from .env.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { chat } from "../api/chat.js";
import { agentMemory } from "../memory/agent-memory.js";

describe("chat memory recall", () => {
  it("should recall a previously remembered alert", async () => {
    const sessionId = `recall-test-${Date.now()}`;
    const markerAlertId = "recall-test-alert-42";
    const markerRuleId = "999999";

    // Seed long-term memory directly (as the agent would after handling an alert)
    agentMemory.rememberAlert(markerAlertId, { ruleId: markerRuleId, action: "blocked-ip" });
    await agentMemory.flush();

    try {
      const reply = await chat(
        "Have we seen alert_id=recall-test-alert-42 before? What rule was it and what action did we take?",
        sessionId
      );
      console.log("Model reply:", reply);

      assert.ok(typeof reply === "string" && reply.length > 0, "chat should return a reply");
      // The injected memory contains ruleId/action — the model should relay them
      assert.ok(
        reply.includes(markerRuleId) || /blocked-ip/i.test(reply),
        `reply should reference the remembered alert, got: ${reply}`
      );
    } finally {
      // Clean up test artifacts
      agentMemory.forgetAlert(markerAlertId);
      agentMemory.deleteSession(sessionId);
      await agentMemory.flush();
    }
  });
});
