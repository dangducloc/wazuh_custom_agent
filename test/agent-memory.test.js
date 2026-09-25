// test/agent-memory.test.js
// Smoke test: verify the AgentMemory module can be imported and called.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import os from "os";
import path from "path";
import fs from "fs/promises";
import { AgentMemory } from "../memory/agent-memory.js";

describe("AgentMemory", () => {
  it("should handle short-term history, long-term facts, and recall", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "agent-mem-test-"));
    const memory = new AgentMemory({
      factsFile: path.join(dir, "facts.json"),
      sessionsFile: path.join(dir, "sessions.json"),
      saveDebounceMs: 10,
    });

    // Short-term: session history
    await memory.addTurn("s1", "user", "hello");
    await memory.addTurn("s1", "assistant", "hi there");
    const history = memory.getHistory("s1");
    assert.equal(history.length, 2);
    assert.equal(history[0].role, "user");

    // Long-term: remember / recall alert
    memory.rememberAlert("alert-123", { ruleId: "5710", action: "notified" });
    assert.ok(memory.hasSeenAlert("alert-123"));
    assert.ok(!memory.hasSeenAlert("alert-999"));

    // Notes
    memory.addNote("SSH brute-force spike from 10.0.0.5");

    // Recall routing
    assert.ok(memory.needsRecall("have we seen alert_id=alert-123 before?"));
    assert.ok(!memory.needsRecall("show me all agents"));

    // Fact search + context building
    const found = memory.searchFacts("what happened with alert_id=alert-123");
    assert.equal(found.alert.ruleId, "5710");

    const messages = memory.buildContext("s1", "You are a SOC assistant.", "have we seen alert_id=alert-123 before?");
    assert.equal(messages[0].role, "system");
    assert.ok(messages.some((m) => m.content.includes("Related memory")));
    assert.equal(messages.at(-1).role, "user");

    // Persist + reload
    await memory.flush();
    const reloaded = new AgentMemory({
      factsFile: path.join(dir, "facts.json"),
      sessionsFile: path.join(dir, "sessions.json"),
    });
    assert.ok(reloaded.hasSeenAlert("alert-123"));
    assert.equal(reloaded.getHistory("s1").length, 2);

    await fs.rm(dir, { recursive: true, force: true });
  });
});
