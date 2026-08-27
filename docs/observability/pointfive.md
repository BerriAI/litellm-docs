# PointFive

LiteLLM can ship proxy request logs to [PointFive](https://www.pointfive.co) for AI cost and usage analysis. Logs are buffered and uploaded through a presigned URL that the PointFive API issues per batch, so the proxy holds no cloud credentials of its own and runs unchanged wherever it is hosted.

## Overview

| Property | Details |
|----------|---------|
| Callback name | `pointfive` |
| Destination | PointFive, via a presigned upload URL issued per batch |
| Data format | gzip-compressed NDJSON, one line per request |
| Upload trigger | every `flush_interval` seconds, or as soon as `batch_size` records are queued |
| Authentication | PointFive API key |

## Prerequisites

You need a PointFive account and an API key. Add the LiteLLM integration in the PointFive app; it issues the key that this callback uses to request upload URLs.

## Setup

### Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `POINTFIVE_API_KEY` | Yes | PointFive API key |
| `POINTFIVE_API_URL` | No | PointFive API endpoint; defaults to `https://api.pointfive.co/api/v1/ingestion` |

### Proxy config

```yaml
model_list:
  - model_name: {{openai_small}}
    litellm_params:
      model: openai/{{openai_small}}
      api_key: os.environ/OPENAI_API_KEY

litellm_settings:
  callbacks: ["pointfive"]
```

```bash
export POINTFIVE_API_KEY="<your-api-key>"
litellm --config /path/to/config.yaml
```

### Setup on the UI

You can enable the callback from the admin UI instead of `config.yaml`. Open `Settings`, then `Logging & Alerts`, add `PointFive`, and paste your API key. Leave the URL field blank to use the default endpoint. See the [admin UI docs](https://docs.litellm.ai/docs/proxy/ui) for how to reach these screens.

## Tuning the batching

All settings are optional and can be given under `pointfive_params`. Secrets can be referenced with `os.environ/`.

```yaml
litellm_settings:
  callbacks: ["pointfive"]
  pointfive_params:
    api_key: os.environ/POINTFIVE_API_KEY
    api_url: https://api.pointfive.co/api/v1/ingestion
    batch_size: 10000
    flush_interval: 300
    max_batch_bytes: 8388608
    max_upload_retries: 3
```

| Setting | Default | Description |
|---------|---------|-------------|
| `api_key` | unset | Falls back to `POINTFIVE_API_KEY`. The callback refuses to start without a key |
| `api_url` | `https://api.pointfive.co/api/v1/ingestion` | Falls back to `POINTFIVE_API_URL` |
| `batch_size` | `10000` | Queued records that trigger a flush before the interval elapses |
| `flush_interval` | `300` | Seconds between flushes |
| `max_batch_bytes` | `8388608` | Uncompressed size bound per uploaded object. A flush larger than this is split into several objects |
| `max_upload_retries` | `3` | Attempts per object, with exponential backoff between them |

The defaults trade freshness for fewer, larger uploads, since every flush becomes at least one object.

### Redacting prompts and responses

Set `turn_off_message_logging` to leave prompts and responses out of what gets uploaded. Metadata such as model, token counts, latency, and spend is still sent.

```yaml
litellm_settings:
  callbacks: ["pointfive"]
  pointfive_params:
    turn_off_message_logging: true
```

## How it works

Each flush serializes the queued records to NDJSON, splits them into objects no larger than `max_batch_bytes`, gzips each object off the event loop, and asks the PointFive API for an upload URL sized to exactly those bytes before PUTting them. Every retry requests a fresh URL, so an expired or already-consumed URL is never reused, and PointFive picks the object key, so the proxy never chooses where its data lands.

Delivery is at-least-once. A failure that is worth retrying keeps the batch queued for the next flush, which can re-send an object that already landed; a rejection the server would refuse again drops that object rather than blocking every record queued behind it. When a flush finds nothing queued, the callback reports that it is still alive, so an idle proxy is distinguishable from one that has stopped shipping.

## Verification

Run the proxy with `LITELLM_LOG=DEBUG` and send a request. Each upload logs the compressed size and the key it landed at:

```log
pointfive: uploaded 5182 gzipped bytes to <object-key>
```

Failures are logged as warnings or errors on the same `pointfive:` prefix, including whether the batch was kept for a later flush or dropped.

## Related links

- [PointFive](https://www.pointfive.co)
- [Proxy logging guide](https://docs.litellm.ai/docs/proxy/logging)
