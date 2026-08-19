// /utils/helper.js
// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
import { logger } from "./index.js";


/**
 * Safely parse tool-call arguments.
 *
 * Cloudflare Workers AI may return arguments in 3 shapes:
 *   1. string  → JSON.parse normally
 *   2. object  → already parsed, use as-is
 *   3. truncated string (model hit max_tokens mid-way)
 *      → try to close any open brackets
 *
 * @param {string|object|null|undefined} raw
 * @param {string} toolName  — used to log clearer warnings
 * @returns {object}
 */
export function safeParseArgs(raw, toolName = "unknown") {
  // Case 2: Cloudflare already parsed it into an object
  if (raw !== null && typeof raw === "object") return raw;

  // Null / undefined / empty string
  if (!raw || String(raw).trim() === "") return {};

  const str = String(raw);

  // Case 1: happy path
  try {
    return JSON.parse(str);
  } catch (firstErr) {
    logger.warn(
      `[Tool:${toolName}] Malformed arguments JSON — attempting recovery. ` +
        `Error: ${firstErr.message}`
    );
  }

  // Case 3: attempt to close unclosed braces/brackets/strings
  try {
    const fixed = recoverJson(str);
    const result = JSON.parse(fixed);
    logger.warn(`[Tool:${toolName}] Arguments JSON recovered successfully.`);
    return result;
  } catch (secondErr) {
    // Log the raw string (capped) for debugging then throw
    const preview = str.length > 200 ? str.slice(0, 200) + "…" : str;
    throw new Error(
      `[Tool:${toolName}] Cannot parse arguments JSON.\n` +
        `  Second error: ${secondErr.message}\n` +
        `  Raw (preview): ${preview}`
    );
  }
}

/**
 * Attempt to repair a truncated JSON string by closing any open
 * strings, arrays, and objects left hanging by a premature cutoff.
 *
 * Strategy:
 *   • Walk the string char-by-char tracking string / escape state.
 *   • Track unclosed { and [ counts.
 *   • Append the missing closers in reverse order.
 *
 * @param {string} str
 * @returns {string}
 */
export function recoverJson(str) {
  const stack = []; // 'obj' | 'arr'
  let inString = false;
  let escape = false;

  for (let i = 0; i < str.length; i++) {
    const ch = str[i];

    if (escape) {
      escape = false;
      continue;
    }

    if (ch === "\\" && inString) {
      escape = true;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue; // skip content inside strings

    if (ch === "{") stack.push("obj");
    else if (ch === "[") stack.push("arr");
    else if (ch === "}" || ch === "]") stack.pop();
  }

  let result = str;

  // Close open string first (if we were mid-string when input ended)
  if (inString) result += '"';

  // Close remaining open containers in LIFO order
  while (stack.length) {
    result += stack.pop() === "obj" ? "}" : "]";
  }

  return result;
}

/**
 * Truncate a tool result so it does not blow up the context window.
 * The model generating malformed JSON in later iterations is almost always
 * caused by an oversized context, not a model bug.
 *
 * @param {unknown} result   — raw return value from the tool handler
 * @param {number}  maxChars — max characters for the serialized result
 * @returns {string}         — JSON string safe to put in the tool message
 */
export function serializeToolResult(result, maxChars = 6000) {
  let serialized;
  try {
    serialized = JSON.stringify(result);
  } catch {
    serialized = String(result);
  }

  if (serialized.length <= maxChars) return serialized;

  // Truncate and mark it so the model knows the result was cut
  const half = Math.floor(maxChars / 2);
  const truncated = {
    _truncated: true,
    _original_length: serialized.length,
    _limit: maxChars,
    data: serialized.slice(0, half) + " … [TRUNCATED] … " + serialized.slice(-half / 2),
  };
  logger.warn(
    `[Tool result] Truncated ${serialized.length} → ≤${maxChars} chars to protect context window.`
  );
  return JSON.stringify(truncated);
}
