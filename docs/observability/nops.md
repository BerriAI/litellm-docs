# nOps

Send LiteLLM traces to [nOps](https://www.nops.io) with the `nops` callback. Every request's model, provider, token usage and cost reach nOps over OTLP, so AI spend shows up next to the rest of your cloud spend. One proxy-wide API key covers the whole proxy. For the nOps side of the setup, see [Send OpenTelemetry data to nOps](https://help.nops.io/telemetry/opentelemetry).

## Prerequisites

You need an nOps API key with only the `telemetry:write` permission. Creating one requires nOps administrator access and the **Inform + Operate** plan; an administrator creates it in nOps under **Settings > Security > API Keys**, as described in [Create an API key](https://help.nops.io/telemetry/opentelemetry#step-1-create-an-api-key). nOps shows the key once, so copy it when it is created. A dedicated key for the proxy, for example `litellm-prod`, lets you revoke it without affecting other senders. No extra Python packages are required; the callback uses the OTLP HTTP exporter that ships with `litellm[proxy]`.

## Quick start

Add `nops` to `callbacks` and set your API key. `LITELLM_OTEL_V2=true` is recommended: it gives you one trace per request covering the HTTP call, auth, guardrails, the model call and the spend write. See [OpenTelemetry v2](./opentelemetry_v2) for what the v2 trace contains.

```yaml title="config.yaml"
litellm_settings:
  callbacks: ["nops"]
```

```shell title=".env"
LITELLM_OTEL_V2=true
NOPS_API_KEY="<your-nops-api-key>"
```

Start the proxy and send a request:

```shell
curl -X POST 'http://localhost:4000/v1/chat/completions' \
  -H "Authorization: Bearer $LITELLM_API_KEY" -H 'Content-Type: application/json' \
  -d '{"model": "{{openai_small}}", "messages": [{"role": "user", "content": "What is nOps?"}]}'
```

The trace is sent to `https://api.nops.io/otel/v1/traces` with your key in an `Authorization: Bearer` header. Each request carries a `chat <model>` span with the canonical `gen_ai.*` attributes for model, provider, token usage, cost and latency. Under v2 every span also carries the [request identity](./opentelemetry_v2#request-identity-on-every-span) attributes such as `litellm.team.id`, `litellm.team.alias` and `litellm.api_key.hash`. The same applies to `/v1/messages` and `/v1/responses`. In nOps the data shows up as metadata on the **Explorer** page, where you can filter and group it under the **AI** category, for example by **AI > Source** or **AI > User**.

`NOPS_OTEL_ENDPOINT` is optional and overrides the OTLP base URL, which defaults to `https://api.nops.io/otel`. The callback appends `/v1/traces` itself, and a value that already ends in `/v1/traces` is used as is. If `NOPS_API_KEY` is unset or empty, the proxy still starts but logs an error naming `NOPS_API_KEY` and exports nothing to nOps.

You can also enable the callback from the Admin UI under **Settings > Logging & Alerts**, where nOps appears in the callback list and takes the same two values: **API Key** and **OTel Endpoint**.

## Prompts and responses

The `nops` callback sends no prompt or response text by default; only metadata, token counts and cost leave the proxy. To include message content, set `OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT`, which works the same way as for every other OpenTelemetry preset:

```shell title=".env"
OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT="span_only"
```

The accepted values are described in [Capturing prompts & responses](./opentelemetry_v2#capturing-prompts--responses).

## Per-team and per-key routing

Not supported. Every trace is exported with the proxy-wide `NOPS_API_KEY` to the proxy-wide endpoint, and nOps is not offered as a team or key callback in the Admin UI. Under v2 the team and key identity still travel on each span, so spend can be broken down by team inside nOps.

## Verify

`GET /health/services?service=nops` returns 200 when the callback is configured and a test span was queued. Because spans are batched and sent asynchronously, this confirms configuration, not delivery; an nOps endpoint that is unreachable or rejecting the key still yields 200 here. To confirm delivery, send a chat completion and look for it in the nOps Explorer.

If spans do not arrive, check the proxy log for OTLP export errors. A 401 from nOps means the key is wrong or revoked, and a 403 means the key lacks `telemetry:write` or the organization is not on the Inform + Operate plan. A 404 usually means `NOPS_OTEL_ENDPOINT` points at the wrong host or path. The full list is in the nOps [troubleshooting table](https://help.nops.io/telemetry/opentelemetry#troubleshooting). In every case the caller still gets its response; only that batch of spans is dropped, and later batches land once nOps accepts them.

Spans still queued in the batch processor when the proxy receives SIGTERM can be lost. This affects every OpenTelemetry-based callback in LiteLLM, not just nOps.

## Without OTel v2

The `nops` callback also works with `LITELLM_OTEL_V2` unset. It then uses the legacy [OpenTelemetry integration](./opentelemetry_integration) with the same two environment variables, OTLP HTTP to `<endpoint>/v1/traces`, the same `Authorization: Bearer` header and the same no-content default. Cost attributes are named `gen_ai.cost.*` on this path and `litellm.cost.*` under v2.

## LiteLLM SDK

The `nops` callback is available in the SDK as well. Set the same environment variables and enable it before any LiteLLM call:

```python
import litellm
from litellm import completion

litellm.callbacks = ["nops"]

response = completion(
  model="openai/{{openai_large}}",
  messages=[{"content": "What is nOps?", "role": "user"}]
)
print(response)
```

## Support

For help with the nOps side, including API keys, plans and limits, see [Send OpenTelemetry data to nOps](https://help.nops.io/telemetry/opentelemetry) or [contact nOps](https://www.nops.io/contact-us). For the LiteLLM callback, open an issue at [BerriAI/litellm](https://github.com/BerriAI/litellm/issues).
