import Image from '@theme/IdealImage';
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Peyeeye PII Redaction & Rehydration

Use [Peyeeye](https://peyeeye.ai) to strip PII from prompts before they reach the model and rehydrate the original values into the model's response. Detects 60+ built-in entity types — emails, payment data, secrets, government IDs, medical IDs, and more — plus first-class support for custom entities.

Two session modes:

- **Stateful** — peyeeye holds the token → value mapping under a `ses_…` id; the post-call hook references the id to rehydrate.
- **Stateless** — peyeeye returns a sealed `skey_…` rehydration key; nothing is retained server-side.

## Quick Start

### 1. Get an API key

Sign up at [peyeeye.ai](https://peyeeye.ai) and create an API key from the dashboard.

```shell
export PEYEEYE_API_KEY="pk_…"
```

### 2. Define guardrails on your LiteLLM `config.yaml`

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: gpt-4o-mini
    litellm_params:
      model: openai/gpt-4o-mini
      api_key: os.environ/OPENAI_API_KEY

guardrails:
  - guardrail_name: "peyeeye-redact"
    litellm_params:
      guardrail: peyeeye
      mode: "pre_call"
      api_key: os.environ/PEYEEYE_API_KEY
  - guardrail_name: "peyeeye-rehydrate"
    litellm_params:
      guardrail: peyeeye
      mode: "post_call"
      api_key: os.environ/PEYEEYE_API_KEY
```

The two entries share session state via `litellm_call_id`, so a single request automatically pairs the redaction with the rehydration.

#### Supported values for `mode`

- `pre_call` — Redact PII from `messages[].content` before the LLM is called.
- `post_call` — Rehydrate placeholders in `response.choices[].message.content` back to the original values.

### 3. Start LiteLLM Gateway

```shell
litellm --config config.yaml --detailed_debug
```

### 4. Test request

<Tabs>
<TabItem label="Round-trip" value="roundtrip">

Send a prompt containing PII; the model never sees the email but the response comes back with it restored.

```shell
curl -i http://0.0.0.0:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o-mini",
    "messages": [
      {"role": "user", "content": "Draft a reply confirming we received the order from alice@acme.com on card 4242 4242 4242 4242."}
    ],
    "guardrails": ["peyeeye-redact", "peyeeye-rehydrate"]
  }'
```

What the model receives (peyeeye intercepts the outbound prompt):

```text
Draft a reply confirming we received the order from [EMAIL_1] on card [CARD_1].
```

What the client receives back (peyeeye rehydrates the inbound completion):

```json
{
  "choices": [
    {
      "message": {
        "role": "assistant",
        "content": "Thanks for your order! We've received your card ending 4242 and will email alice@acme.com when it ships."
      }
    }
  ]
}
```

</TabItem>

<TabItem label="Stateless mode" value="stateless">

Use stateless mode if you don't want peyeeye to retain the token mapping server-side. peyeeye returns a sealed `skey_…` blob in the redact response that LiteLLM uses internally for rehydration; nothing is stored on peyeeye's side.

```yaml showLineNumbers title="config.yaml"
guardrails:
  - guardrail_name: "peyeeye-redact"
    litellm_params:
      guardrail: peyeeye
      mode: "pre_call"
      api_key: os.environ/PEYEEYE_API_KEY
      peyeeye_session_mode: "stateless"
  - guardrail_name: "peyeeye-rehydrate"
    litellm_params:
      guardrail: peyeeye
      mode: "post_call"
      api_key: os.environ/PEYEEYE_API_KEY
      peyeeye_session_mode: "stateless"
```

</TabItem>

<TabItem label="Restrict entities" value="entities">

Only detect the entities you care about (faster, fewer false positives):

```yaml showLineNumbers title="config.yaml"
guardrails:
  - guardrail_name: "peyeeye-redact"
    litellm_params:
      guardrail: peyeeye
      mode: "pre_call"
      api_key: os.environ/PEYEEYE_API_KEY
      peyeeye_entities: ["EMAIL", "CARD", "PHONE", "SSN"]
```

The full catalog (60+ entities) is documented at [peyeeye.ai/docs/entities](https://peyeeye.ai/docs/entities).

</TabItem>
</Tabs>

## Configuration parameters

| Parameter | Type | Description |
|---|---|---|
| `api_key` | string | Peyeeye API key. Falls back to `PEYEEYE_API_KEY`. |
| `api_base` | string | API base URL. Defaults to `https://api.peyeeye.ai`. Falls back to `PEYEEYE_API_BASE`. |
| `peyeeye_locale` | string | BCP-47 language tag for detection. `auto` (default) lets peyeeye detect. |
| `peyeeye_entities` | list[string] | Restrict detection to these entity IDs. Omit to detect all 60+ built-in entities. |
| `peyeeye_session_mode` | `stateful` \| `stateless` | `stateful` (default) uses peyeeye sessions. `stateless` returns a sealed key — no PII retained server-side. |

## Custom entities

Custom entities (account numbers, internal SKUs, partner IDs, etc.) are first-class — define a regex once in the peyeeye dashboard and the guardrail will redact and rehydrate them like any built-in. See [peyeeye.ai/docs/custom-entities](https://peyeeye.ai/docs/custom-entities).

## How it works

1. **Pre-call** — peyeeye replaces every detected PII span with a placeholder like `[EMAIL_1]`, `[CARD_1]`. The same placeholder is reused for repeat values within the request, so the model sees consistent references. The session id (or sealed key) is cached against the request's `litellm_call_id`.
2. **Model call** — LiteLLM forwards the redacted messages to the model. The model never sees the original PII.
3. **Post-call** — peyeeye looks up the cached session, swaps placeholders in the model's response back to the original values, and cleans up the session.

## Links

- Homepage: [peyeeye.ai](https://peyeeye.ai)
- Docs: [peyeeye.ai/docs](https://peyeeye.ai/docs)
- Entity catalog: [peyeeye.ai/docs/entities](https://peyeeye.ai/docs/entities)
