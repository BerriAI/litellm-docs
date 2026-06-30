import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Tag Based Routing

## Quick Start

### 1. Define tags on config.yaml

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: gpt-4
    litellm_params:
      model: openai/fake
      api_key: fake-key
      api_base: https://exampleopenaiendpoint-production.up.railway.app/
      tags: ["free"] # 👈 Key Change
  - model_name: gpt-4
    litellm_params:
      model: openai/gpt-4o
      api_key: os.environ/OPENAI_API_KEY
      tags: ["paid"] # 👈 Key Change
  - model_name: gpt-4
    litellm_params:
      model: openai/gpt-4o
      api_key: os.environ/OPENAI_API_KEY
      api_base: https://exampleopenaiendpoint-production.up.railway.app/
      tags: ["default"] # OPTIONAL - All untagged requests will get routed to this

router_settings:
  enable_tag_filtering: True # 👈 Key Change

general_settings:
  master_key: sk-1234
```

### 2. Make Request with `tags=["free"]`

```bash
curl -i http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-1234" \
  -d '{
    "model": "gpt-4",
    "messages": [
      {"role": "user", "content": "Hello, Claude gm!"}
    ],
    "tags": ["free"]
  }'
```

**Response:**

```json
{
  "id": "chatcmpl-33c534e3d70148218e2d62496b81270b",
  "choices": [
    {
      "finish_reason": "stop",
      "index": 0,
      "message": {
        "content": "\n\nHello there, how may I assist you today?",
        "role": "assistant"
      }
    }
  ],
  "model": "gpt-3.5-turbo-0125",
  "object": "chat.completion",
  "usage": {"completion_tokens": 12, "prompt_tokens": 9, "total_tokens": 21}
}
```

### 3. Make Request with `tags=["paid"]`

```bash
curl -i http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-1234" \
  -d '{
    "model": "gpt-4",
    "messages": [
      {"role": "user", "content": "Hello, Claude gm!"}
    ],
    "tags": ["paid"]
  }'
```

**Response:**

```json
{
  "id": "chatcmpl-9maCcqQYTqdJrtvfakIawMOIUbEZx",
  "choices": [
    {
      "finish_reason": "stop",
      "index": 0,
      "message": {
        "content": "Good morning! How can I assist you today?",
        "role": "assistant"
      }
    }
  ],
  "model": "gpt-4o-2024-05-13",
  "object": "chat.completion",
  "usage": {"completion_tokens": 10, "prompt_tokens": 12, "total_tokens": 22}
}
```

## Calling via Request Header

```bash
curl -L -X POST 'http://0.0.0.0:4000/v1/chat/completions' \
-H 'Content-Type: application/json' \
-H 'Authorization: Bearer sk-1234' \
-H 'x-litellm-tags: free,my-custom-tag' \
-d '{
  "model": "gpt-4",
  "messages": [
    {
      "role": "user",
      "content": "Hey, how'\''s it going?"
    }
  ]
}'
```

## Setting Default Tags

### 1. Set default tag on yaml

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: fake-openai-endpoint
    litellm_params:
      model: openai/fake
      api_key: fake-key
      api_base: https://exampleopenaiendpoint-production.up.railway.app/
      tags: ["default"] # 👈 Key Change - All untagged requests will get routed to this
    model_info:
      id: "default-model"
```

### 2. Start proxy

```bash
$ litellm --config /path/to/config.yaml
```

### 3. Make request with no tags

```bash
curl -i http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-1234" \
  -d '{
    "model": "fake-openai-endpoint",
    "messages": [
      {"role": "user", "content": "Hello, Claude gm!"}
    ]
  }'
```

## Negation Tags (Denylist)

Prefix any tag with `!` to **exclude** deployments that carry that exact tag. This is useful when you want to avoid a specific provider or model family without listing every allowed alternative.

### Quick example

```bash
curl http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-1234" \
  -d '{
    "model": "gpt-4",
    "messages": [{"role": "user", "content": "Hello"}],
    "metadata": {"tags": ["!provider:anthropic"]}
  }'
```

Any deployment tagged `provider:anthropic` is removed from the candidate pool before routing. All remaining deployments are eligible.

### Config example

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: chat
    litellm_params:
      model: anthropic/claude-haiku-4-5-20251001
      api_key: os.environ/ANTHROPIC_API_KEY
      tags: ["provider:anthropic"]

  - model_name: chat
    litellm_params:
      model: openai/gpt-4o-mini
      api_key: os.environ/OPENAI_API_KEY
      tags: ["provider:openai"]

  - model_name: chat
    litellm_params:
      model: vertex_ai/gemini-2.0-flash
      api_key: os.environ/VERTEX_API_KEY
      tags: ["provider:vertex"]

router_settings:
  enable_tag_filtering: true

general_settings:
  master_key: sk-1234
```

### Combining positive and negation tags

Use positive tags to select a tier and negation tags to exclude a provider within that tier:

```bash
curl http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-1234" \
  -d '{
    "model": "chat",
    "messages": [{"role": "user", "content": "Hello"}],
    "metadata": {"tags": ["paid", "!provider:anthropic"]}
  }'
```

### Excluding multiple providers

Send multiple `!` tags to exclude more than one deployment group:

```bash
curl http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-1234" \
  -d '{
    "model": "chat",
    "messages": [{"role": "user", "content": "Hello"}],
    "metadata": {"tags": ["!provider:anthropic", "!provider:openai"]}
  }'
```

Only the vertex deployment remains eligible.

### Negation with fallback chains

When the primary model group is banned, the router falls through to the configured fallback automatically:

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: primary
    litellm_params:
      model: anthropic/claude-haiku-4-5-20251001
      api_key: os.environ/ANTHROPIC_API_KEY
      tags: ["provider:anthropic"]

  - model_name: fallback
    litellm_params:
      model: openai/gpt-4o-mini
      api_key: os.environ/OPENAI_API_KEY
      tags: ["provider:openai"]

router_settings:
  enable_tag_filtering: true
  fallbacks:
    - {"primary": ["fallback"]}

general_settings:
  master_key: sk-1234
```

```bash
curl http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-1234" \
  -d '{
    "model": "primary",
    "messages": [{"role": "user", "content": "Hello"}],
    "metadata": {"tags": ["!provider:anthropic"]}
  }'
# primary is banned -> falls through to fallback (provider:openai)
```

### Negation semantics

| Behavior | Detail |
|----------|--------|
| Matching | Exact tag string match. `!provider:anthropic` removes only deployments tagged exactly `provider:anthropic` |
| No regex | Negation tags are plain strings, not regex patterns. `!provider:(anthropic\|openai)` only excludes a deployment tagged exactly `provider:(anthropic\|openai)`. To exclude multiple providers send separate tags: `["!provider:anthropic", "!provider:openai"]`. Note: `tag_regex` in deployment config is regex, but that is operator-configured and unrelated to client-supplied negation tags |
| Ban-only request | If the request carries only `!` tags and no positive tags, the base pool mirrors untagged-request behaviour: default-tagged deployments if any exist, otherwise all deployments. The exclusion set is then applied on top of that pool |
| All excluded | If negation tags remove every candidate, the request fails with `no_deployments_with_tag_routing` |
| Untagged deployments | Deployments with no `tags` field are never excluded by negation tags |
| Header | Negation tags work via `x-litellm-tags` header too: `-H 'x-litellm-tags: !provider:anthropic'` |

## Regex-based tag routing (`tag_regex`)

Use `tag_regex` on a deployment to match incoming requests by their headers (e.g. `User-Agent`) — without requiring the client to send explicit tags. Patterns are operator-configured and compiled server-side, not supplied by callers.

:::caution
User-Agent is a client-supplied header and can be set to any value by any caller. Use `tag_regex` for traffic classification, not access-control enforcement.

Header-based routing is not a security boundary on its own. It is only meaningful when requests pass through an upstream authentication layer (e.g., an API gateway or reverse proxy that validates credentials and rejects unauthenticated traffic before it reaches LiteLLM). Without such a layer, any client can spoof the User-Agent and be routed to a deployment it should not reach.
:::

### 1. Config

```yaml showLineNumbers title="config.yaml"
model_list:
  # Claude Code traffic → dedicated deployment, matched by User-Agent
  - model_name: claude-sonnet
    litellm_params:
      model: bedrock/converse/anthropic-claude-sonnet-4-6
      aws_region_name: us-east-1
      aws_role_name: arn:aws:iam::111122223333:role/LiteLLMClaudeCode
      tag_regex:
        - "^User-Agent: claude-code\\/"   # matches claude-code/1.x, 2.x, etc.
    model_info:
      id: claude-code-deployment
  # All other traffic falls back to the default deployment
  - model_name: claude-sonnet
    litellm_params:
      model: bedrock/converse/anthropic-claude-sonnet-4-6
      aws_region_name: us-east-1
      aws_role_name: arn:aws:iam::444455556666:role/LiteLLMDefault
      tags:
        - default
    model_info:
      id: regular-deployment

router_settings:
  enable_tag_filtering: true
  tag_filtering_match_any: true

general_settings:
  master_key: sk-1234
```

### 2. Verify routing

```bash
# Claude Code request (User-Agent set automatically by Claude Code)
curl http://localhost:4000/v1/chat/completions \
  -H "Authorization: Bearer sk-1234" \
  -H "User-Agent: claude-code/1.2.3" \
  -d '{"model": "claude-sonnet", "messages": [{"role": "user", "content": "hi"}]}'
# -> x-litellm-model-id: claude-code-deployment

# Any other client (no matching User-Agent) -> default deployment
curl http://localhost:4000/v1/chat/completions \
  -H "Authorization: Bearer sk-1234" \
  -d '{"model": "claude-sonnet", "messages": [{"role": "user", "content": "hi"}]}'
# -> x-litellm-model-id: regular-deployment
```

### Matching semantics

| Behavior | Detail |
|----------|--------|
| Engine | Python `re.search` — patterns do not need to be anchored unless you want to pin to the start (`^`) or end (`$`) of the string |
| Input format | Patterns are matched against `"Header-Name: value"` strings. Currently only `User-Agent` is exposed: `User-Agent: claude-code/1.2.3` |
| Logic | Always OR — any single pattern matching is enough to select the deployment. `tag_filtering_match_any=False` applies only to plain `tags`, not to `tag_regex` |
| Invalid patterns | A pattern that fails `re.compile` is logged and skipped; it never causes a hard error |
| Interaction with plain tags | When a deployment has both `tags` and `tag_regex`, and `tag_filtering_match_any=False`, the regex path is blocked if the strict tag check already failed. Regex cannot override a strict-tag policy |
| Trusted input | Patterns are set by the operator in config, never supplied by the caller. This is the key difference from negation tags (`!foo` in request metadata), which are always treated as plain literals |

### Interaction with negation tags

Negation exclusion runs before `tag_regex` matching. The order matters when a deployment carries both a plain `tags` list and `tag_regex`:

1. The router removes any deployment whose `tags` intersect the request's excluded set.
2. `tag_regex` matching runs only on the surviving candidates.

**Case 1: negation removes a plain-tagged deployment; the `tag_regex` deployment is unaffected**

```yaml
model_list:
  - model_name: chat
    litellm_params:
      tag_regex: ["^User-Agent: claude-code\\/"]   # no plain tags
    model_info: {id: claude-code-deployment}

  - model_name: chat
    litellm_params:
      tags: ["provider:anthropic"]
    model_info: {id: anthropic-deployment}
```

```bash
curl ... -H "User-Agent: claude-code/1.2.3" \
  -d '{"model":"chat","metadata":{"tags":["!provider:anthropic"]}}'
# anthropic-deployment is excluded; claude-code-deployment is matched by User-Agent
# -> x-litellm-model-id: claude-code-deployment
```

**Case 2: negation removes the deployment that holds `tag_regex`; ban-only path fires**

If the negated tag is on the same deployment as `tag_regex`, that deployment is excluded first. With no `tag_regex` deployments left in the candidate pool, `has_tag_filter` becomes `False`, the ban-only path fires, and the remaining deployments are returned directly.

```yaml
model_list:
  - model_name: chat
    litellm_params:
      tag_regex: ["^User-Agent: claude-code\\/"]
      tags: ["group:claude"]   # negation target is on the tag_regex deployment
    model_info: {id: claude-code-deployment}

  - model_name: chat
    litellm_params:
      tags: ["provider:openai"]
    model_info: {id: openai-deployment}
```

```bash
curl ... -H "User-Agent: claude-code/1.2.3" \
  -d '{"model":"chat","metadata":{"tags":["!group:claude"]}}'
# claude-code-deployment excluded; no tag_regex deployments remain
# ban-only path returns openai-deployment regardless of User-Agent
# -> x-litellm-model-id: openai-deployment
```

### Observability

```json
{
  "tag_routing": {
    "matched_via": "tag_regex",
    "matched_value": "^User-Agent: claude-code\\/",
    "user_agent": "claude-code/1.2.3",
    "request_tags": []
  }
}
```

## Team based tag routing (Enterprise)

### Configuration

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: fake-openai-endpoint
    litellm_params:
      model: openai/fake
      api_key: fake-key
      api_base: https://exampleopenaiendpoint-production.up.railway.app/
      tags: ["teamA"] # 👈 Key Change
    model_info:
      id: "team-a-model"
  - model_name: fake-openai-endpoint
    litellm_params:
      model: openai/fake
      api_key: fake-key
      api_base: https://exampleopenaiendpoint-production.up.railway.app/
      tags: ["teamB"] # 👈 Key Change
    model_info:
      id: "team-b-model"
  - model_name: fake-openai-endpoint
    litellm_params:
      model: openai/fake
      api_key: fake-key
      api_base: https://exampleopenaiendpoint-production.up.railway.app/
      tags: ["default"] # OPTIONAL - All untagged requests will get routed to this

router_settings:
  enable_tag_filtering: True # 👈 Key Change

general_settings:
  master_key: sk-1234
```

### Create teams with tags

```bash
# Create Team A
curl -X POST http://0.0.0.0:4000/team/new \
  -H "Authorization: Bearer sk-1234" \
  -H "Content-Type: application/json" \
  -d '{"tags": ["teamA"]}'

# Create Team B
curl -X POST http://0.0.0.0:4000/team/new \
  -H "Authorization: Bearer sk-1234" \
  -H "Content-Type: application/json" \
  -d '{"tags": ["teamB"]}'
```

### Generate keys for team members

```bash
# Generate key for Team A
curl -X POST http://0.0.0.0:4000/key/generate \
  -H "Authorization: Bearer sk-1234" \
  -H "Content-Type: application/json" \
  -d '{"team_id": "team_a_id_here"}'

# Generate key for Team B
curl -X POST http://0.0.0.0:4000/key/generate \
  -H "Authorization: Bearer sk-1234" \
  -H "Content-Type: application/json" \
  -d '{"team_id": "team_b_id_here"}'
```

### Verify routing

```bash
curl -i -X POST http://0.0.0.0:4000/chat/completions \
  -H "Authorization: Bearer team_a_key_here" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "fake-openai-endpoint",
    "messages": [
      {"role": "user", "content": "Hello!"}
    ]
  }'
```
