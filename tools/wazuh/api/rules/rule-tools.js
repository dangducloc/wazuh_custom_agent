// /tools/wazuh/api/rules/rule-tools.js
import { wazuhApiConfig } from "../../../../config/index.js";
import {
    WAZUH_API_RULES_ENDPOINT,
    wazuhAxios,
    logger,
    buildHeaders,
    fetchPaginated,
} from "../../../../utils/index.js";

const url_rules = `${wazuhApiConfig.WAZUH_API_URL}${WAZUH_API_RULES_ENDPOINT}`;
const url_rules_files = `${url_rules}/files`;
const url_rules_groups = `${url_rules}/groups`;

/** GET /rules */
export const listRules = async (
    params = {},
    fetchAll = true,
    pageSize = 500,
) => {
    try {
        const rules = await fetchPaginated(
            url_rules,
            params,
            fetchAll,
            pageSize,
        );
        logger.info({ count: rules.length }, "Fetched rules from Wazuh.");
        return rules;
    } catch (error) {
        logger.error({ err: error.message, params }, "Error fetching rules.");
        throw error;
    }
};

/** GET /rules/groups */
export const listRuleGroups = async (
    params = {},
    fetchAll = true,
    pageSize = 500,
) => {
    try {
        const groups = await fetchPaginated(
            url_rules_groups,
            params,
            fetchAll,
            pageSize,
        );
        logger.info(
            { count: groups.length },
            "Fetched rule groups from Wazuh.",
        );
        return groups;
    } catch (error) {
        logger.error(
            { err: error.message, params },
            "Error fetching rule groups.",
        );
        throw error;
    }
};

/**
 * GET /rules/requirement/{requirement}
 * @param {"pci_dss"|"gdpr"|"hipaa"|"nist-800-53"|"gpg13"|"tsc"|"mitre"} requirement
 */
export const listRuleRequirement = async (
    requirement,
    params = {},
    fetchAll = true,
    pageSize = 500,
) => {
    try {
        const url = `${url_rules}/requirement/${requirement}`;
        const items = await fetchPaginated(url, params, fetchAll, pageSize);
        logger.info(
            { requirement, count: items.length },
            "Fetched rule requirement names.",
        );
        return items;
    } catch (error) {
        logger.error(
            { err: error.message, requirement, params },
            "Error fetching rule requirement.",
        );
        throw error;
    }
};

/** GET /rules/files */
export const listRuleFiles = async (
    params = {},
    fetchAll = true,
    pageSize = 500,
) => {
    try {
        const files = await fetchPaginated(
            url_rules_files,
            params,
            fetchAll,
            pageSize,
        );
        logger.info({ count: files.length }, "Fetched rule files list.");
        return files;
    } catch (error) {
        logger.error(
            { err: error.message, params },
            "Error fetching rule files.",
        );
        throw error;
    }
};

/**
 * GET /rules/files/{filename} — get raw XML content of a rule file
 * @param {string} filename
 * @param {string} [relativeDirname]
 * @returns {Promise<string>} raw XML content
 */
export const getRuleFileContent = async (filename, relativeDirname) => {
    try {
        const headers = await buildHeaders();
        const response = await wazuhAxios.get(
            `${url_rules_files}/${filename}`,
            {
                headers,
                params: {
                    raw: true,
                    ...(relativeDirname && {
                        relative_dirname: relativeDirname,
                    }),
                },
            },
        );

        if (response.status !== 200) {
            throw new Error(`Unexpected status: ${response.status}`);
        }

        return response.data; // raw XML string when raw=true
    } catch (error) {
        logger.error(
            { err: error.message, filename },
            "Error fetching rule file content.",
        );
        throw error;
    }
};

/**
 * PUT /rules/files/{filename} — upload/replace a custom rule file
 * @param {string} filename
 * @param {string} xmlContent - raw XML content
 * @param {Object} [options]
 * @param {boolean} [options.overwrite=false]
 * @param {string} [options.relativeDirname]
 */
export const updateRuleFile = async (
    filename,
    xmlContent,
    { overwrite = false, relativeDirname } = {},
) => {
    try {
        const headers = {
            ...(await buildHeaders()),
            "Content-Type": "application/octet-stream",
        };

        const response = await wazuhAxios.put(
            `${url_rules_files}/${filename}`,
            xmlContent,
            {
                headers,
                params: {
                    overwrite,
                    ...(relativeDirname && {
                        relative_dirname: relativeDirname,
                    }),
                },
            },
        );

        if (response.status !== 200) {
            throw new Error(`Unexpected status: ${response.status}`);
        }

        logger.info(
            { filename, overwrite },
            "Rule file uploaded successfully.",
        );
        return response.data;
    } catch (error) {
        logger.error(
            { err: error.message, filename },
            "Error uploading rule file.",
        );
        throw error;
    }
};

/**
 * DELETE /rules/files/{filename} — delete a custom rule file
 * @param {string} filename
 * @param {string} [relativeDirname]
 */
export const deleteRuleFile = async (filename, relativeDirname) => {
    try {
        const headers = await buildHeaders();
        const response = await wazuhAxios.delete(
            `${url_rules_files}/${filename}`,
            {
                headers,
                params: {
                    ...(relativeDirname && {
                        relative_dirname: relativeDirname,
                    }),
                },
            },
        );

        if (response.status !== 200) {
            throw new Error(`Unexpected status: ${response.status}`);
        }

        logger.info({ filename }, "Rule file deleted successfully.");
        return response.data;
    } catch (error) {
        logger.error(
            { err: error.message, filename },
            "Error deleting rule file.",
        );
        throw error;
    }
};
