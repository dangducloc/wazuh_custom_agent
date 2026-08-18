// /model/cloudflare-ai.js
import { fetch } from "undici";
import { logger } from "../utils/index.js";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Safely parse tool-call arguments.
 *
 * Cloudflare Workers AI có thể trả arguments ở 3 dạng:
 *   1. string  → JSON.parse bình thường
 *   2. object  → đã parsed rồi, dùng thẳng
 *   3. string bị truncate (model hit max_tokens giữa chừng)
 *      → cố gắng tự đóng các bracket còn mở
 *
 * @param {string|object|null|undefined} raw
 * @param {string} toolName  — dùng để log warning rõ ràng hơn
 * @returns {object}
 */
function safeParseArgs(raw, toolName = "unknown") {
  // Case 2: Cloudflare đã parse sẵn thành object
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
function recoverJson(str) {
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
function serializeToolResult(result, maxChars = 6000) {
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
        logger.warn(`Response bị cắt cụt vì chạm max_tokens (${maxTokens})`);
      }

      // ── No tool calls → final answer ─────────────────────────────────────
      const toolCalls = message.tool_calls;
      if (!toolCalls || toolCalls.length === 0) {
        return message.content;
      }

      // ── Append assistant turn ─────────────────────────────────────────────
      // Cloudflare ai/v1/chat/completions yêu cầu content là string (không được null).
      messages.push({
        role: "assistant",
        content: message.content ?? "", // FIX: null → ""
        tool_calls: toolCalls.map((tc) => ({
          id: tc.id,
          type: "function",
          function: {
            name: tc.function.name,
            // Normalize: nếu arguments là object thì stringify lại
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
          // Không throw — trả lỗi về cho model như một tool result
          // để agent có thể tự điều chỉnh thay vì crash cả pipeline.
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
          // Trả lỗi về model thay vì crash — agent biết tool không tồn tại
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
