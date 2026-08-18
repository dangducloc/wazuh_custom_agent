// /tools/wazuh/alerts/fetch.wazuh-alert-indexs.js
import { opensearchConfig } from "../../../config/index.js";
import { fetch } from "undici";
import { WAZUH_ALERTS_ENDPOINT, insecureAgent, table2Json } from "../../../utils/index.js";
import { logger } from "../../../utils/index.js";

const url = `${opensearchConfig.OPENSEARCH_URL}${WAZUH_ALERTS_ENDPOINT.path}`;

async function fetchIndexs() {
    const response = await fetch(url, {
        dispatcher: insecureAgent,
        method: WAZUH_ALERTS_ENDPOINT.method,
        headers: opensearchConfig.OPENSEARCH_HEADERS,
    });
    if (!response.ok) {
        const detail = await response.text();
        throw new Error(`Failed to fetch indexs: ${response.status} ${response.statusText} — ${detail}`);
    }
    return table2Json(await response.text());
}

export const IndexsInfo = async () => {
    try {
        const result = await fetchIndexs();
        logger.info(`Data fetched successfully for endpoint: ${WAZUH_ALERTS_ENDPOINT.path}`);
        return result;
    } catch (error) {
        logger.error("Fetch indexs info failed:", error);
        throw error;
    }
};
