# Asqav - Local-First Audit Log

:::tip

This is community maintained. Please make an issue if you run into a bug:
https://github.com/BerriAI/litellm

:::

[Asqav](https://asqav.com) provides a tamper-evident local-first audit log for LLM calls. Every call is written to a local JSONL file, and each record carries a SHA-256 chain hash so the log can be verified offline with standard tools. No per-call network traffic is required.

## Quick start

Set `ASQAV_LOG_PATH` to choose where the file lands (default: `~/.litellm_asqav_audit.jsonl`), then add `asqav` to `success_callbacks` and `failure_callbacks`:

```python
import litellm
import os

os.environ["ASQAV_LOG_PATH"] = "/var/log/litellm_audit.jsonl"

litellm.success_callbacks = ["asqav"]
litellm.failure_callbacks = ["asqav"]

response = litellm.completion(
    model="gpt-3.5-turbo",
    messages=[{"role": "user", "content": "Hello"}],
)
```

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `ASQAV_LOG_PATH` | `~/.litellm_asqav_audit.jsonl` | Path to the JSONL audit log |
| `ASQAV_REDACT_CONTENT` | `"true"` | Set to `"false"` to store message and response text in the clear instead of as SHA-256 digests |

## Log format

Each line in the log is a JSON object. Fields:

| Field | Description |
|---|---|
| `seq` | Monotonically increasing call counter, resumed across restarts |
| `ts` | ISO 8601 UTC timestamp |
| `prev_hash` | SHA-256 of the previous record (genesis sentinel for the first record) |
| `record_hash` | SHA-256 of this record's canonical fields |
| `call_id` | LiteLLM call identifier |
| `model` | Model string |
| `status` | `"success"` or `"failure"` |
| `latency_ms` | End-to-end latency in milliseconds |
| `prompt_tokens` / `completion_tokens` / `total_tokens` | Token counts |
| `messages_digest` | SHA-256 of the messages array (omitted when `ASQAV_REDACT_CONTENT=false`) |
| `response_content_digest` | SHA-256 of the response text (omitted when `ASQAV_REDACT_CONTENT=false`) |
| `finish_reason` | Model finish reason |
| `provider_request_id` | Provider request ID if available |
| `metadata` | String-keyed metadata from the call |

## Verifying the log

```python
from litellm.integrations.asqav import AsqavLogger

logger = AsqavLogger(log_path="/var/log/litellm_audit.jsonl")
ok, message = logger.verify_chain()
print(ok, message)  # True ok
```

`verify_chain` checks that every record's hash matches its content and that `prev_hash` links correctly to the previous record. Any missing or modified record causes it to return `(False, reason)`.

## LiteLLM proxy config

```yaml
litellm_settings:
  success_callback: ["asqav"]
  failure_callback: ["asqav"]

environment_variables:
  ASQAV_LOG_PATH: "/var/log/litellm_audit.jsonl"
  ASQAV_REDACT_CONTENT: "true"
```
