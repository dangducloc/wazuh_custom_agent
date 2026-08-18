// /tools/wazuh/mapping/alert.mapping.js
// get the mapping of the wazuh-alerts-* index from OpenSearch and export it for use in other parts of the application.
import { MAPPING_WAZUH_ALERTS_ENDPOINT } from "../../../utils/index.js";
import { opensearchConfig } from "../../../config/index.js";
import {logger, insecureAgent} from "../../../utils/index.js";
import {fetch} from "undici";

const url = `${opensearchConfig.OPENSEARCH_URL}${MAPPING_WAZUH_ALERTS_ENDPOINT.path}`;

async function fetchWazuhAlertsMapping() {
    const response = await fetch(url, {
        dispatcher: insecureAgent,
        method: MAPPING_WAZUH_ALERTS_ENDPOINT.method,
        headers: opensearchConfig.OPENSEARCH_HEADERS,
    });
    if (!response.ok) {
        throw new Error(`Failed to fetch Wazuh alerts mapping: ${response.status} ${response.statusText}`);
    }
    return response.json();
}

export const AlertsMapping = async () => {
    try {
        const mapping = await fetchWazuhAlertsMapping();
        logger.info("Successfully fetched Wazuh alerts mapping.");
        return mapping;
    } catch (error) {
        logger.error("Error fetching Wazuh alerts mapping:", error);
        throw error;
    }
};

