---
title: OSS classifiers
sidebar_label: Jev, Nimble and Laya
description: Configure the Auto Router's OSS Classifier with hosted Jev or self-hosted Nimble and Laya.
---

Use Jev, Nimble or Laya to choose which model answers each request. The classifier picks a complexity tier; the Auto Router then calls a model configured for that tier. Clients keep using one router model name through the normal chat completions API.

Jev is available through TypeSafe's hosted API. Nimble and Laya are open models you can run on your own infrastructure. All three use `classifier_type: oss_classifier`, with the provider selected inside `opensource_classifier_config`.

| Classifier | Where it runs | Classifier model | `opensource_classifier_config.provider` |
| --- | --- | --- | --- |
| [Jev](https://docs.typesafe.ai/) | TypeSafe's hosted API | `jev-latest` | `jev` |
| [Bespoke Nimble](https://github.com/bespokelabsai/nimble) | Self-hosted, including Ollama | `nimble` on Ollama; `nimble-latest` on Bespoke's System One server | `jev` with a custom endpoint |
| [Laya](https://github.com/NandhaKishorM/laya) | Self-hosted | `english`, `multilingual` or `typed-decisions` | `laya` |

All three use the System One decision protocol. LiteLLM sends a `choice` question describing your tiers to `POST /v1/systemone`. Set `api_base` to the server's base URL without `/v1/systemone`; an endpoint that only exposes `/v1/evaluate` or chat completions is not sufficient.

:::info Availability

The configuration names in this guide and Laya support require a gateway build containing [backend #43626](https://github.com/BerriAI/litellm/pull/43626). The **OSS Classifier** dashboard selector also requires [UI #43768](https://github.com/BerriAI/litellm/pull/43768). These changes are pending; existing releases can reject `oss_classifier`, `opensource_classifier_config` and `provider: laya`.

For Jev or Nimble on a released build, keep `classifier_type: jev` and `jev_classifier_config` as shown in the [Jev setup guide](/docs/auto_router/setup#jev-classifier-typesafe-ai). The new backend continues to accept those names; see [migration](#migrate-an-existing-jev-or-nimble-router).

:::

## Configure the router

Start with this complete configuration, then choose the classifier connection below. `small-solver` and `large-solver` are public deployment names; replace their underlying models with models your gateway can access:

```yaml title="config.yaml"
model_list:
  - model_name: small-solver
    litellm_params:
      model: openai/{{openai_small}}
      api_key: os.environ/OPENAI_API_KEY
  - model_name: large-solver
    litellm_params:
      model: openai/{{openai_large}}
      api_key: os.environ/OPENAI_API_KEY
  - model_name: decision-router
    litellm_params:
      model: auto_router/complexity_router
      complexity_router_default_model: large-solver
      complexity_router_config:
        classifier_type: oss_classifier
        opensource_classifier_config:
          provider: jev
          model: jev-latest
          timeout_ms: 3000
        tiers:
          SIMPLE: small-solver
          MEDIUM: small-solver
          COMPLEX: large-solver
          REASONING: large-solver
        classifier_fallback: default_model
        classifier_context_window_size: 0
```

This example routes classifier failures to `large-solver` and sends no prior conversation turns to the classifier. The current request and selected system text are still sent. The default fallback, when omitted, is `heuristic`; the default history window is three prior user turns within an 8,000-character prior-turn budget.

### Jev: hosted TypeSafe API

Set `TYPESAFE_API_KEY` in the gateway's environment using your secret manager. Leave the example's `opensource_classifier_config` unchanged. `provider: jev` still uses the TypeSafe transport and environment variables. `TYPESAFE_API_BASE` is optional and defaults to `https://api.typesafe.ai`.

For a router-specific endpoint, supply both `api_base` and its matching `api_key` inside `opensource_classifier_config`. An explicit endpoint does not inherit the TypeSafe environment key. The model, timeout, instructions and circuit-breaker fields follow the [Jev reference](/docs/proxy/auto_routing#jev-classifier), whose examples retain the names supported by released builds.

### Nimble: self-hosted with Ollama

Install [Ollama 0.35 or later](https://ollama.com/library/nimble) and start its server. If the Ollama app is not already serving requests, run `ollama serve` in a separate terminal. Download the decision model:

```bash
ollama pull nimble
```

Replace the example's `opensource_classifier_config` with this block:

```yaml
opensource_classifier_config:
  provider: jev
  model: nimble
  api_base: http://localhost:11434
  api_key: ollama
  timeout_ms: 30000
```

Local Ollama ignores the API key. `ollama` is a non-secret placeholder because LiteLLM's Jev-compatible client requires a nonempty key when an endpoint is supplied. If your endpoint has authentication, use that endpoint's real credential instead. There is no `provider: nimble` setting.

The longer timeout allows more time for local inference; warm the model before measuring latency. For Bespoke's own System One server, use its base URL and `model: nimble-latest` instead. See the upstream [serving guide](https://github.com/bespokelabsai/nimble/blob/main/docs/MODAL_SERVING.md) and [model preparation guide](https://github.com/bespokelabsai/nimble#quickstart).

### Laya: self-hosted HTTP server

Install Laya in a separate environment from LiteLLM and start the English checkpoint:

```bash
python -m venv .venv-laya
source .venv-laya/bin/activate
python -m pip install 'laya[serve]==0.3.21'
LAYA_HOST=127.0.0.1 LAYA_PORT=8000 LAYA_MODELS=english laya-serve
```

In the gateway process, set its reachable server URL:

```bash
export LAYA_API_BASE="http://127.0.0.1:8000"
```

Replace the example's `opensource_classifier_config` with this block:

```yaml
opensource_classifier_config:
  provider: laya
  model: english
  timeout_ms: 15000
```

Choose `english`, `multilingual` or `typed-decisions` explicitly. When `api_base` is omitted, the gateway uses `LAYA_API_BASE` and optional `LAYA_API_KEY`. To require authentication, configure the same key on the Laya server and gateway.

An administrator can instead set `api_base` and optional `api_key` on this router. An explicit Laya endpoint without a key connects without authentication and does not inherit the environment key. See the [Laya HTTP guide](https://github.com/NandhaKishorM/laya/blob/main/docs/http-api.md) for server options.

For either self-hosted server, `localhost` refers to the gateway's own host or container. Use a hostname reachable from the gateway when the classifier runs elsewhere.

## Test routing and send a request

Start LiteLLM from its own environment after configuring the completion-provider credentials and your chosen classifier:

```bash
litellm --config config.yaml
```

In **Models + Endpoints → Auto Router**, open the create or edit form and use **Test Routing** to inspect the chosen tier and model without calling the completion model. A successful fallback does not prove the classifier worked: inspect the routing cause and classifier model. A decision-model result uses `cause: jev_classifier`; Laya reports a classifier model such as `laya/english`.

Use a LiteLLM virtual key with access to `decision-router` to make a completion:

```bash
curl http://localhost:4000/v1/chat/completions \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "decision-router",
    "messages": [{"role": "user", "content": "Explain what an HTTP status code means"}]
  }'
```

In dashboards containing [UI #43768](https://github.com/BerriAI/litellm/pull/43768), select **OSS Classifier** in the auto-router form, then **Jev** or **Laya**. Nimble uses the **Jev** provider with a custom model and endpoint; YAML is the simplest setup. Older dashboards label the classifier **JEV Classifier**.

Administrators can configure connection overrides. Team members cannot submit classifier endpoint or credential overrides through the management API. Saved connection fields are hidden on edit; leaving them untouched preserves them. Use the explicit reset controls to clear a saved key or return to the gateway connection.

## Call Laya's native decision API

With `LAYA_API_BASE` configured as above, call `POST /laya/v1/systemone` using a LiteLLM virtual key with access to `laya/english`. The request names the bare checkpoint; LiteLLM uses `laya/english` for model permissions and usage logs.

```bash
curl http://localhost:4000/laya/v1/systemone \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "english",
    "state": "My invoice has two identical charges",
    "questions": {
      "department": {
        "type": "choice",
        "instructions": "Choose the department that should help",
        "criteria": {
          "billing": "Invoices, payments, and refunds",
          "technical": "Bugs and connectivity problems"
        }
      }
    }
  }'
```

Every native request must explicitly choose `english`, `multilingual` or `typed-decisions`, with permission for the corresponding `laya/<checkpoint>` model. Unknown names and automatic selection are rejected. The response preserves Laya's `answers`, `usage` and `routing` fields. The native Laya route supports System One requests only; `/laya/v1/evaluate` and Laya chat completions are not exposed.

## Evaluate quality and cost

Compare tier choices on representative prompts before changing production routing. Probabilities describe the supplied choices; confidence scores from different model families are not interchangeable accuracy estimates. Measure downstream answer quality, classifier latency, fallback frequency and total cost using the [evaluation guide](/docs/auto_router/evaluate).

Jev calls can incur TypeSafe charges. Self-hosting Nimble or Laya has compute costs even without a hosted inference fee. Laya's built-in catalog rates are zero; custom Nimble model names may have no registered rate, so missing classifier cost does not establish zero cost. Jev and Nimble retain `typesafe/<model>` classifier log naming; Laya uses `laya/<checkpoint>`. The OSS classifier name does not change the `cause: jev_classifier` value in routing results.

If the classifier falls back, check the endpoint, checkpoint name, credentials, model warm-up and timeout. A timeout can also open the classifier circuit breaker, which defaults to a 30-second recovery interval. Verify that the server accepts `/v1/systemone`, rather than adding that path to `api_base`.

## Migrate an existing Jev or Nimble router

After upgrading to a build containing [backend #43626](https://github.com/BerriAI/litellm/pull/43626), use `classifier_type: oss_classifier` and rename `jev_classifier_config` to `opensource_classifier_config`. Set `provider: jev` and keep the existing model, endpoint, credential and classifier options. For example, the hosted Jev configuration becomes:

```yaml
classifier_type: oss_classifier
opensource_classifier_config:
  provider: jev
  model: jev-latest
  timeout_ms: 3000
```

The new backend still accepts `classifier_type: jev`, `jev_classifier_config` and the legacy `provider: typesafe` value for existing YAML and saved routers. Supply only one classifier configuration block. Model-management creates and updates that include the classifier configuration write the canonical names; an update that leaves the configuration untouched preserves the saved value.

Existing Jev and Nimble connections continue to use `TYPESAFE_API_KEY` and `TYPESAFE_API_BASE` when no explicit connection is supplied. The transport, `typesafe/<model>` accounting labels and `cause: jev_classifier` remain unchanged.
