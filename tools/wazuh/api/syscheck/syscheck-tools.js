// //tools/wazuh/api/syscheck/syscheck-tools.js
import { wazuhApiConfig } from "../../../../config/index.js";
import {wazuhAxios,WAZUH_API_SYSCHECK_ENDPOINT, logger, buildHeaders, fetchPaginated} from "../../../../utils/index.js";

const url_syscheck = `${wazuhApiConfig.WAZUH_API_URL}${WAZUH_API_SYSCHECK_ENDPOINT}`;

// @param {string[]} [agentIds] - if omitted, runs on ALL agents 
export const runSyscheckScan = async (agentIds = []) => {
    try {
        const headers = await buildHeaders();
        const params = agentIds.length ? { agents_list: agentIds.join(",") } : {};

        const response = await wazuhAxios.put(url_syscheck, null, { headers, params });

        if (response.status !== 200) {
            throw new Error(`Unexpected status: ${response.status}`);
        }

        logger.info(
            { agentIds: agentIds.length ? agentIds : "ALL", affected: response.data.data.total_affected_items },
            "Syscheck scan triggered."
        );
        return response.data.data;
    } catch (error) {
        logger.error({ err: error.message, agentIds }, "Error triggering syscheck scan.");
        throw error;
    }
};

export const getSyscheckResults = async (agentId, params = {}, fetchAll = true, pageSize = 500) => {
    try {
        const url = `${url_syscheck}/${agentId}`;
        const findings = await fetchPaginated(url, params, fetchAll, pageSize);
        logger.info({ agentId, count: findings.length }, "Fetched syscheck results.");
        return findings;
    } catch (error) {
        logger.error({ err: error.message, agentId, params }, "Error fetching syscheck results.");
        throw error;
    }
};

export const getSyscheckSummary = async (agentId, params = {}) => {
    return getSyscheckResults(agentId, { ...params, summary: true });
};

// DELETE /syscheck/{agent_id} — clear FIM data 
export const clearSyscheckResults = async (agentId) => {
    try {
        const headers = await buildHeaders();
        const response = await wazuhAxios.delete(`${url_syscheck}/${agentId}`, { headers });

        if (response.status !== 200) {
            throw new Error(`Unexpected status: ${response.status}`);
        }

        logger.info({ agentId }, "Syscheck results cleared (legacy agent).");
        return response.data.data;
    } catch (error) {
        logger.error({ err: error.message, agentId }, "Error clearing syscheck results.");
        throw error;
    }
};


export const getSyscheckLastScan = async (agentId) => {
    try {
        const headers = await buildHeaders();
        const response = await wazuhAxios.get(`${url_syscheck}/${agentId}/last_scan`, { headers });

        if (response.status !== 200) {
            throw new Error(`Unexpected status: ${response.status}`);
        }

        return response.data.data.affected_items[0]; // { start, end }
    } catch (error) {
        logger.error({ err: error.message, agentId }, "Error fetching last syscheck scan info.");
        throw error;
    }
};

