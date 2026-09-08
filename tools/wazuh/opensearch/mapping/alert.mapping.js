// /tools/wazuh/mapping/alert.mapping.js
// get the mapping of the wazuh-alerts-* index from OpenSearch and export it for use in other parts of the application.
import { MAPPING_WAZUH_ALERTS_ENDPOINT } from "../../../../utils/index.js";
import { opensearchConfig } from "../../../../config/index.js";
import {logger, wazuhAxios} from "../../../../utils/index.js";

const url = `${opensearchConfig.OPENSEARCH_URL}${MAPPING_WAZUH_ALERTS_ENDPOINT}`;

async function fetchWazuhAlertsMapping() {
    try {
        const response = await wazuhAxios.get(url, {
            headers: opensearchConfig.OPENSEARCH_HEADERS
        });
        return response.data;
    } catch (err) {
        throw new Error(`Failed to fetch Wazuh alerts mapping: ${err.response?.status} ${err.response?.statusText}`);
    }
};

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

