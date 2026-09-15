# Tool Policies

Tool Policies is a proxy-managed registry of tools and their input and output policies. The proxy collects tool names during its spend update flow and asynchronously upserts them into `LiteLLM_ToolTable`. A newly created tool has `input_policy: "untrusted"` and `output_policy: "untrusted"`. The Tool Policy Guardrail reads this registry and enforces the policies for tool requests and responses

The registry stores the tool name, origin, policy values, call count, team and key metadata when available, user agent, and discovery and usage timestamps. Existing rows keep their policy values when the proxy increments their call count. The registry is synchronized into an in-memory policy registry for request-time enforcement. In practical terms, the input policy determines whether a tool call is allowed or denied

## Tool Policies and the Tool Permission Guardrail

Tool Policies manages trust relationships between tools. Its input policy can allow untrusted input, require trusted input, or block a tool. Its output policy marks output as trusted or untrusted. A blocked input policy or a team or key override rejects a tool call. A trusted input policy rejects a tool when the conversation contains output from a tool whose output policy is untrusted

An `untrusted` input policy accepts any input, including data from untrusted tool outputs. A `trusted` input policy requires trusted input. A `blocked` input policy prohibits the tool. An `untrusted` output policy may contain unsafe content and can trigger downstream trust-chain blocks. A `trusted` output policy is treated as verified safe and does not trigger those blocks

The [Tool Permission Guardrail](./guardrails/tool_permission) provides a separate rule-based control. It matches configured tool names and, optionally, tool types and arguments, then applies its configured allow or deny action. Use Tool Permission Guardrail rules when authorization depends on matching configured patterns. Use Tool Policies when the control is based on the trust classification of a discovered tool and the trust chain between tool outputs and inputs. The source does not define precedence or a combined decision algorithm between these guardrails

## Quick start

The current Admin UI route is `http://localhost:4000/ui/tool-policies`. The legacy URL `http://localhost:4000/ui/?page=tool-policies` redirects to this route

Tool Policies is available only to users with the UI `viewToolPolicies` capability. The UI assigns that capability to its admin roles and displays an access message for users without it. The UI does not fetch the tool list when the capability is missing

The overview displays counts for tools discovered today, total discovered tools, blocked tools, and active teams. It can also display newly discovered tools that still have the default untrusted input policy. The table supports search, policy and team or key filters, refresh, and client-side pagination. Its columns include discovery time, tool name, input policy, output policy, call count, team name, key hash, key name, and user agent

Select a tool name to open its detail view. The detail view shows the origin, call count, user agent, first discovery time, and last use time. Use the Input Policy and Output Policy selectors to save global policy values. Input policies are `untrusted`, `trusted`, and `blocked`. Output policies are `untrusted` and `trusted`

The detail view also displays team and key overrides that block the tool. To add an override, choose a team or key and save the blocked input policy. To remove an override, select Remove next to that team or key. The detail view includes recent usage logs for the selected tool

## Management API

All Tool Policy management routes use the proxy's authenticated API dependency. Send the proxy master key or another credential accepted by `user_api_key_auth` in the `Authorization` header. The routes return `401` or another authentication error when authentication fails. The source does not apply the UI capability check to these route declarations, so API access should be evaluated separately from Admin UI visibility

### List tools

`GET /v1/tool/list` returns an object with `tools` and `total`. Each tool row includes its policies and registry metadata. You can filter by the input policy with the `input_policy` query parameter

```bash
curl "http://localhost:4000/v1/tool/list" \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY"
```

To list only blocked tools:

```bash
curl "http://localhost:4000/v1/tool/list?input_policy=blocked" \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY"
```

### Get one tool

`GET /v1/tool/{tool_name}` returns a single `LiteLLM_ToolTableRow`. URL-encode the tool name when it contains characters that have meaning in a URL

```bash
curl "http://localhost:4000/v1/tool/example_tool" \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY"
```

`GET /v1/tool/{tool_name}/detail` returns the tool row together with its `overrides` list. The detail route is used by the Admin UI

```bash
curl "http://localhost:4000/v1/tool/example_tool/detail" \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY"
```

The detail response has the following shape:

```json
{
  "tool": {
    "tool_id": "tool-id",
    "tool_name": "example_tool",
    "input_policy": "untrusted",
    "output_policy": "untrusted"
  },
  "overrides": []
}
```

The complete tool row can also contain `origin`, `call_count`, `assignments`, `key_hash`, `team_id`, `key_alias`, `user_agent`, `last_used_at`, `created_at`, `updated_at`, `created_by`, and `updated_by`

### Get policy options

`GET /v1/tool/policy/options` returns the supported input and output policy values with their labels and descriptions

```bash
curl "http://localhost:4000/v1/tool/policy/options" \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY"
```

The response has `input_policies` and `output_policies` arrays. Each option contains `value`, `label`, and `description`:

```json
{
  "input_policies": [
    {
      "value": "untrusted",
      "label": "Untrusted",
      "description": "Tool accepts any input, including data from untrusted tool outputs. Default for newly discovered tools."
    }
  ],
  "output_policies": [
    {
      "value": "trusted",
      "label": "Trusted",
      "description": "Tool output is verified safe. Will not trigger trust-chain blocks on downstream tools."
    }
  ]
}
```

### Update a global policy

`POST /v1/tool/policy` accepts a JSON body containing `tool_name` and at least one of `input_policy` or `output_policy`. The input policy accepts `trusted`, `untrusted`, or `blocked`. The output policy accepts `trusted` or `untrusted`

```bash
curl -X POST "http://localhost:4000/v1/tool/policy" \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "tool_name": "example_tool",
    "input_policy": "blocked",
    "output_policy": "untrusted"
  }'
```

The endpoint upserts the registry row when necessary and returns `tool_name`, the submitted policy fields, and `updated: true`. Omitting both policy fields returns HTTP 400 with `At least one of input_policy or output_policy must be provided`

### Add or remove a team or key override

The same update route can add or remove a block for one team or one key. Include exactly one of `team_id` or `key_hash`. Set `input_policy` to `blocked` to add the override

```bash
curl -X POST "http://localhost:4000/v1/tool/policy" \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "tool_name": "example_tool",
    "input_policy": "blocked",
    "team_id": "team-id"
  }'
```

For a key override, use `key_hash` instead of `team_id`. The request model also accepts `key_alias` for the key metadata returned by the update route

```bash
curl -X POST "http://localhost:4000/v1/tool/policy" \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "tool_name": "example_tool",
    "input_policy": "blocked",
    "key_hash": "key-hash",
    "key_alias": "production-key"
  }'
```

To remove an override, use `DELETE /v1/tool/{tool_name}/overrides` with exactly one query parameter:

```bash
curl -X DELETE "http://localhost:4000/v1/tool/example_tool/overrides?team_id=team-id" \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY"
```

The delete route returns `{"deleted": true, "tool_name": "example_tool"}` when the override is removed. Supplying both `team_id` and `key_hash` is rejected with `Provide either team_id or key_hash, not both`

### Get usage logs

The detail view reads invoked-tool logs from `GET /v1/tool/{tool_name}/logs`. It supports `page`, `page_size`, `start_date`, and `end_date` query parameters. The date values use `YYYY-MM-DD`

```bash
curl "http://localhost:4000/v1/tool/example_tool/logs?page=1&page_size=50" \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY"
```

The response contains `logs`, `total`, `page`, and `page_size`. A log entry can include the request ID, timestamp, model, spend, total tokens, and an input snippet

## Enforcement

Add the Tool Policy Guardrail to the proxy configuration to enable policy enforcement:

```yaml
guardrails:
  - guardrail_name: "tool_policy"
    litellm_params:
      guardrail: tool_policy
      mode: post_call
```

The guardrail supports `pre_call`, `post_call`, and `during_call` event hooks. On a request it reads tool names from the request tools or from the request route when the tools list is absent. On a response it reads tool names from response tool calls

When a tool has `input_policy: "blocked"`, or a team or key override blocks it, the guardrail raises HTTP 400. Its caller-visible exception detail is:

```json
{
  "detail": {
    "error": "Violated tool policy",
    "blocked_tools": ["example_tool"],
    "message": "Tool(s) ['example_tool'] are blocked by policy."
  }
}
```

When a tool has `input_policy: "trusted"` and the conversation contains output from a tool with `output_policy: "untrusted"`, the guardrail also raises HTTP 400. The detail includes `blocked_tools`, `untrusted_sources`, and a message stating that the trusted-input tool requires trusted input

The HTTP 400 response has this shape:

```json
{
  "detail": {
    "error": "Violated tool policy",
    "blocked_tools": ["trusted_tool"],
    "untrusted_sources": ["untrusted_tool"],
    "message": "trusted_tool requires trusted input but conversation contains untrusted output from untrusted_tool."
  }
}
```

If the in-memory policy registry is not initialized, the guardrail returns the inputs without applying Tool Policies. The proxy initializes the registry from the database when its tool database objects are loaded, and policy updates resynchronize the registry when it has already been initialized

## Configuration

`TOOL_POLICY_CACHE_TTL_SECONDS` is an environment variable with a default of `60`. The configuration reference describes it as the TTL in seconds for caching Tool Policy Guardrail results:

```bash
export TOOL_POLICY_CACHE_TTL_SECONDS=60
```

See [Proxy configuration settings](./config_settings) for the complete environment variable reference

## Discovery behavior

The spend update flow queues tool names from MCP tool call metadata, OpenAI-format request tools, Anthropic Messages request tools, and response tool calls. The queue deduplicates each tool name within a flush cycle, and the registry writer increments `call_count` on later upserts while preserving existing policies

The source contains different descriptions for registry discovery and usage indexing. The usage log and spend routes state that declaring a tool without invoking it does not create a usage entry, while the registry extraction code also scans request tool declarations. Because these paths do not establish the same behavior, this page does not promise whether a declared but unused tool creates a registry row
