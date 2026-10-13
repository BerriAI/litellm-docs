---
title: Connect self-hosted classifiers
sidebar_label: Self-hosted classifiers
description: Connect a self-hosted Laya or Bespoke Nimble endpoint, or the Databricks `ai_decide` AI Function, to LiteLLM Auto Router. Set the endpoint, credentials, classifier model, and routing tiers.
---

Connect an existing Laya or Bespoke Nimble endpoint, or the Databricks `ai_decide` AI Function, to LiteLLM Auto Router. Your classifier chooses a complexity tier for each request, then LiteLLM calls a completion model assigned to that tier. Your application uses one router model name through the chat completions API.

For a screenshot walkthrough and the full tuning reference, see [Customize your classifier](./optimize_classifier.md#connect-a-self-hosted-classifier). That guide also covers using a self-hosted OpenAI-compatible LLM as a judge instead of a System One classifier.

**Laya and Bespoke Nimble are the supported self-hosted classifier options.** Jev uses TypeSafe's hosted API, and Databricks serves OpenJev from your workspace as the `ai_decide` AI Function; both share the same configuration flow. Select **OSS Classifier** in the dashboard, or use `classifier_type: oss_classifier` with a provider inside `opensource_classifier_config`.

## What you host

You host the classifier model behind a System One HTTP API, separately from the LiteLLM gateway. LiteLLM sends it the request context and tier criteria, then uses its decision to route the completion. This guide assumes that endpoint is running. For hosting instructions, see the [Laya HTTP server guide](https://github.com/NandhaKishorM/laya/blob/main/docs/http-api.md) or the [Nimble project](https://github.com/bespokelabsai/nimble#quickstart).

| Component | Role | Where it runs |
| --- | --- | --- |
| LiteLLM gateway | Receives the client request, asks for a tier, then routes the completion | Your gateway deployment |
| Classifier server | Runs Laya or Nimble inference and returns the tier choice | A server you deploy and operate |
| Completion model | Generates the answer after routing | Your configured hosted provider or self-hosted model endpoint |

Use a base URL reachable from the gateway. For a classifier in your private network, this can be an internal service URL. Selecting a classifier in LiteLLM connects to that service; it does not start a model server.

### Request context and data flow

The classifier receives the current user request, selected system text, and any configured prior-turn context, along with the tier criteria. Set `classifier_context_window_size: 0` to omit prior turns; the current request and selected system text still reach the classifier. The YAML example below uses this setting.

The completion model still receives the request needed to generate the answer. Hosting the classifier yourself does not change where that completion runs. See the [classifier context reference](/docs/proxy/auto_routing) for history-window and character-budget settings.

## Choose a classifier

| Classifier | Where it runs | Classifier model | `opensource_classifier_config.provider` |
| --- | --- | --- | --- |
| [Laya](https://github.com/NandhaKishorM/laya) | Self-hosted | `english`, `multilingual` or `typed-decisions` | `laya` |
| [Bespoke Nimble](https://github.com/bespokelabsai/nimble) | Self-hosted System One server | `nimble-latest`, `nimble` (Ollama) or `bespokelabs/Bespoke-Nimble-9B` | `bespoke` |
| [Jev](https://docs.typesafe.ai/) | TypeSafe's hosted API | `jev-latest` | `jev` |
| [Databricks `ai_decide`](https://docs.databricks.com/aws/en/sql/language-manual/functions/ai_decide) | An AI Function on your Databricks workspace (Beta) | `ai_decide` | `databricks` |

All four use the System One decision protocol. LiteLLM sends a `choice` question describing your tiers to `POST /v1/systemone`, or to `POST /api/2.0/ai-functions/ai-decide` for Databricks. Set `api_base` to the server's base URL without `/v1/systemone`; an endpoint that only exposes `/v1/evaluate` or chat completions is not sufficient.

:::info Availability

The configuration names in this guide and Laya support require a gateway build containing [backend #43626](https://github.com/BerriAI/litellm/pull/43626). The **OSS Classifier** dashboard selector also requires [UI #43768](https://github.com/BerriAI/litellm/pull/43768). Both changes are merged; use a gateway build that includes them. Bespoke Nimble support requires [Nimble #44246](https://github.com/BerriAI/litellm/pull/44246).

Databricks serving endpoints require [BerriAI/litellm#45200](https://github.com/BerriAI/litellm/pull/45200), and the `ai_decide` AI Function requires [BerriAI/litellm#45722](https://github.com/BerriAI/litellm/pull/45722).

Existing Jev-compatible configurations can keep `classifier_type: jev` and `jev_classifier_config`. For new routers, use the canonical names below; see [migration](#migrate-an-existing-jev-or-nimble-router) when upgrading an existing router.

:::

## Connect the classifier to the gateway

Set your classifier's connection variables in the **LiteLLM gateway environment**. The examples below use internal hostnames; replace them with your endpoint's base URL. LiteLLM appends `/v1/systemone`, so omit that path from the URL.

### Connect Laya {#laya-self-hosted-http-server}

Point LiteLLM to your Laya HTTP endpoint:

```bash
export LAYA_API_BASE="http://laya-server:8000"
# Set this only if your endpoint requires bearer authentication.
export LAYA_API_KEY="<classifier-bearer-key>"
```

Use `provider: laya` and select a checkpoint your endpoint serves: `english`, `multilingual` or `typed-decisions`. In the [complete router configuration](#configure-the-router), use:

```yaml
opensource_classifier_config:
  provider: laya
  model: english
  timeout_ms: 15000
```

### Connect Nimble {#nimble-self-hosted-system-one-server}

Point LiteLLM to your Nimble System One endpoint:

```bash
export BESPOKE_API_BASE="http://nimble-server:8000"
# Set this only if your endpoint requires bearer authentication.
export BESPOKE_API_KEY="<classifier-bearer-key>"
```

Use `provider: bespoke` and set `model` to the name your endpoint serves. Replace the classifier block in the [complete router configuration](#configure-the-router) with:

```yaml
opensource_classifier_config:
  provider: bespoke
  model: nimble-latest
  timeout_ms: 30000
```

For an Ollama endpoint, use `model: nimble`. Other deployments may serve `nimble-latest` or `bespokelabs/Bespoke-Nimble-9B`. The `bespoke` provider is separate from LiteLLM's Nimble search integration.

### Endpoint and authentication settings

- **Base URL:** use the hostname and port reachable from the gateway. `localhost` refers to the gateway's own host or container.
- **Credentials:** LiteLLM sends `LAYA_API_KEY` or `BESPOKE_API_KEY` as a bearer token. Use the credential your endpoint accepts; omit it for endpoints that do not require authentication. These settings do not enable authentication on the classifier server.
- **Model:** match the name served by your endpoint.
- **Timeout:** start with the examples above, then tune for your classifier's response time.

Restart the gateway after changing its environment. You can then [configure the Auto Router in the dashboard](#configure-from-the-dashboard) or [use YAML](#configure-the-router).

For a router-specific connection, set `api_base` and its matching `api_key` inside `opensource_classifier_config`. An explicit `api_base` does not inherit the environment key. If your endpoint requires another authentication scheme, such as Modal's `Modal-Key` and `Modal-Secret` headers, use a proxy that translates the bearer credential to the required headers.

### Jev: hosted TypeSafe API

To use the hosted option, set `TYPESAFE_API_KEY` in the gateway's environment using your secret manager and use this classifier block in the [complete router configuration](#configure-the-router):

```yaml
opensource_classifier_config:
  provider: jev
  model: jev-latest
  timeout_ms: 3000
```

`provider: jev` uses the TypeSafe transport and environment variables. `TYPESAFE_API_BASE` is optional and defaults to `https://api.typesafe.ai`.

For a router-specific endpoint, supply both `api_base` and its matching `api_key` inside `opensource_classifier_config`. An explicit endpoint does not inherit the TypeSafe environment key. The model, timeout, instructions and circuit-breaker fields follow the [Jev reference](/docs/proxy/auto_routing#jev-classifier), whose examples retain the names supported by released builds.

### Databricks: the ai_decide AI Function {#databricks-ai-decide}

Databricks serves OpenJev as the `ai_decide` AI Function at `POST /api/2.0/ai-functions/ai-decide` on your workspace. The function is in Beta, so a workspace admin must turn on the `ai_decide` preview first. Point LiteLLM at your workspace with the same variables the other `databricks/` models use:

```bash
export DATABRICKS_API_BASE="https://<workspace-host>"
export DATABRICKS_API_KEY="<databricks-token>"
```

`DATABRICKS_TOKEN` is read when `DATABRICKS_API_KEY` is unset, and a `DATABRICKS_API_BASE` that ends in `/serving-endpoints` also works. Use `provider: databricks` and set `model: ai_decide`, which is required. A bare serving endpoint name such as `databricks-openjev-qwen35-4b` also works, and LiteLLM then sends the request, `model` included, to that endpoint's `/invocations` route instead. In the [complete router configuration](#configure-the-router), use:

```yaml
opensource_classifier_config:
  provider: databricks
  model: ai_decide
  timeout_ms: 5000
```

LiteLLM posts the System One request without a `model` field to `POST /api/2.0/ai-functions/ai-decide` and logs the classifier call as `databricks/ai_decide`. The AI Function reports no token usage, so the classifier call is logged at zero cost and no `x-litellm-classifier-cost` header is returned. A router-specific `api_base` requires its matching `api_key`, so a configuration override cannot send the workspace token to another host.

## Configure from the dashboard

First set the [connection variables above](#connect-the-classifier-to-the-gateway) on your gateway. The dashboard uses that connection when you select a provider.

1. Open **Models + Endpoints → Auto Router** and create or edit a router.
2. Under **What classifies your requests?**, select **OSS Classifier**. Under **OSS provider**, choose **Laya** or **Bespoke Nimble**.
3. Set **Classifier Model** to a name your server supports and **Classifier Timeout (ms)** to a value appropriate for that server. Start with `15000` for Laya or `30000` for Nimble, then tune after warming the model.
4. Assign existing completion deployments to the `SIMPLE`, `MEDIUM`, `COMPLEX` and `REASONING` tiers, and choose a default model.
5. Use **Test Routing** with representative prompts, inspect the classifier result, then save the router. Send client requests to the router's model name as shown [below](#test-routing-and-send-a-request).

Built-in OSS classification uses the shipped tier criteria and is available without a LiteLLM license. Custom instructions and custom tiers follow the dashboard's displayed allowance.

Administrators can configure `api_base` and `api_key` overrides through the management API. An explicit `api_base` does not inherit the environment key; supply its matching `api_key` when the server requires one. The dashboard edits model and classifier options while the gateway owns the connection. Saving the same provider preserves its stored connection; changing providers drops the previous provider's endpoint and key. Team members cannot submit endpoint or credential overrides through the management API.

## Configure the router in YAML {#configure-the-router}

This complete example uses a self-hosted Laya classifier. Set the [Laya connection variables](#laya-self-hosted-http-server) on the gateway first. To use Nimble, replace the classifier block with the [Nimble configuration](#nimble-self-hosted-system-one-server). `small-solver` and `large-solver` are public deployment names; replace their underlying models with models your gateway can access:

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
          provider: laya
          model: english
          timeout_ms: 15000
        tiers:
          SIMPLE: small-solver
          MEDIUM: small-solver
          COMPLEX: large-solver
          REASONING: large-solver
        classifier_fallback: default_model
        classifier_context_window_size: 0
```

This example routes classifier failures to `large-solver` and sends no prior conversation turns to the classifier. The current request and selected system text are still sent. The default fallback, when omitted, is `heuristic`; the default history window is three prior user turns within an 8,000-character prior-turn budget.

## Test routing and send a request

Start LiteLLM after setting the classifier connection variables and your completion-provider credentials:

```bash
litellm --config config.yaml
```

In **Models + Endpoints → Auto Router**, open the create or edit form and use **Test Routing** to inspect the chosen tier and model without calling the completion model. A successful fallback does not prove the classifier worked: inspect the routing cause and classifier model. A decision-model result uses `cause: jev_classifier` for all four providers. Laya reports a classifier model such as `laya/english`; Nimble reports `bespoke/<model>`, using the model returned by the server when available; Databricks reports `databricks/ai_decide`.

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

If the provider is missing from the dashboard, verify that your gateway and its dashboard include the changes listed in the availability note above. Older dashboards label the classifier **JEV Classifier**.

## Call a native decision API

Configure the matching server URL, then use a LiteLLM virtual key with access to the provider-prefixed model. The body names the native model:

| Provider | Gateway endpoint | Body `model` | Virtual-key model permission |
| --- | --- | --- | --- |
| Laya | `/laya/v1/systemone` | `english` | `laya/english` |
| Bespoke Nimble | `/bespoke/v1/systemone` | `nimble-latest` (`nimble` on Ollama) | `bespoke/nimble-latest` (`bespoke/nimble` on Ollama) |
| Databricks `ai_decide` | `/v1/systemone` (`/v1/decisions` for the OpenAI format) | A `model_list` deployment of `databricks/ai_decide` | The deployment's model name |

The following Laya example also works for Nimble after replacing the endpoint and body model with the Nimble row:

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

Databricks `ai_decide` is called through the [unified decision routes](/docs/decisions) instead of a provider-prefixed path: `/v1/systemone` takes System One bodies and `/v1/decisions` takes the OpenAI Decisions format. Add the AI Function to `model_list` and name that deployment in the request body:

```yaml
model_list:
  - model_name: databricks-decider
    litellm_params:
      model: databricks/ai_decide
      api_base: os.environ/DATABRICKS_API_BASE
      api_key: os.environ/DATABRICKS_API_KEY
```

```bash
curl http://localhost:4000/v1/systemone \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "databricks-decider",
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

LiteLLM unwraps the `response` envelope Databricks returns and keeps its `metadata`. The AI Function reports no usage or model, so `usage` is zero and `model` is `null`. See the [Databricks provider page](/docs/providers/databricks#decisions-ai_decide) for the full deployment example.

Every native Laya request must explicitly choose `english`, `multilingual` or `typed-decisions`, with permission for the corresponding `laya/<checkpoint>` model. Unknown names and automatic selection are rejected. The response preserves Laya's `answers`, `usage` and `routing` fields. Both native routes support System One requests only; `/v1/evaluate`, chat completions and streaming are not exposed. Nimble preserves its native `answers` and `usage` response.

## Evaluate quality and cost

Compare tier choices on representative prompts before changing production routing. Probabilities describe the supplied choices; confidence scores from different model families are not interchangeable accuracy estimates. Measure downstream answer quality, classifier latency, fallback frequency and total cost using the [evaluation guide](/docs/auto_router/evaluate).

Jev calls can incur TypeSafe charges. Self-hosting Nimble or Laya has compute costs even without a hosted inference fee. Laya and Bespoke Nimble's built-in catalog token rates are zero; infrastructure is paid separately. Jev uses `typesafe/<model>` classifier log naming, Laya uses `laya/<checkpoint>`, Bespoke Nimble uses `bespoke/<model>` and Databricks uses `databricks/ai_decide`. Databricks `ai_decide` is logged at zero cost: Databricks bills AI Functions on your workspace, and the function reports no token usage for LiteLLM to price. The OSS classifier name does not change the `cause: jev_classifier` value in routing results.

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

Existing configurations that retain `provider: jev` continue using the TypeSafe transport and environment variables. To migrate a compatible Nimble System One server to `provider: bespoke`, select `nimble-latest`, configure `BESPOKE_API_BASE` and optional `BESPOKE_API_KEY`, and grant access to `bespoke/nimble-latest`. The provider change clears saved Jev connection overrides; administrators must explicitly resupply any intended override. New calls use `bespoke/<model>` in logs, while `cause: jev_classifier` stays unchanged.
