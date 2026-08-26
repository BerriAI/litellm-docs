# Asqav - Verifiable Audit Log for LLM Calls

:::tip

This is community maintained. Please make an issue if you run into a bug:
https://github.com/BerriAI/litellm

:::

[Asqav](https://asqav.com) provides a tamper-evident local-first audit log for LLM calls. Every call is written to a local JSONL file, and each record carries a SHA-256 chain hash so the log can be verified offline with standard tools. No per-call network traffic is required.

The local log is the free floor: it lets you, the holder, recompute and check the chain. When you need a receipt an outside party can verify without trusting you, Asqav also signs receipts in the cloud. See [Local file vs. signed receipts](#local-file-vs-signed-receipts) for the difference.

:::info

This callback writes a local, tamper-evident log: the SHA-256 chain shows a record sequence was not altered, but the file is not signed and whoever holds it can recompute the chain after an edit. For receipts a third party can verify without trusting the holder, see the signed-receipts option in [Local file vs. signed receipts](#local-file-vs-signed-receipts).

:::

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

## Local file vs. signed receipts

The local log is tamper-evident: the SHA-256 chain links each record to the one before it, so a verifier can show a sequence was not altered. It is not signed, so whoever holds the file can edit a record and recompute the chain. That is enough for a local audit trail you control end to end. It does not let an outside party verify the log without trusting you.

When you want receipts an independent party can verify without trusting the holder, the Asqav SDK signs each receipt with ML-DSA-65 (FIPS 204, post-quantum) and exposes a public verification endpoint that needs no account.

| | Local callback (this page) | Asqav signed receipts |
|---|---|---|
| Cost | Free, offline, no signup | Opt-in via the Asqav SDK and an API key |
| Integrity | SHA-256 hash chain (tamper-evident) | ML-DSA-65 signature over each receipt |
| Verified by | The holder, offline | Any third party, no account needed |
| Network | None per call | Receipts issued via the Asqav API |

```bash
pip install asqav
```

The signed receipts and an offline verifier are documented at [asqav.com/docs](https://asqav.com/docs). Signatures can be checked at the public verify endpoint without an API key.

If you want the cloud-signed receipts as a LiteLLM callback rather than a separate step, install the `litellm` extra:

```bash
pip install asqav[litellm]
```

```python
import litellm
from asqav.extras.litellm import AsqavSigningLogger

litellm.callbacks = [AsqavSigningLogger(agent_name="my-agent")]
```

`AsqavSigningLogger` signs each call through the Asqav API and stitches the returned receipt into the same local JSONL index, so the chain and the third-party-verifiable receipts stay linked. See [`asqav/extras/litellm`](https://github.com/jagmarques/asqav-sdk/blob/main/python/src/asqav/extras/litellm.py).

## LiteLLM proxy config

```yaml
litellm_settings:
  success_callback: ["asqav"]
  failure_callback: ["asqav"]

environment_variables:
  ASQAV_LOG_PATH: "/var/log/litellm_audit.jsonl"
  ASQAV_REDACT_CONTENT: "true"
```
