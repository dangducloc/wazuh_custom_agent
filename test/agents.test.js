// /test/agents.test.js this test file is used to test the fetching of agent information from the Wazuh API and sending it to an AI model for processing. It imports necessary modules, reads environment variables, and exports the fetch agent function for use in other parts of the application.
import {describe, it} from "node:test";
import { getAgentList } from "../tools/wazuh/api/agent/agent-tools.js";

describe("fetch agent list", () => {
    it("should return a successful response for fetch agent list", async () => {
        const result = await getAgentList();
        // Add assertions here based on the expected result
        console.log("Fetch agent list result:", result);
    });
});
