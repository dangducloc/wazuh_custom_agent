// /test/sca.test.js this test file is used to test the fetching of SCA (Security Configuration Assessment) policies and checks from the Wazuh API.
import {describe, it} from "node:test";
import { listAgentScaPolicies, listPolicyChecks, listFailedPolicyChecks } from "../tools/wazuh/api/sca/sca-tools.js";

describe("SCA tools", () => {
    it("should return a successful response for list SCA policies", async () => {
        const agentId = "003"; // Replace with an actual agent ID
        const result = await listAgentScaPolicies(agentId);
        // console.log("SCA policies result:", result);
    });

    it("should return a successful response for list policy checks", async () => {
        const agentId = "003"; // Replace with an actual agent ID
        const policyId = "cis_ubuntu22-04"; // Replace with an actual policy ID
        const result = await listPolicyChecks(agentId, policyId);
        // console.log("SCA policy checks result:", result);
    });

    it("should return a successful response for list failed policy checks", async () => {
        const agentId = "003"; // Replace with an actual agent ID
        const policyId = "cis_ubuntu22-04"; // Replace with an actual policy ID
        const result = await listFailedPolicyChecks(agentId, policyId);
        // console.log("SCA failed policy checks result:", result);
    });
});