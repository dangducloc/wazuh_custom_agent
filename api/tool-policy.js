// /api/tool-policy.js
//
// Enforcement layer for the tool access policy that the system prompt can
// only describe in prose. The prompt ASKS the model to avoid destructive
// operations; this module makes blocked tools invisible AND uncallable:
//
//   - every tool definition declares `access: "read" | "write" | "action"`
//     (validated at boot in tools/descriptions.js); destructive tools also
//     declare `destructive: true`;
//   - a request runs in mode "read-only" (only `read` tools are exposed) or
//     "full" (read + write + action, with `destructive` tools additionally
//     hidden unless the caller explicitly passes `allowDestructive: true`);
//   - the deployment-wide default comes from AGENT_MODE (default "full") and
//     acts as a ceiling: requests may narrow it to "read-only" but can never
//     widen a read-only deployment back to "full".
//
// Both the tool definitions sent to the model and the registered handlers
// are filtered with the same allowed set, so a blocked tool fails cleanly
// ("Tool 'x' is not registered") even if the model hallucinates its name.

import { wazuhToolDefinitions } from "../tools/descriptions.js";
import { guardedHandlers } from "./registry.js";
import { logger } from "../utils/index.js";

const MODES = ["read-only", "full"];

// Deployment-wide ceiling, evaluated per call so tests can toggle AGENT_MODE.
const envMode = () => (process.env.AGENT_MODE === "read-only" ? "read-only" : "full");

export function resolveToolPolicy({ mode, allowDestructive = false } = {}) {
    if (mode !== undefined && !MODES.includes(mode)) {
        throw new Error(
            `Invalid tool policy mode '${mode}'. Use one of: ${MODES.join(", ")}.`
        );
    }
    if (mode === "full" && envMode() === "read-only") {
        throw new Error(
            "Request mode 'full' rejected: this deployment is locked to 'read-only' (AGENT_MODE)."
        );
    }

    const effectiveMode = mode ?? envMode();
    const destructiveAllowed = effectiveMode === "full" && allowDestructive === true;

    const toolDefinitions = wazuhToolDefinitions.filter(
        (def) =>
            def.access === "read" ||
            (effectiveMode === "full" && (!def.destructive || destructiveAllowed))
    );

    const allowedNames = new Set(toolDefinitions.map((def) => def.name));
    const blockedTools = wazuhToolDefinitions
        .map((def) => def.name)
        .filter((name) => !allowedNames.has(name));

    // Handlers are the already summarizeIfLarge-wrapped `guardedHandlers`;
    // filter them with the same allowed set (also drops orphan handlers that
    // have no matching definition).
    const toolHandlers = Object.fromEntries(
        Object.entries(guardedHandlers).filter(([name]) => allowedNames.has(name))
    );

    if (blockedTools.length) {
        logger.info(
            { mode: effectiveMode, blockedTools },
            "[ToolPolicy] tools hidden from the model for this request"
        );
    }

    return {
        mode: effectiveMode,
        allowDestructive: destructiveAllowed,
        toolDefinitions,
        toolHandlers,
        blockedTools,
    };
}
