// /model/default-registry.js
//
// Example setup — chỉnh baseUrl/model/key theo nhu cầu thực tế.
// The production wiring is `api/registry.js`; this helper is for scripts,
// experiments, and tests that want a ready-made multi-provider registry.

import { ProviderRegistry } from "./provider-registry.js";

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

import { buildDefaultRegistry, chatWithFallback } from "../model/index.js";

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
