// /tools/wazuh/api/agent/descriptions.js
//
// Wazuh agent-related tool definitions.
// Each entry describes a callable tool: its name, a natural-language description
// for the model, the JSON Schema for its parameters, plus a handler that
// dispatches to the implementation in `agent-tools.js` / `agent-config-tools.js`.
//
// Parameter naming convention: snake_case throughout, matching the Wazuh REST
// API and the rest of this repo's tooling. The model defaults to snake_case
// for Wazuh-style calls; mismatched casing silently produces `undefined` in
// destructuring and turns every request into a request for
// `/agents/undefined/group/undefined`.
//
// Failure contract: most handlers return `null` (read) or `false` (write) on
// transport / non-200 failures. Surface that to the model instead of letting
// it infer success from the absence of an exception.

import { getAgentActiveConfig } from "./agent-config-tools.js";
import {
    getAgentList,
    getAgentById,
    assignAgentToGroup,
    removeAgentFromGroups,
} from "./agent-tools.js";

/**
 * Valid Wazuh agent configuration components.
 * Mirrors `AGENT_CONFIG_COMPONENT_MAP` in `utils/helper/isValidAgentConfig.js`.
 * Some components only exist on the manager (agent 000) or on real agents;
 * `isValidAgentConfig` enforces this at runtime.
 */
const AGENT_CONFIG_COMPONENTS = [
    "agent",
    "agentless",
    "analysis", // manager-only
    "auth", // manager-only
    "com",
    "csyslog", // agent-only
    "integrator", // agent-only
    "logcollector",
    "mail", // manager-only
    "monitor", // manager-only
    "request", // manager-only
    "syscheck",
    "wazuh-db",
    "wmodules",
];

// Wazuh agent id: 0-padded three-digit string ("000".."999"). "000" is the
// manager itself, which cannot be a group member — see per-tool descriptions.
const AGENT_ID_PATTERN = "^[0-9]{3}$";

// Wazuh group_id naming rule: 1–128 chars, `[A-Za-z0-9._-]`. Mirrors the
// constant in `groups/descriptions.js`.
const GROUP_ID_PATTERN = "^[A-Za-z0-9._-]{1,128}$";

export const toolDefinitions = [
    {
        name: "get_agent_list",
        description:
            "Retrieve the full list of Wazuh agents enrolled in the manager. " +
            "Returns each agent's id, name, ip, status (active / disconnected / never-connected / pending), " +
            "operating system, version, last keepalive, and group memberships. " +
            "Use this to discover agent ids before calling other agent-specific tools.",
        parameters: {
            type: "object",
            properties: {},
            additionalProperties: false,
        },
    },
    {
        name: "get_agent_by_id",
        description:
            "Retrieve a single Wazuh agent by its id. " +
            "Returns the same shape of object as one entry in `get_agent_list` (id, name, ip, status, " +
            "os, version, last keepalive, group list). Use this when you already know the agent id and want " +
            "to avoid pulling the full list. Returns `null` on transport / non-200 failures or if the id is unknown.",
        parameters: {
            type: "object",
            properties: {
                agent_id: {
                    type: "string",
                    pattern: AGENT_ID_PATTERN,
                    description:
                        "Target agent id, 3-digit zero-padded string. " +
                        "`000` is the manager itself; real agents start at `001`. " +
                        "Obtain real-agent ids from `get_agent_list`.",
                },
            },
            required: ["agent_id"],
            additionalProperties: false,
        },
    },
    {
        name: "get_agent_active_config",
        description:
            "Retrieve the active (currently loaded) configuration block for a given " +
            "`component`/`configuration` pair on a specific Wazuh agent. " +
            "Examples of valid combinations: `agent/client`, `logcollector/localfile`, `syscheck/syscheck`, " +
            "`wmodules/wmodules`. Note: `analysis`, `monitor`, `request`, `mail`, `auth` exist only on the manager " +
            "(agent id `000`); `agent`, `agentless`, `csyslog`, `integrator` exist only on real agents. " +
            "Returns the parsed configuration object, or `null` if the combination is invalid or the request fails.",
        parameters: {
            type: "object",
            properties: {
                agent_id: {
                    type: "string",
                    pattern: AGENT_ID_PATTERN,
                    description:
                        "Target agent id. Use `000` to read manager-side config blocks; use a real agent id " +
                        "for agent-side blocks. Obtain real-agent ids from `get_agent_list`.",
                },
                component: {
                    type: "string",
                    enum: AGENT_CONFIG_COMPONENTS,
                    description:
                        "Wazuh configuration component (top-level daemons/modules). " +
                        "Must be paired with a `configuration` valid for that component.",
                },
                configuration: {
                    type: "string",
                    description:
                        "Subsystem within `component`, e.g. `client` for `agent`, `localfile` for `logcollector`, " +
                        "`syscheck` for `syscheck`. Only combinations defined in the Wazuh API are accepted.",
                },
            },
            required: ["agent_id", "component", "configuration"],
            additionalProperties: false,
        },
    },
    {
        name: "assign_agent_to_group",
        description:
            "Assign a single Wazuh agent to a single agent group. " +
            "Pre-conditions, in order: (1) `agent_id` must be a real agent id — NOT `000`. The Wazuh manager " +
            "(`000`) cannot be assigned to groups and the API will reject this call. " +
            "(2) `group_id` must already exist on the manager — use `get_group_list` to check, " +
            "`create_group` (with `tools/wazuh/api/groups/descriptions.js`) to create. " +
            "Returns `true` on success, `false` on any failure (auth, validation, group not found, etc.). " +
            "Calling this for an agent already in the group is a no-op success. " +
            "To assign an agent to multiple groups, call this tool once per group.",
        parameters: {
            type: "object",
            properties: {
                agent_id: {
                    type: "string",
                    pattern: AGENT_ID_PATTERN,
                    description:
                        "Target agent id (3-digit, zero-padded). Must be a real agent id, NOT `000` (the manager " +
                        "is not assigned to groups).",
                },
                group_id: {
                    type: "string",
                    pattern: GROUP_ID_PATTERN,
                    description:
                        "Id of the target group. Must already exist on the manager — verify with `get_group_list` " +
                        "and create with `create_group` if missing.",
                },
            },
            required: ["agent_id", "group_id"],
            additionalProperties: false,
        },
    },
    {
        name: "remove_agent_from_groups",
        description:
            "Remove a Wazuh agent from one or more agent groups. " +
            "Group ids are sent as a comma-separated list; pass an empty `group_ids` array to remove the agent " +
            "from every group it currently belongs to. The agent itself is NOT deleted — only its group " +
            "memberships are cleared. The underlying call uses `wait_for_complete=true`, so the response " +
            "reflects the final state. Returns `true` on success, `false` on failure. " +
            "Like `assign_agent_to_group`, do NOT target `agent_id` `000`.",
        parameters: {
            type: "object",
            properties: {
                agent_id: {
                    type: "string",
                    pattern: AGENT_ID_PATTERN,
                    description:
                        "Target agent id (3-digit, zero-padded). Must be a real agent id, NOT `000`.",
                },
                group_ids: {
                    type: "array",
                    items: {
                        type: "string",
                        pattern: GROUP_ID_PATTERN,
                    },
                    minItems: 0,
                    description:
                        "Array of group ids to remove the agent from. Each id must match " +
                        "`^[A-Za-z0-9._-]{1,128}$`. Pass an empty array to remove the agent from ALL groups " +
                        "it is currently in.",
                },
            },
            required: ["agent_id", "group_ids"],
            additionalProperties: false,
        },
    },
];

export const toolHandlers = {
    get_agent_list: () => getAgentList(),
    get_agent_by_id: ({ agent_id }) => getAgentById(agent_id),
    get_agent_active_config: ({ agent_id, component, configuration }) =>
        getAgentActiveConfig(agent_id, component, configuration),
    assign_agent_to_group: ({ agent_id, group_id }) =>
        assignAgentToGroup(agent_id, group_id),
    remove_agent_from_groups: ({ agent_id, group_ids }) =>
        removeAgentFromGroups(agent_id, group_ids),
};
