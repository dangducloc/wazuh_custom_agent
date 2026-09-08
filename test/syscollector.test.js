// /test/syscollector.test.js this test file is used to test the syscollector tools from the Wazuh API.
import {describe, it} from "node:test";
import {
    getAgentHotfixes,
    getAgentNetaddr,
    getAgentNetiface,
    getAgentNetproto,
    getAgentPackages,
    getAgentPorts,
    getAgentProcesses,
    getAgentUsers,
    getAgentGroups,
    getAgentBrowserExtensions,
    getAgentServices,
    getAgentHardware,
    getAgentOs,
    getAgentFullInventory,
} from "../tools/wazuh/api/syscollector/syscollector-tools.js";

const agentId = "003"; // Replace with an actual agent ID

describe("syscollector tools", () => {
    it("should return hotfixes", async () => {
        const result = await getAgentHotfixes(agentId);
        // console.log("Hotfixes:", result);
    });

    it("should return netaddr", async () => {
        const result = await getAgentNetaddr(agentId);
        // console.log("Netaddr:", result);
    });

    it("should return netiface", async () => {
        const result = await getAgentNetiface(agentId);
        // console.log("Netiface:", result);
    });

    it("should return netproto", async () => {
        const result = await getAgentNetproto(agentId);
        // console.log("Netproto:", result);
    });

    it("should return packages", async () => {
        const result = await getAgentPackages(agentId);
        // console.log("Packages:", result);
    });

    it("should return ports", async () => {
        const result = await getAgentPorts(agentId);
        // console.log("Ports:", result);
    });

    it("should return processes", async () => {
        const result = await getAgentProcesses(agentId);
        // console.log("Processes:", result);
    });

    it("should return users", async () => {
        const result = await getAgentUsers(agentId);
        // console.log("Users:", result);
    });

    it("should return groups", async () => {
        const result = await getAgentGroups(agentId);
        // console.log("Groups:", result);
    });

    it("should return browser extensions", async () => {
        const result = await getAgentBrowserExtensions(agentId);
        // console.log("Browser extensions:", result);
    });

    it("should return services", async () => {
        const result = await getAgentServices(agentId);
        // console.log("Services:", result);
    });

    it("should return hardware", async () => {
        const result = await getAgentHardware(agentId);
        // console.log("Hardware:", result);
    });

    it("should return os", async () => {
        const result = await getAgentOs(agentId);
        // console.log("OS:", result);
    });

    it("should return full inventory", async () => {
        const result = await getAgentFullInventory(agentId);
        // console.log("Full inventory:", result);
    });
});