---
title: Unified tokenization
sidebar_label: /tokenize
description: Choose a model in your /tokenize request and get its token count, IDs, and text through one API for vLLM and IBM watsonx.ai.
---

# /tokenize

Pass a model name and one text string to `/tokenize`. Read the token count, plus token IDs and text where the provider returns them. Choose Llama on vLLM or Granite on IBM watsonx.ai through the same endpoint and JSON fields.

## /tokenize or token counting

Use `/tokenize` to inspect how a model's tokenizer splits text. For an app that checks context limits or estimates input cost, use the token counting APIs with the request you plan to send, including messages and tools where supported. Counts can be estimates when LiteLLM uses a local tokenizer or fallback.

| API                                                                                                                                | Input                                                                  | Result                                                                                                                             |
| ---------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `/tokenize`, `litellm.tokenize()`, `litellm.atokenize()`                                                                           | One text string                                                        | Token count and available token IDs or text from vLLM or watsonx.ai.                                                               |
| `/utils/token_counter`                                                                                                             | Prompt, messages, or contents; tools and system input where applicable | `total_tokens` and metadata. Uses a local tokenizer by default; `?call_endpoint=true` requests provider counting where configured. |
| [Provider token counting](./count_tokens.md): `litellm.acount_tokens()`, `/v1/messages/count_tokens`, `/v1/responses/input_tokens` | Messages or input in the API's format; tools where supported           | A token count; see the guide for provider support and fallback behavior.                                                           |

For local counting in Python, [`litellm.token_counter()`](./completion/token_usage.md#3-token_counter) returns an integer. `/tokenize` accepts a single `prompt` string, not a complete chat request with `messages` and `tools`. A tokenization call returns tokens without generating an answer.

### Tokens and token IDs

A token is a chunk of text: a word, part of a word, a space, or punctuation. The tokenizer has a vocabulary that maps those pieces to numeric IDs. Consider this made-up vocabulary excerpt:

| Text piece | Token ID |
| ---------- | -------- |
| `"Hello"`  | `101`    |
| `" world"` | `102`    |

To encode `Hello world` in this example, the tokenizer selects `"Hello"` and `" world"`, looks up their rows, and returns `[101, 102]` in the same order. The second piece includes the space. `count` is `2` because the list has two entries; the values `101` and `102` do not affect the count.

During inference, the model uses each ID to look up a learned vector: a list of numbers that represents that token. The model processes those vectors to predict the next token. `/tokenize` exposes the tokens without running inference. Use IDs with their matching tokenizer vocabulary: another model can use a different split and numbering. This table and the [response examples](#response) use illustrative IDs.

### Use cases

**Inspect a large token count.** A long identifier or URL can take many tokens. Read `tokens` to see the split, then compare the counts and token strings for two versions of your prompt.

**Debug extra tokens in vLLM.** Tokenizers can add tokens at the beginning or end of text. Call `/tokenize` with `add_special_tokens: true`, then `false`, for the same prompt. Compare the counts and IDs to see which tokens the model's tokenizer adds.

**Check a vLLM deployment.** Record the IDs for a fixed prompt before and after a deployment, using the same `add_special_tokens` setting. If the IDs change, check the tokenizer version and configuration.

**Replace custom provider translators.** App developers select a model through `/tokenize`. LiteLLM translates requests and responses for vLLM and watsonx.ai, while the serving team maintains provider credentials and model settings.

:::info Installation

`/tokenize` requires a build containing [LiteLLM PR #48079](https://github.com/BerriAI/litellm/pull/48079) and the compiled LiteLLM Rust extension. LiteLLM runs the provider integration in Rust; the provider's tokenizer computes the tokens.

:::

## Gateway quickstart

This example uses `meta-llama/Llama-3.1-8B-Instruct`. Your vLLM server must serve that model under this name; replace it with your server's model name if needed. Set `HOSTED_VLLM_API_BASE` to the server URL, `HOSTED_VLLM_API_KEY` to its API key, and `LITELLM_MASTER_KEY` to your gateway key. Omit `api_key` if your server does not require authentication.

Save this as `config.yaml`:

```yaml
model_list:
  - model_name: llama-3.1-8b
    litellm_params:
      model: hosted_vllm/meta-llama/Llama-3.1-8B-Instruct
      api_base: os.environ/HOSTED_VLLM_API_BASE
      api_key: os.environ/HOSTED_VLLM_API_KEY

general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
```

Start the gateway:

```bash
litellm --config config.yaml --port 4000
```

Pass `llama-3.1-8b` in the request to select that model:

```bash
curl --fail-with-body http://localhost:4000/tokenize \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama-3.1-8b",
    "prompt": "Hello world"
  }'
```

You can use `/v1/tokenize` with the same body. For applications, use a [LiteLLM virtual key](./proxy/virtual_keys.md) with access to `llama-3.1-8b`.

### Choose a model on each request

The request's `model` field selects a `model_name` from your gateway configuration. Its `litellm_params.model` selects the provider and upstream model. In this example, `llama-3.1-8b` selects `meta-llama/Llama-3.1-8B-Instruct` on vLLM, and `granite-3.3-8b` selects `ibm/granite-3-3-8b-instruct` on watsonx.ai.

To offer both models, use this configuration. Set `WATSONX_API_BASE`, `WATSONX_APIKEY`, and `WATSONX_PROJECT_ID` for your watsonx.ai instance. The Granite model must be available in your project; replace its upstream name if you use another model.

```yaml
model_list:
  - model_name: llama-3.1-8b
    litellm_params:
      model: hosted_vllm/meta-llama/Llama-3.1-8B-Instruct
      api_base: os.environ/HOSTED_VLLM_API_BASE
      api_key: os.environ/HOSTED_VLLM_API_KEY
  - model_name: granite-3.3-8b
    litellm_params:
      model: watsonx/ibm/granite-3-3-8b-instruct
      api_base: os.environ/WATSONX_API_BASE
      api_key: os.environ/WATSONX_APIKEY
      project_id: os.environ/WATSONX_PROJECT_ID

general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
```

Restart the gateway, then pass `granite-3.3-8b` to select Granite. Your API key must have access to that model name.

```bash
curl --fail-with-body http://localhost:4000/tokenize \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "granite-3.3-8b",
    "prompt": "Hello world"
  }'
```

The endpoint and JSON fields stay the same; the `model` value selects the tokenizer. LiteLLM translates `prompt` to watsonx.ai's `input`, adds the configured project, and returns the shared response fields.

For a stable client request, choose a shared gateway name such as `text-tokenizer` and update the model behind that name in gateway configuration. Clients keep sending `"model": "text-tokenizer"` when you change providers. The upstream tokenizer determines the token values and count, so a model change can change the result.

## Python SDK

Use `litellm.tokenize()` for synchronous calls and `litellm.atokenize()` for asynchronous calls. These examples call the provider through LiteLLM's SDK; `api_base` is the provider's URL.

### Synchronous vLLM call

```python
import os
import litellm

response = litellm.tokenize(
    model="hosted_vllm/meta-llama/Llama-3.1-8B-Instruct",
    prompt="Hello world",
    api_base=os.environ["HOSTED_VLLM_API_BASE"],
    api_key=os.environ.get("HOSTED_VLLM_API_KEY"),
)

print(response.count)
print(response.token_ids)
print(response.tokens)
```

### Asynchronous watsonx.ai call

```python
import asyncio
import os
import litellm


async def main():
    response = await litellm.atokenize(
        model="watsonx/ibm/granite-3-3-8b-instruct",
        prompt="Hello world",
        api_base=os.environ["WATSONX_API_BASE"],
        api_key=os.environ["WATSONX_APIKEY"],
        project_id=os.environ["WATSONX_PROJECT_ID"],
    )
    print(response.model_dump())


asyncio.run(main())
```

Use `router.tokenize()` and `router.atokenize()` with [LiteLLM Router](./routing.md) model aliases configured in `model_list`.

## Supported providers

| Provider       | Model prefix              | `token_ids`       | `tokens`                                                     |
| -------------- | ------------------------- | ----------------- | ------------------------------------------------------------ |
| vLLM           | `hosted_vllm/` or `vllm/` | Numeric token IDs | Token strings when the server returns them; `null` if absent |
| IBM watsonx.ai | `watsonx/`                | `null`            | Token strings                                                |

Use the [token counting APIs](./count_tokens.md) to count tokens across other providers, including Gemini.

## Request

Both gateway paths accept a JSON object with these required fields:

| Field    | Type   | Description                                                                                        |
| -------- | ------ | -------------------------------------------------------------------------------------------------- |
| `model`  | string | Configured gateway model name, such as `llama-3.1-8b`, or provider-prefixed model name in the SDK. |
| `prompt` | string | Text to tokenize. LiteLLM accepts an empty string; the provider applies its own validation.        |

Pass provider options as additional top-level fields in the JSON body or as SDK keyword arguments. To keep clients portable between providers, configure provider-specific options in the gateway's `litellm_params` and send only `model` and `prompt` from the client.

An explicit caller option overrides its configured default. LiteLLM ignores unrelated defaults on a model deployment, such as `temperature` and `max_tokens`, when it tokenizes. It rejects unsupported provider options supplied by the caller.

### vLLM options

| Option               | Type    | Default | Description                                                          |
| -------------------- | ------- | ------- | -------------------------------------------------------------------- |
| `add_special_tokens` | boolean | `true`  | Include the tokenizer's special tokens. Set to `false` to omit them. |

Set `api_base` or `HOSTED_VLLM_API_BASE`. A base ending in `/v1` works: LiteLLM calls the sibling `/tokenize` endpoint. LiteLLM preserves any reverse proxy path prefix.

Authentication uses `api_key` or `HOSTED_VLLM_API_KEY` when present. LiteLLM requests token strings alongside IDs; servers that omit token strings produce `tokens: null`.

### watsonx.ai options

| Option        | Type   | Default                                             | Description                                                      |
| ------------- | ------ | --------------------------------------------------- | ---------------------------------------------------------------- |
| `project_id`  | string | `WATSONX_PROJECT_ID`                                | Project containing the model. `watsonx_project` is an alias.     |
| `space_id`    | string | `WATSONX_DEPLOYMENT_SPACE_ID` or `WATSONX_SPACE_ID` | Deployment space to use when no project resolves.                |
| `api_version` | string | `2024-03-13`                                        | Version for the watsonx.ai tokenization API.                     |
| `token`       | string | `WATSONX_TOKEN`                                     | Existing bearer token.                                           |
| `zen_api_key` | string | `WATSONX_ZENAPIKEY`                                 | Zen API key for deployments that use this authentication scheme. |

Provide a project or a space. A resolved project takes precedence over a space. Set `api_base` or `WATSONX_API_BASE`; LiteLLM accepts `WATSONX_URL` as an alternative.

For IBM Cloud authentication, set `api_key` or `WATSONX_APIKEY` and LiteLLM obtains an IAM token. Authentication precedence is an explicit `Authorization` header, a bearer `token`, a `zen_api_key`, then an API key for IAM. Keep gateway credentials in deployment configuration or environment variables.

### SDK connection options

| Option                | Type                      | Description                                                                              |
| --------------------- | ------------------------- | ---------------------------------------------------------------------------------------- |
| `api_base`            | string                    | Provider base URL. Falls back to the provider's environment variables above.             |
| `api_key`             | string                    | Provider API key. Falls back to the provider's environment variables above.              |
| `timeout`             | number or `httpx.Timeout` | Provider request timeout in seconds, or an HTTPX timeout object. Defaults to 60 seconds. |
| `extra_headers`       | mapping                   | Additional provider HTTP headers.                                                        |
| `custom_llm_provider` | string                    | Explicit provider when passing a model name without a provider prefix.                   |

## Response

The gateway returns JSON. The SDK returns a `TokenizeResponse` with the same fields and a `.model_dump()` method.

| Field       | Type                                    | Description                                                                                                          |
| ----------- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `model`     | string                                  | Resolved upstream model name, without the LiteLLM provider prefix. This can differ from the requested gateway alias. |
| `count`     | nonnegative integer                     | Number of tokens the provider returns.                                                                               |
| `token_ids` | array of nonnegative integers or `null` | Numeric token IDs, when the provider exposes them.                                                                   |
| `tokens`    | array of strings or `null`              | Token strings, when the provider exposes them.                                                                       |

The examples below use the configured model names and made-up token data. Your model and special-token setting determine the actual IDs, strings, and counts.

Illustrative response for the `llama-3.1-8b` request:

```json
{
  "model": "meta-llama/Llama-3.1-8B-Instruct",
  "count": 2,
  "token_ids": [101, 102],
  "tokens": ["Hello", " world"]
}
```

Illustrative response for the `granite-3.3-8b` request:

```json
{
  "model": "ibm/granite-3-3-8b-instruct",
  "count": 2,
  "token_ids": null,
  "tokens": ["Hello", " world"]
}
```

`null` means the provider does not expose that representation in its response. An empty array means the provider returned zero tokens. LiteLLM preserves this distinction and does not invent token IDs for watsonx.ai.
