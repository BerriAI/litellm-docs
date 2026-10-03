---
title: Self-hosted classifiers
sidebar_label: Self-hosted classifiers
description: Run Auto Router classification on your own infrastructure with Laya or Bespoke Nimble. Configure the server, request context, routing tiers, and fallback behavior.
---

Run the model that makes your routing decisions on infrastructure you control. Deploy a classifier server, connect it to LiteLLM, and map complexity tiers to your completion models. The classifier chooses a tier for each request; the Auto Router calls a model in that tier to generate the answer. Clients keep using one router model name through the chat completions API.

**Laya and Bespoke Nimble are the supported self-hosted classifier options.** Jev uses TypeSafe's hosted API and shares the same configuration flow. Select **OSS Classifier** in the dashboard, or use `classifier_type: oss_classifier` with a provider inside `opensource_classifier_config`.

## What you host

Deploy the classifier as a separate service reachable from the gateway. LiteLLM calls its HTTP API; selecting a classifier in the dashboard does not install or start its model server.

| Component | Role | Where it runs |
| --- | --- | --- |
| LiteLLM gateway | Receives the client request, asks for a tier, then routes the completion | Your gateway deployment |
| Classifier server | Runs Laya or Nimble inference and returns the tier choice | A server you deploy and operate |
| Completion model | Generates the answer after routing | Your configured hosted provider or self-hosted model endpoint |

To keep classification traffic inside your network, deploy the classifier there and configure an internal base URL reachable from the gateway. You manage the checkpoint, inference capacity, authentication, and server availability. Self-hosting has compute costs even when the model has no hosted inference fee.

### Request context and data flow

The classifier receives the current user request, selected system text, and any configured prior-turn context, along with the tier criteria. Set `classifier_context_window_size: 0` to omit prior turns; the current request and selected system text still reach the classifier. The YAML example below uses this setting.

The completion model still receives the request needed to generate the answer. Hosting the classifier yourself does not change where that completion runs. See the [classifier context reference](/docs/proxy/auto_routing) for history-window and character-budget settings.

## Choose a classifier

| Classifier | Where it runs | Classifier model | `opensource_classifier_config.provider` |
| --- | --- | --- | --- |
| [Laya](https://github.com/NandhaKishorM/laya) | Self-hosted | `english`, `multilingual` or `typed-decisions` | `laya` |
| [Bespoke Nimble](https://github.com/bespokelabsai/nimble) | Self-hosted System One server | `nimble-latest`, `nimble` (Ollama) or `bespokelabs/Bespoke-Nimble-9B` | `bespoke` |
| [Jev](https://docs.typesafe.ai/) | TypeSafe's hosted API | `jev-latest` | `jev` |

All three use the System One decision protocol. LiteLLM sends a `choice` question describing your tiers to `POST /v1/systemone`. Set `api_base` to the server's base URL without `/v1/systemone`; an endpoint that only exposes `/v1/evaluate` or chat completions is not sufficient.

:::info Availability

The configuration names in this guide and Laya support require a gateway build containing [backend #43626](https://github.com/BerriAI/litellm/pull/43626). The **OSS Classifier** dashboard selector also requires [UI #43768](https://github.com/BerriAI/litellm/pull/43768). Both changes are merged; use a gateway build that includes them. Bespoke Nimble support requires [Nimble #44246](https://github.com/BerriAI/litellm/pull/44246).

Existing Jev-compatible configurations can keep `classifier_type: jev` and `jev_classifier_config`. For new routers, use the canonical names below; see [migration](#migrate-an-existing-jev-or-nimble-router) when upgrading an existing router.

:::

## Start a classifier server

Choose one of the self-hosted options below, or use [Jev's hosted API](#jev-hosted-typesafe-api). The local examples run the gateway and classifier on the same machine, in separate processes.

### Laya: self-hosted HTTP server

Install Laya in a separate Python environment from LiteLLM and start its English checkpoint using the [HTTP server](https://github.com/NandhaKishorM/laya/blob/main/docs/http-api.md):

```bash
python -m venv .venv-laya
source .venv-laya/bin/activate
python -m pip install 'laya[serve]==0.3.21'
LAYA_HOST=127.0.0.1 LAYA_PORT=8000 LAYA_MODELS=english laya-serve
```

Leave this process running. In another terminal, check liveness:

```bash
curl --fail-with-body http://127.0.0.1:8000/health
```

A health response confirms the server is running. Use the [decision request below](#verify-the-classifier-server) to check that inference works too.

In the environment that will run the gateway, set:

```bash
export LAYA_API_BASE="http://127.0.0.1:8000"
```

Use this classifier block in the [complete router configuration](#configure-the-router):

```yaml
opensource_classifier_config:
  provider: laya
  model: english
  timeout_ms: 15000
```

For another checkpoint, change `LAYA_MODELS` and the router's `model` to `multilingual` or `typed-decisions`. To require bearer authentication, set the same `LAYA_API_KEY` secret in both the server and gateway environments before starting them.

For container deployments, follow Laya's [Docker quickstart](https://github.com/NandhaKishorM/laya/blob/main/docs/docker.md). The [HTTP server reference](https://github.com/NandhaKishorM/laya/blob/main/docs/http-api.md) covers preloading, device selection, and concurrency limits.

### Nimble: self-hosted System One server

Install [Ollama](https://ollama.com/download) 0.35 or later, as required by its [Nimble model](https://ollama.com/library/nimble). If Ollama is not already running, start it in a separate terminal:

```bash
ollama serve
```

Leave the server running. In another terminal, download Nimble:

```bash
ollama pull nimble
```

In the environment that will run the gateway, set:

```bash
export BESPOKE_API_BASE="http://127.0.0.1:11434"
```

Use this classifier block in the [complete router configuration](#configure-the-router):

```yaml
opensource_classifier_config:
  provider: bespoke
  model: nimble
  timeout_ms: 30000
```

Ollama exposes Nimble at `/v1/systemone` with the model name `nimble`. Verify it with the [decision request below](#verify-the-classifier-server). `BESPOKE_API_KEY` is unnecessary for local Ollama; setting a gateway key does not enable authentication on the server.

For a GPU deployment on Modal, follow Bespoke's [System One deployment guide](https://github.com/bespokelabsai/nimble/blob/main/docs/MODAL_SERVING.md). Set `BESPOKE_API_BASE` to your deployment's URL and choose the name it serves, such as `nimble-latest` or `bespokelabs/Bespoke-Nimble-9B`. The `bespoke` provider is separate from LiteLLM's Nimble search integration.

The Modal recipe publishes an unauthenticated endpoint by default. Its [private mode](https://github.com/bespokelabsai/nimble/blob/main/deploy/setup_credentials.py) uses `Modal-Key` and `Modal-Secret` headers. LiteLLM's classifier bearer-key setting cannot supply that pair directly; a proxy must handle those headers if you use private mode.

### Connect across hosts or containers

`127.0.0.1` and `localhost` refer to the gateway's own host or container. When the classifier runs elsewhere, use a hostname reachable from the gateway, such as `http://laya-server:8000` or `http://nimble-server:11434` for an Ollama service.

The classifier must also listen on a reachable interface. Set `LAYA_HOST=0.0.0.0` for Laya, or configure Ollama's [`OLLAMA_HOST`](https://docs.ollama.com/faq#how-do-i-configure-ollama-server) before starting its server. Keep the service on your intended private network. If you expose Ollama through a reverse proxy, configure authentication there; Ollama's local API does not enforce the gateway's bearer key.

For a server that accepts bearer authentication, set its matching `LAYA_API_KEY` or `BESPOKE_API_KEY` in the gateway environment. LiteLLM sends that credential to the classifier.

### Verify the classifier server

Run this check from the gateway host or container, before configuring routing. Choose the connection variables for **Laya**:

```bash
CLASSIFIER_API_BASE="$LAYA_API_BASE"
CLASSIFIER_MODEL="english"
CLASSIFIER_API_KEY="${LAYA_API_KEY:-}"
```

Or choose **Nimble on Ollama**:

```bash
CLASSIFIER_API_BASE="$BESPOKE_API_BASE"
CLASSIFIER_MODEL="nimble"
CLASSIFIER_API_KEY="${BESPOKE_API_KEY:-}"
```

Then send a decision request directly to that server:

```bash
curl --fail-with-body "$CLASSIFIER_API_BASE/v1/systemone" \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $CLASSIFIER_API_KEY" \
  --data-binary @- <<JSON
{
  "model": "$CLASSIFIER_MODEL",
  "state": "Summarize this short email in one sentence.",
  "questions": {
    "tier": {
      "type": "choice",
      "instructions": "Choose the complexity tier for this request.",
      "criteria": {
        "SIMPLE": "Short, routine requests with no multi-step reasoning.",
        "COMPLEX": "Requests that require analysis across multiple steps."
      }
    }
  }
}
JSON
```

A successful response includes `answers.tier.choice` with one of the supplied choices. This checks reachability, the model name, credentials, and inference without involving a completion model. The two-choice question is a setup check; Auto Router supplies its own tier criteria when routing. Warm the model before measuring latency, then tune the classifier timeout for your server.

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

## Configure from the dashboard

After starting and verifying your classifier server, set its connection variables on the gateway:

| Dashboard provider | Gateway base URL variable | Optional gateway bearer-key variable | Classifier Model |
| --- | --- | --- | --- |
| **Laya** | `LAYA_API_BASE` | `LAYA_API_KEY` | `english`, `multilingual` or `typed-decisions` |
| **Bespoke Nimble** | `BESPOKE_API_BASE` | `BESPOKE_API_KEY` | `nimble-latest`, `nimble` or `bespokelabs/Bespoke-Nimble-9B` |

Set each base URL to the classifier server's root. LiteLLM appends `/v1/systemone`. Restart the gateway after changing its environment.

1. Open **Models + Endpoints → Auto Router** and create or edit a router.
2. Under **What classifies your requests?**, select **OSS Classifier**. Under **OSS provider**, choose **Laya** or **Bespoke Nimble**.
3. Set **Classifier Model** to a name your server supports and **Classifier Timeout (ms)** to a value appropriate for that server. Start with `15000` for Laya or `30000` for Nimble, then tune after warming the model.
4. Assign existing completion deployments to the `SIMPLE`, `MEDIUM`, `COMPLEX` and `REASONING` tiers, and choose a default model.
5. Use **Test Routing** with representative prompts, inspect the classifier result, then save the router. Send client requests to the router's model name as shown [below](#test-routing-and-send-a-request).

Built-in OSS classification uses the shipped tier criteria and is available without a LiteLLM license. Custom instructions and custom tiers follow the dashboard's displayed allowance.

Administrators can configure `api_base` and `api_key` overrides through the management API. An explicit `api_base` does not inherit the environment key; supply its matching `api_key` when the server requires one. The dashboard edits model and classifier options while the gateway owns the connection. Saving the same provider preserves its stored connection; changing providers drops the previous provider's endpoint and key. Team members cannot submit endpoint or credential overrides through the management API.

## Configure the router in YAML {#configure-the-router}

This complete example uses a self-hosted Laya classifier. Start the [Laya server](#laya-self-hosted-http-server) and set `LAYA_API_BASE` on the gateway first. To use Nimble, replace the classifier block with the [Nimble configuration](#nimble-self-hosted-system-one-server). `small-solver` and `large-solver` are public deployment names; replace their underlying models with models your gateway can access:

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

Start LiteLLM from its own environment after configuring the completion-provider credentials and your chosen classifier:

```bash
litellm --config config.yaml
```

In **Models + Endpoints → Auto Router**, open the create or edit form and use **Test Routing** to inspect the chosen tier and model without calling the completion model. A successful fallback does not prove the classifier worked: inspect the routing cause and classifier model. A decision-model result uses `cause: jev_classifier` for all three providers. Laya reports a classifier model such as `laya/english`; Nimble reports `bespoke/<model>`, using the model returned by the server when available.

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

Every native Laya request must explicitly choose `english`, `multilingual` or `typed-decisions`, with permission for the corresponding `laya/<checkpoint>` model. Unknown names and automatic selection are rejected. The response preserves Laya's `answers`, `usage` and `routing` fields. Both native routes support System One requests only; `/v1/evaluate`, chat completions and streaming are not exposed. Nimble preserves its native `answers` and `usage` response.

## Evaluate quality and cost

Compare tier choices on representative prompts before changing production routing. Probabilities describe the supplied choices; confidence scores from different model families are not interchangeable accuracy estimates. Measure downstream answer quality, classifier latency, fallback frequency and total cost using the [evaluation guide](/docs/auto_router/evaluate).

Jev calls can incur TypeSafe charges. Self-hosting Nimble or Laya has compute costs even without a hosted inference fee. Laya and Bespoke Nimble's built-in catalog token rates are zero; infrastructure is paid separately. Jev uses `typesafe/<model>` classifier log naming, Laya uses `laya/<checkpoint>` and Bespoke Nimble uses `bespoke/<model>`. The OSS classifier name does not change the `cause: jev_classifier` value in routing results.

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
