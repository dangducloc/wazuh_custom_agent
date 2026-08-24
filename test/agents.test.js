// /test/agents.test.js this test file is used to test the fetching of agent information from the Wazuh API and sending it to an AI model for processing. It imports necessary modules, reads environment variables, and exports the fetch agent function for use in other parts of the application.
import {describe, it} from "node:test";
import { getAgentList,getAgentById,assignAgentToGroup,removeAgentFromGroups} from "../tools/wazuh/api/agent/agent-tools.js";
import { getAgentActiveConfig } from "../tools/wazuh/api/agent/agent-config-tools.js";

describe("agent tools", () => {
    it("should return a successful response for fetch agent list", async () => {
        const result = await getAgentList();
        // Add assertions here based on the expected result
        // console.log("Fetch agent list result:", result);
    });

    it("should return a successful response for fetch agent by ID", async () => {
        const agentId = "003"; // Replace with an actual agent ID
        const result = await getAgentById(agentId);
        // Add assertions here based on the expected result
        // console.log("Fetch agent by ID result:", result);
    });

    it("should return a successful response for fetch agent active config", async () => {
        const agentId = "003"; // Replace with an actual agent ID
        const component = "agent"; // Replace with an actual component
        const configuration = "client"; // Replace with an actual configuration
        const result = await getAgentActiveConfig(agentId, component, configuration);
        // Add assertions here based on the expected result
        // console.log("Fetch agent active config result:", result);
    });
    it("manager configuration", async () => {
        const agentId = "000"; // Replace with an actual agent ID
        const component = "syscheck"; // Valid component
        const configuration = "rootcheck"; // Valid configuration
        const result = await getAgentActiveConfig(agentId, component, configuration);
        // Add assertions here based on the expected result
        // console.log("Fetch agent active config with valid pair result:", result);
    });

    it("should return an error for invalid component/configuration pair", async () => {
        const agentId = "003"; // Replace with an actual agent ID
        const component = "invalid_component"; // Invalid component
        const configuration = "invalid_configuration"; // Invalid configuration
        const result = await getAgentActiveConfig(agentId, component, configuration);
        // Add assertions here based on the expected result
        // console.log("Fetch agent active config with invalid pair result:", result);
    });

    it("should return a successful response for assign agent to group", async () => {
        const agentId = "003";
        const groupId = "test1"; // Replace with an actual group ID
        const result = await assignAgentToGroup(agentId, groupId);
        // Add assertions here based on the expected result
        // console.log("Assign agent to group result:", result);
    });

    it("should return a successful response for remove agent from groups", async () => {
        const agentId = "003";
        const groupIds = ["test1"]; // Replace with actual group IDs
        const result = await removeAgentFromGroups(agentId, groupIds);
        // Add assertions here based on the expected result
        console.log("Remove agent from groups result:", result);
    });

});
