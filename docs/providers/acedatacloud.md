# Ace Data Cloud

[Ace Data Cloud](https://platform.acedata.cloud?utm_source=opensource&utm_medium=referral&utm_campaign=evergreen&utm_content=litellm_provider_docs) provides model APIs with one API key and a shared Credit balance.

## Overview

| Property | Value |
| --- | --- |
| LiteLLM provider | `acedatacloud/` |
| API base | `https://api.acedata.cloud/openai` |
| API key | `ACEDATACLOUD_API_KEY` |
| Supported endpoints | Chat Completions and Responses |
| API documentation | [Chat Completions](https://platform.acedata.cloud/documents/openai-chat-completions), [Responses](https://platform.acedata.cloud/documents/openai-responses) |
| Model catalog and prices | [Models](https://platform.acedata.cloud/models), [machine-readable catalog](https://platform.acedata.cloud/api/v1/models/catalog/) |

:::note Release availability

The `acedatacloud/` prefix requires a LiteLLM version containing [the provider integration](https://github.com/BerriAI/litellm/pull/44817). Older releases can route through the [OpenAI-compatible provider](https://docs.litellm.ai/docs/providers/openai_compatible) with `openai/gpt-6-luna`, `api_base="https://api.acedata.cloud/openai"`, an explicit API key, and custom prices from the public catalog.

Versions without the Credit-cost fix can fail strict response serialization when `usage.cost` contains a structured Credit value. Verify serialization and custom prices before using the generic configuration in a proxy.

:::

## Get an API key

Register or sign in at [Ace Data Cloud Applications](https://platform.acedata.cloud/console/applications?utm_source=opensource&utm_medium=referral&utm_campaign=evergreen&utm_content=litellm_provider_docs_api_key). If no General application exists, choose **Initialize General Application**. Open **General application** and confirm OpenAI service access, the selected model, current balance, and [pricing](https://platform.acedata.cloud/models?utm_source=opensource&utm_medium=referral&utm_campaign=evergreen&utm_content=litellm_provider_docs_pricing).

Copy its API key or choose **Manage Keys** and **Create** to make a separate `LiteLLM models` key. A service-specific application key is limited to its service. Use a business API credential; Account Tokens are for the separate platform management API. Paste only the token string, without `Bearer ` or quotes.

![Copy an Ace API key or open Manage Keys](https://raw.githubusercontent.com/AceDataCloud/SunoDify/8d3d03570e73324220f111f7fe343da0792a8071/_assets/tutorial/get-api-key-en.png)

![Create an optional separate Ace key](https://raw.githubusercontent.com/AceDataCloud/SunoDify/8d3d03570e73324220f111f7fe343da0792a8071/_assets/tutorial/create-api-key-en.png)

These redacted Ace console images are reused from the Suno Dify onboarding guide. They illustrate the shared key workflow, not a successful LiteLLM connection. Set your own token in the environment.

```bash
export ACEDATACLOUD_API_KEY="your-api-token"
```

The provider uses the `/openai` base path. LiteLLM appends `/chat/completions` or `/responses` as appropriate.

## Chat Completions

```python keep-model-ids
from litellm import completion

response = completion(
    model="acedatacloud/gpt-6-luna",
    messages=[{"role": "user", "content": "Reply with exactly OK."}],
    reasoning_effort="none",
    max_completion_tokens=64,
)
print(response.choices[0].message.content)
```

For streaming, add `stream=True` and `stream_options={"include_usage": True}`, then iterate over the returned chunks.

## Responses

```python keep-model-ids
from litellm import responses

response = responses(
    model="acedatacloud/gpt-6-luna",
    input="Reply with exactly OK.",
    reasoning={"effort": "none"},
    max_output_tokens=64,
)
print(response.output)
```

`gpt-6-luna` accepts `none`, `low`, `medium`, `high`, `xhigh`, and `max` reasoning effort. It does not accept `minimal`.

## LiteLLM Proxy

Save this as `config.yaml`.

```yaml keep-model-ids
model_list:
  - model_name: ace-gpt-6-luna
    litellm_params:
      model: acedatacloud/gpt-6-luna
      api_key: os.environ/ACEDATACLOUD_API_KEY

general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
```

Set a proxy master key, then start the proxy.

```bash
export LITELLM_MASTER_KEY="sk-$(openssl rand -hex 32)"
litellm --config config.yaml --port 4000
```

```bash keep-model-ids
curl http://localhost:4000/v1/chat/completions \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"model":"ace-gpt-6-luna","messages":[{"role":"user","content":"Reply with exactly OK."}],"reasoning_effort":"none","max_completion_tokens":64}'
```

The same deployment also accepts Responses requests.

```bash keep-model-ids
curl http://localhost:4000/v1/responses \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"model":"ace-gpt-6-luna","input":"Reply with exactly OK.","reasoning":{"effort":"none"},"max_output_tokens":64}'
```

In the Admin UI, open **Models + Endpoints**, choose **Add Model**, select **Ace Data Cloud**, select `acedatacloud/gpt-6-luna`, and enter your Ace Data Cloud API key.

## Models and cost tracking

The initial priced model is `acedatacloud/gpt-6-luna`, using the standard service tier. You can use other model IDs documented for Ace Data Cloud's OpenAI-compatible endpoints with the same prefix, but configure custom pricing for models or service tiers without an Ace Data Cloud catalog entry. Check endpoint eligibility and model-specific capabilities in the current catalog. Models served only by the separate Claude Messages API are outside this integration.

Ace Data Cloud bills in Credits. Convert consumption to USD using `Credits × package price / package amount`. LiteLLM's catalog uses the public entry package verified on October 6, 2026: USD 7 for 40 Credits, or USD 0.175 per Credit. Larger recharge packages and account discounts can lower the effective USD cost.

The priced model includes uncached input, cached input, cache creation, output, and the higher rates for prompts over 272,000 tokens. The source is the catalog's full `cost` rules, not its rounded display prices. The `usage.cost` returned by Ace Data Cloud is denominated in Credits. LiteLLM omits this structured field from its numeric cost field and estimates USD spend using the model catalog.

To track a different recharge tier, configure [custom pricing](https://docs.litellm.ai/docs/proxy/custom_pricing) using that package's current conversion rate and the model's public cost rules. Check [the live catalog](https://platform.acedata.cloud/api/v1/models/catalog/) before changing rates.

## Music, video, and image tools

Suno, Seedance, HappyHorse, GPT Image, and Nano Banana use separate [Ace Data Cloud media MCP connections](../mcp_servers/acedatacloud.md). Their discovery entries are independent of this text-model provider. Do not send a media task payload to the Chat Completions endpoint or apply text-token prices to a media service.
