// file config/opensearch.js this file is used to configure the OpenSearch client for the application. It imports necessary modules, reads environment variables, and exports the configured OpenSearch client instance for use in other parts of the application.

import { createAiGateway } from "ai-gateway-provider";
import dotenv from "dotenv";
import path from "path";

dotenv.config({
  path: path.resolve(import.meta.dirname, '../.env'),
});

const OPENSEARCH_URL = process.env.OPENSEARCH_URL || "Missing OPENSEARCH_URL environment variable";
const OPENSEARCH_USERNAME = process.env.OPENSEARCH_USERNAME || "Missing OPENSEARCH_USERNAME environment variable";
const OPENSEARCH_PASSWORD = process.env.OPENSEARCH_PASSWORD || "Missing OPENSEARCH_PASSWORD environment variable";
const OPENSEARCH_HEADERS = {
  "Content-Type": "application/json",
  "Authorization": `Basic ${btoa(`${OPENSEARCH_USERNAME}:${OPENSEARCH_PASSWORD}`)}`,
};

export const opensearchConfig = { OPENSEARCH_URL, OPENSEARCH_USERNAME, OPENSEARCH_PASSWORD, OPENSEARCH_HEADERS };


