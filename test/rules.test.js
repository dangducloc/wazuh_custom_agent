import { listRules } from "../tools/wazuh/api/rules/rule-tools.js";
import {describe, it} from "node:test";
import { logger } from "../utils/index.js";


describe("rules tools", () => {
    it("should return a successful response for fetch rules list", async () => {
        const result = await listRules();
        // console.log("Rules List:", result);
    });
    it("test with params", async () => {
        const rules = await listRules({ status: "enabled", mitre: "T1059" });
        // console.log("Rules List with Params:", result);
    });
    it("test select ", async () => {
        const rules = await listRules({ select: "id,description,level" });;
        // console.log("Rules List with Pagination:", rules);
    });
    it
});
