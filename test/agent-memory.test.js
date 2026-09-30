// test/agent-memory.test.js
// Offline unit tests for the SQLite-backed AgentMemory module.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import os from "os";
import path from "path";
import fs from "fs/promises";
import { AgentMemory } from "../memory/index.js";

async function makeTempDir() {
  return fs.mkdtemp(path.join(os.tmpdir(), "agent-mem-test-"));
}

describe("AgentMemory", () => {
  it("should handle short-term history, long-term facts, and recall", async () => {
    const dir = await makeTempDir();
    const memory = new AgentMemory({
      factsFile: path.join(dir, "facts.json"),
      sessionsFile: path.join(dir, "sessions.json"),
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

    // Persist + reload (writes are committed immediately; flush checkpoints)
    await memory.flush();
    const reloaded = new AgentMemory({
      factsFile: path.join(dir, "facts.json"),
      sessionsFile: path.join(dir, "sessions.json"),
    });
    assert.ok(reloaded.hasSeenAlert("alert-123"));
    assert.equal(reloaded.getHistory("s1").length, 2);

    memory.close();
    reloaded.close();
    await fs.rm(dir, { recursive: true, force: true });
  });

  it("should migrate a legacy JSON memory store on first boot", async () => {
    const dir = await makeTempDir();
    const facts = {
      seenAlerts: { "alert-legacy-1": { ruleId: "5710", action: "blocked-ip", ts: Date.now() } },
      resolvedGroups: { "grp-1": { foo: "bar" } },
      notes: [{ note: "legacy note", ts: Date.now() }],
    };
    const oldTs = Date.now() - 100 * 24 * 60 * 60 * 1000;
    const sessions = {
      s1: { messages: [{ role: "user", content: "hi" }], lastActiveAt: Date.now() },
      s2: [{ role: "user", content: "bare array format" }],
      s3: { messages: [{ role: "user", content: "old session" }], lastActiveAt: oldTs },
    };
    await fs.writeFile(path.join(dir, "facts.json"), JSON.stringify(facts));
    await fs.writeFile(path.join(dir, "sessions.json"), JSON.stringify(sessions));

    const memory = new AgentMemory({
      factsFile: path.join(dir, "facts.json"),
      sessionsFile: path.join(dir, "sessions.json"),
    });
    assert.ok(memory.hasSeenAlert("alert-legacy-1"));
    assert.equal(memory.getHistory("s1").length, 1);
    assert.equal(memory.getHistory("s2").length, 1);
    // Stale sessions survive: lastActiveAt is bumped to migration time so the
    // boot-time TTL prune cannot wipe freshly migrated history.
    assert.equal(memory.getHistory("s3").length, 1);

    const recentNotes = memory.searchFacts("random message").recentNotes;
    assert.equal(recentNotes.length, 1);
    assert.equal(recentNotes[0].note, "legacy note");

    // One-time: legacy JSON files are renamed after successful migration
    await assert.rejects(() => fs.access(path.join(dir, "facts.json")));
    await assert.rejects(() => fs.access(path.join(dir, "sessions.json")));
    await fs.access(path.join(dir, "facts.json.migrated"));
    await fs.access(path.join(dir, "sessions.json.migrated"));

    memory.close();
    await fs.rm(dir, { recursive: true, force: true });
  });

  it("should prune expired alerts, notes, and idle sessions", async () => {
    const dir = await makeTempDir();
    const memory = new AgentMemory({
      factsFile: path.join(dir, "facts.json"),
      sessionsFile: path.join(dir, "sessions.json"),
    });
    memory.rememberAlert("alert-old", { ruleId: "1", action: "x" });
    memory.addNote("old note");
    await memory.addTurn("s-old", "user", "hello");

    // Backdate rows directly in the SQLite store
    const Database = (await import("better-sqlite3")).default;
    const db = new Database(memory.dbFile);
    const old = Date.now() - 100 * 24 * 60 * 60 * 1000;
    db.prepare("UPDATE seen_alerts SET ts = ?").run(old);
    db.prepare("UPDATE notes SET ts = ?").run(old);
    db.prepare("UPDATE sessions SET last_active_at = ?").run(old);
    db.close();

    // Boot a fresh instance -> constructor prunes expired rows
    const reloaded = new AgentMemory({
      factsFile: path.join(dir, "facts.json"),
      sessionsFile: path.join(dir, "sessions.json"),
    });
    assert.ok(!reloaded.hasSeenAlert("alert-old"));
    assert.equal(reloaded.searchFacts("random message").recentNotes, undefined);
    assert.ok(!reloaded.listSessions().includes("s-old"));

    memory.close();
    reloaded.close();
    await fs.rm(dir, { recursive: true, force: true });
  });

  it("should trim history and summarize dropped turns", async () => {
    const dir = await makeTempDir();
    const memory = new AgentMemory({
      factsFile: path.join(dir, "facts.json"),
      sessionsFile: path.join(dir, "sessions.json"),
      maxHistoryMessages: 3,
    });

    await memory.addTurn("s1", "user", "hello");
    await memory.addTurn("s1", "assistant", "hi");
    await memory.addTurn("s1", "user", "how are you");
    await memory.addTurn("s1", "assistant", "fine");

    const history = memory.getHistory("s1");
    // Preserved behavior: trim to maxHistoryMessages, then unshift a summary
    // on top -> final length is maxHistoryMessages + 1.
    assert.equal(history.length, 4);
    assert.equal(history[0].role, "system");
    assert.ok(history[0].content.includes("[Previous conversation summary]"));
    assert.ok(history[0].content.includes("user: hello"));
    assert.equal(history.at(-1).content, "fine");
    assert.deepEqual(history.slice(1).map((m) => m.content), ["hi", "how are you", "fine"]);

    memory.close();
    await fs.rm(dir, { recursive: true, force: true });
  });

  it("should enforce the session cap and drop the oldest sessions", async () => {
    const dir = await makeTempDir();
    const memory = new AgentMemory({
      factsFile: path.join(dir, "facts.json"),
      sessionsFile: path.join(dir, "sessions.json"),
      maxSessions: 2,
    });

    await memory.addTurn("s1", "user", "one");
    await memory.addTurn("s2", "user", "two");
    await memory.addTurn("s3", "user", "three");

    assert.deepEqual(memory.listSessions().sort(), ["s2", "s3"]);

    memory.close();
    await fs.rm(dir, { recursive: true, force: true });
  });

  it("should match rule ids and return recent notes in searchFacts", async () => {
    const dir = await makeTempDir();
    const memory = new AgentMemory({
      factsFile: path.join(dir, "facts.json"),
      sessionsFile: path.join(dir, "sessions.json"),
    });

    memory.rememberAlert("alert-a", { ruleId: "5710", action: "blocked-ip" });
    memory.rememberAlert("alert-b", { ruleId: "5710", action: "notified" });
    memory.rememberAlert("alert-c", { ruleId: "87105", action: "x" });

    const byRule = memory.searchFacts("which rule_id=5710 did we use");
    assert.equal(byRule.matchingAlerts.length, 2);
    assert.ok(byRule.matchingAlerts.some((a) => a.id === "alert-a"));

    memory.addNote("note one");
    memory.addNote("note two");
    const recent = memory.searchFacts("anything else").recentNotes;
    assert.equal(recent.length, 2);
    assert.equal(recent.at(-1).note, "note two");

    const miss = memory.searchFacts("what happened with alert_id=alert-missing");
    assert.equal(miss.alert, null);

    memory.close();
    await fs.rm(dir, { recursive: true, force: true });
  });
});
