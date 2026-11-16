---
title: "newmean-pii PII Masking on LiteLLM AI Gateway"
sidebar_label: "newmean-pii"
description: "Mask names, phone numbers, emails, addresses and ID numbers in 54 languages inside the LiteLLM AI Gateway process with newmean-pii, with no extra service."
---

# newmean-pii

[newmean-pii](https://github.com/newmean-ai/pii) masks personal information (names, phone numbers, email addresses, postal addresses, ID numbers and more) with a small multilingual model that runs inside the LiteLLM Proxy process. There is no second service to deploy and no API key: the model is a C extension in the `newmean-pii` Python package (Apache-2.0), 2.6 MB to 15.5 MB depending on the size you pick, and it covers 54 languages.

It plugs in through LiteLLM's [custom guardrail](./custom_guardrail) loading: the package ships a `CustomGuardrail` class and you point `guardrail:` at it.

## Quick Start

### 1. Install the package

Install it in the same environment as LiteLLM Proxy:

```shell
pip install newmean-pii
```

The model files are downloaded from Hugging Face on the first request (checked against SHA-256 values pinned in the package) and cached under `~/.cache/newmean-pii`. To run without network access, download them once and set `model_dir`.

### 2. Add the guardrail to your LiteLLM config.yaml

```yaml title="config.yaml"
model_list:
  - model_name: {{openai_small}}
    litellm_params:
      model: openai/{{openai_small}}
      api_key: os.environ/OPENAI_API_KEY

guardrails:
  - guardrail_name: "newmean-pii"
    litellm_params:
      guardrail: newmean_pii.litellm.NewmeanPIIGuardrail
      mode: "pre_call"      # mask the request before it is sent to the model
      size: "medium"        # nano | small | medium | large
```

### 3. Start LiteLLM Proxy

```shell
litellm --config config.yaml
```

### 4. Test it

Apply the guardrail to a text directly:

```shell
curl http://localhost:4000/guardrails/apply_guardrail \
  -H "Authorization: Bearer sk-1234" \
  -H "Content-Type: application/json" \
  -d '{
    "guardrail_name": "newmean-pii",
    "text": "Please call Kim Minsu on 010-1234-5678 or write to kim@example.com."
  }'
```

```json
{"response_text": "Please call [PERSON] on [PHONE] or write to [EMAIL]."}
```

Or send a chat request with the guardrail turned on:

```shell
curl http://localhost:4000/v1/chat/completions \
  -H "Authorization: Bearer sk-1234" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "{{openai_small}}",
    "guardrails": ["newmean-pii"],
    "messages": [{"role": "user", "content": "Please call Kim Minsu on 010-1234-5678."}]
  }'
```

The response carries the header `x-litellm-applied-guardrails: newmean-pii`.

## Supported modes

| Mode | What is masked |
|------|----------------|
| `pre_call` | The request, before it is sent to the model |
| `post_call` | The model's response |

Set `default_on: true` to apply the guardrail to every request without the `guardrails` field.

## Parameters

All parameters are optional and go under `litellm_params`.

| Parameter | Default | Description |
|-----------|---------|-------------|
| `size` | `medium` | Model size: `nano` (2.6 MB), `small` (7.1 MB), `medium` (11.3 MB) or `large` (15.5 MB) |
| `labels` | all | Labels to mask, for example `[PERSON, EMAIL, PHONE]`. Available: `PERSON`, `EMAIL`, `PHONE`, `ADDRESS`, `ID_NUMBER`, `FINANCIAL`, `ORG`, `USERNAME`, `URL`, `DATE_OF_BIRTH`, `SECRET`, `PERSON_L2`, `URL_L2` |
| `sensitivity` | `0.0` | Above 0 masks more, below 0 masks less (about -1 to 1) |
| `redact_mode` | `tag` | `tag` writes `[EMAIL]`, `mask` writes asterisks, `blank` removes the text |
| `allow` | none | A list of values that are not PII in your data and must stay visible |
| `model_dir` | none | Folder with the model files, for running without downloads |

## Limits

Masked values are not put back into the response, so the model answers with `[PERSON]` where a name was. No model finds every piece of personal information: miss rates per dataset and language are published in the [project README](https://github.com/newmean-ai/pii#results). The guardrail lowers what a provider sees and does not guarantee that nothing gets through. The model runs on CPU in a worker thread, and a short message takes from a few milliseconds to a few tens of milliseconds depending on the size and the machine.

The package and its source are at [github.com/newmean-ai/pii](https://github.com/newmean-ai/pii), with a [Python guide](https://github.com/newmean-ai/pii/blob/main/python/README.md#integrations). Report problems in its [issue tracker](https://github.com/newmean-ai/pii/issues).
