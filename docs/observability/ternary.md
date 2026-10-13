# Ternary

LiteLLM can export proxy spend data to [Ternary](https://ternary.app) as [FOCUS 1.2](https://focus.finops.org/) formatted cost reports. This lets you allocate and analyse LLM spend alongside your cloud costs in Ternary's FinOps platform — for example, splitting a shared AI invoice across teams, projects, and API keys.

## Overview

| Property | Details |
|----------|---------|
| Destination | Export LiteLLM usage data to a Ternary AI Gateway cost connection |
| Data format | FOCUS CSV (automatically transformed from LiteLLM spend data) |
| Supported operations | Automatic scheduled export (daily; interval for setup validation) |
| Authentication | Ternary API key + connection ID (per-connection bearer token) |
| Privacy | Cost and usage metadata only — no prompt or completion content leaves the gateway |

## Prerequisites

You need three values from Ternary:

1. **Connection ID** (`TERNARY_CONNECTION_ID`) — identifies the cost connection the data lands in; it appears in the export URL path.
2. **API Key** (`TERNARY_API_KEY`) — a per-connection bearer token that authenticates the push.
3. **API host** (`TERNARY_BASE_URL`) — your Ternary API host, which differs by region (US vs EU).

The Connection ID and API Key are minted when you add an **AI Gateway** integration in Ternary (**Settings → Integrations → Add integration → AI Gateway**). The API host is the base URL of the Ternary instance you sign in to — the US and EU regions have different hosts.

## Setup

### Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `TERNARY_API_KEY` | Yes | Per-connection bearer token from the Ternary AI Gateway integration |
| `TERNARY_CONNECTION_ID` | Yes | Cost connection identifier (used in the export URL path) |
| `TERNARY_BASE_URL` | Yes | Your Ternary API host (region-specific, US vs EU). No default is assumed. |
| `TERNARY_EXPORT_FREQUENCY` | No | `daily` (default), or `interval` for short setup-validation loops. LiteLLM spend is a daily aggregate, so there is no sub-daily cadence. |
| `TERNARY_EXPORT_INTERVAL_SECONDS` | No | Seconds between exports when frequency is `interval` (intended for short setup-validation / test loops) |

### Proxy config

```yaml
model_list:
  - model_name: gpt-4o
    litellm_params:
      model: openai/gpt-4o
      api_key: sk-your-key

litellm_settings:
  callbacks: ["ternary"]
```

```bash
export TERNARY_API_KEY="<your-connection-api-key>"
export TERNARY_CONNECTION_ID="<your-connection-id>"
export TERNARY_BASE_URL="<your-ternary-api-host>"   # region-specific (US vs EU)
litellm --config /path/to/config.yaml
```

The proxy registers a background job that exports FOCUS-formatted spend data on the configured schedule.

## How it works

On each scheduled run LiteLLM transforms recent spend into FOCUS 1.2 CSV and uploads **one file per UTC day** in the export window:

1. **Request an upload URL.** For each day with data, LiteLLM calls `POST {TERNARY_BASE_URL}/external-cost-sources/v1/{TERNARY_CONNECTION_ID}/upload-url` with `Authorization: Bearer {TERNARY_API_KEY}` and the body `{"day": "YYYY-MM-DD"}`. Ternary returns a short-lived signed Google Cloud Storage URL for exactly that day's file, plus the headers the upload must carry.
2. **Upload the day.** LiteLLM `PUT`s that day's CSV straight to the signed URL with the returned headers. The CSV never passes through Ternary's API.

Each day maps to one file, so re-sending a day replaces it rather than double-counting. If one day's upload fails, the remaining days still upload; the next scheduled run re-sends the window, so a missed day catches up on its own.

## Privacy

Only cost and usage **metadata** is exported — spend, token counts, model, provider, and team/key identifiers. Prompt and completion **content never leaves the gateway**.

## Cost provenance (estimate vs. billed)

Gateway-reported spend is a rate-card **estimate**, not a billed invoice. Ternary tags every row landed through this connection with its provenance (a cost source of `"LiteLLM estimate"`), derived server-side from the connection — so estimated gateway spend is never mistaken for, or reallocated as, billed cloud cost. Keep the gateway's spend scoped as the estimate it is to avoid double-counting against a separate provider invoice.

## FOCUS field mapping

LiteLLM spend data is transformed into the FOCUS 1.2 schema (the same shared transformer used by the other FOCUS destinations):

| LiteLLM field | FOCUS column | Description |
|---------------|--------------|-------------|
| `spend` | BilledCost, EffectiveCost, ListCost, ContractedCost | Cost of the usage (gateway estimate) |
| `model` | ChargeDescription, ResourceId | Model identifier |
| `model_group` | ServiceName | Model group / deployment |
| `custom_llm_provider` | ProviderName, PublisherName | Provider (openai, anthropic, …) |
| `api_key` | BillingAccountId | Hashed API key |
| `api_key_alias` | BillingAccountName | Human-readable key alias |
| `team_id` | SubAccountId | Team identifier |
| `team_alias` | SubAccountName | Team name |
| `organization_id` / `organization_alias` | Tags | Organization identifier / display name |

### Token breakdown

Per-request token counts — `prompt_tokens`, `completion_tokens`, `cache_read_input_tokens`, `cache_creation_input_tokens` — which the shared FOCUS transformer does not surface as top-level columns, are carried in the standard FOCUS **`Tags`** column as JSON. Ternary reads them from `Tags` on ingest to enable token-weighted cost allocation. Other metadata (`user_id`, `user_email`, `model`, …) also rides in `Tags`.

## Related Links

- [Ternary](https://ternary.app)
- [FOCUS Specification](https://focus.finops.org/)
- [Focus Export (S3 / GCS / Parquet)](./focus.md)
