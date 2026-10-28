import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Mixpanel

Send LiteLLM OpenTelemetry v2 traces to [Mixpanel](https://mixpanel.com) with the `mixpanel` callback. The preset exports canonical OpenTelemetry `gen_ai.*` span attributes to Mixpanel's regional `/v1/ai/otel/traces` ingestion endpoint using HTTP Basic authentication (`Authorization: Basic <base64(project_token:)>`) and stamps `user.id` across the trace so Mixpanel maps every span to `distinct_id`.

## Prerequisites

You need `LITELLM_OTEL_V2=true` enabled on your LiteLLM Proxy or SDK environment, your Mixpanel Project Token (`MIXPANEL_PROJECT_TOKEN`), and an end-user identifier on requests (`user`, `metadata.user.id`, `metadata.user_id`, `metadata.trace_user_id`, `x-litellm-customer-id`, or OpenTelemetry Baggage `user.id`). Mixpanel drops spans without a non-empty `user.id`. No extra Python packages are required; the callback uses the OTLP HTTP exporter that ships with `litellm[proxy]`.

## Quick start

Add `mixpanel` to `callbacks` and set your project token. See [OpenTelemetry v2](./opentelemetry_v2) for what the v2 trace contains.

```yaml title="config.yaml"
litellm_settings:
  callbacks: ["mixpanel"]
```

<Tabs>
<TabItem value="us" label="US (default)" default>

```shell title=".env"
LITELLM_OTEL_V2=true
MIXPANEL_PROJECT_TOKEN="<your-project-token>"
```

Exports to `https://ingestion-us.mixpanel.com/v1/ai/otel/traces`.

</TabItem>
<TabItem value="eu" label="EU">

```shell title=".env"
LITELLM_OTEL_V2=true
MIXPANEL_PROJECT_TOKEN="<your-project-token>"
MIXPANEL_REGION="eu"
```

Exports to `https://ingestion-eu.mixpanel.com/v1/ai/otel/traces`.

</TabItem>
<TabItem value="in" label="India">

```shell title=".env"
LITELLM_OTEL_V2=true
MIXPANEL_PROJECT_TOKEN="<your-project-token>"
MIXPANEL_REGION="in"
```

Exports to `https://ingestion-in.mixpanel.com/v1/ai/otel/traces`.

</TabItem>
</Tabs>

Start the proxy and send a request with a user identifier:

```shell
curl -X POST 'http://localhost:4000/v1/chat/completions' \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "{{openai_small}}",
    "user": "user-123",
    "messages": [{"role": "user", "content": "Hello Mixpanel!"}]
  }'
```

You can also enable the callback from the Admin UI under **Settings > Logging & Alerts**, where Mixpanel appears as a tile that takes `mixpanel_project_token` and `mixpanel_region`.

## Setting `user.id`

Mixpanel requires a non-empty `user.id` attribute on every span and maps `user.id` to `distinct_id`. The `mixpanel` preset resolves `user.id` from request `metadata["user.id"]` or `metadata["user_id"]`, `metadata["trace_user_id"]`, the top-level `user` parameter, the proxy `x-litellm-customer-id` header (or virtual key `end_user_id`), or inbound OpenTelemetry Baggage (`baggage.set_baggage("user.id", "...")`), and promotes it across every span in the trace.

## Per-team and per-key routing

Under OpenTelemetry v2 (`LITELLM_OTEL_V2=true`), a team or virtual key can route its traces to its own Mixpanel project and data residency region (`us`, `eu`, or `in`). This uses the same key and team callback mechanism as [Team/Key based logging](../proxy/team_logging), and the general behavior (override versus additive mode, what the tenant receives, key beating team) is covered in [Per-key / per-team credentials](./opentelemetry_v2#per-key--per-team-credentials-multi-tenant).

Register the callback on a team:

```shell
curl -X POST 'http://localhost:4000/team/<team-id>/callback' \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
    "callback_name": "mixpanel",
    "callback_type": "success",
    "callback_vars": {
      "mixpanel_project_token": "<team-project-token>",
      "mixpanel_region": "eu"
    }
  }'
```

Or on a virtual key, including a key with no team:

```shell
curl -X POST 'http://localhost:4000/key/generate' \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
    "metadata": {
      "logging": [{
        "callback_name": "mixpanel",
        "callback_type": "success",
        "callback_vars": {
          "mixpanel_project_token": "<key-project-token>",
          "mixpanel_region": "us"
        }
      }]
    }
  }'
```

The Admin UI exposes the same two fields on a team's or key's logging settings under the Mixpanel tile. The project token is stored encrypted and reads back masked.

## Prompt and completion content

By default the Mixpanel callback exports request metadata only (model, token usage, cost, latency and `user.id`). Prompts and completions are not sent. To include them, set `OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT=span_only`, which adds `gen_ai.input.messages` and `gen_ai.output.messages` to the `chat` span.

If only some traffic is safe to record, keep capture on but redact every request by default, then let trusted callers opt in per request. Turn on redaction in the proxy config, and spans carry `redacted-by-litellm` in place of message content:

```yaml
litellm_settings:
  callbacks: ["mixpanel"]
  turn_off_message_logging: true
```

Add `allow_client_message_redaction_opt_out: true` to the metadata of each key or team that may opt out, and have those callers send `LiteLLM-Disable-Message-Redaction: true` on requests whose content can be recorded. The proxy drops the header on any other key, so content is only exported when both the key and the request opt in. See [Disable Message Redaction](../proxy/logging#disable-message-redaction) for the key setup.

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `LITELLM_OTEL_V2` | Yes | Must be `true` to enable OpenTelemetry v2 |
| `MIXPANEL_PROJECT_TOKEN` | Yes (unless using per-team/key routing only) | Mixpanel project token, encoded as HTTP Basic auth (`<token>:`) |
| `MIXPANEL_REGION` | No | `us` (default), `eu`, or `in` |
| `MIXPANEL_ENDPOINT` | No | Optional full OTLP traces endpoint override |
| `OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT` | No | Set to `span_only` to include `gen_ai.input.messages` and `gen_ai.output.messages` (defaults to `no_content`) |
