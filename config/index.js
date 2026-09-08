// file config/index.js is an entry point for the configuration of the application. It imports the configured AI Gateway instance from config/model.js and exports it for use in other parts of the application.

export { modelConfig} from "./model.js";
export { opensearchConfig } from "./opensearch.js";
export { wazuhApiConfig } from "./wazuhapi.js";
