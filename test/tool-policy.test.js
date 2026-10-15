// /test/tool-policy.test.js
// Offline unit tests for the request-scoped tool access policy
// (api/tool-policy.js). No network access — importing api/tool-policy.js
// pulls in tools/descriptions.js (whose boot validation must pass) and
// api/registry.js (provider registration only, no calls are made).

import test from "node:test";
import assert from "node:assert/strict";

import { resolveToolPolicy } from "../api/tool-policy.js";
import { wazuhToolDefinitions } from "../tools/descriptions.js";

const DESTRUCTIVE_TOOLS = wazuhToolDefinitions
    .filter((def) => def.destructive)
    .map((def) => def.name);

const WRITE_TOOLS = wazuhToolDefinitions
    .filter((def) => def.access === "write")
    .map((def) => def.name);

const READ_TOOLS = wazuhToolDefinitions
    .filter((def) => def.access === "read")
    .map((def) => def.name);

test("every tool definition declares a valid access level and a handler", () => {
    for (const def of wazuhToolDefinitions) {
        assert.ok(
            ["read", "write", "action"].includes(def.access),
            `tool '${def.name}' has invalid access: ${def.access}`
        );
    }
    // Boot validation in tools/descriptions.js already enforced this — reaching
    // this line means the import did not throw.
});

test("default policy is full mode with destructive tools hidden", () => {
    const policy = resolveToolPolicy({});

    assert.equal(policy.mode, "full");
    assert.equal(policy.allowDestructive, false);

    const names = policy.toolDefinitions.map((def) => def.name);
    for (const name of READ_TOOLS) {
        assert.ok(names.includes(name), `read tool '${name}' must be visible`);
    }
    for (const name of WRITE_TOOLS) {
        assert.ok(names.includes(name), `write tool '${name}' must be visible in full mode`);
    }
    for (const name of DESTRUCTIVE_TOOLS) {
        assert.ok(!names.includes(name), `destructive tool '${name}' must be hidden by default`);
        assert.ok(!(name in policy.toolHandlers), `destructive tool '${name}' must be uncallable`);
    }
});

test("full mode with allowDestructive exposes everything, defs and handlers in sync", () => {
    const policy = resolveToolPolicy({ mode: "full", allowDestructive: true });

    assert.equal(policy.mode, "full");
    assert.equal(policy.allowDestructive, true);
    assert.equal(policy.blockedTools.length, 0);
    assert.equal(policy.toolDefinitions.length, wazuhToolDefinitions.length);

    const handlerNames = Object.keys(policy.toolHandlers);
    for (const def of policy.toolDefinitions) {
        assert.ok(
            handlerNames.includes(def.name),
            `definition '${def.name}' has no matching handler`
        );
    }
    assert.equal(handlerNames.length, policy.toolDefinitions.length);
});

test("read-only mode exposes only read tools", () => {
    const policy = resolveToolPolicy({ mode: "read-only" });

    assert.equal(policy.mode, "read-only");
    assert.equal(policy.allowDestructive, false);

    const names = policy.toolDefinitions.map((def) => def.name);
    assert.equal(names.length, READ_TOOLS.length);
    for (const name of WRITE_TOOLS) {
        assert.ok(!names.includes(name), `write tool '${name}' must be hidden in read-only mode`);
        assert.ok(!(name in policy.toolHandlers), `write tool '${name}' must be uncallable`);
    }
    for (const name of DESTRUCTIVE_TOOLS) {
        assert.ok(!names.includes(name), `destructive tool '${name}' must be hidden`);
        assert.ok(!(name in policy.toolHandlers), `destructive tool '${name}' must be uncallable`);
    }
});

test("allowDestructive is ignored in read-only mode", () => {
    const policy = resolveToolPolicy({ mode: "read-only", allowDestructive: true });

    assert.equal(policy.mode, "read-only");
    assert.equal(policy.allowDestructive, false);
    const names = policy.toolDefinitions.map((def) => def.name);
    for (const name of DESTRUCTIVE_TOOLS) {
        assert.ok(!names.includes(name));
    }
});

test("invalid mode is rejected", () => {
    assert.throws(() => resolveToolPolicy({ mode: "sudo" }), /Invalid tool policy mode/);
});

test("AGENT_MODE=read-only acts as a ceiling", () => {
    const previous = process.env.AGENT_MODE;
    process.env.AGENT_MODE = "read-only";
    try {
        // No explicit mode → deployment default applies.
        assert.equal(resolveToolPolicy({}).mode, "read-only");

        // Requests may not widen the deployment policy back to full.
        assert.throws(
            () => resolveToolPolicy({ mode: "full" }),
            /locked to 'read-only'/
        );

        // Narrowing is always allowed.
        const policy = resolveToolPolicy({ mode: "read-only" });
        assert.equal(policy.mode, "read-only");
    } finally {
        if (previous === undefined) {
            delete process.env.AGENT_MODE;
        } else {
            process.env.AGENT_MODE = previous;
        }
    }
});
