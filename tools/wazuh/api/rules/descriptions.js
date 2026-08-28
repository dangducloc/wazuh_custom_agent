// /tools/wazuh/api/rules/descriptions.js
//
// Wazuh rules-management tool definitions.
// Each entry describes a callable tool: its name, a natural-language description
// for the model, the JSON Schema for its input, plus a handler that dispatches
// to the implementation in `rule-tools.js`.
//
// Schema key convention: the model client (`model/cloudflare-ai.js`) reads
// `def.input_schema` when building the tool payload — NOT `parameters`. The
// older modules under `api/agent` and `api/groups` still use `parameters`,
// which makes their schemas invisible to the model. Follow `input_schema`,
// like the `opensearch/*` descriptions do.
//
// Parameter naming convention: snake_case throughout, matching the Wazuh REST
// API (with the documented camelCase translation in `upload_rule_file`).
//
// Failure contract: unlike the agent/groups modules (null/false on failure),
// the implementations in `rule-tools.js` THROW on transport / non-200
// failures. The agent loop catches those throws and surfaces them back to the
// model as `{ "error": <message> }` tool results.

import {
    listRules,
    listRuleGroups,
    listRuleRequirement,
    listRuleFiles,
    getRuleFileContent,
    updateRuleFile,
    deleteRuleFile,
} from "./rule-tools.js";

// Wazuh rule level: 0–16, either a single level ("4") or a range ("5-8").
const RULE_LEVEL_PATTERN = "^\\d{1,2}(-\\d{1,2})?$";

// Wazuh rule files are XML on disk. Basenames only; the directory is selected
// separately via `relative_dirname`.
const RULE_FILENAME_PATTERN = "^[A-Za-z0-9._-]+\\.xml$";

// Compliance requirement namespaces supported by /rules/requirement/{req}.
// Mirrors the JSDoc on `listRuleRequirement` in `rule-tools.js`.
const RULE_REQUIREMENTS = [
    "pci_dss",
    "gdpr",
    "hipaa",
    "nist-800-53",
    "gpg13",
    "tsc",
    "mitre",
];

export const toolDefinitions = [
    {
        name: "get_rule_list",
        description:
            "Retrieve Wazuh detection rules with optional filters. Returns an array of rule objects " +
            "(id, level, description, groups, filename, status, compliance mappings such as " +
            "pci_dss/gdpr/hipaa/nist-800-53/tsc/mitre). All rules are fetched across pagination " +
            "automatically. Use `get_rule_requirements` together with the matching filter here when " +
            "hunting rules by compliance requirement, or `rule_ids` to look up specific rules seen in alerts.",
        input_schema: {
            type: "object",
            properties: {
                rule_ids: {
                    type: "array",
                    items: { type: "integer" },
                    description:
                        "Restrict results to these numeric rule ids (e.g. ids observed in alerts). " +
                        "Omit to list all rules.",
                },
                status: {
                    type: "string",
                    enum: ["enabled", "disabled", "all"],
                    description:
                        "Filter by rule status. The Wazuh API defaults to `enabled` when omitted; " +
                        "pass `all` to include disabled rules.",
                },
                group: {
                    type: "string",
                    description:
                        "Filter by rule group name (e.g. `windows`, `sshd`, `web`). " +
                        "Discover valid names with `get_rule_groups`.",
                },
                level: {
                    type: "string",
                    pattern: RULE_LEVEL_PATTERN,
                    description:
                        'Filter by rule level: a single level `0`-`16` (e.g. "12") or an inclusive ' +
                        'range (e.g. "5-16"). Higher is more severe.',
                },
                filename: {
                    type: "string",
                    description:
                        "Filter rules by the XML file that defines them (e.g. `0225-mcafee_av_rules.xml`). " +
                        "Discover filenames with `get_rule_file_list`.",
                },
                q: {
                    type: "string",
                    description:
                        "Wazuh query-language filter, e.g. `level>10;group=windows`. Prefer it over " +
                        "`search` for precise filtering.",
                },
                search: {
                    type: "string",
                    description:
                        "Free-text search across rule fields. Less precise than `q`.",
                },
                select: {
                    type: "array",
                    items: { type: "string" },
                    description:
                        'Fields to include in each returned rule, e.g. `["id", "description", "level", "groups"]`. ' +
                        "Note: the field is `groups` (plural, array) — NOT `group`, which is a separate filter param. " +
                        "Use to shrink large responses.",
                },
            },
            additionalProperties: false,
        },
    },
    {
        name: "get_rule_groups",
        description:
            "Retrieve the list of Wazuh rule groups (e.g. `windows`, `sshd`, `web`, `sysmon`). " +
            "Returns an array of group name strings. Use this to discover valid values for the " +
            "`group` filter of `get_rule_list`.",
        input_schema: {
            type: "object",
            properties: {
                q: {
                    type: "string",
                    description:
                        "Wazuh query-language filter for the group names.",
                },
                search: {
                    type: "string",
                    description: "Free-text search across group names.",
                },
            },
            additionalProperties: false,
        },
    },
    {
        name: "get_rule_requirements",
        description:
            "Retrieve the list of requirement names defined in Wazuh rules for a given compliance " +
            "framework (pci_dss, gdpr, hipaa, nist-800-53, gpg13, tsc, or mitre). Returns an array " +
            "of requirement values (e.g. PCI DSS section numbers or MITRE technique ids). " +
            "Combine with `get_rule_list`'s `q` filter to find the rules mapped to a requirement.",
        input_schema: {
            type: "object",
            properties: {
                requirement: {
                    type: "string",
                    enum: RULE_REQUIREMENTS,
                    description: "Compliance framework namespace to enumerate.",
                },
            },
            required: ["requirement"],
            additionalProperties: false,
        },
    },
    {
        name: "get_rule_file_list",
        description:
            "Retrieve the list of rule XML files known to the Wazuh manager (both the stock ruleset " +
            "and custom rules). Returns objects with `filename`, `relative_dirname`, and `status`. " +
            "Use to find a `filename`/`relative_dirname` pair before calling `get_rule_file`, " +
            "`upload_rule_file`, or `delete_rule_file`.",
        input_schema: {
            type: "object",
            properties: {
                filename: {
                    type: "string",
                    description: "Filter by exact filename.",
                },
                relative_dirname: {
                    type: "string",
                    description:
                        "Filter by directory relative to the ruleset root (e.g. `ruleset/rules` for stock, " +
                        "`etc/rules` for custom files).",
                },
                status: {
                    type: "string",
                    enum: ["enabled", "disabled", "all"],
                    description:
                        "Filter by file status. The Wazuh API defaults to `enabled` when omitted.",
                },
            },
            additionalProperties: false,
        },
    },
    {
        name: "get_rule_file",
        description:
            "Retrieve the raw XML content of a single rule file. Returns the XML as a plain string, " +
            "not a parsed object. Use to inspect the exact rule definitions inside a file before " +
            "editing it with `upload_rule_file`.",
        input_schema: {
            type: "object",
            properties: {
                filename: {
                    type: "string",
                    pattern: RULE_FILENAME_PATTERN,
                    description:
                        "Rule file basename ending in `.xml`, e.g. `0565-ms_ipsec_rules.xml`. " +
                        "Obtain names from `get_rule_file_list`.",
                },
                relative_dirname: {
                    type: "string",
                    description:
                        "Directory of the file relative to the ruleset root. Required when the file " +
                        "is not in the default location — copy it from `get_rule_file_list` output.",
                },
            },
            required: ["filename"],
            additionalProperties: false,
        },
    },
    {
        name: "upload_rule_file",
        description:
            "Create or replace a rule file on the Wazuh manager with the given raw XML content. " +
            "Intended for CUSTOM rules (under `etc/rules`): the manager rejects modifications to " +
            "stock ruleset files unless explicitly allowed in the API configuration. " +
            "The content must be valid Wazuh rule XML with a root `<group>` element containing one " +
            "or more `<rule>` blocks. New rules are picked up by the manager's rule reload cycle. " +
            "Returns the API response object on success; on failure the model sees an error message.",
        input_schema: {
            type: "object",
            properties: {
                filename: {
                    type: "string",
                    pattern: RULE_FILENAME_PATTERN,
                    description:
                        "Target filename, must end with `.xml` (e.g. `100100-custom_rules.xml`).",
                },
                xml_content: {
                    type: "string",
                    description:
                        'Complete raw XML of the rule file: a `<group name="...">` root containing ' +
                        '`<rule id="..." level="...">` blocks. Rule ids 100000-120000 are reserved ' +
                        "for local/custom rules.",
                },
                overwrite: {
                    type: "boolean",
                    description:
                        "Replace the file when it already exists. Defaults to false — the call fails " +
                        "if the file exists and overwrite is not set.",
                },
                relative_dirname: {
                    type: "string",
                    description:
                        "Target directory relative to the ruleset root. Use `etc/rules` for custom " +
                        "rules; omit for the manager default.",
                },
            },
            required: ["filename", "xml_content"],
            additionalProperties: false,
        },
    },
    {
        name: "delete_rule_file",
        description:
            "Delete a rule file from the Wazuh manager along with all rules it defines. " +
            "Intended for CUSTOM rule files; stock ruleset files cannot be deleted unless the API " +
            "configuration allows it. This is destructive — confirm the target via `get_rule_file` " +
            "first. On failure the model sees an error message.",
        input_schema: {
            type: "object",
            properties: {
                filename: {
                    type: "string",
                    pattern: RULE_FILENAME_PATTERN,
                    description:
                        "Rule file basename ending in `.xml`. Obtain names from `get_rule_file_list`.",
                },
                relative_dirname: {
                    type: "string",
                    description:
                        "Directory of the file relative to the ruleset root, when it is not in the " +
                        "default location.",
                },
            },
            required: ["filename"],
            additionalProperties: false,
        },
    },
];

const SELECT_FIELD_ALIASES = { group: "groups" };
const normalizeSelect = (select = []) =>
    select.map((f) => SELECT_FIELD_ALIASES[f] ?? f);

export const toolHandlers = {
    get_rule_list: ({
        rule_ids,
        status,
        group,
        level,
        filename,
        q,
        search,
        select,
    } = {}) =>
        listRules({
            ...(rule_ids?.length && { rule_ids: rule_ids.join(",") }),
            ...(status && { status }),
            ...(group && { group }),
            ...(level && { level }),
            ...(filename && { filename }),
            ...(q && { q }),
            ...(search && { search }),
            ...(select?.length && { select: normalizeSelect(select).join(",") }),
        }),
    get_rule_groups: ({ q, search } = {}) =>
        listRuleGroups({
            ...(q && { q }),
            ...(search && { search }),
        }),
    get_rule_requirements: ({ requirement }) =>
        listRuleRequirement(requirement),
    get_rule_file_list: ({ filename, relative_dirname, status } = {}) =>
        listRuleFiles({
            ...(filename && { filename }),
            ...(relative_dirname && { relative_dirname }),
            ...(status && { status }),
        }),
    get_rule_file: ({ filename, relative_dirname }) =>
        getRuleFileContent(filename, relative_dirname),
    upload_rule_file: ({
        filename,
        xml_content,
        overwrite = false,
        relative_dirname,
    }) =>
        updateRuleFile(filename, xml_content, {
            overwrite,
            relativeDirname: relative_dirname,
        }),
    delete_rule_file: ({ filename, relative_dirname }) =>
        deleteRuleFile(filename, relative_dirname),
};
