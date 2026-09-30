# AGENTS.md

Node.js (ESM) Express service: an AI SOC agent that answers security questions by calling ~50 Wazuh/OpenSearch tools via an LLM (tool-calling loop). No build step, no bundler, no lint/format/typecheck config.

## Commands

- Install: `pnpm install`
- Run server: `node app.js` (serves on `process.env.PROXY_PORT`, default 3000)
- Tests: `npm test` runs the offline unit test (`test/agent-memory.test.js`). Run individual files with `node --test test/<file>.test.js`
  - Unit (offline): `test/agent-memory.test.js`
  - Everything else (`agents.test.js`, `chat-memory.test.js`, ...) hits **live services** — Wazuh API at `linh.local:55000`, OpenSearch, and Cloudflare/NVIDIA LLM endpoints. They need a working `.env` and reachable lab hosts; there are no mocks.

## Request flow (wiring not obvious from filenames)

`app.js` → `api/api.js` (Express routes) → `api/chat.js`:
`agentMemory.buildContext()` → `chatWithFallback(registry, FALLBACK_ORDER)` → `model/compatible-ai.js` (provider-agnostic OpenAI-compatible tool-calling loop, max 10 iterations, 60s timeout).

- Providers are registered in `api/registry.js` (cloudflare priority 9, nvidia 10, but `FALLBACK_ORDER` is a **hardcoded array** `["cloudflare", "nvidia"]` — priorities are unused for fallback).
- Every tool handler is wrapped in `summarizeIfLarge()` via `guardedHandlers` in `registry.js` — large tool outputs are truncated before reaching the model.
- **Gotcha**: `api/chat.js` catches model errors and returns nothing, so `POST /chat` can return HTTP 200 with only `{"sessionId": ...}` and no `reply` field. Always check the server logs (`logs/`) when reply is missing.

## Adding a tool

Two places must stay in sync in `tools/descriptions.js`:
1. `wazuhToolDefinitions` — schema using `input_schema` convention (converted to OpenAI function-calling format inside `compatible-ai.js`)
2. `wazuhToolHandlers` — map of name → async handler(args)

Tool handlers throw on error; the tool-calling loop converts thrown errors into `{error}` tool results, so one bad tool does not crash a chat turn.

## Memory

`memory/agent-memory.js` exports a singleton `agentMemory` backed by **SQLite** (`./data/agent-memory.db`, WAL mode, via `better-sqlite3`) — must run from repo root. On first boot it migrates legacy `./data/agent-memory.json` / `./data/agent-sessions.json` into the DB and renames them to `*.json.migrated` (kept as backup); migrated sessions get `lastActiveAt` bumped to migration time so the boot-time TTL prune cannot wipe them. Writes are committed immediately (no debounce); `flush()` is just a WAL checkpoint and `close()` releases the DB — call `close()` before deleting `data/` and in tests that create instances with temp dirs (Windows file locks). Session history is injected as prompt context; long-term facts (seenAlerts, notes) are only injected when the user message matches a recall regex (`needsRecall`). Fresh start = delete the whole `data/` dir (including `agent-memory.db`).

## Environment

Real variable names (the README `.env` example is **wrong** — do not trust it, trust `config/*.js`):
- `PROXY_PORT` (not `PORT`)
- `CLOUDFLARE_API_URL`, `CLOUDFLARE_AUTH_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `CF_MODEL`
- `NVIDIA_URL`, `NVIDIA_API_KEY`, `NVIDIA_MODEL`
- `WAZUH_API_URL`, `WAZUH_API_USERNAME`, `WAZUH_API_PASSWORD`
- `OPENSEARCH_URL`, `OPENSEARCH_USERNAME`, `OPENSEARCH_PASSWORD`

Config modules fall back to the literal string `"Missing ... environment variable"` instead of throwing, so a missing var surfaces **late** as a provider/tool failure — check logs first.

## Repo conventions

- ESM only (`"type": "module"`); use `import`, never `require`.
- Package manager is pnpm (`pnpm-lock.yaml`); don't commit `package-lock.json`.
- `data/`, `logs/`, `cache/` are gitignored runtime state (memory store `data/agent-memory.db` + legacy `data/*.json.migrated` backups, pino logs, cached Wazuh JWT in `cache/token.json`). Don't commit them; fresh start = delete the whole `data/` dir.
- No lint/format/typecheck — follow existing style (2-space indent in `model/`, `memory/`; 4-space in `api/`; ESM exports at bottom for barrels like `utils/index.js`).

## Testing the API by hand (Windows / PowerShell)

Inline `-d` JSON breaks under PowerShell quoting. Use `curl.exe` (not the `curl` alias) with a body file:

```powershell
curl.exe -s -X POST http://localhost:3000/chat -H "Content-Type: application/json" -d '@body.json'
# body.json: {"message": "...", "sessionId": "..."}
```
