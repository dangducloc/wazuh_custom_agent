// /tools/wazuh/alerts/descriptions.js

import { AlertsCountInfo } from "./fetch.alerts-count.js";
import { AlertsSearch } from "./fetch.alerts-searchs.js";
import { IndexsInfo } from "./fetch.wazuh-alert-indexs.js";

export const toolDefinitions = [
  {
    name: "get_alerts_count",
    description:
      "Count the number of alerts in Wazuh by filter conditions (time range, rule, agent, severity...). Used to gauge alert volume before diving into detailed searches.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "object",
          description: "OpenSearch DSL query body to filter alerts (bool, range, term...).",
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
          description: "OpenSearch DSL query body, may include query, size, sort, _source...",
        },
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
  get_alerts_count: (input) => AlertsCountInfo(input.query),
  search_alerts: (input) => AlertsSearch(input.query),
  get_wazuh_indexes: () => IndexsInfo(),
};
