// api/chat.js
import { chatWithFallback } from "../model/index.js";
import { registry, FALLBACK_ORDER, guardedHandlers } from "./registry.js";
import { resolveToolPolicy } from "./tool-policy.js";
import { logger } from "../utils/index.js";
import { SYSTEM_PROMPT } from "../model/system-prompts.js";
import { agentMemory } from "../memory/index.js";

for (const name of registry.list()) {
    registry.get(name).client.registerTools(guardedHandlers);
}

export const chat = async (
    message,
    sessionId = "default",
    { mode, allowDestructive = false } = {}
) => {
    if (!message) {
        throw new Error("Message is required for chat.");
    }
    if (typeof message !== "string") {
        throw new Error("Message must be a string.");
    }

    // Throws for an invalid mode, or a 'full' request against an
    // AGENT_MODE=read-only deployment — the caller surfaces it as an error.
    const policy = resolveToolPolicy({ mode, allowDestructive });

    const messages = agentMemory.buildContext(sessionId, SYSTEM_PROMPT, message);

    let reply;
    try {
        reply = await chatWithFallback(registry, FALLBACK_ORDER, {
            messages,
            toolDefinitions: policy.toolDefinitions,
            toolHandlers: policy.toolHandlers,
            maxTokens: 4096,
            trace: true,
        });
    } catch (err) {
        logger.error(
            { err: err.message, sessionId, mode: policy.mode },
            "Error during text generation."
        );
        throw new Error(`Chat failed for session '${sessionId}': ${err.message}`);
    }

    if (reply == null) {
        logger.error({ sessionId, mode: policy.mode }, "Model returned a null/undefined reply.");
        throw new Error(`Chat failed for session '${sessionId}': model returned an empty reply.`);
    }

    // save the conversation turn in memory for future context
    agentMemory.addTurn(sessionId, "user", message);
    agentMemory.addTurn(sessionId, "assistant", reply);

    logger.info(
        { sessionId, mode: policy.mode, blockedTools: policy.blockedTools.length },
        "Text generation completed successfully."
    );
    return reply;
};
