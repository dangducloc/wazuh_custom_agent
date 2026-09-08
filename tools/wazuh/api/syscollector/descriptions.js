// /tools/wazuh/api/syscollector/descriptions.js
//
// Wazuh syscollector tool definitions — hardware/software inventory gathered by
// the Wazuh agent (OS, hardware, packages, ports, processes, users, groups,
// network interfaces, services, etc.).
// Each entry describes a callable tool: its name, a natural-language description
// for the model, the JSON Schema for its input, plus a handler that dispatches
// to the implementation in `syscollector-tools.js`.
//
// Schema key convention: the model client (`model/cloudflare-ai.js`) reads
// `def.input_schema` when building the tool payload — NOT `parameters`. The
// older modules under `api/agent` and `api/groups` still use `parameters`,
// which makes their schemas invisible to the model. Follow `input_schema`,
// like the `rules`, `mitre`, and `opensearch/*` descriptions do.
//
// Failure contract: the implementations in `syscollector-tools.js` THROW on
// transport / non-200 failures (unlike the null/false contract of the
// agent/groups modules). The agent loop catches those throws and surfaces
// them back to the model as `{ "error": <message> }` tool results.

import {
    getAgentHotfixes,
    getAgentNetaddr,
    getAgentNetiface,
    getAgentNetproto,
    getAgentPackages,
    getAgentPorts,
    getAgentProcesses,
    getAgentUsers,
    getAgentGroups,
    getAgentBrowserExtensions,
    getAgentServices,
    getAgentHardware,
    getAgentOs,
    getAgentFullInventory,
} from "./syscollector-tools.js";

// Wazuh agent id: 0-padded three-digit string ("000".."999").
const AGENT_ID_PATTERN = "^[0-9]{3}$";

// Paginated resources: list endpoints that return arrays and support filters.
const paginatedResources = [
    { name: "get_syscollector_hotfixes", label: "installed OS hotfixes/patches", handler: getAgentHotfixes },
    { name: "get_syscollector_netaddr", label: "network IP addresses", handler: getAgentNetaddr },
    { name: "get_syscollector_netiface", label: "network interfaces", handler: getAgentNetiface },
    { name: "get_syscollector_netproto", label: "network protocols/interface stats", handler: getAgentNetproto },
    { name: "get_syscollector_packages", label: "installed software packages", handler: getAgentPackages },
    { name: "get_syscollector_ports", label: "open listening ports", handler: getAgentPorts },
    { name: "get_syscollector_processes", label: "running processes", handler: getAgentProcesses },
    { name: "get_syscollector_users", label: "local system users", handler: getAgentUsers },
    { name: "get_syscollector_groups", label: "local system groups", handler: getAgentGroups },
    { name: "get_syscollector_browser_extensions", label: "installed browser extensions", handler: getAgentBrowserExtensions },
    { name: "get_syscollector_services", label: "system services", handler: getAgentServices },
];

const paginatedDefinitions = paginatedResources.map(
    ({ name, label, handler }) => ({
        name,
        description:
            `Retrieve the ${label} collected from a given Wazuh agent (syscollector inventory). ` +
            "Returns an array of records; supports optional `q`/`search` filters. Use to inventory a host " +
            "during investigation or asset discovery.",
        input_schema: {
            type: "object",
            properties: {
                agent_id: {
                    type: "string",
                    pattern: AGENT_ID_PATTERN,
                    description: "Target agent id, 3-digit zero-padded string.",
                },
                q: {
                    type: "string",
                    description: "Wazuh query-language filter over the fields.",
                },
                search: {
                    type: "string",
                    description: "Free-text search across the fields.",
                },
            },
            required: ["agent_id"],
            additionalProperties: false,
        },
        __handler: handler,
    }),
);

export const toolDefinitions = [
    ...paginatedDefinitions.map(({ __handler, ...def }) => def),
    {
        name: "get_syscollector_hardware",
        description:
            "Retrieve the hardware inventory of a given Wazuh agent (CPU, RAM, serial number, board/vendor, " +
            "enclosure, etc.). Returns a single object (not a list). Use for asset identification.",
        input_schema: {
            type: "object",
            properties: {
                agent_id: {
                    type: "string",
                    pattern: AGENT_ID_PATTERN,
                    description: "Target agent id, 3-digit zero-padded string.",
                },
            },
            required: ["agent_id"],
            additionalProperties: false,
        },
    },
    {
        name: "get_syscollector_os",
        description:
            "Retrieve the operating-system inventory of a given Wazuh agent (kernel, distribution, version, " +
            "platform, hostname). Returns a single object (not a list). Use for OS/version asset identification.",
        input_schema: {
            type: "object",
            properties: {
                agent_id: {
                    type: "string",
                    pattern: AGENT_ID_PATTERN,
                    description: "Target agent id, 3-digit zero-padded string.",
                },
            },
            required: ["agent_id"],
            additionalProperties: false,
        },
    },
    {
        name: "get_syscollector_full_inventory",
        description:
            "Retrieve a consolidated inventory snapshot of a given Wazuh agent, bundling hardware, OS, " +
            "packages, ports, processes, and users in a single call. Use for a one-shot overview of a host " +
            "instead of issuing six separate syscollector requests.",
        input_schema: {
            type: "object",
            properties: {
                agent_id: {
                    type: "string",
                    pattern: AGENT_ID_PATTERN,
                    description: "Target agent id, 3-digit zero-padded string.",
                },
            },
            required: ["agent_id"],
            additionalProperties: false,
        },
    },
];

const paginatedHandlers = Object.fromEntries(
    paginatedDefinitions.map(({ name, __handler }) => [
        name,
        ({ agent_id, q, search } = {}) =>
            __handler(agent_id, {
                ...(q && { q }),
                ...(search && { search }),
            }),
    ]),
);

export const toolHandlers = {
    ...paginatedHandlers,
    get_syscollector_hardware: ({ agent_id }) => getAgentHardware(agent_id),
    get_syscollector_os: ({ agent_id }) => getAgentOs(agent_id),
    get_syscollector_full_inventory: ({ agent_id }) => getAgentFullInventory(agent_id),
};