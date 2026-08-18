// file /test/cluster-health.test.js this file is used to test the health of the Wazuh agent and related services. It imports necessary modules, reads environment variables, and exports the health check function for use in other parts of the application.
import {describe, it} from "node:test";
import { HealthCheck } from "../tools/wazuh/health/fetch.cluster-health.js";

describe("cluster health check", () => {
    it("should return a successful response for cluster health", async () => {
        const result = await HealthCheck();
        // Add assertions here based on the expected result
        // console.log("Cluster health check result:", result);
    });
});
