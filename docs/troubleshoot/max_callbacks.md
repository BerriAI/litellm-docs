# MAX_CALLBACKS Limit

## Error Message

```
Cannot add callback - would exceed MAX_CALLBACKS limit of 100. Current callbacks: 100
```

## What This Means

LiteLLM limits the number of callbacks that can be registered to prevent performance degradation. Each callback runs on every LLM request, so having too many callbacks can cause exponential CPU usage and slow down your proxy. When a callback list is already at the limit, LiteLLM logs this message as a warning and skips the new callback

The default limit is **100 callbacks**.

## When You Might Hit This Limit

- **Large enterprise deployments** with many teams, each having their own guardrails
- **Multiple logging integrations** combined with custom callbacks
- **Per-team callback configurations** that add up across your organization

## How to Override

Set the `LITELLM_MAX_CALLBACKS` environment variable to increase the limit:

```bash
# Docker
docker run -e LITELLM_MAX_CALLBACKS=200 ...

# Docker Compose
environment:
  - LITELLM_MAX_CALLBACKS=200

# Kubernetes
env:
  - name: LITELLM_MAX_CALLBACKS
    value: "200"

# Direct
export LITELLM_MAX_CALLBACKS=200
litellm --config config.yaml
```

## Recommendations

1. **Start conservative** - Only increase as much as you need. If you have 150 teams with guardrails, try `LITELLM_MAX_CALLBACKS=175` to leave headroom.

2. **Monitor performance** - More callbacks means more processing per request. Watch your CPU usage and response latency after increasing the limit.

3. **Consolidate where possible** - If multiple teams use identical guardrails, consider using shared callback configurations rather than per-team duplicates.

## Example: Large Enterprise Setup

For an organization with 150+ teams, each with a guardrail callback:

```yaml
# config.yaml
litellm_settings:
  callbacks: ["prometheus", "langfuse"]  # 2 global callbacks

# Each team adds 1 guardrail callback = 150+ callbacks
# Total: 152+ callbacks needed
```

Set the environment variable:

```bash
export LITELLM_MAX_CALLBACKS=200
```
