# SZL Evidence (signed receipts)

[szl-evidence-litellm](https://github.com/szl-holdings/szl-evidence-litellm) is an open-source LiteLLM callback that writes a tamper-evident receipt for every LLM request: a content-addressed `GovernedAction/v1` document whose id is the sha256 of its own canonical (RFC 8785) body, appended to an append-only hash chain. It runs entirely in-process and writes to local files; no external service or account is required.

**Key Features:**

- **Receipt per request** - one receipt per logical call, plus one per retry/fallback attempt, with the model, provider, usage and finish reason
- **Hash chain** - `seq` / `prev` / `entry_digest` links make reorder, truncation, replay and field-level edits detectable by an offline verifier
- **Fail-open or fail-closed** - an explicit policy decides whether a request proceeds when the evidence layer fails; the policy's hash is embedded in each receipt
- **Privacy by default** - prompt and response bodies are never stored unless `SZL_CAPTURE_BODIES=1`; receipts carry their sha256 digests
- **Correlation header** - the proxy returns the receipt id as `x-szl-receipt-id`

## Pre-Requisites

```bash
pip install szl-evidence-litellm litellm
```

Python 3.11+. The package is Apache-2.0 and released from GitHub Actions through PyPI Trusted Publishing.

## Quick Start (SDK)

```python
import litellm
from szl_evidence_litellm import EvidencePolicy, EvidenceSink, FailMode, SZLEvidenceLogger

policy = EvidencePolicy(fail_mode=FailMode.FAIL_OPEN)          # or FailMode.FAIL_CLOSED
sink = EvidenceSink("./evidence", policy=policy)                 # receipts.jsonl lands here
litellm.callbacks = [SZLEvidenceLogger(sink=sink, policy=policy)]

response = litellm.completion(
    model="gpt-4o-mini",
    messages=[{"role": "user", "content": "hi"}],
)
```

Each call appends a receipt to `./evidence/receipts.jsonl`. Receipts are built synchronously (sha256 only, no I/O on the request path) and persisted by a background flusher in batches.

## Usage with LiteLLM Proxy

1. Add the callback to your config:

```yaml
model_list:
  - model_name: gpt-4o-mini
    litellm_params:
      model: gpt-4o-mini
      api_key: os.environ/OPENAI_API_KEY

litellm_settings:
  callbacks: szl_evidence_litellm.plugin.evidence_logger
```

2. Start the proxy with the sink enabled:

```bash
SZL_EVIDENCE_LOGGER=1 \
SZL_SINK_DIR=/var/lib/szl/evidence \
SZL_FAIL_MODE=fail_open \
litellm --config config.yaml --port 4000
```

3. Make a request and read the correlation id from the response headers:

```bash
curl -s -D - http://127.0.0.1:4000/v1/chat/completions \
  -H "Authorization: Bearer sk-1234" \
  -H "content-type: application/json" \
  -d '{"model": "gpt-4o-mini", "messages": [{"role": "user", "content": "hi"}]}' | grep -i x-szl-receipt-id
```

The `evidence_logger` singleton is only created when `SZL_EVIDENCE_LOGGER=1`, so importing the package elsewhere has no side effects.

## Configuration

| Environment variable | Default | Meaning |
|---|---|---|
| `SZL_EVIDENCE_LOGGER` | unset | Set to `1` to create the proxy callback singleton |
| `SZL_SINK_DIR` | `./szl-evidence` | Directory for `receipts.jsonl`, `drops.jsonl` and optional `bodies/` |
| `SZL_FAIL_MODE` | `fail_open` | `fail_open` (request proceeds if evidence fails) or `fail_closed` (request is refused) |
| `SZL_REQUIRE_RECEIPT` | unset | With `fail_closed`, block the response until the receipt is built |
| `SZL_CAPTURE_BODIES` | unset | Set to `1` to store request/response bodies content-addressed under `bodies/` |
| `SZL_QUEUE_MAXSIZE` | `10000` | Bounded in-process queue; on backpressure `fail_open` drops and counts, `fail_closed` refuses |

## Verifying receipts

```bash
python -m szl_evidence_litellm verify --sink ./evidence
```

The verifier re-hashes every receipt, replays the chain and reports the first broken link, if any. See the [project README](https://github.com/szl-holdings/szl-evidence-litellm/tree/main/packages/szl-evidence-litellm#readme) for the fail-open / fail-closed matrix and the OpenTelemetry GenAI attribute mapping.

## Support

- GitHub issues: https://github.com/szl-holdings/szl-evidence-litellm/issues
- PyPI: https://pypi.org/project/szl-evidence-litellm/
