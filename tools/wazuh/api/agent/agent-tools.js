// /tools/wazuh/api/agent/agent-tools.js
import { WAZUH_API_AGENTS_ENDPOINT, getToken, wazuhAxios } from "../../../../utils/index.js";
import { wazuhApiConfig } from "../../../../config/index.js";
import { logger } from "../../../../utils/logger.js";

const { WAZUH_API_URL } = wazuhApiConfig;

export const getAgentList = async () => {
    const token = await getToken();
    const baseUrl = WAZUH_API_URL + WAZUH_API_AGENTS_ENDPOINT;

    try {
        const response = await wazuhAxios.get(baseUrl, {
            headers: { Authorization: `Bearer ${token}` },
        });

        if (response.status === 200) {
            const agents = response.data.data;
            logger.info("Retrieved agent list:", agents);
            return agents;
        }
        logger.error("Failed to retrieve agent list. Status code:", response.status);
        return null;
    } catch (error) {
        logger.error("Error retrieving agent list:", error.message);
        return null;
    }
};

export const getAgentById = async (agentId) => {
    const token = await getToken();
    const baseUrl = `${WAZUH_API_URL}${WAZUH_API_AGENTS_ENDPOINT}?agents_list=${agentId}`;
    try {
        const response = await wazuhAxios.get(baseUrl, {
            headers: { Authorization: `Bearer ${token}` },
        });

        if (response.status === 200) {
            const agent = response.data.data;
            logger.info("Retrieved agent by ID:", agent);
            return agent;
        }
        logger.error("Failed to retrieve agent by ID. Status code:", response.status);
        return null;
    } catch (error) {
        logger.error("Error retrieving agent by ID:", error.message);
        return null;
    }
};


