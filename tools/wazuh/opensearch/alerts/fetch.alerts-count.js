// /tools/wazuh/alerts/fetch.alerts-count.js
import { opensearchConfig } from "../../../../config/index.js";
import { INDEX_WAZUH_ALERTS_COUNT_ENDPOINT, wazuhAxios } from "../../../../utils/index.js";
import { logger } from "../../../../utils/index.js";

const url = `${opensearchConfig.OPENSEARCH_URL}${INDEX_WAZUH_ALERTS_COUNT_ENDPOINT}`;

async function fetchAlertsCount(body) {
    try {
        const response = await wazuhAxios.post(url, body, {
            headers: opensearchConfig.OPENSEARCH_HEADERS
        });
        return response.data;
    } catch (err) {
        throw new Error(
            `Failed to fetch alerts count: ${err.response?.status} ${err.response?.statusText} — ${JSON.stringify(err.response?.data)}`
        );
    }
}

export const AlertsCountInfo = async (body) => {
    try {
        const result = await fetchAlertsCount(body);
        logger.info(`Data fetched successfully for endpoint: ${INDEX_WAZUH_ALERTS_COUNT_ENDPOINT.path}`);
        return result;
    } catch (error) {
        logger.error("Fetch alerts count info failed:", error);
        throw error;
    }
}
