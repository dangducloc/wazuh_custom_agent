// /test/count-alert.test.js is a test file that uses the Jest testing framework to test the functionality of the fetch.wazuh-alert-count.js script.
import { describe, it } from "node:test";
import { AlertsCountInfo } from "../tools/wazuh/opensearch/alerts/fetch.alerts-count.js";
import { logger } from "../utils/index.js";

describe("AlertsCountInfo", () => {
    it("should fetch all alerts count successfully", async () => {
        const body = {};
        const result = await AlertsCountInfo(body);
        // Add assertions here to verify the result
    });
    it("filter by agent should fetch alerts count successfully", async () => {
        const body = {query:{ term: { "agent.id": "001" } }};
        const result = await AlertsCountInfo(body);
        // Add assertions here to verify the result
    });
    it("filter by time range should fetch alerts count successfully", async () => {
        const body = {
            query: {
                bool: {
                    filter: [
                        { range: { "@timestamp": { gte: "now-30d" } } },
                        { range: { "rule.level": { gte: 1, lte: 10 } } },
                    ],
                },
            },
        };
        const result = await AlertsCountInfo(body);
        // console.log("result", result);
    });
    it("filter by time and agent should fetch alerts count successfully", async () => {
        const body = {
            query: {
                bool: {
                    filter: [
                        { range: { "@timestamp": { gte: "now-4d" } } },
                        { term: { "agent.id": "003" } },
                    ],
                },
            },
        };
        const result = await AlertsCountInfo(body);
        // console.log("result", result);
    });
});

