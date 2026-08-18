// /test/alert-indexs.test.js this test file is used to test the fetching of index information from the Wazuh API and sending it to an AI model for processing. It imports necessary modules, reads environment variables, and exports the fetch index function for use in other parts of the application.
import {describe, it} from "node:test";
import { IndexsInfo } from "../tools/wazuh/alerts/fetch.wazuh-alert-indexs.js";

describe("fetch indexs info", () => {
    it("should return a successful response for fetch indexs info", async () => {
        const result = await IndexsInfo();
        // Add assertions here based on the expected result
        // console.log("Fetch indexs info result:", result);
    });
});
