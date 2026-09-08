// tools/wazuh/api/sca/sca-tools.js
import {
    WAZUH_API_SCA_ENDPOINT,
    logger,
    fetchPaginated,
} from "../../../../utils/index.js";
import { wazuhApiConfig } from "../../../../config/index.js";

const url_sca = `${wazuhApiConfig.WAZUH_API_URL}${WAZUH_API_SCA_ENDPOINT}`;

export const listAgentScaPolicies = async (
    agentId,
    params = {},
    fetchAll = true,
    pageSize = 500,
) => {
    try {
        const url = `${url_sca}/${agentId}`;
        const policies = await fetchPaginated(url, params, fetchAll, pageSize);
        logger.info(
            { agentId, count: policies.length },
            "Fetched SCA policies for agent.",
        );
        return policies;
    } catch (error) {
        logger.error(
            { err: error.message, agentId, params },
            "Error fetching SCA policies.",
        );
        throw error;
    }
};

export const listPolicyChecks = async (
    agentId,
    policyId,
    params = {},
    fetchAll = true,
    pageSize = 500,
) => {
    try {
        const url = `${url_sca}/${agentId}/checks/${policyId}`;
        const checks = await fetchPaginated(url, params, fetchAll, pageSize);
        logger.info(
            { agentId, policyId, count: checks.length },
            "Fetched SCA policy checks.",
        );
        return checks;
    } catch (error) {
        logger.error(
            { err: error.message, agentId, policyId, params },
            "Error fetching SCA policy checks.",
        );
        throw error;
    }
};

export const listFailedPolicyChecks = async (agentId, policyId) => {
    return listPolicyChecks(agentId, policyId, { result: "failed" });
};
