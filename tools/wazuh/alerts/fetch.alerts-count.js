// /tools/wazuh/alerts/fetch.alerts-count.js
import { opensearchConfig } from "../../../config/index.js";
import { fetch } from "undici";
import { INDEX_WAZUH_ALERTS_COUNT_ENDPOINT, insecureAgent } from "../../../utils/index.js";
import { logger } from "../../../utils/index.js";

const url = `${opensearchConfig.OPENSEARCH_URL}${INDEX_WAZUH_ALERTS_COUNT_ENDPOINT.path}`;

async function fetchAlertsCount(body) {
    const response = await fetch(url, {
        dispatcher: insecureAgent,
        method: INDEX_WAZUH_ALERTS_COUNT_ENDPOINT.method,
        headers: opensearchConfig.OPENSEARCH_HEADERS,
        body: JSON.stringify(body),
    });
    if (!response.ok) {
        const detail = await response.text();
        throw new Error(
            `Failed to fetch alerts count: ${response.status} ${response.statusText} — ${detail}`
        );
    }
    return response.json();
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
