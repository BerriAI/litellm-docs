import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Algenta MCP server

> Connect a self-hosted Algenta decision engine through the LiteLLM MCP Gateway for governed data queries, simulations, recommendations, and policy-gated decision execution.

Algenta is a governed AI decision engine: workloads run under an explicit execution policy, and every execution returns a receipt pinning the policy and schema snapshots it ran under. You operate the engine yourself, so unlike the other servers in this section there is one to deploy and a URL of your own to point the gateway at. LiteLLM adds centralized auth, access control by key and team, cost tracking per tool call, and one audit trail across every MCP server you expose.

## When should you use this server

- Give an agent governed data queries, Monte Carlo simulations, and recommendations while keeping real-world execution out of its reach
- Let an agent propose and record decisions, with execution reserved for deployments on a higher profile
- Roll out execution deliberately: the gateway refuses calls outside the configured profile before they reach the engine, and the engine's own policy gates refuse an unsafe execution synchronously

## Key features

- Four tool profiles (`observe`, `govern`, `execute`, `full`) map onto the gateway's own `allowed_tools` and `allowed_params` lists, so the profile boundary is enforced by LiteLLM at call time with a 403; see [MCP Permission Management](../mcp_control.md)
- On every profile where `execute_decision` is reachable, its operator-only `force` and `override_safety` arguments are excluded from `allowed_params`, so a model can never supply them
- The [`litellm-algenta`](https://pypi.org/project/litellm-algenta/) package generates and lints the config below; the linter also flags a hand-written config that points at an Algenta-hosted URL or leaves `execute_decision` reachable without the argument scrub

## Authentication

- **Method:** A bearer token issued by your own engine. The gateway sends it upstream as `Authorization: Bearer ...`, and every caller shares this one identity. Rotate the token out of band; if it expires mid-session, the upstream 401 reaches the MCP client as an `isError: true` tool result rather than a retryable response.
- **Alternative:** OAuth 2.0 client credentials, if your engine issues them. LiteLLM then mints and refreshes the upstream token itself; see the auth table in [MCP Overview](../mcp.md).

## Endpoint

**Remote MCP server (your own deployment):**

```
https://engine.example.com/mcp
```

The engine is self-hosted, so there is no Algenta-operated URL to put here. Point `url` at your own deployment's `/mcp` endpoint.

***

## Connect via LiteLLM MCP Gateway

### Step 1: Register the server in LiteLLM

<Tabs>
<TabItem value="generator" label="litellm-algenta">

[`litellm-algenta`](https://github.com/thyn-ai/algenta-integrations/tree/main/python/litellm-algenta) is a config generator and linter maintained by Algenta. It emits the same `mcp_servers:` entry shown in the manual tab, mapped from the profile you pick, and refuses to emit a config its linter considers unsafe:

```bash showLineNumbers
pip install litellm-algenta
python -m litellm_algenta.config --profile observe --server-name algenta --merge-into config.yaml
```

`--profile` accepts `observe` (the default), `govern`, `execute`, or `full`. The merge is idempotent and touches only the `mcp_servers:` key, so rerunning it against an existing `config.yaml` is safe. Leave off `--merge-into` to print the YAML to stdout instead. The package's only runtime dependency is PyYAML; generating or linting a config does not require LiteLLM to be installed.

</TabItem>
<TabItem value="manual" label="config.yaml (manual)">

The same `observe` profile entry, written by hand:

```yaml title="config.yaml" showLineNumbers
mcp_servers:
  algenta:
    url: os.environ/ALGENTA_MCP_URL
    transport: http
    auth_type: bearer_token
    authentication_token: os.environ/ALGENTA_MCP_TOKEN
    allowed_tools:
    - get_contract
    - query_data
    - recommend
    - simulate
    extra_headers:
    - x-trace-id
```

`extra_headers` forwards the named caller headers (here `x-trace-id`) from the MCP client to the engine, verbatim.

</TabItem>
</Tabs>

Storing MCP servers also needs `store_model_in_db: true`, covered in [Prerequisites](../mcp.md#prerequisites).

### Step 2: Set the engine endpoint and credential, then start the proxy

```bash showLineNumbers
export ALGENTA_MCP_URL="https://engine.example.com/mcp"
export ALGENTA_MCP_TOKEN="your-engine-issued-token"
litellm --config config.yaml --port 4000
```

Both values stay out of the config file: `os.environ/ALGENTA_MCP_URL` and `os.environ/ALGENTA_MCP_TOKEN` are resolved by the proxy at startup.

### Step 3: Connect from an agent

The gateway serves each server at `http://localhost:4000/{server_name}/mcp`, so `algenta` is reachable at `http://localhost:4000/algenta/mcp`.

<Tabs>
<TabItem value="cursor" label="Claude Desktop / Cursor">

```json title="Claude Desktop / Cursor" showLineNumbers
{
  "mcpServers": {
    "algenta": {
      "url": "http://localhost:4000/algenta/mcp",
      "headers": {
        "x-litellm-api-key": "Bearer sk-<your-litellm-api-key>"
      }
    }
  }
}
```

</TabItem>
<TabItem value="claude-code" label="Claude Code">

```bash showLineNumbers
claude mcp add --transport http algenta http://localhost:4000/algenta/mcp \
  --header "x-litellm-api-key: Bearer $LITELLM_API_KEY"
```

</TabItem>
</Tabs>

***

## Tool profiles

Each profile is a fixed set of tools, expressed as the entry's `allowed_tools` list. A call to a tool outside the list is refused by the gateway with a 403, even if the caller bypasses the filtered `tools/list` response.

| Profile | Tools | Execution |
|---|---|---|
| `observe` (default) | `get_contract`, `query_data`, `simulate`, `recommend` | Read-only |
| `govern` | `observe` plus `plan_decision`, `log_decision` | Proposes and records decisions; never executes |
| `execute` | `govern` plus `execute_decision` | Executes logged decisions, arguments scrubbed (below) |
| `full` | Everything the engine advertises (`allowed_tools` omitted) | Unrestricted tools; arguments still scrubbed |

On `execute` and `full`, the generated entry also sets `allowed_params.execute_decision` to `["decision_id", "metadata", "timeout_seconds", "webhook_url"]`. A call carrying any other argument, in particular the operator-only `force` or `override_safety`, is refused by the gateway with a 403 before it reaches the engine. The `execute` profile entry as generated:

```yaml title="config.yaml" showLineNumbers
mcp_servers:
  algenta:
    url: os.environ/ALGENTA_MCP_URL
    transport: http
    auth_type: bearer_token
    authentication_token: os.environ/ALGENTA_MCP_TOKEN
    allowed_tools:
    - execute_decision
    - get_contract
    - log_decision
    - plan_decision
    - query_data
    - recommend
    - simulate
    allowed_params:
      execute_decision:
      - decision_id
      - metadata
      - timeout_seconds
      - webhook_url
    extra_headers:
    - x-trace-id
```

Two more boundaries sit on the engine side, and the config cannot relax either. The engine only serves execute-tier tools to a credential its operator has enabled for them, and `execute_decision` itself is synchronous: it returns an execution receipt, or it refuses in the same call naming one of three gates (`idempotency`, `confidence`, `risk_floor`), which reaches the MCP client as an `isError: true` result. Only the operator-only arguments above can bypass a gate, and those are exactly what `allowed_params` keeps away from the model.

***

## Tools provided

| Tool | Description | First profile |
|---|---|---|
| `get_contract` | Fetch the live, machine-readable capability contract for the connected engine | `observe` |
| `query_data` | Run governed exact queries against an authorized, connected dataset | `observe` |
| `simulate` | Run a Monte Carlo simulation over a scenario; returns a decision envelope | `observe` |
| `recommend` | Return a governed recommendation for a scenario without a full simulation run | `observe` |
| `plan_decision` | Produce a structured decision-plan summary for human or downstream review | `govern` |
| `log_decision` | Persist a decision record and its rationale; returns the `decision_id` execution later references | `govern` |
| `execute_decision` | Dispatch one logged decision to a webhook for real-world execution; returns the execution receipt | `execute` |

LiteLLM prefixes tool names with the server name, so `query_data` is exposed to models as `algenta-query_data`; see [Tool naming](../mcp_rest_api.md#tool-naming).

:::info Restrict who can use it
Grant the server per key or per team with `object_permission`, and cap call volume per server with `mcp_rpm_limit`, both covered in [MCP Permission Management](../mcp_control.md). On this server in particular, prefer one registration per profile: register the same engine under different server names (for example `algenta` on `observe` and `algenta_execute` on `execute`), and grant the `execute` registration only to the keys and teams that should reach it.
:::
