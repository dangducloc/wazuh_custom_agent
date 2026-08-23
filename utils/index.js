// file utils/index.js this file is used to configure the logger for the application. It imports necessary modules, reads environment variables, and exports the configured logger instance for use in other parts of the application.
export { logger } from "./logger.js";
import { Agent } from "undici";
export const insecureAgent = new Agent({
    connect: {
        rejectUnauthorized: false, // Disable SSL certificate validation
    },
});

export {
    CLUSTER_HEALTH_ENDPOINT,
    WAZUH_ALERTS_ENDPOINT,
    MAPPING_WAZUH_ALERTS_ENDPOINT,
    INDEX_WAZUH_ALERTS_SEARCH_ENDPOINT,
    INDEX_WAZUH_ALERTS_COUNT_ENDPOINT,
    WAZUH_MSEARCH_ENDPOINT,
} from "./opensearch-endpoints.js";

// export {insecureAgent} from './opensearch-endpoints.js';
export {
    WAZUH_API_AGENTS_ENDPOINT,
    WAZUH_API_AUTH_ENDPOINT,
    wazuhAxios
} from "./wazuhapi-endpoints.js";

//format
export { table2Json } from "./format/table2json.js";

//helper
export * from "./helper.js";

export { getToken} from "./helper/get-wazuh-api-token.js";
export { isValidAgentConfig } from "./helper/isValidAgentConfig.js";
