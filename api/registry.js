// /api/registry.js
import { ProviderRegistry } from "../model/compatible-ai.js";
import { logger } from "../utils/index.js";
import { modelConfig } from "../config/index.js";
import { summarizeIfLarge } from "../utils/index.js";
import { wazuhToolHandlers } from "../tools/descriptions.js";

const registry = new ProviderRegistry();

const guardedHandlers = Object.fromEntries(
    Object.entries(wazuhToolHandlers).map(([name, handler]) => [
        name,
        async (args) => summarizeIfLarge(await handler(args)),
    ]),
);

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

const FALLBACK_ORDER = ["cloudflare", "nvidia"].filter((name) =>
    registry.list().includes(name),
);

export { registry, guardedHandlers, FALLBACK_ORDER };
