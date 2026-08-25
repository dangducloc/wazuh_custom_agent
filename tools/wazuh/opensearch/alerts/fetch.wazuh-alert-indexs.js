// /tools/wazuh/opensearch/alerts/fetch.wazuh-alert-indexs.js
import { opensearchConfig } from "../../../../config/index.js";
import { WAZUH_ALERTS_ENDPOINT, wazuhAxios, table2Json } from "../../../../utils/index.js";
import { logger } from "../../../../utils/index.js";

const url = `${opensearchConfig.OPENSEARCH_URL}${WAZUH_ALERTS_ENDPOINT}`;

async function fetchIndexs() {
    try {
        const response = await wazuhAxios.get(url, {
            headers: opensearchConfig.OPENSEARCH_HEADERS
        });
        return table2Json(response.data);
    } catch (err) {
        throw new Error(
            `Failed to fetch indexs: ${err.response?.status} ${err.response?.statusText} — ${JSON.stringify(err.response?.data)}`
        );
    }
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
