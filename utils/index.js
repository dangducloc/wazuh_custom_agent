// file utils/index.js this file is used to configure the logger for the application. It imports necessary modules, reads environment variables, and exports the configured logger instance for use in other parts of the application.
export { logger } from "./logger.js";

export * from "./opensearch-endpoints.js";

export * from "./wazuhapi-endpoints.js";

export * from "./helper/xml-checker.js";

//format
export { table2Json } from "./format/table2json.js";

//helper
export * from "./helper.js";

export { getToken, buildHeaders, fetchPaginated } from "./helper/get-wazuh-api-token.js";
export { isValidAgentConfig } from "./helper/isValidAgentConfig.js";
