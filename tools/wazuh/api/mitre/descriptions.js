// /tools/wazuh/api/mitre/descriptions.js
//
// MITRE ATT&CK lookup tool definitions, backed by the Wazuh manager's cached
// MITRE database (the /mitre endpoints). All tools here are read-only.
// Each entry describes a callable tool: its name, a natural-language
// description for the model, the JSON Schema for its input, plus a handler
// that dispatches to the implementation in `mitre-tools.js`.
//
// Schema key convention: the model client (`model/cloudflare-ai.js`) reads
// `def.input_schema` when building the tool payload — NOT `parameters`. The
// older modules under `api/agent` and `api/groups` still use `parameters`,
// which makes their schemas invisible to the model. Follow `input_schema`,
// like the `opensearch/*` descriptions do.
//
// Id lists are optional on every list endpoint: omit (or pass an empty array)
// to enumerate the entire category, or pass specific ids to resolve just
// those. All results are fetched across pagination automatically.
//
// Failure contract: the implementations in `mitre-tools.js` THROW on
// transport / non-200 failures (unlike the null/false contract of the
// agent/groups modules). The agent loop catches those throws and surfaces
// them back to the model as `{ "error": <message> }` tool results.

import {
    getMitreMetadata,
    listMitreTactics,
    listMitreTechniques,
    listMitreMitigations,
    listMitreSoftware,
    listMitreGroups,
    listMitreReferences,
} from "./mitre-tools.js";

// MITRE ATT&CK external id formats.
const TACTIC_ID_PATTERN = "^TA\\d{4}$"; // e.g. TA0001
const TECHNIQUE_ID_PATTERN = "^T\\d{4}(\\.\\d{3})?$"; // T1059, T1059.001
const MITIGATION_ID_PATTERN = "^M\\d{4}$"; // e.g. M1049
const SOFTWARE_ID_PATTERN = "^S\\d{4}$"; // e.g. S0154
const GROUP_ID_PATTERN = "^G\\d{4}$"; // e.g. G0006
// Reference ids are free-form (mix of internal ids and external source ids),
// so no pattern is enforced.

export const toolDefinitions = [
    {
        name: "get_mitre_metadata",
        description:
            "Retrieve metadata about the MITRE ATT&CK database cached on the Wazuh manager " +
            "(last update timestamp, version info). Use to check how fresh the MITRE data is " +
            "before drawing conclusions from the other `get_mitre_*` tools.",
        input_schema: {
            type: "object",
            properties: {},
            additionalProperties: false,
        },
    },
    {
        name: "get_mitre_tactics",
        description:
            "Retrieve MITRE ATT&CK tactics (the high-level attack phases such as Initial Access, " +
            "Execution, Lateral Movement). Omit `tactic_ids` to list all tactics; pass ids to " +
            "resolve specific ones referenced by alerts or techniques.",
        input_schema: {
            type: "object",
            properties: {
                tactic_ids: {
                    type: "array",
                    items: { type: "string", pattern: TACTIC_ID_PATTERN },
                    description:
                        "Tactic ids like `TA0001`. Omit or pass an empty array to list all tactics.",
                },
                q: {
                    type: "string",
                    description:
                        "Wazuh query-language filter (e.g. `name~Execution`).",
                },
                search: {
                    type: "string",
                    description: "Free-text search across tactic fields.",
                },
            },
            additionalProperties: false,
        },
    },
    {
        name: "get_mitre_techniques",
        description:
            "Retrieve MITRE ATT&CK techniques and sub-techniques (e.g. `T1059` Command and Scripting " +
            "Interpreter, `T1059.001` PowerShell). This is the primary lookup for mapping ids found " +
            "in Wazuh alerts (`rule.mitre.id`) to human-readable names and descriptions during " +
            "threat analysis. Omit `technique_ids` to list the full catalog.\n\n" +
            "IMPORTANT: to look up a known technique id, put it in `technique_ids` — do NOT use `q` " +
            "for id lookups. `q` uses Wazuh query syntax with `=`/`!=`/`~` operators " +
            '(e.g. `q: "name~PowerShell"`), never `field:value`.',
        input_schema: {
            type: "object",
            properties: {
                technique_ids: {
                    type: "array",
                    items: { type: "string", pattern: TECHNIQUE_ID_PATTERN },
                    description:
                        'Technique or sub-technique ids, e.g. `["T1059", "T1078", "T1059.001"]`. ' +
                        "Omit or pass an empty array to list all techniques.",
                },
                q: {
                    type: "string",
                    description:
                        "Wazuh query-language filter for the technique fields.",
                },
                search: {
                    type: "string",
                    description:
                        'Free-text search across technique names/descriptions (e.g. "powershell").',
                },
            },
            additionalProperties: false,
        },
    },
    {
        name: "get_mitre_mitigations",
        description:
            "Retrieve MITRE ATT&CK mitigations (courses of action, e.g. `M1049` Antivirus/Antimalware). " +
            "Use to translate mitigation ids into actionable recommendations when reporting on findings. " +
            "Omit `mitigation_ids` to list all mitigations.",
        input_schema: {
            type: "object",
            properties: {
                mitigation_ids: {
                    type: "array",
                    items: { type: "string", pattern: MITIGATION_ID_PATTERN },
                    description:
                        "Mitigation ids like `M1049`. Omit or pass an empty array to list all.",
                },
                q: {
                    type: "string",
                    description:
                        "Wazuh query-language filter for the mitigation fields.",
                },
                search: {
                    type: "string",
                    description:
                        "Free-text search across mitigation names/descriptions.",
                },
            },
            additionalProperties: false,
        },
    },
    {
        name: "get_mitre_mitigations_software_placeholder",
        description: "",
        input_schema: { type: "object", properties: {} },
    },
];

// The placeholder entry above is removed below; keeping the real software
// definition separate from the array literal would break the loader contract,
// so the final definitions are rebuilt here.
toolDefinitions.pop();
toolDefinitions.push(
    {
        name: "get_mitre_software",
        description:
            "Retrieve MITRE ATT&CK software entries (known malware and attacker tools, e.g. `S0154` " +
            "Cobalt Strike). Use to look up tool/malware ids referenced by alerts or groups. " +
            "Omit `software_ids` to list all software entries.",
        input_schema: {
            type: "object",
            properties: {
                software_ids: {
                    type: "array",
                    items: { type: "string", pattern: SOFTWARE_ID_PATTERN },
                    description:
                        "Software ids like `S0154`. Omit or pass an empty array to list all.",
                },
                q: {
                    type: "string",
                    description:
                        "Wazuh query-language filter for the software fields.",
                },
                search: {
                    type: "string",
                    description:
                        "Free-text search across software names/descriptions.",
                },
            },
            additionalProperties: false,
        },
    },
    {
        name: "get_mitre_groups",
        description:
            "Retrieve MITRE ATT&CK adversary groups (APT aliases, e.g. `G0006` APT1). Use to resolve " +
            "group ids or to enumerate threat actors when profiling detected activity. " +
            "Note: these are ATT&CK adversary groups — unrelated to Wazuh agent groups " +
            "(`get_group_list`).",
        input_schema: {
            type: "object",
            properties: {
                group_ids: {
                    type: "array",
                    items: { type: "string", pattern: GROUP_ID_PATTERN },
                    description:
                        "Group ids like `G0006`. Omit or pass an empty array to list all groups.",
                },
                q: {
                    type: "string",
                    description:
                        "Wazuh query-language filter for the group fields.",
                },
                search: {
                    type: "string",
                    description:
                        "Free-text search across group names/descriptions.",
                },
            },
            additionalProperties: false,
        },
    },
    {
        name: "get_mitre_references",
        description:
            "Retrieve MITRE ATT&CK references (external source citations attached to techniques, " +
            "tactics, software, etc.). Reference ids are free-form — use `search` for fuzzy lookup " +
            "when the exact id is unknown. Omit `reference_ids` to list all references.",
        input_schema: {
            type: "object",
            properties: {
                reference_ids: {
                    type: "array",
                    items: { type: "string" },
                    description:
                        "Reference ids to resolve. Omit or pass an empty array to list all references.",
                },
                q: {
                    type: "string",
                    description:
                        "Wazuh query-language filter for the reference fields.",
                },
                search: {
                    type: "string",
                    description:
                        "Free-text search across reference fields (e.g. a URL fragment).",
                },
            },
            additionalProperties: false,
        },
    },
);

export const toolHandlers = {
    get_mitre_metadata: () => getMitreMetadata(),
    get_mitre_tactics: ({ tactic_ids = [], q, search } = {}) =>
        listMitreTactics(tactic_ids, {
            ...(q && { q }),
            ...(search && { search }),
        }),
    get_mitre_techniques: ({ technique_ids = [], q, search } = {}) =>
        listMitreTechniques(technique_ids, {
            ...(q && { q }),
            ...(search && { search }),
        }),
    get_mitre_mitigations: ({ mitigation_ids = [], q, search } = {}) =>
        listMitreMitigations(mitigation_ids, {
            ...(q && { q }),
            ...(search && { search }),
        }),
    get_mitre_software: ({ software_ids = [], q, search } = {}) =>
        listMitreSoftware(software_ids, {
            ...(q && { q }),
            ...(search && { search }),
        }),
    get_mitre_groups: ({ group_ids = [], q, search } = {}) =>
        listMitreGroups(group_ids, {
            ...(q && { q }),
            ...(search && { search }),
        }),
    get_mitre_references: ({ reference_ids = [], q, search } = {}) =>
        listMitreReferences(reference_ids, {
            ...(q && { q }),
            ...(search && { search }),
        }),
};
