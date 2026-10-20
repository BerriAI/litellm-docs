# Strands Decider

[Strands Decider](https://huggingface.co/StrandsAgents/strands-decider-2B-hobson-v19) is a small decision model that you run on your own server. It does not generate text. It answers typed questions about an input, such as a yes or no question, a pick from a fixed list of options, or a level on a scale, and gives every answer a calibrated probability. LiteLLM serves it on the [decision routes](../decisions/index.md), `/v1/decisions` for the OpenAI Decisions format and `/v1/systemone` for the System One format.

| Property | Details |
|----------|---------|
| Provider route on LiteLLM | `strands_decider/` |
| Model | `strands_decider/strands-decider-2B-hobson-v19` |
| LiteLLM endpoints | `/v1/decisions`, `/v1/systemone` |
| Question types | `predicate` or `noul`, `choice`, `score` |
| Image input | No |
| Price in LiteLLM | $0 per token |

Available in `v1.104.2` and later on the `1.104.x` line and in `v1.105.0-rc.3` and later. `v1.106.0-dev.1` has no `/v1/systemone` route and takes the System One format at `/v1/decisions`, so on that build send the [/v1/systemone](#v1systemone) request body to `/v1/decisions`, and call `litellm.decisions` with `state` instead of `input`.

## Serve the model

Install the `strands-decider` package and start its HTTP server. The first start downloads the weights from Hugging Face.

```bash
pip install strands-decider
strands-decider serve StrandsAgents/strands-decider-2B-hobson-v19 --port 8000
```

Without `--device`, the server picks CUDA, then MPS, then CPU. Pass `--device cuda`, `--device mps` or `--device cpu` to choose one. On Apple silicon, `--device mlx` runs the model on MLX after `pip install 'strands-decider[mlx]'`.

The `strands-decider-2B-hobson-v21` checkpoint works the same way. Serve it instead and set `model` to `strands_decider/strands-decider-2B-hobson-v21` in the examples below.

The server binds to `127.0.0.1` and has no authentication, and its model card says to use it for local experiments. Run LiteLLM on the same machine when you can. When LiteLLM runs in a container or on another machine, keep the server on `127.0.0.1` behind a reverse proxy that checks a bearer token, and set `STRANDS_DECIDER_API_KEY` to that token. `--host` changes the address the server binds to, but anything that can reach that address can call the server without a token.

Check that the server answers.

```bash
curl -s localhost:8000/v1/systemone -H 'content-type: application/json' -d '{
  "state": "Help! My payouts have been failing for 3 days!",
  "questions": {"is_urgent": {"type": "noul", "instructions": "Does this convey urgency?"}}
}'
```

```json
{
  "model": "strands-decider-2B-hobson-v19",
  "answers": {"is_urgent": {"type": "noul", "noul": 0.8287}},
  "usage": {"input_tokens": 86, "output_tokens": 1},
  "latency_ms": 1651.63
}
```

## Environment variables

| Variable | Required | Value |
|----------|----------|-------|
| `STRANDS_DECIDER_API_BASE` | Yes, or set `api_base` | Server base URL |
| `STRANDS_DECIDER_API_KEY` | No | Bearer token |

Set `STRANDS_DECIDER_API_BASE` to the server's base URL without `/v1/systemone`, for example `http://127.0.0.1:8000`. LiteLLM removes a trailing `/` or `/v1` and adds `/v1/systemone`, so `http://127.0.0.1:8000/v1` reaches the same route.

Strands Decider has no default host, so set `STRANDS_DECIDER_API_BASE` or pass `api_base`. Without either, LiteLLM answers `400` with `api_base is required for Decisions provider 'strands_decider'` and does not call the server.

LiteLLM sends `Authorization: Bearer <key>` only when `STRANDS_DECIDER_API_KEY` or `api_key` is set, and sends no `Authorization` header otherwise. `strands-decider serve` has no authentication, so set the key only when something in front of the server checks it.

## Proxy setup

1. Add the model to `config.yaml`.

```yaml showLineNumbers
model_list:
  - model_name: strands-decider
    litellm_params:
      model: strands_decider/strands-decider-2B-hobson-v19
      api_base: os.environ/STRANDS_DECIDER_API_BASE
```

2. Start the proxy.

```bash showLineNumbers
export STRANDS_DECIDER_API_BASE=http://127.0.0.1:8000
litellm --config config.yaml
```

## /v1/decisions

Ask one question of each type in the OpenAI Decisions format.

```bash showLineNumbers
curl -X POST 'http://0.0.0.0:4000/v1/decisions' \
-H "Authorization: Bearer $LITELLM_API_KEY" \
-H 'Content-Type: application/json' \
-d '{
  "model": "strands-decider",
  "input": "Help! My payouts have been failing for 3 days!",
  "questions": [
    {"type": "predicate", "name": "is_urgent", "instructions": "Does this convey urgency?"},
    {
      "type": "choice",
      "name": "team",
      "instructions": "Which team should handle this?",
      "choices": [
        {"value": "billing", "description": "payments, payouts and invoices"},
        {"value": "sales", "description": "new plans and upgrades"},
        {"value": "retail", "description": "in-store orders"}
      ]
    },
    {
      "type": "score",
      "name": "frustration",
      "instructions": "How frustrated is the writer?",
      "levels": [{"label": "calm"}, {"label": "frustrated"}, {"label": "angry"}]
    }
  ]
}'
```

Response

```json
{
  "model": "strands-decider-2B-hobson-v19",
  "answers": [
    {"type": "predicate", "name": "is_urgent", "probability": 0.8287},
    {
      "type": "choice",
      "name": "team",
      "choice": "billing",
      "probabilities": [
        {"value": "billing", "probability": 0.97},
        {"value": "sales", "probability": 0.0201},
        {"value": "retail", "probability": 0.0099}
      ],
      "confidence": 0.955
    },
    {
      "type": "score",
      "name": "frustration",
      "score": 1.2867,
      "probabilities": [
        {"value": 0, "label": "calm", "probability": 0.1335},
        {"value": 1, "label": "frustrated", "probability": 0.4463},
        {"value": 2, "label": "angry", "probability": 0.4202}
      ],
      "confidence": 0.4583
    }
  ],
  "usage": {
    "input_tokens": 211,
    "input_tokens_details": {"cached_tokens": 0, "cache_write_tokens": 0},
    "output_tokens": 3,
    "output_tokens_details": {"reasoning_tokens": 0},
    "total_tokens": 214
  }
}
```

## /v1/systemone

Ask the same questions in the System One format.

```bash showLineNumbers
curl -X POST 'http://0.0.0.0:4000/v1/systemone' \
-H "Authorization: Bearer $LITELLM_API_KEY" \
-H 'Content-Type: application/json' \
-d '{
  "model": "strands-decider",
  "state": "Help! My payouts have been failing for 3 days!",
  "questions": {
    "is_urgent": {"type": "noul", "instructions": "Does this convey urgency?"},
    "team": {
      "type": "choice",
      "instructions": "Which team should handle this?",
      "criteria": {
        "billing": "payments, payouts and invoices",
        "sales": "new plans and upgrades",
        "retail": "in-store orders"
      }
    },
    "frustration": {
      "type": "score",
      "instructions": "How frustrated is the writer?",
      "criteria": ["calm", "frustrated", "angry"]
    }
  }
}'
```

Response

```json
{
  "model": "strands-decider-2B-hobson-v19",
  "answers": {
    "is_urgent": {"type": "noul", "noul": 0.8287},
    "team": {
      "type": "choice",
      "choice": "billing",
      "confidence": 0.955,
      "probabilities": {"billing": 0.97, "sales": 0.0201, "retail": 0.0099}
    },
    "frustration": {
      "type": "score",
      "score": 1.2867,
      "confidence": 0.4583,
      "legend": {"0": "calm", "1": "frustrated", "2": "angry"},
      "probabilities": {"0": 0.1335, "1": 0.4463, "2": 0.4202}
    }
  },
  "usage": {"input_tokens": 211, "output_tokens": 3},
  "latency_ms": 5118.34
}
```

The server adds `latency_ms`, and LiteLLM passes it through on `/v1/systemone`.

## SDK

Call the server from Python with `litellm.decisions` for the OpenAI Decisions format or `litellm.systemone` for the System One format. `litellm.systemone` is available in `v1.104.3` and later on the `1.104.x` line, `v1.105.0` and later on the `1.105.x` line, and `v1.106.0-rc.1` and later. [SDK usage](../decisions/sdk.md) covers the async versions and the other arguments.

```python showLineNumbers title="OpenAI Decisions format"
import os
import litellm

os.environ["STRANDS_DECIDER_API_BASE"] = "http://127.0.0.1:8000"

response = litellm.decisions(
    model="strands_decider/strands-decider-2B-hobson-v19",
    input="Help! My payouts have been failing for 3 days!",
    questions=[
        {"type": "predicate", "name": "is_urgent", "instructions": "Does this convey urgency?"},
    ],
)
print(response.answers[0].probability)
```

```python showLineNumbers title="System One format"
import os
import litellm

os.environ["STRANDS_DECIDER_API_BASE"] = "http://127.0.0.1:8000"

response = litellm.systemone(
    model="strands_decider/strands-decider-2B-hobson-v19",
    state="Help! My payouts have been failing for 3 days!",
    questions={
        "is_urgent": {"type": "noul", "instructions": "Does this convey urgency?"},
    },
)
print(response.answers["is_urgent"].noul)
```

Both print `0.8287` for this input.

## Cost tracking

The LiteLLM cost map prices `strands_decider/strands-decider-2B-hobson-v19` at $0 per input and output token, since you pay for the server yourself. It is the only Strands Decider model in the cost map, and the proxy records calls to other checkpoints at $0. To track what the server costs you, set `input_cost_per_token` and `output_cost_per_token` under `model_info` on the deployment, as shown in [Custom pricing](../proxy/custom_pricing.md#cost-per-token-eg-azure).

## Use it as the Auto Router classifier

Strands Decider can pick the model tier for each request in LiteLLM Auto Router. Add the deployment above to `model_list` and set `deployment_name` in the router's `opensource_classifier_config` to its `model_name`, as shown in [Use a deployed decision model](../auto_router/decision_classifiers.md#use-a-deployed-decision-model). Available in `v1.104.3` and later on the `1.104.x` line, `v1.105.0` and later on the `1.105.x` line, and `v1.106.0-rc.1` and later. A server on CPU can need far more than the classifier's 3000 ms default timeout, so time a few requests to your server after warm-up and set `timeout_ms` above that. With `classifier_fallback: default_model`, as in that example, the `x-litellm-complexity-router-cause` response header is `jev_classifier` when the classifier answered and `default_model_fallback` when it did not.
