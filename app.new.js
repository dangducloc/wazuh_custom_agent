// app.js
import "dotenv/config";
import { ProviderRegistry, chatWithFallback } from "./model/compatible-ai.js";
import { SYSTEM_PROMPT } from "./model/system-prompts.js";
import { logger } from "./utils/index.js";
import { wazuhToolDefinitions, wazuhToolHandlers } from "./tools/descriptions.js";
import { modelConfig } from "./config/index.js";
import { summarizeWazuhArrayResult } from "./tools/wazuh/wazuh-result-summarizer.js";

const LARGE_RESULT_CHAR_THRESHOLD = 20_000;
const MAX_ITEMS_IN_SUMMARY = 20;

function summarizeIfLarge(result) {
  if (!Array.isArray(result)) return result;
  let size;
  try {
    size = JSON.stringify(result).length;
  } catch {
    return result;
  }
  if (size <= LARGE_RESULT_CHAR_THRESHOLD) return result;
  return summarizeWazuhArrayResult(result, { maxItems: MAX_ITEMS_IN_SUMMARY });
}

const guardedHandlers = Object.fromEntries(
  Object.entries(wazuhToolHandlers).map(([name, handler]) => [
    name,
    async (args) => summarizeIfLarge(await handler(args)),
  ])
);

// ──  provider ──────────────────────────────────────────────────────────
const registry = new ProviderRegistry();

if (modelConfig.cloudflare?.baseUrl) {
  registry.register("cloudflare", {
    baseUrl: modelConfig.cloudflare.baseUrl,
    apiKey: modelConfig.cloudflare.authToken,
    model: modelConfig.cloudflare.model,
    priority: 9,
    tags: ["cloud", "reliable-tools"],
  });
}

if (modelConfig.nvidia?.url) {
  registry.register("nvidia", {
    baseUrl: modelConfig.nvidia.url,
    apiKey: modelConfig.nvidia.apiKey,
    model: modelConfig.nvidia.model,
    priority: 10,
    tags: ["cloud", "fast-inference"],
  });
}

for (const name of registry.list()) {
  registry.get(name).client.registerTools(guardedHandlers);
}

logger.info("Starting the application...");
logger.info(`Providers registered: [${registry.list().join(", ")}]`);

const FALLBACK_ORDER = ["cloudflare", "nvidia"].filter((name) => registry.list().includes(name));

try {
  const reply = await chatWithFallback(registry, FALLBACK_ORDER, {
    messages: [
      {
        role: "system",
        content: SYSTEM_PROMPT,
      },
      {
        role: "user",
        content: "delete rules with id 101001 and 101000",
      },
    ],
    toolDefinitions: wazuhToolDefinitions,
    maxTokens: 4096,
    trace: true,
  });

  console.log(reply);
  logger.info("Text generation completed successfully.");
} catch (err) {
  logger.error({ err: err.message }, "Error during text generation.");
}
