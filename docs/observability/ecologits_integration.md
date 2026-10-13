# EcoLogits
:::caution 
This EcoLogits observability integration is currently in beta, as is the
EcoLogits API it depends on, which remains under active development.
Interfaces, schema mappings, and configuration options may change as we iterate based on user feedback.
Please treat this integration as a preview and report any issues or suggestions to help us stabilize and improve the workflow.
:::
[EcoLogits](https://ecologits.ai/) estimates the environmental impacts of LLM
inference: electrical energy, greenhouse gas emissions, abiotic resource
depletion, primary energy, and water consumption. The LiteLLM `ecologits`
callback calls the [EcoLogits public REST API](https://api.ecologits.ai) after
every successful LLM call, enriches the logging payload with the returned
impacts, and exposes the same numbers as Prometheus counters. The enrichment is
visible to every downstream observability tool you already run (Langfuse,
Datadog, SpendLogs, OTEL, and others), so you can track the footprint of your
traffic next to latency, cost, and token counts.

## Quick start

### Step 1: enable the callback

Register `ecologits` in `litellm_settings.callbacks`.
The callback runs in the first loop of the success handler and rewrites
the call metadata in place, so every callback registered after it sees the
EcoLogits numbers; anything registered before it runs against the un-enriched
payload. Order in the callbacks list does not matter, though listing ecologits 
first can help convey the mental model:

```yaml
model_list:
  - model_name: gpt-4o
    litellm_params:
      model: openai/gpt-4o

litellm_settings:
  callbacks: ["ecologits", "prometheus", "langfuse"]
```

### Step 2 (optional): set the electricity-mix zone

EcoLogits weights energy impacts by the electricity mix of the region where the
model physically runs. This is a property of the deployment rather than of the
caller, so set it per model in `model_info.ecologits_electricity_mix_zone` using
an [EcoLogits zone code](https://ecologits.ai/) (for example `FRA` for France,
`USA` for the United States, `WOR` for the world average).

```yaml
model_list:
  - model_name: gpt-4o
    litellm_params:
      model: openai/gpt-4o
    model_info:
      ecologits_electricity_mix_zone: "USA"

  - model_name: mistral-large
    litellm_params:
      model: mistral/mistral-large-latest
    model_info:
      ecologits_electricity_mix_zone: "FRA"
```

Place the zone under `model_info`, not directly under `litellm_params`.

### Step 3 (optional): set global defaults via env vars

```shell
ECOLOGITS_API_BASE="https://api.ecologits.ai"  # override the API base if you self-host EcoLogits (a possible future improvement)
ECOLOGITS_ELECTRICITY_MIX_ZONE="FRA"           # default zone for models without a per-model zone
```

`ECOLOGITS_API_BASE` defaults to `https://api.ecologits.ai`.
`ECOLOGITS_ELECTRICITY_MIX_ZONE` has no default; when neither the per-model zone
nor this env var is set, the field is omitted from the request and EcoLogits
falls back to its world-average zone `WOR`.

The resolution order for the zone on each call is: the per-model
`model_info.ecologits_electricity_mix_zone`, then the
`ECOLOGITS_ELECTRICITY_MIX_ZONE` env var, then EcoLogits' own `WOR` default.

## How it works

After each successful LLM call, the callback reads the model, provider, output
token count, and measured request latency from the call, sends them to the
EcoLogits estimations endpoint (`/v1beta/estimations`), and uses the response to
do two things.

First, it attaches the full impacts payload under the `ecologits` key in two
metadata locations, because downstream loggers read from different places.
Langfuse reads `litellm_params["metadata"]`, while Datadog, SpendLogs, and the
other StandardLoggingPayload consumers read
`standard_logging_object["metadata"]`. Writing to both means the enrichment
shows up everywhere rather than only in the raw-kwargs OTEL dump. The attached
object also carries back the exact request the callback sent, under
`ecologits_payload`, so you can see which model, provider, token count, and zone
produced a given estimate.

Second, when `prometheus-client` is installed it increments a set of Prometheus
counters, one per impact, so you can graph cumulative energy and emissions in
Grafana the same way you graph token usage. Prometheus is optional: if
`prometheus-client` is not installed the metadata enrichment still works and the
metrics are simply skipped.

The provider name is normalized for the EcoLogits API where it differs from
LiteLLM's; for example LiteLLM's `mistral` is sent as `mistralai` for EcoLogits.

Do not hesitate to report any problem with the provider-name conversion. You can
submit a PR to enrich the conversion table directly in the EcoLogits integration
file:
[litellm/integrations/ecologits.py](https://github.com/BerriAI/litellm/tree/litellm_internal_staging/litellm/integrations/ecologits.py)

### Prometheus metrics

Each impact is exported as a cumulative counter:

| Metric | Unit | Impact |
|--------|------|--------|
| `litellm_ecologits_energy_kwh_total` | kWh | electrical energy consumed |
| `litellm_ecologits_gwp_kgco2eq_total` | kgCO2eq | global warming potential |
| `litellm_ecologits_adpe_kgsbeq_total` | kgSbeq | abiotic depletion potential (elements) |
| `litellm_ecologits_pe_mj_total` | MJ | primary energy consumed |
| `litellm_ecologits_wcf_l_total` | L | water consumption footprint |

Every counter carries the labels `model`, `custom_llm_provider`,
`electricity_mix_zone`, and `bound`. EcoLogits returns a single `value` for
models with deterministic impact factors and a `min`/`max` range for models
whose parameters are uncertain; the `bound` label is `value` in the first case
and one series each for `min` and `max` in the second, so a query summing over
`bound` would double count. Pick the bound you want, for example:

```promql
sum by (model) (rate(litellm_ecologits_gwp_kgco2eq_total{bound="max"}[5m]))
```

## What gets sent to EcoLogits

The callback posts the model name, the provider, the output (completion) token
count, the measured request latency in seconds, and the resolved electricity-mix
zone. No prompts, completions, or user content are sent. If any required field
is missing (for example a streaming path that does not report completion tokens),
the call is skipped rather than sent with partial data.

`no-log` requests are respected: when a request is marked `no-log`, the callback
returns early and makes no API call, so model, provider, token count, latency,
and zone are never sent to EcoLogits for those requests.

## Failure handling

EcoLogits enrichment never breaks an LLM call. A timeout, a non-200 response, or
a malformed payload is caught and logged at warning level, and the call proceeds
and is logged without the `ecologits` enrichment. The API request uses a short
timeout (2 seconds) so a slow estimations endpoint cannot stall your logging
path.

## Scope and roadmap

This first version is observe-only. It measures the environmental footprint of
your traffic and surfaces it through the logging payload and Prometheus metrics
so you can monitor, analyse, and report on green-cost; it never alters the
behaviour of a call. EcoLogits sits purely on the success-logging path: requests
are estimated after they complete, and no request is ever blocked, throttled, or
rejected on the basis of its impact.

Future iterations could make the footprint actionable rather than informational.
Because LiteLLM already enforces per-key, per-team, and per-model budgets and
rate limits on spend, the same machinery could be extended to environmental
impact: a "green budget" expressed in kWh or kgCO2eq per team, a soft alert when
a team approaches its allowance, or a hard limit that rejects further calls once
the budget is exhausted, the same way a monetary budget does today. Tracking
cumulative impact per key or per team and exposing it on the spend and usage
dashboards would be a natural step toward that. These are directions, not
commitments for now; if a green-budget control would help your deployment, 
please open an issue or a PR so we can prioritise it.
