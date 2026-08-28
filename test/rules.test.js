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
const TEST_XML = `<group name="agent_test">
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
        // Ensure clean slate — ignore 404 if absent
        await deleteRuleFile(TEST_FILE).catch(() => {});

        logger.info("Uploading test rule file...");

        // overwrite:true is safer — protects against a prior run that didn't clean up
        const uploadResult = await updateRuleFile(TEST_FILE, TEST_XML, {
            overwrite: true,
        });
        logger.info({ uploadResult }, "Upload result");

        // ------------------------------------------------------------------
        // Discover where Wazuh stored the file. Uploaded rules land in
        // etc/rules/ but we should not hard-code that — let the API tell us.
        // ------------------------------------------------------------------
        logger.info("Resolving uploaded file location...");
        const allFiles = await listRuleFiles({}, true, 500);
        const meta = allFiles.find((f) => f.filename === TEST_FILE);

        if (!meta) {
            throw new Error(
                `Uploaded file "${TEST_FILE}" not found in GET /rules/files listing. ` +
                    `Upload may have failed silently or Wazuh hasn't indexed it yet.`,
            );
        }

        logger.info(
            {
                filename: meta.filename,
                relative_dirname: meta.relative_dirname,
            },
            "Resolved file location",
        );

        // Read back raw XML — now we have the correct relative_dirname
        logger.info("Reading uploaded rule file...");
        const content = await getRuleFileContent(
            TEST_FILE,
            meta.relative_dirname,
        );

        logger.info(
            { filename: TEST_FILE, length: content?.length },
            "Uploaded file content",
        );

        if (typeof content !== "string") {
            throw new Error(`Expected string content, got ${typeof content}`);
        }

        if (!content.includes(TEST_RULE_ID)) {
            throw new Error(
                `Uploaded rule file does not contain rule ID ${TEST_RULE_ID}`,
            );
        }

        // ------------------------------------------------------------------
        // Verify Wazuh loaded the rule into its active rule set
        // ------------------------------------------------------------------
        logger.info(
            { ruleId: TEST_RULE_ID },
            "Checking whether Wazuh loaded the rule",
        );

        const matched = await listRules({ rule_ids: TEST_RULE_ID }, false, 10);

        logger.info({ count: matched.length, matched }, "Matched rules");

        if (!matched.some((r) => String(r.id) === TEST_RULE_ID)) {
            throw new Error(
                `Rule ${TEST_RULE_ID} uploaded but not found via GET /rules — ` +
                    `Wazuh manager may need a restart to reload rules.`,
            );
        }

        logger.info({ id: TEST_RULE_ID }, "Custom rule uploaded & loaded ✓");

        // Cleanup
        await deleteRuleFile(TEST_FILE, meta.relative_dirname);
        logger.info({ filename: TEST_FILE }, "Cleanup done");
    });
});
