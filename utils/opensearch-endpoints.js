// file /utils/opensearch-endpoints.js this file is used to define the OpenSearch endpoints for the application. It imports necessary modules, reads environment variables, and exports the configured OpenSearch endpoints for use in other parts of the application.
import { opensearchConfig } from "../config/index.js";



//health endpoint
const CLUSTER_HEALTH_ENDPOINT = "/_cluster/health";

//indices endpoint alerts
const WAZUH_ALERTS_ENDPOINT = "/_cat/indices/wazuh-alerts-*?v";
const MAPPING_WAZUH_ALERTS_ENDPOINT = "/wazuh-alerts-*/_mapping";

//index endpoint for wazuh-alerts-*
const INDEX_WAZUH_ALERTS_SEARCH_ENDPOINT = "/wazuh-alerts-*/_search";
const INDEX_WAZUH_ALERTS_COUNT_ENDPOINT =  "/wazuh-alerts-*/_count";


export {
    CLUSTER_HEALTH_ENDPOINT,
    WAZUH_ALERTS_ENDPOINT,
    MAPPING_WAZUH_ALERTS_ENDPOINT,
    INDEX_WAZUH_ALERTS_SEARCH_ENDPOINT,
    INDEX_WAZUH_ALERTS_COUNT_ENDPOINT,
};
