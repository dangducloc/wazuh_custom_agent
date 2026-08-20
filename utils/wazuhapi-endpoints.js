// /utils/wazuhapi-endpoints.js

import { wazuhApiConfig } from "../config/wazuhapi.js";

//agents endpoint
const WAZUH_API_AGENTS_ENDPOINT = {path: "/agents", method: "GET"};

//authenticate endpoint
const WAZUH_API_AUTH_ENDPOINT = {path: "/security/user/authenticate", method: "POST"};

export {
    WAZUH_API_AGENTS_ENDPOINT,
    WAZUH_API_AUTH_ENDPOINT,
};
