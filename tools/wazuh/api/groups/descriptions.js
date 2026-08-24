// /tools/wazuh/api/groups/descriptions.js
//
// Wazuh group-management tool definitions.
// Each entry describes a callable tool: its name, a natural-language description
// for the model, the JSON Schema for its parameters, plus a handler that
// dispatches to the implementation in `groups-tools.js`.
//
// All handlers come back as `null` on transport / non-200 failures — surface
// that explicitly so the model can react instead of treating null as success.

import { getGroupList, createGroup, deleteGroup } from "./groups-tools.js";

// Wazuh group_id naming rules per the public API: 1–128 chars,
// allowed characters: alphanumerics, `-`, `_`, `.`. Anything else is
// rejected by the manager before the request reaches this module.
const GROUP_ID_PATTERN = "^[A-Za-z0-9._-]{1,128}$";

export const toolDefinitions = [
    {
        name: "get_group_list",
        description:
            "Retrieve the list of all agent groups registered on the Wazuh manager. " +
            "Returns each group's name, count of assigned agents, and a merged-config hash. " +
            "Use this to discover existing group names before creating, deleting, or assigning agents to groups.",
        parameters: {
            type: "object",
            properties: {},
            additionalProperties: false,
        },
    },
    {
        name: "create_group",
        description:
            "Create a new agent group on the Wazuh manager. " +
            "Returns the created group's metadata on success. The group_id must be unique and match " +
            "the Wazuh naming rules (alphanumeric, `-`, `_`, `.`; 1–128 chars). " +
            "If a group with the same id already exists, the Wazuh API returns an error and this tool returns `null`.",
        parameters: {
            type: "object",
            properties: {
                group_id: {
                    type: "string",
                    pattern: GROUP_ID_PATTERN,
                    description:
                        "Unique identifier for the new group. Must match `^[A-Za-z0-9._-]{1,128}$`.",
                },
            },
            required: ["group_id"],
            additionalProperties: false,
        },
    },
    {
        name: "delete_group",
        description:
            "Delete one or more agent groups from the Wazuh manager in a single request. " +
            "Group ids are sent as a comma-separated list. Deleting a non-existent group is treated as an error " +
            "by the Wazuh API and surfaces as `null` here. Pass multiple ids in one call rather than issuing per-id calls.",
        parameters: {
            type: "object",
            properties: {
                group_ids: {
                    type: "array",
                    minItems: 1,
                    items: {
                        type: "string",
                        pattern: GROUP_ID_PATTERN,
                    },
                    description:
                        "Array of group ids to delete. Each id must match `^[A-Za-z0-9._-]{1,128}$`. " +
                        "At least one id is required; pass all ids to delete in one call.",
                },
            },
            required: ["group_ids"],
            additionalProperties: false,
        },
    },
];

export const toolHandlers = {
    get_group_list: () => getGroupList(),
    create_group: ({ group_id }) => createGroup(group_id),
    delete_group: ({ group_ids }) => deleteGroup(group_ids),
};
