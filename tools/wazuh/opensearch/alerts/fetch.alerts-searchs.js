// /tools/wazuh/alerts/fetch.alerts-searchs.js
import { opensearchConfig } from "../../../../config/index.js";
import { fetch } from "undici";
import { INDEX_WAZUH_ALERTS_SEARCH_ENDPOINT, logger, insecureAgent} from "../../../../utils/index.js";

const url_search = `${opensearchConfig.OPENSEARCH_URL}${INDEX_WAZUH_ALERTS_SEARCH_ENDPOINT.path}`;

async function fetchAlertsSearch(body) {
    const response = await fetch(url_search, {
        dispatcher: insecureAgent,
        method: INDEX_WAZUH_ALERTS_SEARCH_ENDPOINT.method,
        headers: opensearchConfig.OPENSEARCH_HEADERS,
        body: JSON.stringify(body, null, 2),
    });
    if (!response.ok) {
        const detail = await response.text();
        throw new Error(
            `Failed to fetch alerts search: ${response.status} ${response.statusText} — ${detail}`
        );
    }
    return response.json();
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
