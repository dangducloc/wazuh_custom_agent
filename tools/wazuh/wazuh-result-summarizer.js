// tools/wazuh/wazuh-result-summarizer.js

export function summarizeWazuhArrayResult(rawResult, { maxItems = 20, itemFields = null } = {}) {
  if (!Array.isArray(rawResult)) {
    // Not an array-shaped tool result (e.g. get_rule_file returns raw XML
    // text, upload/delete return a small object) — leave it untouched.
    return rawResult;
  }

  const total = rawResult.length;

  const project = (item) => {
    if (!itemFields || typeof item !== "object" || item === null) return item;
    const out = {};
    for (const f of itemFields) out[f] = item[f];
    return out;
  };

  const sampleItems = rawResult.slice(0, maxItems).map(project);

  return {
    total_count: total,
    items_shown: sampleItems.length,
    items_omitted: Math.max(0, total - sampleItems.length),
    note:
      sampleItems.length < total
        ? `Showing ${sampleItems.length} of ${total} items. Narrow with q/group/level/select filters to see specific items, not more of the same list.`
        : "All items shown.",
    items: sampleItems,
  };
}

/**
 * Wrap a Wazuh tool handler so its result is summarized before it ever
 * reaches serializeToolResult's char-truncation step.
 */
export function withWazuhSummary(handler, options = {}) {
  return async (args) => {
    const raw = await handler(args);
    return summarizeWazuhArrayResult(raw, options);
  };
}