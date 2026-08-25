// /tools/wazuh/alerts/fetch.alerts-searchs.js
import { opensearchConfig } from "../../../../config/index.js";
import { INDEX_WAZUH_ALERTS_SEARCH_ENDPOINT,wazuhAxios, logger} from "../../../../utils/index.js";

const url_search = `${opensearchConfig.OPENSEARCH_URL}${INDEX_WAZUH_ALERTS_SEARCH_ENDPOINT}`;

async function fetchAlertsSearch(body) {
    try {
        const response = await wazuhAxios.post(url_search, body, {
            headers: opensearchConfig.OPENSEARCH_HEADERS
        });
        return response.data;
    } catch (err) {
        throw new Error(
            `Failed to fetch alerts search: ${err.response?.status} ${err.response?.statusText} — ${JSON.stringify(err.response?.data)}`
        );
    }
};

export const AlertsSearch = async (body) => {
    try {
        const result = await fetchAlertsSearch(body);
        logger.info(`Data fetched successfully for endpoint: ${INDEX_WAZUH_ALERTS_SEARCH_ENDPOINT.path}`);
        return result;
    } catch (error) {
        logger.error("Fetch alerts search failed:", error);
        throw error;
    }
};
