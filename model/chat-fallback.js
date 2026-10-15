// /model/chat-fallback.js
//
// chatWithFallback
// Try providers in order; on failure (network, timeout, bad tool-calling
// response, etc.) log and move to the next one. Use this for resilience, not
// for retries of the *same* transient error on the *same* provider.

import { logger } from "../utils/index.js";

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
