// /tools/wazuh/description.js
// Recursively scans all description(s).js files under this directory
// and merges their toolDefinitions/toolHandlers exports.

import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function findDescriptionFiles(dir) {
    let results = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            results = results.concat(findDescriptionFiles(fullPath));
        } else if (
            /^descriptions?\.js$/.test(entry.name) &&
            fullPath !== __filename
        ) {
            results.push(fullPath);
        }
    }
    return results;
}

// Tool access levels enforced by api/tool-policy.js. Every definition must
// declare one; missing or unknown values fail the boot, so a new tool cannot
// silently escape the read-only/full request policy.
const TOOL_ACCESS_LEVELS = ["read", "write", "action"];

async function loadAllTools() {
    const files = findDescriptionFiles(__dirname);
    const toolDefinitions = [];
    const toolHandlers = {};

    for (const file of files) {
        const mod = await import(pathToFileURL(file).href);
        if (!mod.toolDefinitions || !mod.toolHandlers) {
            throw new Error(`${file} Must export toolDefinitions And toolHandlers`);
        }
        for (const def of mod.toolDefinitions) {
            if (!def.name) {
                throw new Error(`${file}: tool definition is missing 'name'`);
            }
            if (!TOOL_ACCESS_LEVELS.includes(def.access)) {
                throw new Error(
                    `${file}: tool '${def.name}' must declare access: one of ` +
                        `[${TOOL_ACCESS_LEVELS.join(", ")}] ` +
                        `(enforced by api/tool-policy.js)`
                );
            }
        }
        toolDefinitions.push(...mod.toolDefinitions);
        Object.assign(toolHandlers, mod.toolHandlers);
    }

    return { toolDefinitions, toolHandlers };
}

export const { toolDefinitions: wazuhToolDefinitions, toolHandlers: wazuhToolHandlers } =
    await loadAllTools();


