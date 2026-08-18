// tools/wazuh/mapping/description.js
import {AlertsMapping} from "./alert.mapping.js";

export const toolDefinitions = [
  {
    name: "get_alerts_mapping",
    description:
      "Retrieve the field mapping of the Wazuh alerts index. Returns only core security-relevant fields by default (rule, agent, timestamp, network, source/dest IP) to save tokens — set include_all=true only if you need application-specific fields like HTTP transaction headers.",
    input_schema: {
      type: "object",
      properties: {
        include_all: {
          type: "boolean",
          description: "Set true to get the full raw mapping including verbose nested fields. Default false.",
        },
      },
    },
  },
];

const KEEP_PREFIXES = [
  "rule",
  "agent",
  "@timestamp",
  "location",
  "manager",
  "cluster",
  "GeoLocation",
  "data.srcip",
  "data.dstip",
  "data.src_ip",
  "data.dest_ip",
  "data.dstport",
  "data.srcport",
  "data.srcuser",
  "data.dstuser",
  "data.protocol",
  "data.event_type",
  "data.alert",
  "data.http",
  "data.url",
  "syscheck.path",
  "syscheck.event",
];

function trimProperties(properties) {
  return Object.fromEntries(
    Object.entries(properties).filter(([key]) =>
      KEEP_PREFIXES.some((p) => key === p || key.startsWith(p + "."))
    )
  );
}

export const toolHandlers = {
  get_alerts_mapping: async ({ include_all = false } = {}) => {
    const mapping = await AlertsMapping();

    // The response contains the mapping repeated for EACH daily index (wazuh-alerts-4.x-YYYY.MM.DD).
    // Only take the latest index as the representative — schemas across days are nearly identical.
    const indexNames = Object.keys(mapping).sort();
    const latestIndex = indexNames[indexNames.length - 1];
    const properties = mapping[latestIndex]?.mappings?.properties || {};

    if (include_all) {
      return { index: latestIndex, properties };
    }

    return { index: latestIndex, properties: trimProperties(properties) };
  },
};
