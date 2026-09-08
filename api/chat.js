// api/chat.js
import { chatWithFallback } from "../model/compatible-ai.js";
import { registry, FALLBACK_ORDER, guardedHandlers } from "./registry.js";
import { wazuhToolDefinitions } from "../tools/descriptions.js";
import { logger } from "../utils/index.js";
import { SYSTEM_PROMPT } from "../model/system-prompts.js";
import { agentMemory } from "../memory/agent-memory.js";

for (const name of registry.list()) {
    registry.get(name).client.registerTools(guardedHandlers);
}

export const chat = async (message, sessionId = "default") => {
    if (!message) {
        throw new Error("Message is required for chat.");
    }
    if (typeof message !== "string") {
        throw new Error("Message must be a string.");
    }
    try {
        const messages = agentMemory.buildContext(sessionId, SYSTEM_PROMPT, message);

        const reply = await chatWithFallback(registry, FALLBACK_ORDER, {
            messages,
            toolDefinitions: wazuhToolDefinitions,
            maxTokens: 4096,
            trace: true,
        });

        // save the conversation turn in memory for future context
        agentMemory.addTurn(sessionId, "user", message);
        agentMemory.addTurn(sessionId, "assistant", reply);

        console.log(reply);
        logger.info({ sessionId }, "Text generation completed successfully.");
        return reply;
    } catch (err) {
        logger.error({ err: err.message }, "Error during text generation.");
    }
};
