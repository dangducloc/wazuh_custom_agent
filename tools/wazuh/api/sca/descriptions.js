// /tools/wazuh/api/sca/descriptions.js
//
// Wazuh SCA (Security Configuration Assessment) tool definitions.
// Each entry describes a callable tool: its name, a natural-language description
// for the model, the JSON Schema for its input, plus a handler that dispatches
// to the implementation in `sca-tools.js`.
//
// Schema key convention: the model client (`model/cloudflare-ai.js`) reads
// `def.input_schema` when building the tool payload — NOT `parameters`. The
// older modules under `api/agent` and `api/groups` still use `parameters`,
// which makes their schemas invisible to the model. Follow `input_schema`,
// like the `rules`, `mitre`, and `opensearch/*` descriptions do.
//
// Failure contract: the implementations in `sca-tools.js` THROW on transport /
// non-200 failures (unlike the null/false contract of the agent/groups modules).
// The agent loop catches those throws and surfaces them back to the model as
// `{ "error": <message> }` tool results.

import {
    listAgentScaPolicies,
    listPolicyChecks,
    listFailedPolicyChecks,
} from "./sca-tools.js";

// Wazuh agent id: 0-padded three-digit string ("000".."999").
const AGENT_ID_PATTERN = "^[0-9]{3}$";

export const toolDefinitions = [
    {
        name: "get_sca_policies",
        description:
            "Retrieve the list of SCA (Security Configuration Assessment) policies applied to a " +
            "specific Wazuh agent. Each policy has an id such as `cis_ubuntu22-04` or a custom name, " +
            "a description, the scan result summary (pass/fail totals and score), and references to " +
            "the compliance standards it covers. Use this to discover the `policy_id` values needed " +
            "by `get_sca_policy_checks`.",
        input_schema: {
            type: "object",
            properties: {
                agent_id: {
                    type: "string",
                    pattern: AGENT_ID_PATTERN,
                    description:
                        "Target agent id, 3-digit zero-padded string. Obtain real-agent ids from `get_agent_list`.",
                },
            },
            required: ["agent_id"],
            additionalProperties: false,
        },
    },
    {
        name: "get_sca_policy_checks",
        description:
            "Retrieve the individual SCA checks/results for a given policy on a given agent. " +
            "Returns the full list of checks with their `result` (`passed`, `failed`, `not applicable`, " +
            "or `unknown`), `rationale`, `remediation`, and any references to compliance standards. " +
            "Optionally filter by `result`; combine with the `q`/`search` params for precise queries. " +
            "Use this to drill into which checks failed after reading a policy summary.",
        input_schema: {
            type: "object",
            properties: {
                agent_id: {
                    type: "string",
                    pattern: AGENT_ID_PATTERN,
                    description:
                        "Target agent id, 3-digit zero-padded string.",
                },
                policy_id: {
                    type: "string",
                    description:
                        "SCA policy id (e.g. `cis_ubuntu22-04`). Obtain valid ids from `get_sca_policies`.",
                },
                result: {
                    type: "string",
                    enum: ["passed", "failed", "not applicable", "unknown"],
                    description:
                        "Filter checks by their result (default: all).",
                },
                q: {
                    type: "string",
                    description:
                        "Wazuh query-language filter over the check fields.",
                },
                search: {
                    type: "string",
                    description:
                        "Free-text search across check fields (e.g. a check title fragment).",
                },
            },
            required: ["agent_id", "policy_id"],
            additionalProperties: false,
        },
    },
    {
        name: "get_sca_failed_checks",
        description:
            "Convenience wrapper that returns only the FAILED checks for a given SCA policy on an " +
            "agent. Equivalent to calling `get_sca_policy_checks` with `result` set to `failed`. " +
            "Use this to jump straight to the actionable items when triaging compliance gaps.",
        input_schema: {
            type: "object",
            properties: {
                agent_id: {
                    type: "string",
                    pattern: AGENT_ID_PATTERN,
                    description:
                        "Target agent id, 3-digit zero-padded string.",
                },
                policy_id: {
                    type: "string",
                    description:
                        "SCA policy id (e.g. `cis_ubuntu22-04`). Obtain valid ids from `get_sca_policies`.",
                },
            },
            required: ["agent_id", "policy_id"],
            additionalProperties: false,
        },
    },
];

export const toolHandlers = {
    get_sca_policies: ({ agent_id }) => listAgentScaPolicies(agent_id),
    get_sca_policy_checks: ({ agent_id, policy_id, result, q, search } = {}) =>
        listPolicyChecks(agent_id, policy_id, {
            ...(result && { result }),
            ...(q && { q }),
            ...(search && { search }),
        }),
    get_sca_failed_checks: ({ agent_id, policy_id }) =>
        listFailedPolicyChecks(agent_id, policy_id),
};