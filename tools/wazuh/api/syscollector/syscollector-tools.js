// /tools/wazuh/api/syscollector/syscollector-tools.js
import { wazuhApiConfig } from "../../../../config/index.js";
import {wazuhAxios,WAZUH_API_SYSCOLLECTOR_ENDPOINT, logger, buildHeaders, fetchPaginated} from "../../../../utils/index.js";

const url_syscollector = `${wazuhApiConfig.WAZUH_API_URL}${WAZUH_API_SYSCOLLECTOR_ENDPOINT}`;

const PAGINATED_RESOURCES = [
    "hotfixes",
    "netaddr",
    "netiface",
    "netproto",
    "packages",
    "ports",
    "processes",
    "users",
    "groups",
    "browser_extensions",
    "services",
];

// Resources that return a single object, no pagination (only `select` supported)
const SINGLE_OBJECT_RESOURCES = ["hardware", "os"];

const createPaginatedGetter = (resource) => {
    return async (agentId, params = {}, fetchAll = true, pageSize = 500) => {
        try {
            const url = `${url_syscollector}/${agentId}/${resource}`;
            const items = await fetchPaginated(url, params, fetchAll, pageSize);
            logger.info({ agentId, resource, count: items.length }, `Fetched syscollector ${resource}.`);
            return items;
        } catch (error) {
            logger.error({ err: error.message, agentId, resource, params }, `Error fetching syscollector ${resource}.`);
            throw error;
        }
    };
};

const createSingleObjectGetter = (resource) => {
    return async (agentId, params = {}) => {
        try {
            const headers = await buildHeaders();
            const url = `${url_syscollector}/${agentId}/${resource}`;
            const response = await wazuhAxios.get(url, { headers, params });

            if (response.status !== 200) {
                throw new Error(`Unexpected status: ${response.status}`);
            }

            return response.data.data.affected_items[0] ?? null;
        } catch (error) {
            logger.error({ err: error.message, agentId, resource }, `Error fetching syscollector ${resource}.`);
            throw error;
        }
    };
};

export const getAgentHotfixes = createPaginatedGetter("hotfixes");
export const getAgentNetaddr = createPaginatedGetter("netaddr");
export const getAgentNetiface = createPaginatedGetter("netiface");
export const getAgentNetproto = createPaginatedGetter("netproto");
export const getAgentPackages = createPaginatedGetter("packages");
export const getAgentPorts = createPaginatedGetter("ports");
export const getAgentProcesses = createPaginatedGetter("processes");
export const getAgentUsers = createPaginatedGetter("users");
export const getAgentGroups = createPaginatedGetter("groups");
export const getAgentBrowserExtensions = createPaginatedGetter("browser_extensions");
export const getAgentServices = createPaginatedGetter("services");

export const getAgentHardware = createSingleObjectGetter("hardware");
export const getAgentOs = createSingleObjectGetter("os");


export const getAgentFullInventory = async (agentId) => {
    try {
        const [hardware, os, packages, ports, processes, users] = await Promise.all([
            getAgentHardware(agentId),
            getAgentOs(agentId),
            getAgentPackages(agentId),
            getAgentPorts(agentId),
            getAgentProcesses(agentId),
            getAgentUsers(agentId),
        ]);

        return { hardware, os, packages, ports, processes, users };
    } catch (error) {
        logger.error({ err: error.message, agentId }, "Error fetching full agent inventory.");
        throw error;
    }
};