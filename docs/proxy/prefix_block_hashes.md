---
title: Prefix Block Hash IDs
description: Record keyed prompt-prefix block IDs in spend logs for synthetic traffic replay without retaining prompt text.
---

# Prefix Block Hash IDs

<SinceVersion v="1.111.0" />

The opt-in `prefix_block_hashes` callback records which requests share a prompt prefix without storing that prompt in the hash metadata. Use these IDs with the input and output token counts already in spend logs to prepare Mooncake-style traces for production traffic replay, such as benchmarks with AIPerf or a trace conversion workflow for GuideLLM. This callback does not export a trace or replay traffic itself.

Each ID represents a block of tokens and all blocks before it. Requests with the same tokenized prefix share leading IDs and diverge after their inputs differ. The callback uses chained HMAC-SHA256 digests, truncated to 16 hexadecimal characters per ID, and includes the final partial block.

## Enable the callback

Set a dedicated, high-entropy secret in the proxy's process environment. For example, generate one before starting the proxy:

```bash
export LITELLM_PREFIX_BLOCK_HASHES_SECRET="$(openssl rand -hex 32)"
```

Keep this value in your secret manager and reuse it across workers and restarts when you need comparable IDs. It has no fallback to `LITELLM_SALT_KEY` or the master key. Changing the secret changes the IDs.

Add the callback to your existing proxy configuration and restart the proxy:

```yaml
litellm_settings:
  callbacks: ["prefix_block_hashes"]
```

Use a database-backed proxy with [spend tracking](./cost_tracking.md) enabled to retain the IDs in `LiteLLM_SpendLogs`. The callback does not enable prompt storage, disable other logging callbacks, or change your existing prompt-retention settings. Review those settings separately if prompts must not be retained.

The default block size is 512 tokens. To use a different size, set `LITELLM_PREFIX_BLOCK_HASHES_BLOCK_SIZE` before startup, then restart:

```bash
export LITELLM_PREFIX_BLOCK_HASHES_BLOCK_SIZE=64
```

The optional `LITELLM_PREFIX_BLOCK_HASHES_MAX_CHARS` setting limits the serialized prompt length before tokenization. Its default is 65,536 characters, or `TOKEN_COUNTER_MAX_EXACT_CHARS` if that is lower. It accepts positive integers up to `TOKEN_COUNTER_MAX_EXACT_CHARS`; it is a character budget, not a token limit. Set it before startup and restart the proxy:

```bash
export LITELLM_PREFIX_BLOCK_HASHES_MAX_CHARS=32768
```

## Read the IDs from spend logs

Both streaming and non-streaming chat requests write to `metadata.spend_logs_metadata.prefix_block_hashes` in the spend log row. Existing `spend_logs_metadata` entries are preserved. An illustrative row, with unrelated fields omitted, looks like this:

```json
{
  "startTime": "2026-11-17T00:00:00.000Z",
  "prompt_tokens": 655,
  "completion_tokens": 52,
  "metadata": {
    "spend_logs_metadata": {
      "prefix_block_hashes": {
        "block_size": 512,
        "hash_ids": ["a1b2c3d4e5f60718", "b2c3d4e5f6071829"]
      }
    }
  }
}
```

These are content-derived fingerprints, not a guarantee of anonymity. Readers can compare prefixes within the same secret and tokenization setup. Protect the secret and restrict access to the logs.

## When hashing is skipped

Hashing is optional and fails open. A missing or empty secret, a serialized prompt over the character budget, or a serialization or tokenizer error leaves the request unchanged. These conditions do not fail the model request; skip and error details are logged at debug level.

The callback also skips hashing when the logging path redacts messages, including global `litellm_settings.turn_off_message_logging: true` and applicable per-request redaction controls. For client-supplied `turn_off_message_logging`, the deployment must explicitly allow that field through `litellm_params.configurable_clientside_auth_params`, for example:

```yaml
model_list:
  - model_name: replay-model
    litellm_params:
      model: openai/{{openai_small}}
      api_key: os.environ/OPENAI_API_KEY
      configurable_clientside_auth_params: ["turn_off_message_logging"]
```

A client can then send `"turn_off_message_logging": true` in the request body. Without the required client-side permission, proxy authentication can reject the override before the callback runs. The callback's fail-open behavior does not bypass authentication. See [message logging controls](./logging.md#redact-messages-response-content) for the global setting and header controls.

Worker admission is bounded by `TOKEN_COUNTER_MAX_CONCURRENT_COUNTS`, which defaults to 4 per process. If all hash slots are occupied, the request skips hashing instead of queuing for a slot. Non-chat call types and requests without a non-empty `messages` list are also left unchanged. The supported call types are `completion` and `acompletion`.

## Convert rows to a Mooncake trace

[AIPerf's Mooncake trace format](https://docs.nvidia.com/aiperf/dev/benchmark-modes/trace-replay-with-mooncake-traces) uses `timestamp` for arrival time in milliseconds, `input_length` and `output_length` for token counts, and optional integer `hash_ids`. Convert the hexadecimal IDs to integers rather than passing the strings through.

The following script reads a JSON array of exported spend log rows from standard input and writes JSONL. It skips rows without IDs, handles metadata exported as either an object or a JSON string, and makes timestamps relative to the first retained request. Export rows from one model/tokenizer setup, secret, and block size for a comparable trace.

```python
import json
import sys
from datetime import datetime

records = []
for row in json.load(sys.stdin):
    metadata = row["metadata"]
    if isinstance(metadata, str):
        metadata = json.loads(metadata)
    hashes = (metadata or {}).get("spend_logs_metadata", {}).get("prefix_block_hashes")
    if hashes and hashes["hash_ids"]:
        started = datetime.fromisoformat(row["startTime"].replace("Z", "+00:00"))
        records.append((started, row, hashes))

records.sort(key=lambda record: record[0])
for started, row, hashes in records:
    print(json.dumps({
        "timestamp": (started - records[0][0]).total_seconds() * 1000,
        "input_length": row["prompt_tokens"],
        "output_length": row["completion_tokens"],
        "hash_ids": [int(value, 16) for value in hashes["hash_ids"]],
    }))
```

Save it as `spend_to_mooncake.py` and run `python3 spend_to_mooncake.py < spend_rows.json > mooncake.jsonl`. An empty input array or an export with no hash-bearing rows produces no trace entries. Use successful rows with recorded token usage. Match your replay tool's synthetic block configuration to the stored `block_size`; the four-field trace above does not carry it. Other tools, including GuideLLM, can require their own import or conversion step.

## Tokenizer and replay limits

The callback serializes tools first as sorted-key JSON, then each message's role and text, plus `tool_calls`, `tool_call_id`, and `name` when present. It keeps text parts from list content and ignores non-text parts such as images. Tokenization uses LiteLLM's model-based `encode` selection with its default-encoding fallback.

This is a deterministic representation, not the provider's exact chat template. Provider input token counts can differ from the serialized token count, so `len(hash_ids)` need not equal the provider's `prompt_tokens` divided into blocks. Use the spend row's actual token counts for trace lengths and treat prefix IDs as an approximation of sharing, not a prediction of cache hits. Replay synthesizes content rather than recovering original prompts. Keep the tokenizer, serialization, block size, and secret consistent when comparing IDs.
