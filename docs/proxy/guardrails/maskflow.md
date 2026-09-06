import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# MaskFlow

[MaskFlow](https://github.com/maskflow/maskflow) is an open-source (MIT) PII masking engine. The `maskflow-litellm` package wraps it as a custom guardrail that runs in-process in the proxy, so there is no separate service and no outbound call to a detection API. On `pre_call` it replaces detected PII with typed, reversible placeholders (`<PAN_1>`, `<EMAIL_2>`) before the request reaches the model provider; on `post_call` and on the streaming path it swaps the originals back into the reply.

Alongside the usual identifiers (email, phone, credit card, and similar) MaskFlow covers Indian identifiers that most PII tools miss: Aadhaar, PAN, GSTIN, UPI VPA, IFSC, ABHA, Indian mobile and PIN code, voter ID, passport, driving licence, vehicle registration, and Indian names and addresses. Per-entity accuracy is measured against a synthetic benchmark and [published in the repository](https://github.com/maskflow/maskflow/blob/main/bench/reports/indiapii-v1.0/results.md), including the entities where other tools score higher.

## Quick Start

### 1. Install the package

```shell
pip install maskflow-litellm
```

Add `maskflow-litellm[redis]` instead if the proxy runs more than one worker or replica and you need cross-turn masking to be consistent between them; see [Sessions](#sessions).

### 2. Add MaskFlow to your LiteLLM config.yaml

Point the guardrail at the class and list both hook points in `mode`, so the request is masked on the way out and the response is restored on the way back.

```yaml title="config.yaml"
model_list:
  - model_name: gpt-4o
    litellm_params:
      model: openai/gpt-4o
      api_key: os.environ/OPENAI_API_KEY

guardrails:
  - guardrail_name: maskflow
    litellm_params:
      guardrail: maskflow_litellm.MaskflowGuardrail
      mode: [pre_call, post_call]
```

Both hook points are required. With `pre_call` alone the caller receives placeholder tokens in the response instead of the real values; the guardrail logs a warning at startup when `post_call` is absent.

### 3. Start LiteLLM Proxy

```shell
export OPENAI_API_KEY=sk-...
litellm --config config.yaml
```

The first request triggers a one-time download of a small spaCy model used by the name and address recognizers. Set `maskflow_patterns_only: true` to skip that pass and detect only the deterministic identifiers.

### 4. Make your first request

<Tabs>
<TabItem label="Masked request" value="masked">

```shell
curl -sSLX POST 'http://0.0.0.0:4000/v1/chat/completions' \
--header 'Authorization: Bearer sk-1234' \
--header 'Content-Type: application/json' \
--data '{
  "model": "gpt-4o",
  "messages": [
    {"role": "user", "content": "My PAN is ABCPE1234F, file my return"}
  ],
  "guardrails": ["maskflow"]
}'
```

The provider receives `My PAN is <PAN_1>, file my return`. The response returned to the caller has `ABCPE1234F` back in place, including when the response is streamed.

</TabItem>
<TabItem label="No PII" value="clean">

```shell
curl -sSLX POST 'http://0.0.0.0:4000/v1/chat/completions' \
--header 'Authorization: Bearer sk-1234' \
--header 'Content-Type: application/json' \
--data '{
  "model": "gpt-4o",
  "messages": [
    {"role": "user", "content": "What time zone is Mumbai in?"}
  ],
  "guardrails": ["maskflow"]
}'
```

Nothing matches, so the request and response pass through unchanged.

</TabItem>
</Tabs>

## What is masked

On the request, the guardrail walks `messages[].content` (a string, multimodal text parts, or Anthropic content blocks), the Anthropic top-level `system` field, `input` for embeddings, and `tool_calls[].function.arguments`. Tool-call arguments are parsed as JSON and only string and numeric values are masked, never the keys, so the argument object stays valid. Inbound tool results are masked through the same session rather than restored, so a value the model already saw as `<PAN_1>` keeps that token for the rest of the run.

On the response, `pre_call` masking is reversed in `choices[].message.content`, `reasoning_content`, `tool_calls[].function.arguments`, and the Anthropic native message shape. For streamed responses the restoration happens in the streaming iterator hook: a placeholder split across two chunks is buffered and stitched back together before the caller sees it, so a half-written token is never delivered.

## Sessions

Within a single request the mapping between a value and its token is always stable, so the same PAN that appears twice in one prompt gets one token. To keep that mapping stable across the turns of a conversation, the client names a session, either with a `maskflow_session_id` field in the request `metadata` or with an `X-Maskflow-Session: <id>` header. Without an id, each request uses a fresh session and tokens are not comparable between requests.

A single-worker proxy keeps sessions in memory and needs nothing further. When the proxy runs multiple workers or replicas, install `maskflow-litellm[redis]` and set `maskflow_redis_url` together with `maskflow_session_encryption_key`; the session snapshot is encrypted with AES-256-GCM before it is written to Redis and always carries a TTL.

## PII handling

The token-to-value map is held in memory by the guardrail, or as an encrypted snapshot in Redis. Only an opaque session reference is written to request metadata, never the mapping itself, and no original value is written to logs or error messages. The guardrail does not block a request for containing PII; masking is the whole behavior.

## Supported parameters

Every parameter is optional and is set under `litellm_params`.

| Parameter | Default | Description |
|---|---|---|
| `maskflow_min_confidence` | `0.5` | Detection score threshold |
| `maskflow_patterns_only` | `false` | `true` skips the spaCy NER pass; faster, drops bare-name and address detection |
| `maskflow_session_ttl_seconds` | `3600` | Lifetime of a named session |
| `maskflow_session_id_field` | `maskflow_session_id` | Request `metadata` field the client uses to name a session |
| `maskflow_redis_url` | none | Redis URL for cross-worker sessions; needs the `[redis]` extra and the key below |
| `maskflow_session_encryption_key` | none | base64 or hex AES-128/192/256 key for the Redis snapshot |

## Supported modes

MaskFlow uses `pre_call` and `post_call`, and both are required for the round trip. `pre_call` masks the request; `post_call` restores a non-streaming response and the streaming iterator hook restores a streamed one. There is no `during_call` mode, since the guardrail rewrites content rather than blocking.

## Further reading

- [maskflow-litellm on GitHub](https://github.com/maskflow/maskflow/tree/main/packages/maskflow-litellm)
- [Design notes and request flow](https://github.com/maskflow/maskflow/blob/main/docs/litellm-guardrail.md)
- [Measured per-entity accuracy](https://github.com/maskflow/maskflow/blob/main/bench/reports/indiapii-v1.0/results.md)
