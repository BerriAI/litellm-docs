import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# PrivAiTe

Use [PrivAiTe](https://github.com/crp4222/PrivAiTe) to replace PII and secrets with reversible placeholders before a request reaches the model provider, then restore the real values in the response.

PrivAiTe runs **in-process**, inside your LiteLLM proxy. There is no API key, no external service and no network call for detection: the models run on your machine, so the values it protects never leave it in order to be protected. Detection uses [Microsoft Presidio](https://github.com/microsoft/presidio) plus OpenAI's open privacy-filter model.

Because the placeholders are reversible, the model answers about `<PERSON_1>` and your caller reads the real name back:

```
Client sends: "Email the invoice to Marie Dupont, marie@acme.com"
Model sees:   "Email the invoice to <PERSON_1>, <EMAIL_ADDRESS_1>"
Model says:   "I've drafted an email to <PERSON_1> at <EMAIL_ADDRESS_1>."
Client reads: "I've drafted an email to Marie Dupont at marie@acme.com."
```

Restoration covers message content, streamed deltas, reasoning traces, refusals, audio transcripts and **tool-call arguments**, on both `/chat/completions` and `/responses`.

## Quick Start

### 1. Install PrivAiTe

```shell
pip install "privaite>=0.4.2"

# One spaCy model per language you scan. The default scans EN + FR.
python -m spacy download en_core_web_lg
python -m spacy download fr_core_news_md
```

The first request with the `onnx` preset downloads the detection model (~800 MB, runs locally via ONNX Runtime) and caches it. Pre-warm it in your image build if you run in containers.

### 2. Define the guardrail on your LiteLLM config.yaml

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: gpt-4o
    litellm_params:
      model: openai/gpt-4o
      api_key: os.environ/OPENAI_API_KEY

guardrails:
  - guardrail_name: "privaite-guard"
    litellm_params:
      guardrail: privaite
      mode: "pre_call"
      preset: "onnx"           # Optional, default. "light" is faster, Presidio only
      languages: "en,fr"       # Optional, default
      deanonymize: true        # Optional, default
```

#### A note on `mode`

PrivAiTe always registers **both** `pre_call` and `post_call`, whatever you write in `mode`. The two halves are one operation: `pre_call` anonymizes the request, `post_call` restores the response. A `mode: post_call` alone would skip anonymization and forward raw PII to the model, so that configuration is corrected rather than honoured. Tag-based `Mode` configs are left untouched.

### 3. Start LiteLLM Gateway

```shell
litellm --config config.yaml --detailed_debug
```

### 4. Test request

<Tabs>
<TabItem label="Masked and restored" value="masked">

```shell
curl -i http://0.0.0.0:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-1234" \
  -d '{
    "model": "gpt-4o",
    "messages": [
      {"role": "user", "content": "Draft a reply to Marie Dupont at marie@acme.com"}
    ],
    "guardrails": ["privaite-guard"]
  }'
```

The provider receives `<PERSON_1>` and `<EMAIL_ADDRESS_1>`. The response you read back contains `Marie Dupont` and `marie@acme.com`.

</TabItem>
<TabItem label="Blocked request" value="blocked">

With `block_entities` set (see below), a request carrying a listed type is refused and nothing is forwarded:

```shell
curl -i http://0.0.0.0:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-1234" \
  -d '{
    "model": "gpt-4o",
    "messages": [
      {"role": "user", "content": "My SSN is 123-45-6789"}
    ],
    "guardrails": ["privaite-guard"]
  }'
```

The proxy answers **HTTP 400** and the error names the entity **type**, never the value:

```
request blocked: contains disallowed PII type(s): US_SSN
```

</TabItem>
</Tabs>

## Supported Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `guardrail` | string | required | Must be `privaite`. |
| `mode` | string | required | Any value; `pre_call` and `post_call` both run regardless (see above). |
| `preset` | string | `onnx` | `onnx` runs the full suite and detects secrets. `light` is Presidio only: faster, no model download, classic PII only. An unknown value falls back to `onnx`. |
| `languages` | string | `en,fr` | Comma-separated spaCy languages. Each one needs its model installed. |
| `deanonymize` | bool | `true` | Restore the original values in the response. Set `false` to verify that the provider only ever received placeholders. |
| `block_entities` | list or string | none | PII types to reject outright instead of masking, e.g. `["US_SSN", "CREDIT_CARD"]` or `"US_SSN,CREDIT_CARD"`. A request containing any listed type is refused with a 400 and nothing is forwarded. Omitted, everything is masked and forwarded. |

## Rejecting instead of masking

Masking is the default: every detected value is replaced and the request goes through. When a type must never reach a provider at all, list it in `block_entities`:

```yaml showLineNumbers title="config.yaml"
guardrails:
  - guardrail_name: "privaite-guard"
    litellm_params:
      guardrail: privaite
      mode: "pre_call"
      block_entities: ["US_SSN", "CREDIT_CARD"]
```

The request is refused with a 400 naming the entity **type**. The value itself is never echoed, in the error or in the logs.

## Verifying that the provider only sees placeholders

Set `deanonymize: false` and read the model's reply as-is. If the answer talks about `<PERSON_1>`, the provider received the placeholder and nothing else. This is the cheapest end-to-end proof, and it is worth running once against your own traffic:

```yaml
      deanonymize: false
```

## Limits worth knowing

- This is **pseudonymization, not anonymization**, and detection is best-effort rather than a guarantee. You remain the data controller.
- **Two types are deliberately irreversible.** The shipped defaults mask `CREDIT_CARD` and redact `SECRET`, which throws the original away on purpose, so those two never come back in the response.
- **Detection has a measured recall**, published with the misses rather than rounded up: see the [benchmark](https://github.com/crp4222/privaite-bench) and the [threat model](https://github.com/crp4222/PrivAiTe#threat-model).
- The first `onnx` request pays the model download and load. Subsequent requests reuse the cached engine.

## Need Help?

- **Repository**: [github.com/crp4222/PrivAiTe](https://github.com/crp4222/PrivAiTe)
- **Documentation**: [crp4222.github.io/PrivAiTe](https://crp4222.github.io/PrivAiTe/)
- **Benchmark**: [github.com/crp4222/privaite-bench](https://github.com/crp4222/privaite-bench)
- **Issues**: [github.com/crp4222/PrivAiTe/issues](https://github.com/crp4222/PrivAiTe/issues)
