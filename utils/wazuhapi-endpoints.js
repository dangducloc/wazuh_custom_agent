// /utils/wazuhapi-endpoints.js

//agents endpoint
const WAZUH_API_AGENTS_ENDPOINT = "/agents";

//authenticate endpoint
const WAZUH_API_AUTH_ENDPOINT = "/security/user/authenticate";

//groups endpoint
const WAZUH_API_GROUPS_ENDPOINT = "/groups";

//rules endpoint
const WAZUH_API_RULES_ENDPOINT = "/rules";

//mitre endpoint
const WAZUH_API_MITRE_ENDPOINT = "/mitre";

import https from "node:https";
import axios from "axios";
const wazuhAxios = axios.create({
    httpsAgent: new https.Agent({ rejectUnauthorized: false }),
});

export {
    WAZUH_API_AGENTS_ENDPOINT,
    WAZUH_API_AUTH_ENDPOINT,
    WAZUH_API_GROUPS_ENDPOINT,
    WAZUH_API_RULES_ENDPOINT,
    WAZUH_API_MITRE_ENDPOINT,
    wazuhAxios, 
};
