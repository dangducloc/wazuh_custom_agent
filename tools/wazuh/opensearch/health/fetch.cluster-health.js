// file /tools/wazuh/opensearch/health/fetch.cluster-health.js this file is used to check the health of the Wazuh agent and related services. It imports necessary modules, reads environment variables, and exports the health check function for use in other parts of the application.
import { opensearchConfig } from "../../../../config/index.js";
import {fetch} from "undici";
import {logger,insecureAgent,CLUSTER_HEALTH_ENDPOINT} from "../../../../utils/index.js";

const url = `${opensearchConfig.OPENSEARCH_URL}${CLUSTER_HEALTH_ENDPOINT.path}`;

async function checkClusterHealth() {
    const response = await fetch(url, {
        dispatcher: insecureAgent,
        method: CLUSTER_HEALTH_ENDPOINT.method,
        headers: opensearchConfig.OPENSEARCH_HEADERS,
    });
    if (!response.ok) {
        throw new Error(`Failed to fetch cluster health: ${response.status} ${response.statusText}`);
    }
    return response.json();
}

export const HealthCheck = async () => {
    try {
        const result = await checkClusterHealth();
        logger.info("Cluster health check passed.");
        return result;
    } catch (error) {
        logger.error("Cluster health check failed:", error);
        throw error;
    }
};



