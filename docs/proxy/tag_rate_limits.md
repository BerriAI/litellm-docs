import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Tag Rate Limits

Cap tokens, requests, dollars, or concurrent in-flight requests per tag identity, independent of which virtual key sent the request.

This is a config-only mechanism, not a database-registered one: any tag value a caller sends is usable immediately, with no `/tag/new` call needed first. Two callbacks share the same entry format: `model_based_tag_rate_limits_hook` declares limits per deployment under `model_info.tag_rate_limits` and enforces them on every routing attempt ([**See Code**](https://github.com/BerriAI/litellm/blob/main/litellm/proxy/hooks/model_based_tag_rate_limits_hook.py)); `global_tag_rate_limits_hook` declares limits once, model-independently, under `litellm_settings.global_tag_rate_limits`, and enforces them before routing even starts (see [Global Tag Rate Limits](#global-tag-rate-limits), [**See Code**](https://github.com/BerriAI/litellm/blob/main/litellm/proxy/hooks/global_tag_rate_limits_hook.py)). Most of this page describes the per-deployment version; the fields and semantics carry over to the global one except where noted.

**See Also:**
- [Setting Tag Budgets](tag_budgets.md) for a database-registered, dollars-only tag budget with a scheduled reset, rather than a rolling window.
- [Request Tags](request_tags.md) for how tags reach the proxy (`metadata.tags`, the `x-litellm-tags` header, or a key's own tags).

## Quick Start Usage

1. Setup config.yaml

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: my-chain
    litellm_params:
      model: anthropic/claude-haiku-4-5
      api_key: os.environ/ANTHROPIC_API_KEY
    model_info:
      tag_rate_limits:
        request_limits:
          limits:
            - name: per_minute
              tag_id: end_user_id
              limit: 5
              period_seconds: 60

litellm_settings:
  callbacks: ["model_based_tag_rate_limits_hook"]

general_settings:
  master_key: sk-1234 # OR set `LITELLM_MASTER_KEY=".."` in your .env
```

2. Start proxy

```bash
litellm --config /path/to/config.yaml
```

3. Test it! Send a request with an `end_user_id` tag on `X-Litellm-Tags`. The 6th request in the same 60-second window gets a 429:

```bash
curl -X POST 'http://0.0.0.0:4000/chat/completions' \
  -H 'Authorization: Bearer sk-1234' \
  -H 'Content-Type: application/json' \
  -H 'X-Litellm-Tags: end_user_id:user-123' \
  -d '{
        "model": "my-chain",
        "messages": [{"role": "user", "content": "Hello"}]
      }'
```

**Expected response once the limit is hit:**

```json
{
  "error": {
    "message": "tag_rate_limit_exceeded",
    "type": "throttling_error",
    "code": "429",
    "provider_specific_fields": {
      "error": "tag_rate_limit_exceeded",
      "type": "requests",
      "tag_id": "end_user_id",
      "tag_value": "user-123",
      "limit_name": "per_minute",
      "limit": 5,
      "period_seconds": 60
    }
  }
}
```

A request from a different `end_user_id` value, or with no tag at all, is unaffected; an entry whose configured `tag_id` isn't present on the request is skipped rather than blocking the call.

## Limit Types

Declare limits under a deployment's `model_info.tag_rate_limits`. There are four sibling groups, each a list of independently-configured entries:

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: my-chain
    litellm_params:
      model: anthropic/claude-haiku-4-5
    model_info:
      tag_rate_limits:
        token_limits:
          limits:
            - name: daily
              tag_id: end_user_id
              limit: 500000
              period_seconds: 86400
        request_limits:
          limits:
            - name: per_minute
              tag_id: end_user_id
              limit: 5
              period_seconds: 60
        dollar_limits:
          limits:
            - name: monthly
              tag_id: team_id
              limit: 50.0
              period_seconds: 2592000
        concurrency_limits:
          limits:
            - name: inflight
              tag_id: end_user_id
              limit: 2
              period_seconds: 300
```

Each entry takes:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Label for this entry, surfaced in the 429 detail and in the Redis key. |
| `tag_id` | string | No (default `end_user_id`) | Which tag identifies the caller for this entry, e.g. `end_user_id` in a tag like `end_user_id:user-123`. Different entries on the same chain can use different `tag_id`s. |
| `limit` | number | Yes | The cap for this entry's unit. |
| `period_seconds` | integer | Yes | The window length in raw seconds. For `concurrency_limits`, this isn't a window; it's a safety TTL a reserved slot self-heals after, in case a worker crashes before releasing it. |
| `scope_by_key_hash` | boolean | No (default `false`) | When `true`, the calling virtual key's hash is folded into the bucket, so each key gets its own counter for the same tag value instead of every key sharing one. Use this when the same tag value (e.g. `end_user_id:user-123`) can legitimately show up behind more than one virtual key and each key's usage of it should be tracked separately. |
| `key_ttl_seconds` | integer | No (default `period_seconds + 3600`) | How long this entry's Redis (or in-memory, if Redis isn't configured) key lives before expiring. Lower it to shed high-cardinality keys sooner without shortening `period_seconds` itself. For `concurrency_limits`, the effective TTL is never allowed below a fixed safety floor, regardless of this value, so a reservation can't expire while the request is still genuinely in flight. |
| `max_in_memory_cache_size` | integer | No | Gives this entry its own dedicated in-memory cache partition instead of sharing the hook's single default one (see [Enable the Callback](#enable-the-callback)). Set this when one high-cardinality entry would otherwise crowd out other entries sharing the default partition; unset entries are unaffected by it either way. |

`period_seconds` is raw seconds, not a day/week/month enum, so the same mechanism covers both a genuine RPM-style cap and a long-window budget: `period_seconds: 86400` resets at UTC midnight, and `period_seconds: 60` resets on real clock-minute boundaries (bucketed by `epoch_second // period_seconds`, so any value that evenly divides a day lands on a natural clock boundary).

`token_limits` and `dollar_limits` are accounted from real usage once a request succeeds, since the actual token count or cost is only known after the response. `request_limits` and `concurrency_limits` are enforced atomically at admission, before the request is dispatched: `request_limits` increments its counter immediately, and `concurrency_limits` reserves a slot that's released once the request finishes, whether it succeeds, fails, or the client disconnects before a response arrives. `period_seconds` remains the outer safety net for a release that's missed some other way, such as a worker crashing before it runs.

## Scoped and Conditional Entries

An entry can be limited to only a subset of traffic, so a tiered override (stricter or looser than a chain's default) can be expressed directly in config rather than pushing that membership decision into whatever attaches tags to the request. Four optional fields, each independently opt-in:

| Field | Type | Description |
|-------|------|-------------|
| `enabled_for` | `{tag_id, values}` | Gates the entry on a tag -- often a second, independent tag (e.g. `company_id`), but `tag_id` can also be set to this same entry's own `tag_id` to scope by a subset of its own resolved identity instead. The entry only resolves when that tag is present on the request and its value is in `values`. |
| `disabled_for` | `{tag_id, values}` | The inverse gate: the entry is skipped whenever that tag is present and its value is in `values`. Absence of the tag never triggers this. |
| `apply_to_key_alias` | list of strings | Restricts the entry to requests authenticated with one of these virtual keys' own `key_alias`. Unset (the default) means every calling key. A key with no alias set never satisfies this allowlist. |
| `apply_to_models` | list of strings | Restricts the entry to requests whose caller-facing `model` matches one of these names. Unset (the default) means every model. A request with no `model` field never satisfies this allowlist. |

`disabled_for`/`enabled_for` gate on tag values; `apply_to_key_alias`/`apply_to_models` gate on the calling key or the caller-facing model name instead, so they compose with tag-based gating rather than duplicating it. A common pattern combines a second-tag `enabled_for` gate with a plain default, falling through to the chain's default entry for everyone else:

```yaml showLineNumbers title="config.yaml"
model_info:
  tag_rate_limits:
    request_limits:
      limits:
        # Platform default -- every identity not caught by the override below.
        - name: default_daily
          tag_id: end_user_id
          limit: 2500
          period_seconds: 86400

        # Company-wide override: only applies to requests tagged company_id:1032,
        # and only when made through the "internal-tools" virtual key.
        - name: company_1032_daily
          tag_id: end_user_id
          limit: 1000
          period_seconds: 86400
          enabled_for:
            tag_id: company_id
            values: ["1032"]
          apply_to_key_alias:
            - internal-tools
```

Both entries key on the same `tag_id` (`end_user_id`), which is what makes them layer as default-vs-override rather than two independent, summed buckets.

Precedence, evaluated in order, deny overriding allow, before the entry's normal admit/check path:

1. Resolve the entry's own identity via its `tag_id`. If absent, skip the entry (unchanged fail-open behavior).
2. If `disabled_for` is set and its tag's value is in `disabled_for.values`, skip the entry. If that tag is absent, this check never fires.
3. Else if `enabled_for` is set and its tag is absent, or its value is not in `enabled_for.values`, skip the entry. Absence does skip here, unlike `disabled_for`, since `enabled_for` is an allowlist gate.
4. Else if `apply_to_models` is set and the request's caller-facing `model` is absent or not in the list, skip the entry. Same allowlist semantics as `enabled_for`.
5. Else if `apply_to_key_alias` is set and the calling key's own alias is absent or not in the list, skip the entry. Same allowlist semantics as `enabled_for`.
6. Otherwise the entry resolves normally.

A skip at any step is the same fail-open, per-entry outcome as a missing `tag_id`; sibling entries on the same chain are unaffected.

These four fields, along with `scope_by_key_hash`, are folded into the same [load-balanced-group](#load-balanced-deployments) equality check as `limit`/`period_seconds`: two deployments agreeing on everything else but disagreeing on `apply_to_models` are genuinely different policies, not a shared bucket. All of them raise `ValidationError` at config load time on malformed input (not a list of strings, or an `enabled_for`/`disabled_for` missing `tag_id`/`values`), the same as every other field on an entry.

## How Enforcement Works

`router_settings.routing_strategy: usage-based-routing` (the legacy, deprecated strategy predating `usage-based-routing-v2`) resolves deployments through a synchronous code path that never runs deployment-filter callbacks, so tag rate limits (and tag-based routing generally) are silently never enforced under that strategy. This is a limitation of that legacy routing path itself, not specific to this callback. Use `usage-based-routing-v2` or another supported strategy if tag rate limits need to be enforced.

Limits are checked on every routing attempt, not just once before the primary model is tried. If a chain has fallbacks configured, a limit breach on the primary rejects that specific hop and the router moves on to try the fallback, whose own `tag_rate_limits` (if any) are checked independently:

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: primary
    litellm_params:
      model: anthropic/claude-haiku-4-5
    model_info:
      tag_rate_limits:
        request_limits:
          limits:
            - {name: per_minute, tag_id: end_user_id, limit: 5, period_seconds: 60}

  - model_name: fallback
    litellm_params:
      model: anthropic/claude-opus-4-6

router_settings:
  fallbacks: [{"primary": ["fallback"]}]
```

## Load-Balanced Deployments

`Router.model_list` lets multiple deployments share one `model_name` for load balancing. `tag_rate_limits` handles this explicitly:

- If every deployment behind a `model_name` declares the **identical** value for a given entry, it's chain-wide: one shared bucket, enforced regardless of which specific deployment ends up serving the request.
- If deployments **disagree** on the value (or only some of them declare it), each distinct value becomes its own bucket, scoped to exactly the deployment(s) that declared it. A breach on one of these rejects the whole routing attempt; it does not filter that one deployment out and let the router try a sibling in the same group instead.

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: my-loadbalanced-chain
    litellm_params:
      model: anthropic/claude-haiku-4-5
    model_info:
      tag_rate_limits:
        request_limits:
          limits: [{name: daily, tag_id: end_user_id, limit: 1000, period_seconds: 86400}]

  - model_name: my-loadbalanced-chain # same model_name -- a load-balanced sibling
    litellm_params:
      model: vertex_ai/claude-haiku-4-5
    model_info:
      tag_rate_limits:
        request_limits:
          limits: [{name: daily, tag_id: end_user_id, limit: 1000, period_seconds: 86400}] # identical value -> one shared bucket
```

A single-deployment `model_name`, or a fallback position (which by construction never has more than one deployment behind the same name), always resolves to exactly one shared bucket, so this doesn't change behavior for the common case.

`concurrency_limits` only supports chain-wide entries: every deployment sharing a `model_name` must declare the identical value. A divergent per-deployment concurrency value is dropped with a warning rather than creating a per-deployment reservation, since a concurrency slot has to be released on completion and there's no reliable way to know, after the fact, which of several candidate deployments would have owned it. `token_limits`, `request_limits`, and `dollar_limits` don't have this restriction since they're plain counters, not reserve/release resources.

## Global Tag Rate Limits

`model_based_tag_rate_limits_hook` (everything above) declares limits per deployment, under `model_info.tag_rate_limits`, and checks them on every routing attempt, so a fallback hop is checked against its own configuration rather than the primary's. `global_tag_rate_limits_hook` is a separate, model-independent sibling: limits are declared once, under `litellm_settings.global_tag_rate_limits`, and checked a single time per request in `async_pre_call_hook`, before Router does any routing at all. Use the global version for a cap that should hold regardless of which model or fallback chain a request ends up hitting; use the per-deployment version for a cap tied to one deployment's own capacity.

The config shape is identical: the same `token_limits`/`request_limits`/`dollar_limits`/`concurrency_limits` groups, the same entry fields (`name`, `tag_id`, `limit`, `period_seconds`, `scope_by_key_hash`, `key_ttl_seconds`, `max_in_memory_cache_size`, `enabled_for`, `disabled_for`, `apply_to_key_alias`, `apply_to_models`), just placed at `litellm_settings.global_tag_rate_limits` instead of under a deployment's `model_info`:

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: my-chain
    litellm_params:
      model: anthropic/claude-haiku-4-5
      api_key: os.environ/ANTHROPIC_API_KEY
  - model_name: my-fallback
    litellm_params:
      model: anthropic/claude-opus-4-6
      api_key: os.environ/ANTHROPIC_API_KEY

router_settings:
  fallbacks: [{"my-chain": ["my-fallback"]}]

litellm_settings:
  callbacks: ["global_tag_rate_limits_hook"]
  global_tag_rate_limits:
    request_limits:
      limits:
        - name: per_minute
          tag_id: end_user_id
          limit: 5
          period_seconds: 60
```

Since there's no deployment to attach to, there's no [load-balanced-group](#load-balanced-deployments) dedup concept for the global version: each entry is exactly one policy, checked once per request. There's a related but different mechanism for scoping to specific models: `apply_to_models` lets one entry cap a whole named fallback chain as a single unit, e.g. `apply_to_models: ["my-chain"]` caps the `my-chain`/`my-fallback` pair together regardless of which one ends up serving the request. Without `apply_to_models`, an entry applies to every model.

A rejection from an `apply_to_models`-scoped entry carries `cross_model_scope: true` in its error detail, which the proxy's own fallback retry logic checks: it stops retrying further fallback models for that request instead of silently admitting it through a model outside the entry's list. Retrying past an `apply_to_models` rejection would otherwise defeat the very policy that just rejected the request, by serving it through a fallback the entry was never meant to exempt.

`model_based_tag_rate_limits_hook` and `global_tag_rate_limits_hook` are independent opt-in callbacks; enabling both at once (`callbacks: ["model_based_tag_rate_limits_hook", "global_tag_rate_limits_hook"]`) is supported, and each enforces its own configuration without interfering with the other's counters (they're namespaced under different Redis/in-memory key prefixes).

## Tag Identity and Trust

A tag value is whatever the caller's tags resolve to, the same identity [Request Tags](request_tags.md) and [Setting Tag Budgets](tag_budgets.md) already use. If a rate limit's `tag_id` is meant to represent a real, distinct caller (e.g. `end_user_id` per end user), that's only enforceable to the extent the tag itself is trustworthy:

- A tag attached to a virtual key (via `/key/generate` metadata) is server-provisioned and can't be spoofed by the caller.
- A tag sent by the caller directly, via `metadata.tags` in the request body or the `x-litellm-tags` header, can be set to anything, including a fresh value on every request, which defeats a limit meant to cap one identity's usage over time.

If callers are untrusted, either provision tags on the key instead of accepting them from the request, or set `general_settings.reject_clientside_metadata_tags: true` to block client-supplied tags outright. That flag currently covers the common chat/embeddings routes; it does not yet cover Bedrock-invoke, `/v1/messages`, Responses, batches, or files routes, which resolve tags from a separate `litellm_metadata` field the check doesn't inspect.

Token and dollar accounting on a successful call read `model_group`, `metadata`, `total_tokens`, and `response_cost` off the same `StandardLoggingPayload` every other logging integration sees. If `litellm.standard_logging_payload_excluded_fields` is configured to strip any of those fields, this callback loses the same data it needs to record usage, silently under-counting (or entirely skipping) the tag's token or dollar bucket for calls made through that configuration. Don't combine tag-scoped token or dollar limits with an exclusion list that removes these fields.

## Enable the Callback

Neither `model_based_tag_rate_limits_hook` nor `global_tag_rate_limits_hook` is a default proxy hook; add whichever one (or both) a config needs to `litellm_settings.callbacks`:

```yaml showLineNumbers title="config.yaml"
litellm_settings:
  callbacks: ["model_based_tag_rate_limits_hook"]
```

<Tabs>
<TabItem value="in-memory" label="In-memory (no Redis)">

Works without any cache configured. Counters are process-local, so this is only accurate for a single-instance deployment.

Every entry that doesn't set its own `max_in_memory_cache_size` (see [Limit Types](#limit-types)) shares one default in-memory counter store, which caps at 200 entries and evicts the oldest when full. If `tag_id` is high-cardinality (for example, one bucket per end user), that cap can evict an active counter before its period elapses, resetting it early. Raise the default cap with `litellm_settings.model_based_tag_rate_limits_max_in_memory_cache_size` (a positive integer, applies to every entry that doesn't set its own override), give one specific high-cardinality entry its own dedicated cache with that entry's `max_in_memory_cache_size`, or use Redis instead, which has no such limit. `global_tag_rate_limits_hook` has the identical knob under its own name, `litellm_settings.global_tag_rate_limits_max_in_memory_cache_size`, sized independently since the two hooks never share a cache partition:

```yaml showLineNumbers title="config.yaml"
litellm_settings:
  callbacks: ["model_based_tag_rate_limits_hook"]
  model_based_tag_rate_limits_max_in_memory_cache_size: 5000
```

`key_ttl_seconds` (see [Limit Types](#limit-types)) is a different, unrelated per-entry setting: it controls how long that entry's own key lives once written, in either backend, rather than how many total keys an in-memory partition can hold at once.

</TabItem>
<TabItem value="redis" label="Redis (multi-instance)">

Set up a [Redis cache](caching.md) so counters are shared across every proxy instance:

```yaml showLineNumbers title="config.yaml"
litellm_settings:
  callbacks: ["model_based_tag_rate_limits_hook"]
  cache: true
  cache_params:
    type: redis
    host: os.environ/REDIS_HOST
    port: os.environ/REDIS_PORT
    password: os.environ/REDIS_PASSWORD
```

</TabItem>
</Tabs>
