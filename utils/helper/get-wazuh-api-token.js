// /utils/get-token.js
import path from "path";
import fs from "fs";
import https from "https";
import axios from "axios";
import { wazuhApiConfig } from "../../config/index.js";
import { WAZUH_API_AUTH_ENDPOINT, wazuhAxios } from "../index.js";

const __dirname = import.meta.dirname;
const tokenFilePath = path.join(__dirname, "../../", "cache", "token.json");

const {
    WAZUH_API_URL,
    WAZUH_API_USERNAME,
    WAZUH_API_PASSWORD,
    // Default false for safety; set = "true" in .env if using a self-signed cert in dev
    WAZUH_API_REJECT_UNAUTHORIZED = "true",
    // Wazuh token lifetime (seconds); default 900s (15 minutes) per standard Wazuh config
    WAZUH_TOKEN_TTL_SECONDS = "900",
} = wazuhApiConfig;

const TOKEN_TTL_MS = Number(WAZUH_TOKEN_TTL_SECONDS) * 1000;
const REJECT_UNAUTHORIZED = WAZUH_API_REJECT_UNAUTHORIZED !== "false";

// Lock to prevent concurrent requests from both calling setToken() when the token is missing or expired
let pendingAuth = null;

/**
 * Calls the Wazuh API to fetch a new token and persists it to a cache file along with its expiry time.
 * @returns {Promise<string>} token
 */
export const setToken = async () => {
    const baseUrl = WAZUH_API_URL + WAZUH_API_AUTH_ENDPOINT;
    const username = WAZUH_API_USERNAME;
    const password = WAZUH_API_PASSWORD;

    if (!WAZUH_API_URL) throw new Error("Wazuh API baseUrl is undefined");
    if (!username) throw new Error("Wazuh API username is undefined");
    if (!password) throw new Error("Wazuh API password is undefined");

    try {
        const response = await wazuhAxios.post(
            baseUrl,
            {},
            { auth: { username, password } }, // không cần httpsAgent riêng nữa, đã có sẵn trong wazuhAxios
        );

        const token = response.data.data.token;
        const expiresAt = Date.now() + TOKEN_TTL_MS;
        console.log("Token retrieved successfully.");

        await fs.promises.mkdir(path.dirname(tokenFilePath), {
            recursive: true,
        });
        await fs.promises.writeFile(
            tokenFilePath,
            JSON.stringify({ token, expiresAt }, null, 2),
            "utf-8",
        );

        return token;
    } catch (error) {
        console.error(
            "Error setting Wazuh API token:",
            error.response?.data || error.message,
        );
        throw error;
    }
};

/**
 * Returns a valid token: reads from the cache if still valid, otherwise refreshes automatically.
 * Safe for concurrent calls (parallel invocations trigger only one setToken).
 * @returns {Promise<string>} token
 */
export const getToken = async () => {
    try {
        if (fs.existsSync(tokenFilePath)) {
            const raw = await fs.promises.readFile(tokenFilePath, "utf-8");
            const { token, expiresAt } = JSON.parse(raw);
            if (token && expiresAt && Date.now() < expiresAt - 5000) {
                return token;
            }
        }
    } catch (error) {
        console.error(
            "Error reading cached token, will refresh:",
            error.message,
        );
    }
    if (!pendingAuth) {
        pendingAuth = setToken().finally(() => {
            pendingAuth = null;
        });
    }

    return pendingAuth;
};

export const buildHeaders = async () => ({
    Authorization: `Bearer ${await getToken()}`,
});

/**
 * Generic paginated GET helper for Wazuh list endpoints
 * (works for /rules, /rules/groups, /rules/requirement/{req}, /rules/files, etc.)
 *
 * @param {string} url
 * @param {Object} [params]
 * @param {boolean} [fetchAll=true]
 * @param {number} [pageSize=500]
 * @returns {Promise<Array>}
 */
export const fetchPaginated = async (url, params = {}, fetchAll = true, pageSize = 500) => {
    const headers = await buildHeaders();

    let offset = 0;
    const firstResponse = await wazuhAxios.get(url, {
        headers,
        params: { ...params, offset, limit: pageSize },
    });

    if (firstResponse.status !== 200) {
        throw new Error(`Unexpected status: ${firstResponse.status}`);
    }

    const { affected_items, total_affected_items } = firstResponse.data.data;
    let items = [...affected_items];

    if (fetchAll && total_affected_items > items.length) {
        const requests = [];
        for (offset = pageSize; offset < total_affected_items; offset += pageSize) {
            requests.push(
                wazuhAxios.get(url, { headers, params: { ...params, offset, limit: pageSize } })
            );
        }
        const responses = await Promise.all(requests);
        for (const res of responses) {
            items = items.concat(res.data.data.affected_items);
        }
    }

    return items;
};