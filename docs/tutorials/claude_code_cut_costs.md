# Claude Code - Cut Costs

Claude Code is one of the heaviest consumers of input tokens in a modern engineering org. Long tool loops, large file reads, and MCP catalogs with hundreds of tools push every request toward the top of the context window, and the bill scales with it.

If Claude Code already points at a LiteLLM proxy (via `ANTHROPIC_BASE_URL`), there are five levers the platform admin can pull to bring that cost down. None of them require a client-side change.

## 1. Budget windows + budget fallbacks

Two knobs on the virtual key.

**Budget windows** cap how much the key can spend inside a rolling time period. Set `max_budget` (dollars) and `budget_duration` ("24h", "7d", "30d", etc). LiteLLM resets the counter automatically at the end of every window. You can stack windows too, e.g. $10/day AND $100/month, so one bad afternoon can't burn the whole month:

```bash
curl 'http://0.0.0.0:4000/key/generate' \
  --header 'Authorization: Bearer <your-master-key>' \
  --header 'Content-Type: application/json' \
  --data-raw '{
    "budget_limits": [
      {"budget_duration": "24h", "max_budget": 10},
      {"budget_duration": "30d", "max_budget": 100}
    ]
  }'
```

**Budget fallbacks** decide what happens once a per-model budget is exhausted. Instead of erroring at the developer's terminal, attach `model_max_budget` per model and a `budget_fallbacks` chain naming the cheaper models to reroute to. The request silently falls to the first fallback still under its own budget:

```bash
curl -X POST http://localhost:4000/key/generate \
  -H "Authorization: Bearer $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model_max_budget": {
      "claude-opus-4-8":   {"budget_limit": 20.0, "time_period": "1d"},
      "claude-sonnet-5":   {"budget_limit": 10.0, "time_period": "1d"},
      "claude-haiku-4-5":  {"budget_limit": 5.0,  "time_period": "1d"}
    },
    "budget_fallbacks": {
      "claude-opus-4-8":  ["claude-sonnet-5", "claude-haiku-4-5"],
      "claude-sonnet-5":  ["claude-haiku-4-5"]
    }
  }'
```

Once the developer burns $20 of Opus in a day, subsequent Opus requests silently reroute to Sonnet; if Sonnet is also tapped out, Haiku picks up. Fallback models without a `model_max_budget` entry are treated as unlimited.

Learn more: [Budget Windows](../proxy/users#set-multiple-budget-windows-on-a-key) and [Budget Fallbacks](../proxy/budget_fallbacks).

## 2. Automatic Prompt Caching

Claude's prompt cache reads a cache hit for roughly 10% of the price of a fresh input token, but only if the request marks the right message with `cache_control`. LiteLLM injects that marker for you: point `cache_control_injection_points` at the system message (or the second-to-last user turn), and every Claude Code call through the proxy carries the checkpoint without any client-side edit.

```yaml title="config.yaml"
model_list:
  - model_name: claude-sonnet-4-5
    litellm_params:
      model: anthropic/claude-sonnet-4-5
      api_key: os.environ/ANTHROPIC_API_KEY
      cache_control_injection_points:
        - location: message
          role: system

router_settings:
  optional_pre_call_checks: ["prompt_caching"]
```

for automatically injecting this in all requests, do this

```yaml title="config.yaml"
model_list:
  - model_name: claude-sonnet-4.5-20250929
    litellm_params:
      model: vertex_ai/claude-sonnet-4-5@20250929
      # ...

router_settings:
  default_litellm_params:
    cache_control_injection_points:
      - location: message
        role: system
  optional_pre_call_checks: ["prompt_caching"]
```

Turning on 'prompt_caching' as a pre call check, means if you run multiple deployments of the same Claude model, LiteLLM will intelligently route to the model deployment which was initially used for the request.

Learn more: [Auto-Inject Prompt Caching Checkpoints](./prompt_caching) and [Claude Code - Prompt Cache Routing](./claude_code_prompt_cache_routing).

## 3. Prompt Compression (Headroom)

Prompt cache trims the static prefix; Headroom trims the dynamic middle. Tool outputs, file reads, database dumps, and RAG payloads get rewritten into a compressed form before they reach the model, and if the model actually needs the original bytes, a `retrieve_headroom` tool call fetches them on demand. Reported savings run 60-95% on the compressible portion of Claude Code traffic.

Headroom runs as a sidecar container next to LiteLLM. Register it as a `pre_call` guardrail and either flip `default_on: true` or attach it to per-developer virtual keys.

```yaml title="config.yaml"
guardrails:
  - guardrail_name: headroom-compression
    litellm_params:
      guardrail: headroom
      mode: pre_call
      api_base: https://your-headroom-service
      default_on: true
```

The developer still exports `ANTHROPIC_BASE_URL` and runs `claude`; the only thing they notice is a smaller number on the spend log.

Learn more: [Headroom guardrail setup guide](../proxy/headroom).

## 4. Defer MCP tools

A Claude Code session that connects to five or six MCP servers can easily surface a few hundred tools, and every one of those tool schemas ships on every `tools/list` call. That is pure input-token overhead on a workload where the model uses two or three tools per turn.

Turn on `mcp_tool_search_enabled` on the virtual key, and LiteLLM replaces the full catalog with two virtual tools, `mcp_tool_search` and `mcp_tool_call`. The model searches by keyword, gets the ranked matches back, and calls the one it wants. The token cost of tool listing collapses from hundreds of schemas to two.

```bash
curl -X POST http://localhost:4000/key/generate \
  -H "Authorization: Bearer $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "object_permission": {
      "mcp_tool_search_enabled": true,
      "mcp_servers": ["github", "slack", "linear", "jira"]
    }
  }'
```

Ranking is token-overlap over `name + description`, so there is no embedding dependency to run. The access surface does not widen; search only returns tools the key was already allowed to call.

Learn more: [MCP Tool Search](../mcp_tool_search).

## 5. Auto routing

Send every request to the smallest model that can handle it, so cheap requests never touch the expensive model. LiteLLM ships three flavors: Semantic (embedding match), Complexity (rule-based, zero external call), and Adaptive (learns from live traffic, beta).

Complexity router is the fastest to set up. Point Claude Code at `smart-router` and it classifies each request into a tier:

```yaml title="config.yaml"
model_list:
  # Target models
  - model_name: gpt-4o-mini
    litellm_params:
      model: gpt-4o-mini

  - model_name: gpt-4o
    litellm_params:
      model: gpt-4o

  - model_name: claude-sonnet
    litellm_params:
      model: claude-sonnet-4-20250514

  - model_name: o1-preview
    litellm_params:
      model: o1-preview

  # Complexity router
  - model_name: smart-router
    litellm_params:
      model: auto_router/complexity_router
      complexity_router_config:
        tiers:
          SIMPLE: gpt-4o-mini
          MEDIUM: gpt-4o
          COMPLEX: claude-sonnet
          REASONING: o1-preview
      complexity_router_default_model: gpt-4o
```

Learn more: [Complexity Router](../proxy/auto_routing#complexity-router), [Semantic Auto Routing](../proxy/auto_routing), and [Adaptive Router](../adaptive_router).

## Stacking the levers

The five features compose. Budget-based fallbacks bound the total spend regardless of what else you do. Prompt cache checkpoints and Headroom compression each shave a different slice of the request payload before it hits the model. MCP tool search cuts the tool schema overhead at the front of every turn. Auto routing sends every request to the smallest model that can handle it. Turn them on together and the same Claude Code workload runs on a fraction of the input tokens it did before, without touching a single developer machine.

## Help us make this better

We're actively investing in cost optimization across the whole stack. If you've got ideas, on auto routing, better cache heuristics, smarter budget policies, anything, join the discussion at [litellm#32172](https://github.com/BerriAI/litellm/discussions/32172).
