import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Mixpanel

<SinceVersion v="1.110.0" />

Send LiteLLM OpenTelemetry v2 traces to [Mixpanel](https://mixpanel.com) with the `mixpanel` callback. The preset exports canonical OpenTelemetry `gen_ai.*` span attributes to Mixpanel's regional `/v1/ai/otel/traces` ingestion endpoint using HTTP Basic authentication (`Authorization: Basic <base64(project_token:)>`) and stamps `user.id` across the trace so Mixpanel maps every span to `distinct_id`.

## Prerequisites

You need `LITELLM_OTEL_V2=true` enabled on your LiteLLM Proxy or SDK environment, your Mixpanel Project Token (`MIXPANEL_PROJECT_TOKEN`), and a user identifier on requests (see [Setting `user.id`](#setting-userid)). Mixpanel drops spans without a non-empty `user.id`. The project token can come from a team or key instead of the environment, see [Per-team and per-key routing](#per-team-and-per-key-routing). No extra Python packages are required; the callback uses the OTLP HTTP exporter that ships with `litellm[proxy]`.

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

Mixpanel requires a non-empty `user.id` attribute on every span and maps `user.id` to `distinct_id`. LiteLLM uses the first of these that holds a usable value:

| Order | Source | Also sets the proxy's end user? |
|---|---|---|
| 1 | `metadata["user.id"]` (also read from `litellm_metadata`, and as nested `metadata["user"]["id"]`) | No |
| 2 | `metadata["user_id"]` | Yes |
| 3 | `metadata["trace_user_id"]` | No |
| 4 | W3C `baggage` request header or in-process Baggage, key `user.id` | No |
| 5 | The proxy's end user: `x-litellm-customer-id` and the other customer headers, the `user` parameter, `litellm_metadata.user`, `safety_identifier`, or the virtual key's `end_user_id` | Yes |

A blank value, a boolean, a value over 1024 characters or one with a control character is skipped, and the next source is used. A number is sent as a string.

`metadata["user.id"]` only labels spans. It never creates a customer, never applies a customer's budget or rate limit, and never appears as the end user on a spend log. To label spans and also enforce customer limits, send `user` or `x-litellm-customer-id`, as you do without Mixpanel. Because the two are read separately, a request with both `metadata["user.id"]` and `user` shows one id in Mixpanel and the other on its spend log.

Clients that fill `metadata.user_id` themselves take that value as the `distinct_id`. Claude Code sends a session-scoped value there on `/v1/messages`, so each session appears as its own user. Send `metadata["user.id"]` from those clients if you can set it.

The id reaches every span of a request from the end of authentication on: the request root, the `auth` span, guardrails, the LLM call and the database and cache work after auth. Four kinds of span carry no id, because LiteLLM has no caller to name yet or no caller at all: reads inside the `auth` phase that run before the key resolves, the `POST /mcp` transport span and the lookups that run before MCP authentication, requests rejected during authentication, and background jobs that do not belong to a request. These still export to a project set with `MIXPANEL_PROJECT_TOKEN`, and Mixpanel drops them. A team's or key's project does not receive them. `baggage` is read only after a request passes authentication, so a caller without a valid key cannot name a user.

## Per-team and per-key routing

Under OpenTelemetry v2 (`LITELLM_OTEL_V2=true`), a team or virtual key can route its traces to its own Mixpanel project and data residency region (`us`, `eu`, or `in`). This uses the same key and team callback mechanism as [Team/Key based logging](../proxy/team_logging), and the general behavior (override versus additive mode, what the tenant receives, key beating team) is covered in [Per-key / per-team credentials](./opentelemetry_v2#per-key--per-team-credentials-multi-tenant).

`MIXPANEL_PROJECT_TOKEN` is not needed for this. It works with `mixpanel` listed in `callbacks` or not, and alongside other callbacks. `user.id` goes only to Mixpanel, so other backends the request exports to do not receive it. The exception is a Langfuse project set on a key or team, which also reads `user.id` from the LLM call span as its Langfuse user.

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

The Admin UI exposes the same two fields on a team's or key's logging settings under the Mixpanel tile.

`mixpanel_project_token` is required whenever a `mixpanel_*` variable is set. LiteLLM refuses an empty token and the masked `***REDACTED***` value with a 400, so send the real token again when you update the callback.

`mixpanel_region` defaults to `us` and does not inherit `MIXPANEL_REGION`, which applies only to the proxy's own project. Set it on every team or key whose data belongs in another region.

Use `callback_type` `success` or `success_and_failure`. A `failure` entry on its own does not route a team's or key's traces to Mixpanel.

The token is stored encrypted. `GET /team/{team_id}/callback` returns it masked, while `/team/info` and `/key/info` return the encrypted value and `/get/config/callbacks` shows the proxy's `MIXPANEL_PROJECT_TOKEN` to proxy admins.

## Prompt and completion content

By default prompts and completions are not sent. Spans still carry what OpenTelemetry v2 records for every backend: model, token usage, cost, latency and `user.id`, along with the caller's IP address and user agent, the request URL, the API key hash and key owner id, and on database spans the database system and table names. A project token from the environment also receives the database host, port and name, which a team's or key's project does not. To include them, set `OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT=span_only`, which adds `gen_ai.input.messages` and `gen_ai.output.messages` to the `chat` span.

If only some traffic is safe to record, keep capture on but redact every request by default, then let trusted callers opt in per request. Turn on redaction in the proxy config, and spans carry `redacted-by-litellm` in place of message content:

```yaml
litellm_settings:
  callbacks: ["mixpanel"]
  turn_off_message_logging: true
```

Add `allow_client_message_redaction_opt_out: true` to the metadata of each key or team that may opt out, and have those callers send `LiteLLM-Disable-Message-Redaction: true` on requests whose content can be recorded. The proxy drops the header on any other key, so content is only exported when both the key and the request opt in. See [Disable Message Redaction](../proxy/logging#disable-message-redaction) for the key setup.

## Using Mixpanel with other callbacks

The first OpenTelemetry v2 callback in `callbacks` owns the request's whole trace, and each later one exports only its own LLM call span. List `mixpanel` first, as in `callbacks: ["mixpanel", "otel"]`, if the project set with `MIXPANEL_PROJECT_TOKEN` should get every span. With `callbacks: ["otel", "mixpanel"]` that project gets only the LLM call span. A team's or key's project gets the whole trace in either order.

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `LITELLM_OTEL_V2` | Yes | Must be `true` to enable OpenTelemetry v2 |
| `MIXPANEL_PROJECT_TOKEN` | Yes (unless using per-team/key routing only) | Mixpanel project token, encoded as HTTP Basic auth (`<token>:`) |
| `MIXPANEL_REGION` | No | `us` (default), `eu`, or `in`. Applies to the proxy's own project only |
| `MIXPANEL_ENDPOINT` | No | Optional full OTLP traces endpoint override |
| `OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT` | No | Set to `span_only` to include `gen_ai.input.messages` and `gen_ai.output.messages` (defaults to `no_content`) |
