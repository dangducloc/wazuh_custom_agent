// /utils/helper/xml-checker.js
import { XMLParser, XMLValidator } from "fast-xml-parser";
const CUSTOM_RULE_ID_MIN = 100000;
const CUSTOM_RULE_ID_MAX = 120000;

export function validateRuleFile(xmlContent) {
    const errors = [];

    const wellFormed = XMLValidator.validate(xmlContent);
    if (wellFormed !== true) {
        return { valid: false, errors: [`Malformed XML: ${wellFormed.err.msg}`] };
    }

    // Catch the plural/singular tag bug directly on the raw string —
    // cheap and catches the exact failure mode we hit in production.
    if (/<groups>/i.test(xmlContent)) {
        errors.push(
            "Found `<groups>` (plural) inside a <rule> block — Wazuh requires the " +
            "singular `<group>` tag for group membership. `<groups>` is valid XML " +
            "but wazuh-analysisd will reject the rule at load time."
        );
    }

    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
    const doc = parser.parse(xmlContent);

    const root = doc.group;
    if (!root) {
        errors.push("Root element must be <group name=\"...\">.");
        return { valid: errors.length === 0, errors };
    }

    const rules = Array.isArray(root.rule) ? root.rule : [root.rule].filter(Boolean);
    if (rules.length === 0) {
        errors.push("No <rule> blocks found inside root <group>.");
    }

    for (const rule of rules) {
        const id = Number(rule["@_id"]);
        const level = Number(rule["@_level"]);

        if (!Number.isInteger(id)) {
            errors.push(`Rule missing a numeric id attribute: ${JSON.stringify(rule)}`);
        } else if (id < CUSTOM_RULE_ID_MIN || id > CUSTOM_RULE_ID_MAX) {
            errors.push(
                `Rule id ${id} is outside the reserved custom range ` +
                `${CUSTOM_RULE_ID_MIN}-${CUSTOM_RULE_ID_MAX} and may collide with stock rules.`
            );
        }

        if (!Number.isInteger(level) || level < 0 || level > 16) {
            errors.push(`Rule id ${id ?? "?"} has an invalid level: ${rule["@_level"]}`);
        }

        if (!rule.description) {
            errors.push(`Rule id ${id ?? "?"} is missing a <description>.`);
        }
    }

    return { valid: errors.length === 0, errors };
}
