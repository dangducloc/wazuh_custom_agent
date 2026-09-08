// /tools/wazuh/api/syscheck/descriptions.js
//
// Wazuh syscheck (FIM — File Integrity Monitoring) tool definitions.
// Each entry describes a callable tool: its name, a natural-language description
// for the model, the JSON Schema for its input, plus a handler that dispatches
// to the implementation in `syscheck-tools.js`.
//
// Schema key convention: the model client (`model/cloudflare-ai.js`) reads
// `def.input_schema` when building the tool payload — NOT `parameters`. The
// older modules under `api/agent` and `api/groups` still use `parameters`,
// which makes their schemas invisible to the model. Follow `input_schema`,
// like the `rules`, `mitre`, and `opensearch/*` descriptions do.
//
// Failure contract: the implementations in `syscheck-tools.js` THROW on
// transport / non-200 failures (unlike the null/false contract of the
// agent/groups modules). The agent loop catches those throws and surfaces
// them back to the model as `{ "error": <message> }` tool results.

import {
    runSyscheckScan,
    getSyscheckResults,
    getSyscheckSummary,
    clearSyscheckResults,
    getSyscheckLastScan,
} from "./syscheck-tools.js";

// Wazuh agent id: 0-padded three-digit string ("000".."999").
const AGENT_ID_PATTERN = "^[0-9]{3}$";

export const toolDefinitions = [
    {
        name: "trigger_syscheck_scan",
        description:
            "Trigger a syscheck (FIM) scan on one or more agents. Omit `agent_ids` (or pass an empty " +
            "array) to run the scan on ALL enrolled agents. Returns the scan request metadata including " +
            "the number of affected agents. Note: this initiates the scan asynchronously — use " +
            "`get_syscheck_results` / `get_syscheck_summary` to read findings afterwards.",
        input_schema: {
            type: "object",
            properties: {
                agent_ids: {
                    type: "array",
                    items: { type: "string", pattern: AGENT_ID_PATTERN },
                    description:
                        "Agent ids (3-digit zero-padded) to scan. Omit or pass an empty array to scan ALL agents.",
                },
            },
            additionalProperties: false,
        },
    },
    {
        name: "get_syscheck_results",
        description:
            "Retrieve the syscheck (FIM) database entries for a given agent — added, modified, and removed " +
            "files/directories with their attributes (path, size, permissions, owner, hashes, event type). " +
            "Use to investigate what changed on a host. Optionally filter with Wazuh query params.",
        input_schema: {
            type: "object",
            properties: {
                agent_id: {
                    type: "string",
                    pattern: AGENT_ID_PATTERN,
                    description:
                        "Target agent id, 3-digit zero-padded string.",
                },
                q: {
                    type: "string",
                    description:
                        "Wazuh query-language filter, e.g. `type=modified;file=/etc/passwd`.",
                },
                search: {
                    type: "string",
                    description:
                        "Free-text search across syscheck fields (e.g. a file path fragment).",
                },
            },
            required: ["agent_id"],
            additionalProperties: false,
        },
    },
    {
        name: "get_syscheck_summary",
        description:
            "Retrieve a summary of syscheck results for a given agent — aggregate counts of added, modified " +
            "and removed files, plus last-scan dates. Use instead of `get_syscheck_results` when you only " +
            "need totals. Supports optional `q`/`search` filters.",
        input_schema: {
            type: "object",
            properties: {
                agent_id: {
                    type: "string",
                    pattern: AGENT_ID_PATTERN,
                    description:
                        "Target agent id, 3-digit zero-padded string.",
                },
                q: {
                    type: "string",
                    description:
                        "Wazuh query-language filter for the summary.",
                },
                search: {
                    type: "string",
                    description: "Free-text search across summary fields.",
                },
            },
            required: ["agent_id"],
            additionalProperties: false,
        },
    },
    {
        name: "get_syscheck_last_scan",
        description:
            "Retrieve the timestamps (`start` / `end`) of the last completed syscheck scan for a given " +
            "agent. Use to determine how current the FIM data is before drawing conclusions from it.",
        input_schema: {
            type: "object",
            properties: {
                agent_id: {
                    type: "string",
                    pattern: AGENT_ID_PATTERN,
                    description:
                        "Target agent id, 3-digit zero-padded string.",
                },
            },
            required: ["agent_id"],
            additionalProperties: false,
        },
    },
    {
        name: "clear_syscheck_results",
        description:
            "Clear (delete) all syscheck FIM data for a given agent on the manager. This is destructive — " +
            "the agent's stored file-integrity history is removed (the next scan repopulates it). " +
            "Intended for legacy agents where the newer agent-db clean is unavailable. Confirm intent " +
            "before calling.",
        input_schema: {
            type: "object",
            properties: {
                agent_id: {
                    type: "string",
                    pattern: AGENT_ID_PATTERN,
                    description:
                        "Target agent id, 3-digit zero-padded string.",
                },
            },
            required: ["agent_id"],
            additionalProperties: false,
        },
    },
];

export const toolHandlers = {
    trigger_syscheck_scan: ({ agent_ids = [] } = {}) =>
        runSyscheckScan(agent_ids),
    get_syscheck_results: ({ agent_id, q, search } = {}) =>
        getSyscheckResults(agent_id, {
            ...(q && { q }),
            ...(search && { search }),
        }),
    get_syscheck_summary: ({ agent_id, q, search } = {}) =>
        getSyscheckSummary(agent_id, {
            ...(q && { q }),
            ...(search && { search }),
        }),
    get_syscheck_last_scan: ({ agent_id }) => getSyscheckLastScan(agent_id),
    clear_syscheck_results: ({ agent_id }) => clearSyscheckResults(agent_id),
};