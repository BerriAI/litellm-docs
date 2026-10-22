---
sidebar_label: "Supported providers"
---

# Supported providers

| Provider | Example model | Credentials | LiteLLM endpoint | Images |
|----------|---------------|-------------|------------------|--------|
| [OpenAI](https://developers.openai.com/api/docs/guides/decisions) | `openai/gpt-6-luna` | `OPENAI_API_KEY`, optional `OPENAI_BASE_URL` | `/v1/decisions` | Yes |
| [TypeSafe Jev](https://docs.typesafe.ai/api) | `typesafe/jev-latest` | `TYPESAFE_API_KEY`, optional `TYPESAFE_API_BASE` | `/v1/systemone` | With the [images header](./typesafe_images.md) |
| [OpenRouter](../providers/openrouter.md#decisions-jev) | `openrouter/typesafe/jev-1.14` | `OPENROUTER_API_KEY`, optional `OPENROUTER_API_BASE` | `/v1/systemone` | No |
| [Fireworks AI](https://docs.fireworks.ai) (private preview) | `fireworks_ai/accounts/fireworks/routers/rune` | `FIREWORKS_AI_API_KEY` or `FIREWORKS_API_KEY`, optional `FIREWORKS_API_BASE` | `/v1/systemone` | No |
| [Perplexity](https://docs.perplexity.ai/docs/decisions/quickstart) | `perplexity/pplx-decider-v1-27b` | `PERPLEXITYAI_API_KEY` or `PERPLEXITY_API_KEY`, optional `PERPLEXITY_API_BASE` | `/v1/systemone` | No |
| [Cloudflare Clef](https://developers.cloudflare.com/workers-ai/models/clef/) | `cloudflare/clef` or `cloudflare/clef-flash` | `CLOUDFLARE_API_KEY` and `CLOUDFLARE_ACCOUNT_ID`, or `api_base` | `/v1/systemone` | Yes |
| [Databricks](https://docs.databricks.com/aws/en/sql/language-manual/functions/ai_decide) | `databricks/databricks-openjev-qwen35-4b` | `DATABRICKS_API_KEY` or `DATABRICKS_TOKEN`, `DATABRICKS_API_BASE` required | `/v1/systemone` | No |
| [Databricks `ai_decide`](../providers/databricks.md#decisions-ai_decide) | `databricks/ai_decide` | `DATABRICKS_API_KEY` or `DATABRICKS_TOKEN`, `DATABRICKS_API_BASE` required | `/v1/systemone` | No |
| [Microsoft Foundry](https://ai.azure.com/catalog/models/Microsoft-Decision-1) | `azure_ai/<deployment>` with `base_model: azure_ai/Microsoft-Decision-1` | `AZURE_AI_API_KEY`, `AZURE_AI_API_BASE` required | `/v1/systemone` | No |
| [Strands Decider](../providers/strands_decider.md) (self-hosted) | `strands_decider/strands-decider-2B-hobson-v19` | `STRANDS_DECIDER_API_BASE` required, `STRANDS_DECIDER_API_KEY` optional | `/v1/systemone` | No |
| [vLLM](https://docs.vllm.ai/en/latest/serving/online_serving/structured_decisions.html) (self-hosted) | `hosted_vllm/Qwen/Qwen3-0.6B` | `HOSTED_VLLM_API_BASE` or `api_base` required, `HOSTED_VLLM_API_KEY` optional | `/v1/systemone` | No |
| [Laya](https://github.com/NandhaKishorM/laya) (self-hosted) | `laya/english`, `laya/multilingual` or `laya/typed-decisions` | `api_base` or `LAYA_API_BASE` required, `LAYA_API_KEY` optional | `/v1/systemone` | No |
| [Bespoke Nimble](https://github.com/bespokelabsai/nimble) (self-hosted) | `bespoke/nimble` on Ollama, else `bespoke/nimble-latest` or `bespoke/bespokelabs/Bespoke-Nimble-9B` | `api_base` or `BESPOKE_API_BASE` required, `BESPOKE_API_KEY` optional | `/v1/systemone` | No |

Some of these providers need a newer LiteLLM release than the decision routes, as listed in [Availability and supported features](./index.md#availability-and-supported-features)

LiteLLM translates between the two formats, so the route you call does not limit which provider you can use. OpenAI receives OpenAI-format bodies and every other provider receives System One bodies, and the answers come back in the format of the route you called. Text parts of an OpenAI `input` are joined into the System One `state`, and System One questions are named by their keys when they go to OpenAI

Cloudflare model names without an `@cf/` prefix are expanded to `@cf/cloudflare/<model>`, and the `{"result": ...}` envelope Cloudflare returns is unwrapped so the response has the same shape as the other providers. On Databricks the model is the bare serving endpoint name and `DATABRICKS_API_BASE` points at `https://<workspace-host>/serving-endpoints`, so the request goes to that endpoint's `/invocations` route. `databricks/ai_decide` instead calls the `ai_decide` AI Function at `/api/2.0/ai-functions/ai-decide` on the same workspace, which needs the `ai_decide` preview turned on and reports no token usage. On Microsoft Foundry the model is your deployment name and `AZURE_AI_API_BASE` is the resource host, `https://<resource>.services.ai.azure.com`. A project-scoped base such as `https://<resource>.services.ai.azure.com/api/projects/<project>/openai/v1` is trimmed back to the host. Azure does not let you name a deployment `Microsoft-Decision-1`, so deploy it under another name and set `base_model` so cost tracking finds the price

```yaml showLineNumbers
model_list:
  - model_name: decision-1
    litellm_params:
      model: azure_ai/decision-1
      api_base: https://<resource>.services.ai.azure.com
      api_key: os.environ/AZURE_AI_API_KEY
    model_info:
      base_model: azure_ai/Microsoft-Decision-1
```

[Strands Decider](../providers/strands_decider.md) has no default host, so set `STRANDS_DECIDER_API_BASE` or pass `api_base`. vLLM needs v0.32.0 or later, which includes [vllm-project/vllm#59299](https://github.com/vllm-project/vllm/pull/59299), and answers `choice`, `noul` and `score` questions as described in vLLM's [Structured Decisions](https://github.com/vllm-project/vllm/blob/v0.32.0/docs/serving/online_serving/structured_decisions.md) docs. It serves the model architectures listed in its [`READ_STRATEGIES`](https://github.com/vllm-project/vllm/blob/v0.32.0/vllm/entrypoints/generate/structured_decisions/strategies.py#L812), Qwen3 and Qwen3.5 among them. To use vLLM as the Auto Router classifier, see [vLLM](../auto_router/decision_classifiers.md#vllm)

## Self-hosted Laya and Nimble

[Laya](https://github.com/NandhaKishorM/laya) and [Bespoke Nimble](https://github.com/bespokelabsai/nimble) are decision models that you host yourself. From a build containing [LiteLLM #45260](https://github.com/BerriAI/litellm/pull/45260) they are providers for `/v1/decisions` and `/v1/systemone`, and you can add them from the Admin UI under Models + Endpoints, Add Model, with Mode set to `Decisions - /v1/decisions`. Earlier builds serve them only on their own gateway routes

| Model | Gateway route | Server settings |
|-------|---------------|-----------------|
| Laya | `/laya/v1/systemone` | `LAYA_API_BASE`, optional `LAYA_API_KEY` |
| Bespoke Nimble | `/bespoke/v1/systemone` | `BESPOKE_API_BASE`, optional `BESPOKE_API_KEY` |

A `laya/*` or `bespoke/*` deployment takes only the model names in the provider table above, and any other name answers 400 before a request leaves the proxy. Ollama serves Nimble as `bespoke/nimble`. The API base must be an HTTP or HTTPS URL without credentials, a query, or a fragment. `LAYA_API_KEY` and `BESPOKE_API_KEY` go only to a deployment whose `api_base` is `LAYA_API_BASE` or `BESPOKE_API_BASE`, ignoring a trailing `/` or `/v1`, and an `api_key` set on the deployment always wins. Both are priced at $0 because you pay for the hardware, so set Custom Pricing on the deployment to track spend

Laya, Nimble and Jev can also pick the model tier for Auto Router. For request examples and the classifier setup, see [Call a native decision API](../auto_router/decision_classifiers.md#call-a-native-decision-api)
