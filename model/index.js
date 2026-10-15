// model/index.js
// Barrel for the model module: OpenAI-compatible client, provider registry,
// fallback runner, and the example registry builder.
export { CompatibleAI } from "./compatible-ai.js";

export { ProviderRegistry } from "./provider-registry.js";

export { chatWithFallback } from "./chat-fallback.js";

export { buildDefaultRegistry } from "./default-registry.js";
