// /test/syscheck.test.js this test file is used to test the syscheck (FIM) tools from the Wazuh API.
import {describe, it} from "node:test";
import {
    runSyscheckScan,
    getSyscheckResults,
    getSyscheckSummary,
    clearSyscheckResults,
    getSyscheckLastScan,
} from "../tools/wazuh/api/syscheck/syscheck-tools.js";

describe("syscheck tools", () => {
    it("should return a successful response for get syscheck results", async () => {
        const agentId = "003"; // Replace with an actual agent ID
        const result = await getSyscheckResults(agentId);
        // console.log("Syscheck results:", result);
    });

    it("should return a successful response for get syscheck summary", async () => {
        const agentId = "003"; // Replace with an actual agent ID
        const result = await getSyscheckSummary(agentId);
        // console.log("Syscheck summary:", result);
    });

    it("should return a successful response for get last syscheck scan", async () => {
        const agentId = "003"; // Replace with an actual agent ID
        const result = await getSyscheckLastScan(agentId);
        // console.log("Last syscheck scan:", result);
    });

    it("should trigger a syscheck scan", async () => {
        const agentIds = ["003"];
        const result = await runSyscheckScan(agentIds);
        // console.log("Syscheck scan result:", result);
    });

    it("should clear syscheck results", async () => {
        const agentId = "003";
        const result = await clearSyscheckResults(agentId);
        // console.log("Clear syscheck result:", result);
    });
});