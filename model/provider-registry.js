// /model/provider-registry.js
//
// ProviderRegistry
// Registers multiple CompatibleAI instances under a name, with tags and
// priority so callers can pick "the best local one" or "the most reliable
// cloud one" without hardcoding provider names everywhere.

import { CompatibleAI } from "./compatible-ai.js";

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
