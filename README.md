# wazuh_custom_agent

A custom Node.js AI agent that replaces the native n8n AI Agent node for **automated threat hunting on Wazuh**. It exposes a simple chat API, talks to the Wazuh REST API and OpenSearch directly, and lets an LLM call ~50 security tools (agents, groups, rules, MITRE ATT&CK, SCA, syscheck, syscollector, alerts) to answer security questions and take action.

Built as part of a Wazuh + n8n + AI threat-hunting internship/thesis project.

## Why this exists

The stock n8n AI Agent node works, but it's hard to scale, debug, and extend with custom tools (see `$fromAI()` quirks, Agent V3 bugs, etc.). This project moves the "brain" out of n8n and into a standalone Express service:

```
Chat message → n8n (thin proxy) → POST /chat → this agent → LLM + tools → Wazuh / OpenSearch
```

n8n is now just a trigger + HTTP Request node forwarding messages to the agent — all the reasoning and tool-calling logic lives here.

## Architecture

```
Express HTTP API (:3000, /chat)
        │
        ▼
ProviderRegistry.chatWithFallback()
        │
        ▼
   Tool Handlers  ──────────────► Wazuh REST API (:55000)
 (rules, agents,                  OpenSearch (wazuh-alerts-*)
  groups, mitre,                  → _search / _mapping
  sca, syscheck,
  syscollector, alerts)
```

- **LLM providers**: Cloudflare Workers AI (primary) with NVIDIA NIM as fallback, both serving the same `openai/gpt-oss-120b` model.
- **Memory**: conversation turns persisted to `data/*.json` via `AgentMemory`.
- **Logging**: `pino` / `pino-pretty`, writing to `logs/<env>/*.log`.
- **Config**: providers and model settings loaded from `.env` via `config/*`.

## Tech stack

- Node.js (ESM) + [Express 5](https://expressjs.com/)
- [Vercel `ai` SDK](https://www.npmjs.com/package/ai) + `ai-gateway-provider` for LLM calls and tool-calling
- `axios` / `undici` for HTTP calls to Wazuh & OpenSearch
- `zod` for tool input-schema validation
- `fast-xml-parser`, `dotenv`, `pino`

## Project structure

```
.
├── api/          # HTTP layer (chat endpoint, request/response handling)
├── config/       # env / provider / model configuration
├── memory/       # conversation persistence (AgentMemory)
├── model/        # LLM provider clients (e.g. cloudflare-ai.js) + ProviderRegistry
├── tools/        # tool handlers exposed to the LLM
│   └── wazuh/
│       ├── api/          # Wazuh REST API tools: agent, groups, mitre, rules, sca, syscheck, syscollector
│       └── opensearch/   # OpenSearch tools: alerts, health
├── test/         # tests
├── utils/        # shared helpers
├── app.js        # entry point
└── package.json
```

## Available tools

The agent exposes ~50 tools to the LLM, grouped by domain:

| Domain | Examples | Count |
|---|---|---|
| Agents | `get_agent_list`, `get_agent_by_id`, `get_agent_active_config`, `assign_agent_to_group`, `remove_agent_from_groups` | 5 |
| Groups | `get_group_list`, `create_group`, `delete_group` | 3 |
| MITRE ATT&CK | `get_mitre_tactics`, `get_mitre_techniques`, `get_mitre_mitigations`, `get_mitre_software`, `get_mitre_groups`, `get_mitre_references` | 8 |
| Rules | `get_rule_list`, `get_rule_file`, `validate_rule_file`, `upload_rule_file`, `delete_rule_file` | 8 |
| SCA | `get_sca_policies`, `get_sca_policy_checks`, `get_sca_failed_checks` | 3 |
| Syscheck | `trigger_syscheck_scan`, `get_syscheck_results`, `get_syscheck_summary`, `clear_syscheck_results` | 5 |
| Syscollector | inventory: hardware, OS, processes, ports, packages, users, network interfaces, services, browser extensions, etc. | 14 |
| Alerts (OpenSearch) | `search_alerts`, `get_alerts_count`, `get_wazuh_indexes` | 3 |
| Cluster | `get_cluster_health` | 1 |

All tools follow a common `input_schema` convention consumed by `model/cloudflare-ai.js`.

## Getting started

### Prerequisites

- Node.js 18+ and `pnpm` (repo ships with a `pnpm-lock.yaml`)
- A running Wazuh Manager with the REST API reachable (default `:55000`)
- OpenSearch/Wazuh indexer reachable for the `wazuh-alerts-*` index
- API keys for at least one LLM provider (Cloudflare Workers AI and/or NVIDIA NIM)

### Installation

```bash
git clone https://github.com/dangducloc/wazuh_custom_agent.git
cd wazuh_custom_agent
pnpm install
```

### Configuration

Create a `.env` file in the project root, e.g.:

```env
PORT=3000

# Wazuh
WAZUH_API_URL=https://<wazuh-manager>:55000
WAZUH_API_USER=wazuh-wui
WAZUH_API_PASSWORD=changeme

# OpenSearch
OPENSEARCH_URL=https://<opensearch-host>:9200
OPENSEARCH_USER=admin
OPENSEARCH_PASSWORD=changeme

# LLM providers
CLOUDFLARE_ACCOUNT_ID=...
CLOUDFLARE_API_TOKEN=...
NVIDIA_NIM_API_KEY=...
MODEL=openai/gpt-oss-120b
```

Exact variable names are defined in `config/` — check there if the app fails to start.

### Run

```bash
node app.js
```

The chat endpoint will be available at:

```
POST http://localhost:3000/chat
Content-Type: application/json

{ "message": "List all Wazuh agents that are disconnected" }
```

### Wiring it into n8n

Point your n8n workflow's "When chat message received" trigger to an HTTP Request node calling `POST http://<host>:3000/chat`, and feed the response back to the reply node. n8n no longer needs an AI Agent node — it's just transport.

## Status

Actively developed as part of an ongoing internship/thesis project on automated threat hunting (Wazuh + n8n + MITRE ATT&CK). Expect breaking changes.

## License

ISC
