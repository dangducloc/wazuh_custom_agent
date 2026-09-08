// file /tools/wazuh/opensearch/health/fetch.cluster-health.js this file is used to check the health of the Wazuh agent and related services. It imports necessary modules, reads environment variables, and exports the health check function for use in other parts of the application.
import { opensearchConfig } from "../../../../config/index.js";
import {logger,wazuhAxios,CLUSTER_HEALTH_ENDPOINT} from "../../../../utils/index.js";

const url = `${opensearchConfig.OPENSEARCH_URL}${CLUSTER_HEALTH_ENDPOINT}`;

async function checkClusterHealth() {
    try {
        const response = await wazuhAxios.get(url, {
            headers: opensearchConfig.OPENSEARCH_HEADERS
        });
        return response.data;
    } catch (err) {
        throw new Error(`Failed to fetch cluster health: ${err.response?.status} ${err.response?.statusText}`);
    }
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



