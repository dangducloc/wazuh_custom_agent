// /tools/wazuh/api/groups/groups-tools.js
import { logger, wazuhAxios, WAZUH_API_GROUPS_ENDPOINT,getToken } from "../../../../utils/index.js";
import { wazuhApiConfig } from "../../../../config/index.js";

const { WAZUH_API_URL } = wazuhApiConfig;

export const getGroupList = async () => {
    const token = await getToken();
    const baseUrl = WAZUH_API_URL + WAZUH_API_GROUPS_ENDPOINT;
    try {
        const response = await wazuhAxios.get(baseUrl, {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (response.status === 200) {
            const groups = response.data.data;
            logger.info("Retrieved group list:", groups);
            return groups;
        }       logger.error("Failed to retrieve group list. Status code:", response.status);   
        return null;
    } catch (error) {
        logger.error("Error retrieving group list:", error.message);
        return null;
    }   
};

export const createGroup = async (group_id) => {
    const token = await getToken();
    const baseUrl = WAZUH_API_URL + WAZUH_API_GROUPS_ENDPOINT;
    try {
        const response = await wazuhAxios.post(baseUrl, { group_id }, {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (response.status === 200) {
            logger.info("Group created successfully:", response.data);
            return response.data;
        }
        logger.error("Failed to create group. Status code:", response.status);
        return null;
    } catch (error) {
        logger.error("Error creating group:", error.message);
        return null;
    }
};

export const deleteGroup = async (group_id=[]) => {
    // group_id=test3,test4,...
    const token = await getToken();
    const baseUrl = `${WAZUH_API_URL}${WAZUH_API_GROUPS_ENDPOINT}?groups_list=${group_id.join(",")}`;
    try {
        const response = await wazuhAxios.delete(baseUrl, {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (response.status === 200) {
            logger.info("Group deleted successfully:", response.data);
            return response.data;
        }
        logger.error("Failed to delete group. Status code:", response.status);
        return null;
    } catch (error) {
        logger.error("Error deleting group:", error.message);
        return null;
    }
};
