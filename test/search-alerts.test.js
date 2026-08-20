// /file /test/search-alerts.test.js describes a test suite for the AlertsSearch function, which fetches alerts from OpenSearch using the endpoints defined in utils/opensearch-endpoints.js. The test suite uses Jest to mock the fetch function and test the behavior of AlertsSearch under different scenarios.
import { AlertsSearch } from "../tools/wazuh/opensearch/alerts/fetch.alerts-searchs.js";
import {describe,it} from "node:test";

describe("AlertsSearch", () => {
    it("should return a successful response for AlertsSearch", async () => {
        const body = {
            "query": {
                "term": { "agent.id": "003" }
            }
        };
        const result = await AlertsSearch(body);
        // Add assertions here based on the expected result
        // console.dir(result, { depth: null });
    });
    it("this search on rule.group should return a successful response for AlertsSearch", async () => {
        const body ={ "query": { "bool": { "filter": [ {"range": { "@timestamp": { "gte": "now-30d" } } }, {"match": { "rule.groups": "web" }}, {"term":{"agent.id":"003"}} ] } }, "size": 1000 };
        const result = await AlertsSearch(body);
        // Add assertions here based on the expected result
        // console.dir(result, { depth: null });
    });
});
