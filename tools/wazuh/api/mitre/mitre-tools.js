// /tools/wazuh/api/mitre/mitre-tools.js

import { wazuhApiConfig } from "../../../../config/index.js";
import {
    WAZUH_API_MITRE_ENDPOINT,
    wazuhAxios,
    logger,
    buildHeaders,
    fetchPaginated,
} from "../../../../utils/index.js";

const url_mitre = `${wazuhApiConfig.WAZUH_API_URL}${WAZUH_API_MITRE_ENDPOINT}`;

/**
 * GET /mitre/metadata
 */
export const getMitreMetadata = async () => {
    try {
        const headers = await buildHeaders();
        const response = await wazuhAxios.get(`${url_mitre}/metadata`, {
            headers,
        });

        if (response.status !== 200) {
            throw new Error(`Unexpected status: ${response.status}`);
        }

        return response.data.data.affected_items;
    } catch (error) {
        logger.error({ err: error.message }, "Error fetching MITRE metadata.");
        throw error;
    }
};

/**
 * GET /mitre/tactics
 * @param {string[]} [tacticIds]
 */
export const listMitreTactics = async (
    tacticIds = [],
    params = {},
    fetchAll = true,
    pageSize = 500,
) => {
    try {
        const finalParams = {
            ...params,
            ...(tacticIds.length && { tactic_ids: tacticIds.join(",") }),
        };
        const items = await fetchPaginated(
            `${url_mitre}/tactics`,
            finalParams,
            fetchAll,
            pageSize,
        );
        logger.info({ count: items.length }, "Fetched MITRE tactics.");
        return items;
    } catch (error) {
        logger.error(
            { err: error.message, tacticIds },
            "Error fetching MITRE tactics.",
        );
        throw error;
    }
};

/**
 * GET /mitre/techniques
 * @param {string[]} [techniqueIds] - vd: ["T1059", "T1078"]
 */
export const listMitreTechniques = async (
    techniqueIds = [],
    params = {},
    fetchAll = true,
    pageSize = 500,
) => {
    try {
        const finalParams = {
            ...params,
            ...(techniqueIds.length && {
                technique_ids: techniqueIds.join(","),
            }),
        };
        const items = await fetchPaginated(
            `${url_mitre}/techniques`,
            finalParams,
            fetchAll,
            pageSize,
        );
        logger.info({ count: items.length }, "Fetched MITRE techniques.");
        return items;
    } catch (error) {
        logger.error(
            { err: error.message, techniqueIds },
            "Error fetching MITRE techniques.",
        );
        throw error;
    }
};

/**
 * GET /mitre/mitigations
 * @param {string[]} [mitigationIds]
 */
export const listMitreMitigations = async (
    mitigationIds = [],
    params = {},
    fetchAll = true,
    pageSize = 500,
) => {
    try {
        const finalParams = {
            ...params,
            ...(mitigationIds.length && {
                mitigation_ids: mitigationIds.join(","),
            }),
        };
        const items = await fetchPaginated(
            `${url_mitre}/mitigations`,
            finalParams,
            fetchAll,
            pageSize,
        );
        logger.info({ count: items.length }, "Fetched MITRE mitigations.");
        return items;
    } catch (error) {
        logger.error(
            { err: error.message, mitigationIds },
            "Error fetching MITRE mitigations.",
        );
        throw error;
    }
};

/**
 * GET /mitre/software
 * @param {string[]} [softwareIds]
 */
export const listMitreSoftware = async (
    softwareIds = [],
    params = {},
    fetchAll = true,
    pageSize = 500,
) => {
    try {
        const finalParams = {
            ...params,
            ...(softwareIds.length && { software_ids: softwareIds.join(",") }),
        };
        const items = await fetchPaginated(
            `${url_mitre}/software`,
            finalParams,
            fetchAll,
            pageSize,
        );
        logger.info({ count: items.length }, "Fetched MITRE software.");
        return items;
    } catch (error) {
        logger.error(
            { err: error.message, softwareIds },
            "Error fetching MITRE software.",
        );
        throw error;
    }
};

/**
 * GET /mitre/groups
 * @param {string[]} [groupIds]
 */
export const listMitreGroups = async (
    groupIds = [],
    params = {},
    fetchAll = true,
    pageSize = 500,
) => {
    try {
        const finalParams = {
            ...params,
            ...(groupIds.length && { group_ids: groupIds.join(",") }),
        };
        const items = await fetchPaginated(
            `${url_mitre}/groups`,
            finalParams,
            fetchAll,
            pageSize,
        );
        logger.info({ count: items.length }, "Fetched MITRE groups.");
        return items;
    } catch (error) {
        logger.error(
            { err: error.message, groupIds },
            "Error fetching MITRE groups.",
        );
        throw error;
    }
};

/**
 * GET /mitre/references
 * @param {string[]} [referenceIds]
 */
export const listMitreReferences = async (
    referenceIds = [],
    params = {},
    fetchAll = true,
    pageSize = 500,
) => {
    try {
        const finalParams = {
            ...params,
            ...(referenceIds.length && {
                reference_ids: referenceIds.join(","),
            }),
        };
        const items = await fetchPaginated(
            `${url_mitre}/references`,
            finalParams,
            fetchAll,
            pageSize,
        );
        logger.info({ count: items.length }, "Fetched MITRE references.");
        return items;
    } catch (error) {
        logger.error(
            { err: error.message, referenceIds },
            "Error fetching MITRE references.",
        );
        throw error;
    }
};
