// /config/wazuhapi.js

import dotenv from "dotenv";
import path from "path";

dotenv.config({
  path: path.resolve(import.meta.dirname, '../.env'),
});


const WAZUH_API_URL = process.env.WAZUH_API_URL || "Missing WAZUH_API_URL environment variable";
const WAZUH_API_USERNAME = process.env.WAZUH_API_USERNAME || "Missing WAZUH_API_USERNAME environment variable";
const WAZUH_API_PASSWORD = process.env.WAZUH_API_PASSWORD || "Missing WAZUH_API_PASSWORD environment variable";

export const wazuhApiConfig = {WAZUH_API_URL, WAZUH_API_USERNAME, WAZUH_API_PASSWORD};



