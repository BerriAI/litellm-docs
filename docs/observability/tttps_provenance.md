# TTTPS Proof-of-Time

TTTPS (TLS TimeToken Provenance System) is a community project that attaches a cryptographic, independently verifiable timestamp to a completion response. The recipe below calls the public self-serve Provenance API at [kpp.kenosian.com](https://kpp.kenosian.com) from a `CustomLogger`, so it works with plain `pip install litellm httpx`; no separate package or proxy configuration is required.

A receipt proves when a response existed and that its content has not been altered since. It does not certify legal or regulatory compliance (EU AI Act, FDA, or similar); treat it as an audit-trail timestamp, not a compliance mark.

## Prerequisites

```bash
pip install litellm httpx
```

## Get an API key

Mint a free-tier key (1,000 seals/month) with an email address; no card or approval step:

```bash
curl -X POST https://kpp.kenosian.com/v1/keys \
  -H "Content-Type: application/json" \
  -d '{"email": "you@example.com", "use_case": "litellm callback"}'
```

The response includes `api_key` (shown once, store it) and the granted `quota`.

```bash
export KPP_API_KEY="kpp_prov_..."
```

## Quick Start

```python
import hashlib
import os
import time

import httpx
from litellm.integrations.custom_logger import CustomLogger
import litellm

KPP_API_KEY = os.environ.get("KPP_API_KEY", "")
KPP_BASE = os.environ.get("KPP_BASE", "https://kpp.kenosian.com")
KPP_TIMEOUT_S = float(os.environ.get("KPP_TIMEOUT_S", "1.0"))


def _seal(text: str) -> dict:
    """POST /v1/anchor. Never raises; failures degrade to a status dict
    so a logging outage never breaks the completion call (fail-open)."""
    digest = hashlib.sha256(text.encode("utf-8")).hexdigest()
    content_hash = f"sha256:{digest}"
    t0 = time.perf_counter()
    try:
        resp = httpx.post(
            f"{KPP_BASE}/v1/anchor",
            json={"content_hash": content_hash, "key": KPP_API_KEY},
            timeout=KPP_TIMEOUT_S,
        )
        elapsed_ms = (time.perf_counter() - t0) * 1000
        if resp.status_code == 200:
            body = resp.json()
            return {
                "status": "ok",
                "content_hash": content_hash,
                "receipt_id": body.get("receipt_id"),
                "receipt": body.get("receipt"),
                "time": body.get("time"),
                "verify_url": body.get("verify_url"),
                "remaining_quota": body.get("remaining"),
                "overhead_ms": round(elapsed_ms, 2),
            }
        if resp.status_code == 402:
            return {"status": "degraded", "reason": "quota_exhausted"}
        if resp.status_code == 403:
            return {"status": "degraded", "reason": "unknown_api_key"}
        return {"status": "degraded", "reason": f"http_{resp.status_code}"}
    except Exception as e:
        return {"status": "degraded", "reason": type(e).__name__}


def _extract_text(response_obj) -> str:
    try:
        return response_obj["choices"][0]["message"]["content"] or ""
    except Exception:
        return ""


class TTTPSProvenanceLogger(CustomLogger):
    """Attaches a sealed Proof-of-Time receipt to each completion response
    as `.tttps_receipt`, without touching response.choices[*].message.content."""

    def log_success_event(self, kwargs, response_obj, start_time, end_time):
        text = _extract_text(response_obj)
        if text:
            response_obj.tttps_receipt = _seal(text)

    async def async_log_success_event(self, kwargs, response_obj, start_time, end_time):
        text = _extract_text(response_obj)
        if text:
            response_obj.tttps_receipt = _seal(text)


litellm.callbacks = [TTTPSProvenanceLogger()]

response = litellm.completion(
    model="gpt-3.5-turbo",
    messages=[{"role": "user", "content": "Hi"}],
)

print(response.tttps_receipt)
```

`response_obj` (a `litellm.types.utils.ModelResponse`) accepts attribute assignment even though it does not support item assignment, and pydantic's `extra="allow"` makes the attached field readable back either as `response_obj.tttps_receipt` or `response_obj["tttps_receipt"]`.

## What comes back

A successful seal returns:

| Field | Description |
|-------|-------------|
| `receipt_id` | Identifier to re-verify the receipt later |
| `receipt` | HMAC-SHA256 signature over the sealed time and content hash |
| `time` | Sealed timestamp, UTC ISO-8601 |
| `verify_url` | Relative path to re-verify (`/v1/verify?receipt_id=...`) |
| `remaining_quota` | Seals left on the free tier this billing period |

## Verifying a receipt

```bash
curl -X POST https://kpp.kenosian.com/v1/verify \
  -H "Content-Type: application/json" \
  -d '{"receipt_id": "<receipt_id from the anchor response>"}'
```

This re-derives the HMAC signature from the stored timestamp and content hash server-side and returns `verified: true` or `false`; it does not require the original API key.

## Failure handling

Every branch in `_seal` returns a dict instead of raising, so a KPP outage or an exhausted quota degrades the receipt instead of breaking the underlying `completion()` call. Check `receipt["status"]` before relying on the fields above.

## Related Links

- [KPP Provenance API](https://kpp.kenosian.com/docs)
- [Custom Callbacks](./custom_callback.md)
