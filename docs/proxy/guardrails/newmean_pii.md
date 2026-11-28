---
title: "newmean-pii Guardrail on LiteLLM AI Gateway"
sidebar_label: "newmean-pii"
description: "Mask personal information in requests or responses on the LiteLLM AI Gateway with newmean-pii, a small multilingual model that runs inside the proxy process."
---

# newmean-pii

[newmean-pii](https://github.com/newmean-ai/pii) masks personal information such as names, e-mail addresses, phone numbers, addresses and ID numbers with a small multilingual token-classification model (54 languages). The guardrail runs the model inside the proxy process, so there is no second service to deploy and the text is not sent to another API. Use `pre_call` to mask a request before the model provider sees it, or `post_call` to mask the response before it goes back to the client.

The guardrail is a [custom guardrail](/docs/proxy/guardrails/custom_guardrail) class that ships in the [`newmean-pii`](https://pypi.org/project/newmean-pii/) package from version 1.6.0. {/* keep-version-note */}

## Quick Start

### 1. Install the package

```shell
pip install "newmean-pii>=1.7.2"
```

Install it into the proxy's own Python environment. It has no dependencies of its own. On the first request the guardrail downloads the model files from Hugging Face (11.3 MB for the default `medium` model, plus a 0.8 MB tokenizer) and checks them against SHA-256 values pinned in the package. No API key is needed.

For a proxy without network access, or to bake the files into a container image, download them ahead of time and point the proxy at the same folder.

```shell
NEWMEAN_PII_CACHE=/opt/newmean-pii python -m newmean_pii download --size medium
```

Run the proxy with `NEWMEAN_PII_CACHE=/opt/newmean-pii`, and add `NEWMEAN_PII_OFFLINE=1` so it fails instead of downloading when a file is missing.

### 2. Add newmean-pii to your LiteLLM config.yaml

```yaml title="config.yaml"
model_list:
  - model_name: {{openai_small}}
    litellm_params:
      model: openai/{{openai_small}}
      api_key: os.environ/OPENAI_API_KEY

guardrails:
  - guardrail_name: newmean-pii
    litellm_params:
      guardrail: newmean_pii.litellm.NewmeanPIIGuardrail
      mode: pre_call
      size: medium   # optional, nano, small, medium or large
```

Requests opt in with `"guardrails": ["newmean-pii"]`. Set `default_on: true` to mask every request.

### 3. Start LiteLLM Proxy

```shell
export OPENAI_API_KEY=sk-...
litellm --config config.yaml
```

### 4. Make your first request

```shell
curl -sSLX POST 'http://0.0.0.0:4000/v1/chat/completions' \
--header 'Content-Type: application/json' \
--data '{
  "model": "{{openai_small}}",
  "messages": [
    {"role": "user", "content": "Call Kim Minsu on 010-1234-5678"}
  ],
  "guardrails": ["newmean-pii"]
}'
```

The model provider receives `Call [PERSON] on [PHONE]`. Without the guardrail it receives the message as written.

## Supported parameters

All parameters are optional.

| Parameter | Default | Description |
|---|---|---|
| `size` | `medium` | Model size, one of `nano` (2.6 MB), `small` (7.1 MB), `medium` (11.3 MB) or `large` (15.5 MB) |
| `labels` | all labels | Labels to mask, from `PERSON`, `EMAIL`, `PHONE`, `ADDRESS`, `ID_NUMBER`, `FINANCIAL`, `ORG`, `USERNAME`, `URL`, `DATE_OF_BIRTH`, `SECRET`, `PERSON_L2` and `URL_L2` |
| `redact_mode` | `tag` | `tag` writes the label (`[PERSON]`), `mask` writes `*` for each character, and `blank` removes the value |
| `sensitivity` | `0.0` | Above 0 masks more and below 0 masks less, roughly from -1 to 1 |
| `allow` | none | Values that are not personal information in your data, as `[text, label]` pairs or plain strings |
| `block` | none | Values that are always personal information in your data, as `[text, label]` pairs |
| `regex` | `false` | Also mask a few patterns (e-mail, URL, card or account number, phone, Korean resident registration number) |
| `model_dir` | none | A folder that already holds the model files. The guardrail never downloads when it is set |
| `cache_dir` | `NEWMEAN_PII_CACHE`, else `$XDG_CACHE_HOME/newmean-pii` or `~/.cache/newmean-pii` | Where downloaded model files are kept |
| `model_url` | Hugging Face | Base URL of a mirror of the model files |

The model loads on the first request and then stays in memory. It runs in a worker thread, so the proxy's event loop stays free while a text is masked. On one core a short text takes about 10 ms with `medium` on an Apple M5 Pro and about 19 ms on an AMD EPYC 9V74 (x86-64 with AVX2).

## Supported modes

`pre_call` masks the text of the request before it is sent to the model provider. `post_call` masks the text of the response before the client gets it. To do both, register the guardrail twice, once per mode.

Masked values are not put back into the response. To mask before the text leaves your application and put the values back in the model's answer, use a newmean-pii middleware in the application instead, for [LangChain](https://github.com/newmean-ai/pii/blob/main/python/README.md#integrations), [LangChain.js or the Vercel AI SDK](https://github.com/newmean-ai/pii/blob/main/js/README.md#putting-the-values-back-vault).

## Limitations

No model finds every piece of personal information. On the newmean-pii public test set (54 languages) the models leave 1.6% (`large`) to 2.9% (`nano`) of PII characters unmasked, and they miss more on the external datasets in the same comparison. The guardrail lowers what a provider sees, but it does not guarantee that nothing gets through. Miss rates per model, dataset, label and language are in the [newmean-pii README](https://github.com/newmean-ai/pii#results).

## Further reading

- [newmean-pii on GitHub](https://github.com/newmean-ai/pii)
- [newmean-pii on PyPI](https://pypi.org/project/newmean-pii/)
- [Python package README](https://github.com/newmean-ai/pii/blob/main/python/README.md#integrations)
