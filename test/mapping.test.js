// /test/mapping.test.js test mapping funcs

import {describe, it} from "node:test";
import {AlertsMapping} from "../tools/wazuh/mapping/alert.mapping.js";

describe("Wazuh Alerts Mapping", () => {
    it("should fetch the mapping for Wazuh alerts indices", async () => {
        const mapping = await AlertsMapping();
        // Add assertions here
        // console.log("Wazuh alerts mapping:", mapping);
    });
});