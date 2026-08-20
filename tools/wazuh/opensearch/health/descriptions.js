// /tools/wazuh/opensearch/health/descriptions.js

import { HealthCheck } from "./fetch.cluster-health.js";

export const toolDefinitions = [
  {
    name: "get_cluster_health",
    description:
      "Check the health status of the OpenSearch/Wazuh cluster (status: green/yellow/red, number of nodes, active/unassigned shards). Use this before running heavy queries to confirm the cluster is in a reliable state, or when alert data looks incomplete/stale.",
    input_schema: {
      type: "object",
      properties: {},
    },
  },
];

export const toolHandlers = {
  get_cluster_health: () => HealthCheck(),
};
