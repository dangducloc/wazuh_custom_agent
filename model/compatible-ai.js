// /model/openai-compatible-ai.js
import { fetch } from "undici";
import { logger } from "../utils/index.js";
import { safeParseArgs, serializeToolResult } from "../utils/index.js";

// ─────────────────────────────────────────────────────────────────────────────
// CompatibleAI
// Generic client for any provider that speaks the OpenAI /chat/completions
// schema (Cloudflare Workers AI, OpenRouter, NVIDIA NIM, HuggingFace Inference
// Providers, Ollama, llama.cpp server, vLLM, ...).
// ─────────────────────────────────────────────────────────────────────────────

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

        const handler = this.tools[name];
        if (!handler) {
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
          content: serializeToolResult(result, toolResultMaxChars),
        });
      }
    }

    throw new Error(`Maximum tool-calling iterations (${maxIterations}) exceeded`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ProviderRegistry
// Registers multiple CompatibleAI instances under a name, with tags and
// priority so callers can pick "the best local one" or "the most reliable
// cloud one" without hardcoding provider names everywhere.
// ─────────────────────────────────────────────────────────────────────────────

export class ProviderRegistry {
  constructor() {
    this.providers = new Map(); // name → { client, model, priority, tags }
  }

  register(name, { baseUrl, apiKey = null, extraHeaders = {}, model, priority = 0, tags = [] }) {
    this.providers.set(name, {
      client: new CompatibleAI({ baseUrl, apiKey, extraHeaders }),
      model,
      priority,
      tags,
    });
    return this;
  }

  get(name) {
    const p = this.providers.get(name);
    if (!p) throw new Error(`Provider '${name}' not been registered. Available: [${[...this.providers.keys()].join(", ")}]`);
    return p;
  }
  pickByTag(tag) {
    const candidates = [...this.providers.entries()]
      .filter(([, p]) => p.tags.includes(tag))
      .sort((a, b) => b[1].priority - a[1].priority);
    if (!candidates.length) throw new Error(`No providers found with tag '${tag}'`);
    return candidates[0];
  }

  list() {
    return [...this.providers.keys()];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// chatWithFallback
// Try providers in order; on failure (network, timeout, bad tool-calling
// response, etc.) log and move to the next one. Use this for resilience, not
// for retries of the *same* transient error on the *same* provider.
// ─────────────────────────────────────────────────────────────────────────────

export async function chatWithFallback(registry, providerNames, chatArgs) {
  let lastError;
  for (const name of providerNames) {
    const { client, model } = registry.get(name);
    try {
      return await client.chat({ ...chatArgs, model });
    } catch (err) {
      logger.warn(`[Fallback] Provider '${name}' fail: ${err.message}`);
      lastError = err;
      continue;
    }
  }
  throw new Error(`All providers failed. Last error: ${lastError?.message}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Example setup — chỉnh baseUrl/model/key theo nhu cầu thực tế
// ─────────────────────────────────────────────────────────────────────────────

export function buildDefaultRegistry({
  cloudflareAccountId,
  cloudflareToken,
  openrouterKey,
  nvidiaKey,
  huggingfaceToken,
  ollamaBaseUrl = "http://localhost:11434/v1",
  vllmBaseUrl = "http://localhost:8000/v1",
} = {}) {
  const registry = new ProviderRegistry();

  if (cloudflareAccountId && cloudflareToken) {
    registry.register("cloudflare", {
      baseUrl: `https://api.cloudflare.com/client/v4/accounts/${cloudflareAccountId}/ai/v1`,
      apiKey: cloudflareToken,
      model: "@cf/meta/llama-3.3-70b-instruct",
      priority: 10,
      tags: ["cloud", "reliable-tools"],
    });
  }

  if (openrouterKey) {
    registry.register("openrouter", {
      baseUrl: "https://openrouter.ai/api/v1",
      apiKey: openrouterKey,
      extraHeaders: {
        "HTTP-Referer": "https://linhai.example.com",
        "X-Title": "LINHAI",
      },
      model: "qwen/qwen3-coder-30b",
      priority: 8,
      tags: ["cloud", "many-models"],
    });
  }

  if (nvidiaKey) {
    registry.register("nvidia-nim", {
      baseUrl: "https://integrate.api.nvidia.com/v1",
      apiKey: nvidiaKey,
      model: "meta/llama3-70b-instruct",
      priority: 9,
      tags: ["cloud", "fast-inference"],
    });
  }

  if (huggingfaceToken) {
    registry.register("huggingface", {
      baseUrl: "https://router.huggingface.co/v1",
      apiKey: huggingfaceToken,
      model: "Qwen/Qwen3-Coder-30B-A3B-Instruct",
      priority: 3, // free tier, rate-limited → ưu tiên thấp, dùng làm backup
      tags: ["cloud", "free-tier"],
    });
  }

  // Local providers — không cần apiKey
  registry.register("ollama-local", {
    baseUrl: ollamaBaseUrl,
    model: "qwen3-coder:14b",
    priority: 5,
    tags: ["local", "offline"],
  });

  registry.register("vllm-local", {
    baseUrl: vllmBaseUrl,
    model: "gpt-oss-20b",
    priority: 7,
    tags: ["local", "offline", "reliable-tools"],
  });

  return registry;
}

/*
Cách dùng:

import { buildDefaultRegistry, chatWithFallback } from "./model/openai-compatible-ai.js";

const registry = buildDefaultRegistry({
  cloudflareAccountId: process.env.CF_ACCOUNT_ID,
  cloudflareToken: process.env.CF_AI_TOKEN,
  openrouterKey: process.env.OPENROUTER_KEY,
  nvidiaKey: process.env.NVIDIA_KEY,
  huggingfaceToken: process.env.HF_TOKEN,
});

// Đăng ký tool handlers cho từng provider client nếu cần dùng riêng lẻ:
// registry.get("cloudflare").client.registerTools({ ... });

const answer = await chatWithFallback(
  registry,
  ["cloudflare", "vllm-local", "openrouter", "huggingface"], // thứ tự ưu tiên khi fallback
  {
    messages: [{ role: "user", content: "Scan target X for open ports" }],
    toolDefinitions: [...],
    trace: true,
  }
);
*/