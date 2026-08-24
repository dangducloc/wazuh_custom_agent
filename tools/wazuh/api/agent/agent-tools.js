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

export const assignAgentToGroup = async (agentId, groupId) => {
    const token = await getToken();
    const baseUrl = `${WAZUH_API_URL}${WAZUH_API_AGENTS_ENDPOINT}/${agentId}/group/${groupId}`;
    try {
        const response = await wazuhAxios.put(baseUrl, null, {
            headers: { Authorization: `Bearer ${token}` },
        });

        if (response.status === 200) {
            logger.info("Agent assigned to group successfully.");
            return true;
        }
        logger.error("Failed to assign agent to group. Status code:", response.status);
        return false;
    } catch (error) {
        logger.error("Error assigning agent to group:", error.message);
        return false;
    }
};

export const removeAgentFromGroups = async (agentId, groupIds=[]) => {
    const token = await getToken();
    const baseUrl = `${WAZUH_API_URL}${WAZUH_API_AGENTS_ENDPOINT}/${agentId}/group?groups_list=${groupIds.join(",")}&wait_for_complete=true`;   
    try {
        const response = await wazuhAxios.delete(baseUrl, {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (response.status === 200) {
            logger.info("Agent removed from all groups successfully.");
            return true;
        }
        logger.error("Failed to remove agent from groups. Status code:", response.status);
        return false;
    } catch (error) {
        logger.error("Error removing agent from groups:", error.message);
        return false;
    }
};

