// /model/cloudflare-ai.js
import { fetch } from "undici";
import { logger } from "../utils/index.js";
import { safeParseArgs, serializeToolResult, recoverJson } from "../utils/index.js";
// ─────────────────────────────────────────────────────────────────────────────
// CloudflareAI
// ─────────────────────────────────────────────────────────────────────────────

export class CloudflareAI {
  constructor({ accountId, authToken }) {
    if (!accountId) throw new Error("accountId is required");
    if (!authToken) throw new Error("authToken is required");

    this.chatUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1/chat/completions`;
    this.headers = {
      Authorization: `Bearer ${authToken}`,
      "Content-Type": "application/json",
    };
    this.tools = {}; // name → handler function
  }

  registerTools(toolHandlers) {
    Object.assign(this.tools, toolHandlers);
  }

  async chat({
    model,
    messages,
    toolDefinitions,
    maxTokens = 4096,
    maxIterations = 10,
    toolResultMaxChars = 6000, // NEW: cap tool result size
    trace = false,
  }) {
    messages = [...messages];

    for (let iteration = 0; iteration < maxIterations; iteration++) {
      if (trace) logger.info(`[Agent] Iteration ${iteration + 1}`);

      // ── Build request payload ────────────────────────────────────────────
      const payload = { model, messages, max_tokens: maxTokens };

      if (toolDefinitions?.length) {
        payload.tools = toolDefinitions.map((def) => ({
          type: "function",
          function: {
            name: def.name,
            description: def.description,
            parameters: def.input_schema,
          },
        }));
      }

      // ── Send request ─────────────────────────────────────────────────────
      const response = await fetch(this.chatUrl, {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const detail = await response.text();
        throw new Error(`${response.status} ${response.statusText} — ${detail}`);
      }

      const data = await response.json();
      const choice = data.choices?.[0];

      if (!choice) {
        throw new Error(`Cloudflare returned no choices. Raw: ${JSON.stringify(data)}`);
      }

      const message = choice.message;

      if (trace) logger.info(`[Agent] finish_reason: ${choice.finish_reason}`);

      if (choice.finish_reason === "length") {
        logger.warn(`Response was truncated because it hit max_tokens (${maxTokens})`);
      }

      // ── No tool calls → final answer ─────────────────────────────────────
      const toolCalls = message.tool_calls;
      if (!toolCalls || toolCalls.length === 0) {
        return message.content;
      }

      // ── Append assistant turn ─────────────────────────────────────────────
      // Cloudflare ai/v1/chat/completions requires content to be a string (null is not allowed).
      messages.push({
        role: "assistant",
        content: message.content ?? "", // FIX: null → ""
        tool_calls: toolCalls.map((tc) => ({
          id: tc.id,
          type: "function",
          function: {
            name: tc.function.name,
            // Normalize: if arguments is an object, stringify it again
            arguments:
              typeof tc.function.arguments === "string"
                ? tc.function.arguments
                : JSON.stringify(tc.function.arguments ?? {}),
          },
        })),
      });

      // ── Execute each tool call ────────────────────────────────────────────
      for (const toolCall of toolCalls) {
        const { name, arguments: argsRaw } = toolCall.function;

        // ★ FIX: safe parse — handles string / object / truncated JSON
        let args;
        try {
          args = safeParseArgs(argsRaw, name);
        } catch (parseErr) {
          // Don't throw — return the error to the model as a tool result
          // so the agent can self-correct instead of crashing the whole pipeline.
          logger.error(`[Tool:${name}] Argument parse failed: ${parseErr.message}`);
          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify({ error: `Failed to parse tool arguments: ${parseErr.message}` }),
          });
          continue; // try remaining tool calls
        }

        if (trace) {
          logger.info(`[Tool] ${name}`);
          logger.info({ args }, "[Tool arguments]");
        }

        const handler = this.tools[name];
        if (!handler) {
          // Return the error to the model instead of crashing — the agent knows the tool does not exist
          const errMsg = `Tool '${name}' is not registered. Available: [${Object.keys(this.tools).join(", ")}]`;
          logger.error(errMsg);
          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify({ error: errMsg }),
          });
          continue;
        }

        let result;
        try {
          result = await handler(args);
        } catch (err) {
          result = { error: err.message };
        }

        if (trace) logger.info({ result }, "[Tool result]");

        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          // ★ FIX: truncate large results to prevent context overflow
          content: serializeToolResult(result, toolResultMaxChars),
        });
      }
    }

    throw new Error(`Maximum tool-calling iterations (${maxIterations}) exceeded`);
  }
}
