// /tools/wazuh/api/agent/descriptions.js
//
// Wazuh agent-related tool definitions.
// Each entry describes a callable tool: its name, a natural-language description
// for the model, the JSON Schema for its parameters, plus a handler that
// dispatches to the implementation in `agent-tools.js` / `agent-config-tools.js`.

import { getAgentActiveConfig } from "./agent-config-tools.js";
import { getAgentList } from "./agent-tools.js";

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
                agentId: {
                    type: "string",
                    description:
                        "Target agent id. Use `000` for the manager. Obtain real-agent ids from `get_agent_list`.",
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
            required: ["agentId", "component", "configuration"],
            additionalProperties: false,
        },
    },
];

export const toolHandlers = {
    get_agent_list: () => getAgentList(),
    get_agent_active_config: ({ agentId, component, configuration }) =>
        getAgentActiveConfig(agentId, component, configuration),
};
