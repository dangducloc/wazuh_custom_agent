// /utils/wazuhapi-endpoints.js

import { wazuhApiConfig } from "../config/wazuhapi.js";

//agents endpoint
const WAZUH_API_AGENTS_ENDPOINT = "/agents";

//authenticate endpoint
const WAZUH_API_AUTH_ENDPOINT = "/security/user/authenticate";

import https from "node:https";
import axios from "axios";
const wazuhAxios = axios.create({
    httpsAgent: new https.Agent({ rejectUnauthorized: false }),
});

export {
    WAZUH_API_AGENTS_ENDPOINT,
    WAZUH_API_AUTH_ENDPOINT,
    wazuhAxios, 
};
