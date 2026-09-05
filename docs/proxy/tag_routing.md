import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Tag Based Routing

## Quick Start

### 1. Define tags on config.yaml

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: {{openai_large}}
    litellm_params:
      model: openai/fake
      api_key: fake-key
      api_base: https://exampleopenaiendpoint-production.up.railway.app/
      tags: ["free"] # 👈 Key Change
  - model_name: {{openai_large}}
    litellm_params:
      model: openai/{{openai_large}}
      api_key: os.environ/OPENAI_API_KEY
      tags: ["paid"] # 👈 Key Change
  - model_name: {{openai_large}}
    litellm_params:
      model: openai/{{openai_large}}
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
    "model": "{{openai_large}}",
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
  "model": "{{openai_large}}",
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
    "model": "{{openai_large}}",
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
  "model": "{{openai_large}}",
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
  "model": "{{openai_large}}",
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
    "model": "{{openai_large}}",
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
      model: anthropic/{{anthropic}}
      api_key: os.environ/ANTHROPIC_API_KEY
      tags: ["provider:anthropic"]

  - model_name: chat
    litellm_params:
      model: openai/{{openai_small}}
      api_key: os.environ/OPENAI_API_KEY
      tags: ["provider:openai"]

  - model_name: chat
    litellm_params:
      model: vertex_ai/{{gemini_flash}}
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
      model: anthropic/{{anthropic}}
      api_key: os.environ/ANTHROPIC_API_KEY
      tags: ["provider:anthropic"]

  - model_name: fallback
    litellm_params:
      model: openai/{{openai_small}}
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

## Required Tags (AND)

Prefix any tag with `&` to require it. A deployment must carry every `&`-prefixed tag in the request to be a candidate, unlike plain tags which need only one match. This is useful for combining independent constraints, for example "must be high-reasoning and specifically from Anthropic", where plain OR tags would instead match a low-reasoning Anthropic deployment or a high-reasoning non-Anthropic deployment.

### Quick example

```bash
curl http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-1234" \
  -d '{
    "model": "chat",
    "messages": [{"role": "user", "content": "Hello"}],
    "metadata": {"tags": ["&reasoning_type:high", "&provider:anthropic"]}
  }'
```

Only a deployment carrying both `reasoning_type:high` and `provider:anthropic` is eligible.

### Config example

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: chat
    litellm_params:
      model: anthropic/{{anthropic}}
      api_key: os.environ/ANTHROPIC_API_KEY
      tags: ["reasoning_type:high", "provider:anthropic"]

  - model_name: chat
    litellm_params:
      model: openai/{{openai_small}}
      api_key: os.environ/OPENAI_API_KEY
      tags: ["reasoning_type:high", "provider:openai"]

router_settings:
  enable_tag_filtering: true

general_settings:
  master_key: sk-1234
```

### Combining required, negation, and plain tags

`!` exclusion applies first, then `&` required tags narrow what's left, then plain tags apply the usual OR preference on the survivors:

```bash
curl http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-1234" \
  -d '{
    "model": "chat",
    "messages": [{"role": "user", "content": "Hello"}],
    "metadata": {"tags": ["&reasoning_type:high", "provider:anthropic", "provider:openai", "!inference:cerebras"]}
  }'
# must be high-reasoning, AND (anthropic OR openai), AND not cerebras-hosted
```

### Required-AND semantics

| Behavior | Detail |
|----------|--------|
| Matching | Exact tag string match, same as negation tags. Not regex |
| Required-only request | If the request carries only `&` tags (no plain or negation tags), the base pool mirrors untagged-request behaviour: default-tagged deployments if any exist, otherwise all deployments. The required-tag filter is then applied on top of that pool |
| Regex/header preference does not dilute a required-AND request | A required-AND-only request always returns every deployment satisfying the required tags, even if one of them also happens to match an unrelated `tag_regex`/User-Agent preference. It is never narrowed down to only the regex-matched deployment |
| All eliminated | If required tags eliminate every candidate, the request fails with `no_deployments_with_tag_routing`, unless the model group opts into [`allow_fail_open`](#fail-open-fallback-allow_fail_open) |
| Header | Required tags work via `x-litellm-tags` header too: `-H 'x-litellm-tags: &reasoning_type:high'` |

## Fail-Open Fallback (`allow_fail_open`)

By default, when `!` or `&` tags eliminate every deployment in a model group, the request fails with `no_deployments_with_tag_routing`. Set `allow_fail_open: true` in `model_info` on every deployment in the group to fall back to the default-tagged pool instead of failing the request.

This is an explicit opt-in. Without it, behavior is unchanged: an unsatisfiable `!` or `&` constraint always raises, exactly as negation already does today.

### Config example

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: chat
    litellm_params:
      model: anthropic/{{anthropic}}
      api_key: os.environ/ANTHROPIC_API_KEY
      tags: ["provider:anthropic"]
    model_info:
      allow_fail_open: true

  - model_name: chat
    litellm_params:
      model: openai/{{openai_small}}
      api_key: os.environ/OPENAI_API_KEY
      tags: ["provider:openai", "default"]
    model_info:
      allow_fail_open: true

router_settings:
  enable_tag_filtering: true

general_settings:
  master_key: sk-1234
```

### Without `allow_fail_open`

```bash
curl http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-1234" \
  -d '{
    "model": "chat",
    "messages": [{"role": "user", "content": "Hello"}],
    "metadata": {"tags": ["!provider:anthropic", "!provider:openai"]}
  }'
# both deployments banned, allow_fail_open unset -> fails with no_deployments_with_tag_routing
```

### With `allow_fail_open`

Using the config above, the same request instead falls back to the default-tagged deployment, including the one the request tried to ban:

```bash
curl http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-1234" \
  -d '{
    "model": "chat",
    "messages": [{"role": "user", "content": "Hello"}],
    "metadata": {"tags": ["!provider:openai"]}
  }'
# openai deployment banned; anthropic deployment is not "default"-tagged, so the
# pool falls back to whichever deployment IS "default"-tagged (openai here) -> the
# ban is treated as advisory rather than failing the request
```

:::caution
Falling back to the default-tagged pool can still return a deployment the request explicitly tried to exclude, for any constraint attributable to the caller. Only set `allow_fail_open` on a model group where a `!`/`&` constraint that can't be honored is acceptable to degrade rather than fail; do not set it on a group where the constraint is a hard compliance requirement (for example, "never route this account's traffic to Provider X").

A constraint inherited from key- or team-level policy is protected from being discarded. The proxy tracks which tags came from key/team metadata separately from what the request itself supplied (`metadata.inherited_tags`), so `allow_fail_open` only ever drops a constraint the caller controlled. That holds even if the caller also resubmits the inherited tag's exact value alongside a conflicting one, a value-collision that plain set subtraction could not tell apart from an honest caller-only tag. If dropping the caller-controlled portion alone still leaves nothing to route to, the request raises instead of falling open.

This protection requires the proxy layer. A direct SDK `Router` call that bypasses the proxy (no `metadata.inherited_tags` set) falls back to the fully-unconstrained default pool unconditionally, exactly as if every tag were caller-supplied. That is the same behavior `allow_fail_open` has always had outside the proxy.
:::

### allow_fail_open semantics

| Behavior | Detail |
|----------|--------|
| Location | `model_info.allow_fail_open`, not `litellm_params`. Set it on every deployment sharing the model group for consistent behavior; the router checks any one member |
| Default | Unset (`false`). Existing `!` negation behavior is unchanged unless a group opts in |
| Scope | Only gates exhaustion caused by `!` or `&`. Plain-tag exhaustion keeps its existing behavior: fall back to the default pool if one exists, otherwise raise |
| Fallback pool | The same default-tagged pool used for untagged and ban-only requests, without re-applying the request's own `!`/`&` constraints |
| Inherited-tag protection | Discarding is based on tag provenance (`metadata.inherited_tags`, populated by the proxy from key/team policy), not on subtracting the caller's own tags from the total — a key/team-inherited constraint stays protected even if the caller separately submits the identical value |

## Explicit Routing Directives (`tag_routing_prefix`)

Tag-based routing infers "is this tag meant for routing" by checking whether some deployment's literal tag string happens to match. That heuristic is usually right, but a caller-invented `&`/`!` tag that matches nothing is treated as suspicious noise and can block `allow_fail_open`'s fallback (see above) even when the caller genuinely wanted an honest, if unsatisfiable, request. Configure `router_settings.tag_routing_prefix` to let a caller mark specific tags as trusted, unambiguous routing directives, removing that ambiguity entirely for the tags that use it.

Any request tag starting with the configured prefix is stripped of the prefix and matched using the usual `!`/`&`/plain-tag logic, with no vocabulary check needed since the caller already declared routing intent explicitly. An unprefixed tag keeps going through today's existing handling unchanged, so adopting the prefix requires no migration.

### Quick example

With `tag_routing_prefix: "route:"` configured:

```bash
curl http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-1234" \
  -d '{
    "model": "chat",
    "messages": [{"role": "user", "content": "Hello"}],
    "metadata": {"tags": ["feature:demo", "route:!provider:openai"]}
  }'
# feature:demo is untouched attribution, never meant for routing; route:!provider:openai
# is stripped to !provider:openai and matched as an explicit ban
```

### Config example

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: chat
    litellm_params:
      model: anthropic/{{anthropic}}
      api_key: os.environ/ANTHROPIC_API_KEY
      tags: ["default", "provider:anthropic"]
    model_info:
      allow_fail_open: true

  - model_name: chat
    litellm_params:
      model: openai/{{openai_small}}
      api_key: os.environ/OPENAI_API_KEY
      tags: ["provider:openai"]

router_settings:
  enable_tag_filtering: true
  tag_routing_prefix: "route:" # opt-in: enables the prefix mechanism

general_settings:
  master_key: sk-1234
```

### Prefixed tags and the unknown-tag fail-open guard

A prefixed `&`/`!` tag counts as known to the [unknown-tag fail-open guard](#fail-open-fallback-allow_fail_open) regardless of whether any deployment's literal tags match it, since the caller has explicitly declared routing intent:

```bash
curl http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-1234" \
  -d '{
    "model": "chat",
    "messages": [{"role": "user", "content": "Hello"}],
    "metadata": {"tags": ["route:&provider:anthropic", "route:&custom-routing-key"]}
  }'
# custom-routing-key matches no deployment's tags, but because it is prefix-marked
# the caller has explicitly declared it a routing directive -- allow_fail_open still
# proceeds to the default-tagged pool instead of being blocked by the "does an
# invented tag hide a satisfiable answer" guard
```

### tag_routing_prefix semantics

| Behavior | Detail |
|----------|--------|
| Location | `router_settings.tag_routing_prefix`, string, default `""` |
| Default | `""`. `str.startswith("")` matches every string, so the mechanism is a full no-op until configured |
| Matching | Exact literal prefix, no delimiter auto-appended. Configure a trailing delimiter yourself (e.g. `"route:"`, not `"route"`) — a prefix with no delimiter can coincidentally match an unrelated tag that happens to start with the same characters |
| Stripping order | The prefix is stripped first, before `!`/`&` parsing, so `route:!provider:x` and `route:&provider:x` both work |
| Unprefixed tags | Keep going through today's existing handling unchanged: the known-tag-vocabulary heuristic for plain tags, and the unknown-tag fail-open guard for `!`/`&` tags |
| Interaction with fail-open | A prefixed `&`/`!` tag counts as known to `allow_fail_open`'s unknown-tag guard regardless of deployment tag vocabulary |

## Per-Model-Group Tag Filtering (`enable_tag_filtering`)

Set `enable_tag_filtering` in `model_info` to override `router_settings.enable_tag_filtering` for one model group only, in either direction. It is checked at the model-group level: the router looks at any deployment in the requested `model_name` group, and if that deployment's `model_info.enable_tag_filtering` is set, it replaces the router-wide default for every request to that group. Set it consistently on every deployment sharing the group, the same convention `allow_fail_open` already uses.

This matters on a proxy that serves many unrelated model groups. Turning on `router_settings.enable_tag_filtering` globally to satisfy one group's `&`/`!`-driven compliance routing would expose every other group's requests to tag evaluation too. Setting `model_info.enable_tag_filtering: true` on just that group's deployments avoids that. The reverse works too: carve out one tag-immune catch-all or incident-response model group while the rest of the proxy enforces tag filtering everywhere else.

### Quick example

```bash
curl http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-1234" \
  -d '{
    "model": "chat-compliance",
    "messages": [{"role": "user", "content": "Hello"}],
    "metadata": {"tags": ["&provider:anthropic"]}
  }'
# router_settings.enable_tag_filtering is false, but chat-compliance opts in via
# model_info.enable_tag_filtering: true, so the "&" constraint still applies
```

### Config example

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: chat-compliance
    litellm_params:
      model: anthropic/{{anthropic}}
      api_key: os.environ/ANTHROPIC_API_KEY
      tags: ["provider:anthropic"]
    model_info:
      enable_tag_filtering: true # opt in for this group only

  - model_name: chat-compliance
    litellm_params:
      model: openai/{{openai_small}}
      api_key: os.environ/OPENAI_API_KEY
      tags: ["provider:openai"]
    model_info:
      enable_tag_filtering: true

  - model_name: incident-response
    litellm_params:
      model: openai/{{openai_small}}
      api_key: os.environ/OPENAI_API_KEY
    model_info:
      enable_tag_filtering: false # opt out for this group only

router_settings:
  enable_tag_filtering: false # router-wide default; chat-compliance overrides it

general_settings:
  master_key: sk-1234
```

With this config, `chat-compliance` evaluates tags on every request even though the router-wide default is off, while every other model group, including `incident-response`, ignores tags and falls back to ordinary load-balanced routing. Flip the router-wide default to `true` instead and `chat-compliance` still evaluates tags, unaffected, while `incident-response`'s explicit `enable_tag_filtering: false` keeps it exempt.

### enable_tag_filtering semantics

| Behavior | Detail |
|----------|--------|
| Location | `model_info.enable_tag_filtering`, not `litellm_params`. Set it on every deployment sharing the model group; the router checks any one member |
| Precedence | Low to high: `router_settings.enable_tag_filtering` (router-wide default), then `model_info.enable_tag_filtering` if set on the requested group, which overrides the router default in either direction for that group alone, then request-level `enable_tag_filtering` from key/team settings |
| Request-level escalation only | The request-level setting, set by the proxy from key/team settings, can only turn filtering on. A request-level `enable_tag_filtering=True` still wins over a group that opted itself out with `enable_tag_filtering: false`; there is no request-level way to turn filtering off over what the router and the model group already decided |
| Default | Unset. The model group defers to `router_settings.enable_tag_filtering`, exactly as before this override existed |
| Scope | Applies to the whole tag-filtering decision for the group, not just `&`/`!` handling. A group with filtering disabled ignores plain, negation, and required tags alike |
| Health-independent | Resolved from every deployment configured for the model group, not just the ones currently healthy — a single deployment's cooldown can't silently disable (or enable) the whole group's tag policy by taking the only deployment carrying the override out of rotation |

## Regex-based tag routing (`tag_regex`)

Use `tag_regex` on a deployment to match incoming requests by their headers (e.g. `User-Agent`) without requiring the client to send explicit tags. Patterns are operator-configured and compiled server-side, not supplied by callers.

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
