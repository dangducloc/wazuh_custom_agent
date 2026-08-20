// file /utils/opensearch-endpoints.js this file is used to define the OpenSearch endpoints for the application. It imports necessary modules, reads environment variables, and exports the configured OpenSearch endpoints for use in other parts of the application.
import { opensearchConfig } from "../config/index.js";



//health endpoint
const CLUSTER_HEALTH_ENDPOINT = { path: "/_cluster/health", method: "GET" };

//indices endpoint alerts
const WAZUH_ALERTS_ENDPOINT = {
    path: "/_cat/indices/wazuh-alerts-*?v",
    method: "GET",
};
const MAPPING_WAZUH_ALERTS_ENDPOINT = { path: "/wazuh-alerts-*/_mapping", method: "GET" };

//index endpoint for wazuh-alerts-*
const INDEX_WAZUH_ALERTS_SEARCH_ENDPOINT = {
    path: "/wazuh-alerts-*/_search",
    method: "POST",
};
const INDEX_WAZUH_ALERTS_COUNT_ENDPOINT = {
    path: "/wazuh-alerts-*/_count",
    method: "POST",
};

//msearch endpoint 
const WAZUH_MSEARCH_ENDPOINT = {
    path: "/_msearch",
    method: "POST",
};

//mitre endpoints



export {
    CLUSTER_HEALTH_ENDPOINT,
    WAZUH_ALERTS_ENDPOINT,
    MAPPING_WAZUH_ALERTS_ENDPOINT,
    INDEX_WAZUH_ALERTS_SEARCH_ENDPOINT,
    INDEX_WAZUH_ALERTS_COUNT_ENDPOINT,
    WAZUH_MSEARCH_ENDPOINT,
};
