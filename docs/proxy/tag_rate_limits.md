import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Tag Rate Limits

Cap tokens, requests, dollars, or concurrent in-flight requests per tag identity, independent of which virtual key sent the request.

This is a config-only mechanism, not a database-registered one: any tag value a caller sends is usable immediately, with no `/tag/new` call needed first. [**See Code**](https://github.com/BerriAI/litellm/blob/main/litellm/proxy/hooks/tag_rate_limiter.py)

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
  callbacks: ["tag_rate_limiter"]

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

`period_seconds` is raw seconds, not a day/week/month enum, so the same mechanism covers both a genuine RPM-style cap and a long-window budget: `period_seconds: 86400` resets at UTC midnight, and `period_seconds: 60` resets on real clock-minute boundaries (bucketed by `epoch_second // period_seconds`, so any value that evenly divides a day lands on a natural clock boundary).

`token_limits` and `dollar_limits` are accounted from real usage once a request succeeds, since the actual token count or cost is only known after the response. `request_limits` and `concurrency_limits` are enforced atomically at admission, before the request is dispatched: `request_limits` increments its counter immediately, and `concurrency_limits` reserves a slot that's released once the request finishes (whether it succeeds or fails).

## How Enforcement Works

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

## Tag Identity and Trust

A tag value is whatever the caller's tags resolve to, the same identity [Request Tags](request_tags.md) and [Setting Tag Budgets](tag_budgets.md) already use. If a rate limit's `tag_id` is meant to represent a real, distinct caller (e.g. `end_user_id` per end user), that's only enforceable to the extent the tag itself is trustworthy:

- A tag attached to a virtual key (via `/key/generate` metadata) is server-provisioned and can't be spoofed by the caller.
- A tag sent by the caller directly, via `metadata.tags` in the request body or the `x-litellm-tags` header, can be set to anything, including a fresh value on every request, which defeats a limit meant to cap one identity's usage over time.

If callers are untrusted, either provision tags on the key instead of accepting them from the request, or set `general_settings.reject_clientside_metadata_tags: true` to block client-supplied tags outright. That flag currently covers the common chat/embeddings routes; it does not yet cover Bedrock-invoke, `/v1/messages`, Responses, batches, or files routes, which resolve tags from a separate `litellm_metadata` field the check doesn't inspect.

## Enable the Callback

`tag_rate_limiter` is opt-in, not a default proxy hook. Add it to `litellm_settings.callbacks`:

```yaml showLineNumbers title="config.yaml"
litellm_settings:
  callbacks: ["tag_rate_limiter"]
```

<Tabs>
<TabItem value="in-memory" label="In-memory (no Redis)">

Works without any cache configured. Counters are process-local, so this is only accurate for a single-instance deployment.

</TabItem>
<TabItem value="redis" label="Redis (multi-instance)">

Set up a [Redis cache](caching.md) so counters are shared across every proxy instance:

```yaml showLineNumbers title="config.yaml"
litellm_settings:
  callbacks: ["tag_rate_limiter"]
  cache: true
  cache_params:
    type: redis
    host: os.environ/REDIS_HOST
    port: os.environ/REDIS_PORT
    password: os.environ/REDIS_PASSWORD
```

</TabItem>
</Tabs>
