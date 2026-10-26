# FlowSpeech

[FlowSpeech](https://flowspeech.io/) converts text to speech. This adapter submits a public API v1 job, polls until it finishes, and downloads the recording as binary WAV audio

:::note Availability
This page requires the v1 implementation in [LiteLLM PR #38498](https://github.com/BerriAI/litellm/pull/38498). The companion documentation is [docs PR #1454](https://github.com/BerriAI/litellm-docs/pull/1454). These examples require a checkout containing that implementation until it is merged and released
:::

| Property | Value |
| --- | --- |
| Provider prefix | `flowspeech/` |
| Model route | `flowspeech/flowspeech-tts` |
| LiteLLM endpoint | `/audio/speech` |
| Default voice | `Kore` |
| Output | WAV, 24 kHz, mono, 16 bit |
| Public API version | v1 |

## Authentication and Endpoint

Set `FLOWSPEECH_API_KEY` in the server-side SDK process or proxy. Generation requires a developer API key, an active paid Basic, Pro or Scale subscription, and sufficient available credits. Browser cookies and plugin login tokens do not authenticate the public API

`FLOWSPEECH_API_BASE` defaults to `https://flowspeech.io`. An override may be an HTTPS origin, a trusted gateway path prefix, or the complete `/api/v1/tts/jobs` endpoint, with no embedded credentials, query or fragment. For example, `https://gateway.example/flowspeech/` resolves to `https://gateway.example/flowspeech/api/v1/tts/jobs`. Only configure a trusted endpoint because it receives the key and input text. API and audio redirects are rejected.

Explicit `api_key` and `api_base` arguments override environment variables. A configured `litellm.api_key` also takes precedence over `FLOWSPEECH_API_KEY`

## Python SDK

```python
import uuid
import litellm

request_id = str(uuid.uuid4())
print("FlowSpeech request_id:", request_id)

audio = litellm.speech(
    model="flowspeech/flowspeech-tts",
    input="The next section explains how to review an audio draft.",
    voice="Kore",
    response_format="wav",
    request_id=request_id,
    timeout=600,
    max_retries=2,
)

print("FlowSpeech job_id:", audio.response.headers["x-flowspeech-job-id"])
with open("speech.wav", "wb") as output:
    output.write(audio.content)
```

The return value is LiteLLM's `HttpxBinaryResponseContent`, with `content-type: audio/wav`, `x-flowspeech-request-id`, and `x-flowspeech-job-id` response headers. Audio is downloaded from `result.url`, without API Authorization, cookies or custom API headers. No base64 conversion is needed

Use `await litellm.aspeech(...)` with the same arguments in asynchronous code. Its requests, polling waits and audio download are asynchronous. Cancelling the local call stops waiting but does not cancel the server job

## Multiple Speakers

Supply `segments` with an empty `input` and omit the top-level `voice`

```python
import uuid
import litellm

audio = litellm.speech(
    model="flowspeech/flowspeech-tts",
    input="",
    segments=[
        {"speaker": "Alice", "text": "Welcome!", "voiceName": "Kore"},
        {"speaker": "Bob", "text": "Thanks for having me.", "voiceName": "Puck"},
    ],
    request_id=str(uuid.uuid4()),
    timeout=600,
)

with open("conversation.wav", "wb") as output:
    output.write(audio.content)
```

A speaker is a label you choose, while `voiceName` selects a case-sensitive FlowSpeech voice. Use the same label and voice for each turn by that character

## Proxy

Configure the model and supply `FLOWSPEECH_API_KEY` and `LITELLM_MASTER_KEY` through your deployment's secret configuration

```yaml
model_list:
  - model_name: flowspeech-narration
    litellm_params:
      model: flowspeech/flowspeech-tts
      api_key: os.environ/FLOWSPEECH_API_KEY
      timeout: 600
      max_retries: 2

general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
```

Start the proxy with your configuration

```bash
litellm --config config.yaml
```

Generate a request ID once and retain it for retries of this unchanged request. Send the request using the LiteLLM proxy key, not the provider key

```bash
FLOWSPEECH_REQUEST_ID="$(uuidgen)"
curl --fail-with-body http://localhost:4000/v1/audio/speech \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"model\":\"flowspeech-narration\",\"input\":\"Welcome to the audio guide.\",\"voice\":\"Kore\",\"response_format\":\"wav\",\"request_id\":\"$FLOWSPEECH_REQUEST_ID\"}" \
  --output speech.wav
```

A reverse proxy must allow the request to remain open for the configured generation timeout. Reuse the same `request_id` for any caller or router retries; a new ID means a new recording

## Parameters and Limits

Single-speaker input maps to `{"input":{"mode":"single","text":input,"voiceName":voice}}`. Multi-speaker input maps to `{"input":{"mode":"multi","segments":segments}}`. The `flowspeech-tts` suffix selects the LiteLLM route and is never sent as a provider-side model field

`response_format` may be omitted or set to `wav`. Other formats, speed, instructions, streaming, separate prompts, legacy speaker fields and provider model selections are rejected instead of silently ignored, including when parameter dropping is enabled. Use FlowSpeech voice names; OpenAI voice names are not translated

The adapter waits at least five seconds between pending status checks, and honors a longer numeric or HTTP-date `Retry-After`, including on rate limits. `timeout` is a finite positive total budget for submission, retries, polling and download; it defaults to LiteLLM's configured request timeout. When passing `httpx.Timeout`, its finite `read` value is the total budget and individual phase timeouts are bounded by the remaining budget

`max_retries` allows zero to ten retries per HTTP operation. Creation retries preserve the same UUID and exact JSON body. Transient transport failures, rate limits, and retryable server errors are retried within the total budget. Download retries reuse the result URL and never create another job. JSON responses and request bodies are limited to 1 MiB, and audio downloads to 100 MiB. The downloaded WAV encoding and completeness are validated

The adapter raises errors for failed or cancelled jobs, unknown statuses, invalid IDs, malformed results, unsafe URLs and deleted recordings. An HTTP 200 status response alone is not generation success. Exceptions include the request ID and known job ID, plus the server error code and trace ID when present

Every job response must contain a canonical UUID `requestId` matching the submitted request and valid nonnegative integer usage counters. UUID comparison normalizes case. LiteLLM's `post_call` runs once after the downloaded WAV passes validation, with only job/request IDs, status and usage in the response log; it does not include API credentials, audio bytes or the storage URL

## Recovery and Account Checks

Pass your own UUID as `request_id` and retain it before starting the call. Alternatively, supply `Idempotency-Key` in `extra_headers`; both values must agree when supplied together. Without either, the adapter generates a UUID. Reuse the original ID and unchanged input after an interruption, including after a download failure. Replaying the create request finds the existing recording rather than generating another one

Use the [FlowSpeech public API guide](https://flowspeech.io/docs/public-api) for account and job management. These operations are outside the LiteLLM speech adapter: `GET /api/v1/quota` returns `quota`, `subscription` and `limits`; `GET /api/v1/voices` returns a `voices` array; `GET /api/v1/tts/jobs?requestId=UUID` recovers a job; and `POST /api/v1/tts/jobs/{id}/cancel` requests cancellation. Send Bearer authentication to these API endpoints, but never to the audio URL

## Migration Changelog

### Public API v1 (Unreleased)

:::danger Breaking Changes
**The retired synchronous endpoint and base64 response are replaced by submit, poll and download.** The adapter now uses `/api/v1/tts/jobs` and returns WAV only. Update custom API bases, save files with a `.wav` extension, allow a longer request timeout, and rotate legacy keys as directed in API settings. Unsupported options that were previously ignored now raise errors. See [implementation PR #38498](https://github.com/BerriAI/litellm/pull/38498)
:::

This migration adds asynchronous polling, multi-speaker input, stable request IDs, bounded retries and downloads, and explicit terminal-state handling. It does not assign a new LiteLLM package version: upstream maintainers control that release. Local mock transport tests verify protocol behavior, not live account access or voice quality
