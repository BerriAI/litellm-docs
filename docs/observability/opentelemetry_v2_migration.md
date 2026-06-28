import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Migrating to OpenTelemetry v2

OpenTelemetry v2 is a rewrite of LiteLLM's tracing. The HTTP server span is owned by the standard FastAPI instrumentation rather than by LiteLLM, the span model is typed, and vendor attribute vocabularies compose through a mapper chain. This guide covers what changes when you move from the [v1 OpenTelemetry integration](./opentelemetry_integration) to [v2](./opentelemetry_v2), and how to migrate without breaking your existing dashboards.

## Turn it on

Set the feature flag and restart the proxy:

```shell
LITELLM_OTEL_V2=true
```

Your existing `OTEL_*` environment variables and your callback keep working, so for many setups this is the only change required. The flag is read once at startup.

## What changes

None of the differences are silent; each one is something you can search for in a dashboard, so migrate the queries that depend on it.

### The root span name

The v1 logger creates the root span itself and names it `Received Proxy Server Request`. v2 lets the FastAPI instrumentation own the root span, which names it after the route, for example `POST /v1/chat/completions`, and stamps `http.route` on it. Any saved query or alert that filters on the literal `Received Proxy Server Request` needs to move to the route name or to `http.route`.

### The guardrail span moves

In v1 a guardrail span is a child of the `litellm_request` span. In v2 it is a sibling of the LLM-call span, directly under the request root, because a pre-call guardrail runs before the LLM call exists. A query that finds guardrail spans by walking down from the inference span should repoint to the request root.

### The inference span name and kind

v1 names the inference span `litellm_request` by default, and `{operation} {model}` only when you opt into the experimental semantic conventions. v2 always names it `{operation} {model}`, for example `chat gpt-4o`, with span kind `CLIENT`.

### Vendor selection

v1 picks a vendor attribute flavor from the callback name through a branch in its attribute code. v2 composes vocabularies through a mapper chain: the canonical `genai` mapper is always present, and presets add vendor mappers on top. Configuring a preset callback is still how you choose a vendor; the mechanism underneath changed, and it now lets you layer several vocabularies onto one span.

### Identity stamping

v1 stamps team and key identity onto each span with explicit per-span code. v2 promotes a small allowlist of identity values into OpenTelemetry Baggage once, and a span processor copies them onto every span. This is usually invisible to dashboards, since the resulting keys (`litellm.team.id`, `litellm.api_key.hash`, and so on) are the same idea; the difference is that the set is now an explicit, configurable allowlist. See [Identity baggage](./opentelemetry_v2#identity-baggage).

### Success status

v1 sets a successful span's status to `OK`. v2 leaves it `UNSET`, the semantic-convention default that matches the FastAPI server span, and sets `ERROR` only on a genuine error. An alert keyed on status `OK` should switch to counting non-error spans.

## Keep the old attribute names during the cutover

v2 ships with a legacy-compatibility mapper on by default (`LITELLM_OTEL_LEGACY_COMPAT=true`) that emits the same data under the older Traceloop key names (`gen_ai.system`, `gen_ai.usage.prompt_tokens`, `gen_ai.usage.completion_tokens`, `llm.is_streaming`, and so on) alongside the canonical keys. This is what makes a gradual migration possible: turn v2 on and your dashboards that read the old token-count and provider keys keep working. Migrate each query to the canonical `gen_ai.*` keys at your own pace, then set `LITELLM_OTEL_LEGACY_COMPAT=false` to drop the duplicates.

## A safe rollout

1. Enable v2 in staging with `LITELLM_OTEL_V2=true`, leaving `legacy_compat` on (the default).
2. Confirm traces arrive and the tree looks right: one server span per request, the LLM-call span beneath it, guardrails as siblings.
3. Update dashboards and alerts for the changed span names and the success-status change.
4. Migrate attribute queries from the legacy key names to the canonical `gen_ai.*` keys.
5. Set `LITELLM_OTEL_LEGACY_COMPAT=false` and confirm nothing breaks.
6. Roll out to production.

## Rolling back

Set `LITELLM_OTEL_V2=false` (or unset it) and restart. LiteLLM falls back to the v1 logger using the same `OTEL_*` variables and callback you already had configured, so a rollback needs no other change.
