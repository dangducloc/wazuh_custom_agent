// /test/groups.test.js
import { getGroupList,createGroup,deleteGroup } from "../tools/wazuh/api/groups/groups-tools.js";
import {describe, it} from "node:test";
import { logger } from "../utils/index.js";

describe("group tools", () => {
    it("should return a successful response for fetch group list", async () => {
        const result = await getGroupList();
        logger.info("Group List:", result);
    });
    it("should return a successful response for create group", async () => {
        // const group_id = "test4";
        // const result = await createGroup("test3");
        // const result1 = await createGroup("test4");
        // logger.info("Create Group Result:", result);
    });
    it("should return a successful response for delete group", async () => {
        const group_id = ["test3", "test4"];
        const result = await deleteGroup(group_id);
        // logger.info("Delete Group Result:", result);
    });
});