// /tools/wazuh/alerts/descriptions.js

import { AlertsCountInfo } from "./fetch.alerts-count.js";
import { AlertsSearch } from "./fetch.alerts-searchs.js";
import { IndexsInfo } from "./fetch.wazuh-alert-indexs.js";

export const toolDefinitions = [
    {
        name: "get_alerts_count",
        description:
            "Count the number of alerts in Wazuh matching a filter (time range, rule, agent, severity...). Only accepts a 'query' clause — no size/sort/_source. Use to gauge alert volume before running search_alerts.",
        input_schema: {
            type: "object",
            properties: {
                query: {
                    type: "object",
                    description:
                        "OpenSearch DSL query clause (bool, range, term...) — this endpoint only accepts 'query', nothing else.",
                },
            },
            required: ["query"],
        },
    },
    {
        name: "search_alerts",
        description:
            "Search alerts in detail in Wazuh using an OpenSearch DSL query, returning full alert documents. Use when specific content (rule, agent, MITRE ATT&CK, timestamp...) is needed for threat hunting analysis.",
        input_schema: {
            type: "object",
            properties: {
                query: {
                    type: "object",
                    description:
                        "OpenSearch DSL query clause (bool, range, term...) — NOT the full request body.",
                },
                size: {
                    type: "integer",
                    description: "Max number of results. Default 10.",
                },
                sort: {
                    type: "array",
                    description:
                        "Sort clauses, e.g. [{'@timestamp':{'order':'desc'}}].",
                },
                _source: { type: "array", description: "Fields to return." },
            },
            required: ["query"],
        },
    },
    {
        name: "get_wazuh_indexes",
        description:
            "Get the list of Wazuh indexes currently available on OpenSearch (name, health, document count...). Use when you need to know which indexes exist before querying.",
        input_schema: {
            type: "object",
            properties: {},
        },
    },
];

export const toolHandlers = {
    get_alerts_count: (input) => AlertsCountInfo({ query: input.query }),
    search_alerts: (input) =>
        AlertsSearch({
            query: input.query,
            size: input.size ?? 10,
            sort: input.sort ?? [{ "@timestamp": { order: "desc" } }],
            _source: input._source,
        }),
    get_wazuh_indexes: () => IndexsInfo(),
};
