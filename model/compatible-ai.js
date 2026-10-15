// /model/compatible-ai.js
//
// CompatibleAI
// Generic client for any provider that speaks the OpenAI /chat/completions
// schema (Cloudflare Workers AI, OpenRouter, NVIDIA NIM, HuggingFace Inference
// Providers, Ollama, llama.cpp server, vLLM, ...).
//
// The rest of the module family lives in sibling files — `provider-registry.js`,
// `chat-fallback.js`, `default-registry.js` — re-exported from the barrel
// `model/index.js`.

import { fetch } from "undici";
import { logger } from "../utils/index.js";
import { safeParseArgs, serializeToolResult } from "../utils/index.js";

export class CompatibleAI {
  constructor({ baseUrl, apiKey = null, extraHeaders = {} }) {
    if (!baseUrl) throw new Error("baseUrl is required");

    this.chatUrl = baseUrl.replace(/\/$/, "") + "/chat/completions";
    this.headers = {
      "Content-Type": "application/json",
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      ...extraHeaders, // provider-specific headers, e.g. OpenRouter's HTTP-Referer/X-Title
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
    toolHandlers, // optional per-request handler map; overrides the client-registered this.tools
    maxTokens = 4096,
    maxIterations = 10,
    toolResultMaxChars = 6000,
    timeoutMs = 60_000, // local/CPU inference can be slow — always bound the request
    trace = false,
    temperature, // optional — forwarded as-is when provided
    topP, // optional — maps to top_p
    extraParams = {}, // escape hatch for provider-specific fields (e.g. NVIDIA's presence_penalty)
  }) {
    messages = [...messages];
    const handlers = toolHandlers ?? this.tools;

    for (let iteration = 0; iteration < maxIterations; iteration++) {
      if (trace) logger.info(`[Agent] Iteration ${iteration + 1}`);

      // ── Build request payload ────────────────────────────────────────────
      const payload = {
        model,
        messages,
        max_tokens: maxTokens,
        ...(temperature !== undefined ? { temperature } : {}),
        ...(topP !== undefined ? { top_p: topP } : {}),
        ...extraParams,
      };

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

      // ── Send request (with timeout) ──────────────────────────────────────
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      let response;
      try {
        response = await fetch(this.chatUrl, {
          method: "POST",
          headers: this.headers,
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
      } catch (err) {
        if (err.name === "AbortError") {
          throw new Error(`Request timed out after ${timeoutMs}ms (${this.chatUrl})`);
        }
        throw err;
      } finally {
        clearTimeout(timer);
      }

      if (!response.ok) {
        const detail = await response.text();
        throw new Error(`${response.status} ${response.statusText} — ${detail}`);
      }

      const data = await response.json();
      const choice = data.choices?.[0];

      if (!choice) {
        throw new Error(`Provider returned no choices. Raw: ${JSON.stringify(data)}`);
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
      messages.push({
        role: "assistant",
        content: message.content ?? "", // null is not accepted by some providers
        tool_calls: toolCalls.map((tc) => ({
          id: tc.id,
          type: "function",
          function: {
            name: tc.function.name,
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

        let args;
        try {
          args = safeParseArgs(argsRaw, name);
        } catch (parseErr) {
          // Small/local models are far more likely to emit malformed JSON —
          // return the error to the model instead of crashing the pipeline.
          logger.error(`[Tool:${name}] Argument parse failed: ${parseErr.message}`);
          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify({ error: `Failed to parse tool arguments: ${parseErr.message}` }),
          });
          continue;
        }

        if (trace) {
          logger.info(`[Tool] ${name}`);
          logger.info({ args }, "[Tool arguments]");
        }

        const handler = handlers[name];
        if (!handler) {
          const errMsg = `Tool '${name}' is not registered. Available: [${Object.keys(handlers).join(", ")}]`;
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
          content: serializeToolResult(result, toolResultMaxChars),
        });
      }
    }

    throw new Error(`Maximum tool-calling iterations (${maxIterations}) exceeded`);
  }
}
