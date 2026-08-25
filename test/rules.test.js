// /test/rules.test.js
import {
    listRules,
    listRuleGroups,
    listRuleRequirement,
    listRuleFiles,
    getRuleFileContent,
    updateRuleFile,
    deleteRuleFile,
} from "../tools/wazuh/api/rules/rule-tools.js";
import { describe, it } from "node:test";
import { logger } from "../utils/index.js";

const TEST_FILE = "agent_test_rules.xml";
const TEST_RULE_ID = "119999";
const TEST_XML = `<group name="agent_test,">
  <rule id="${TEST_RULE_ID}" level="3">
    <match>AGENT_TEST_TRIGGER_STRING</match>
    <description>Agent integration test rule.</description>
  </rule>
</group>
`;

describe("rules tools", () => {
    it("should return a successful response for fetch rules list", async () => {
        const result = await listRules({}, false, 10);
        logger.info({ count: result.length }, "Rules List");
    });

    it("should return a successful response for filtered rules", async () => {
        const result = await listRules(
            { status: "enabled", level: "12-16" },
            false,
            10,
        );
        logger.info({ count: result.length }, "Filtered Rules");
    });

    it("should return a successful response for select fields", async () => {
        const result = await listRules(
            { select: "id,description,level" },
            false,
            10,
        );
        logger.info(
            { keys: Object.keys(result[0] ?? {}) },
            "Selected Rule Fields",
        );
    });

    it("should return a successful response for fetch rule groups", async () => {
        const result = await listRuleGroups({}, true, 500);
        logger.info({ count: result.length }, "Rule Groups");
    });

    it("should return a successful response for rule requirement", async () => {
        const result = await listRuleRequirement("pci_dss", {}, false, 10);
        logger.info({ count: result.length }, "PCI DSS Requirements");
    });

    it("should return a successful response for fetch rule files", async () => {
        const result = await listRuleFiles({}, false, 10);
        logger.info(
            { count: result.length, sample: result[0]?.filename },
            "Rule Files",
        );
    });

    it("should return raw XML content of a rule file", async () => {
        const files = await listRuleFiles({ limit: 1 }, false, 1);
        const target = files[0];
        const content = await getRuleFileContent(
            target.filename,
            target.relative_dirname,
        );
        if (typeof content !== "string" || !content.includes("<")) {
            throw new Error("Expected raw XML string content");
        }
        logger.info(
            { filename: target.filename, length: content.length },
            "Rule File Content",
        );
    });

    it("should upload, read back and delete a custom rule file", async () => {
        // ensure clean slate
        await deleteRuleFile(TEST_FILE).catch(() => {});

        // upload (create)
        await updateRuleFile(TEST_FILE, TEST_XML);

        // read back and verify our rule is present
        const content = await getRuleFileContent(TEST_FILE);
        if (!content.includes(TEST_RULE_ID)) {
            throw new Error(
                `Uploaded rule file does not contain rule ${TEST_RULE_ID}`,
            );
        }

        // verify rule is loaded via API filter
        const matched = await listRules(
            { rule_ids: TEST_RULE_ID },
            false,
            10,
        );
        if (!matched.some((r) => String(r.id) === TEST_RULE_ID)) {
            throw new Error(`Rule ${TEST_RULE_ID} not found via /rules`);
        }
        logger.info({ id: TEST_RULE_ID }, "Custom rule uploaded & loaded");

        // cleanup
        await deleteRuleFile(TEST_FILE);
        logger.info({ filename: TEST_FILE }, "Cleanup done");
    });
});
