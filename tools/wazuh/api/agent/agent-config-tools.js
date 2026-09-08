// /tools/wazuh/api/agent/agent-config-tools.js

import { WAZUH_API_AGENTS_ENDPOINT, getToken, wazuhAxios, isValidAgentConfig } from "../../../../utils/index.js";
import { wazuhApiConfig } from "../../../../config/index.js";
import { logger } from "../../../../utils/logger.js";

const { WAZUH_API_URL } = wazuhApiConfig;

export const getAgentActiveConfig = async (agentId, component, configuration) => {
    if (!isValidAgentConfig(agentId, component, configuration)) {
        logger.error(`Invalid component/configuration for target ${agentId}: ${component}/${configuration}`);
        return null;
    }

    const token = await getToken();
    const baseUrl = `${WAZUH_API_URL}${WAZUH_API_AGENTS_ENDPOINT}/${agentId}/config/${component}/${configuration}`;

    try {
        const response = await wazuhAxios.get(baseUrl, {
            headers: { Authorization: `Bearer ${token}` },
        });

        if (response.status === 200) {
            const activeConfig = response.data.data;
            logger.info(`Retrieved active config [${component}/${configuration}] for agent ${agentId}:`, activeConfig);
            return activeConfig;
        }
        logger.error("Failed to retrieve agent active config. Status code:", response.status);
        return null;
    } catch (error) {
        logger.error(`Error retrieving active config [${component}/${configuration}] for agent ${agentId}:`, error.message);
        return null;
    }
};

