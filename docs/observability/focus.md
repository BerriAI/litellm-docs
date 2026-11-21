---
title: "FOCUS Cost Export for LiteLLM: S3 and GCS"
sidebar_label: "Focus Export (Experimental)"
description: "Export LiteLLM AI Gateway usage in the FinOps FOCUS format to an S3 or GCS bucket, set up with environment variables and config.yaml (experimental)."
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Focus Export (Experimental)

:::warning[Experimental feature]
Focus Format export is under active development and currently considered experimental.
Interfaces, schema mappings, and configuration options may change as we iterate based on user feedback.
Please treat this integration as a preview and report any issues or suggestions to help us stabilize and improve the workflow.
:::

LiteLLM can emit usage data in the [FinOps FOCUS format](https://focus.finops.org/) and push artifacts (for example Parquet files) to destinations such as Amazon S3 or Google Cloud Storage. This enables downstream cost-analysis tooling to ingest a standardised dataset directly from LiteLLM.

The experimental export follows the [FOCUS 1.5 release candidate Cost and Usage dataset](https://github.com/FinOps-Open-Cost-and-Usage-Spec/FOCUS_Spec/tree/v1.5-cr/specification/datasets/cost_and_usage).

## Export columns and request meter

`ServiceProviderName` and `HostProviderName` replace `ProviderName` and `PublisherName`. Both contain the LiteLLM provider name. `InvoiceIssuerName` remains available.

`PrincipalId` identifies the user. `CredentialId` contains the stored hashed API key, not an authenticating key. `RequesterDetails` is a JSON array with a Principal entry when a user ID exists and a Credential entry when a credential ID exists. Known user emails and key aliases supply descriptive attributes; unknown attributes are omitted. The column is null when neither ID exists.

Each row represents one daily per-key/model request meter. Rows are not split by token direction or cache action, because the daily spend aggregate combines their costs. `PricingQuantity` and `ConsumedQuantity` both contain the request count; `PricingUnit` and `ConsumedUnit` are `Requests`.

`SkuId` is a LiteLLM-defined stable identifier formed as `provider/model`. `SkuPriceId` adds `/requests` to identify the combined request meter, not an individual token price. These IDs do not include account identifiers or price amounts and are null if the provider or model is unknown. `SkuPriceDetails` is a JSON object with the FOCUS-defined `ModelId` property, set to the model. It is null when `SkuPriceId` is null and does not include `TokenDirection` or `TokenCacheAction`.

The Vantage destination removes columns outside its supported allowlist, including the SKU and requester details columns, before upload.

## Overview

| Property | Details |
|----------|---------|
| Destination | Export LiteLLM usage data in FOCUS format to managed storage (S3, GCS) |
| Callback name | `focus` |
| Supported operations | Automatic scheduled export |
| Data format | FOCUS Normalised Dataset (Parquet or CSV) |

## Environment Variables

### Common settings

| Variable | Required | Description |
|----------|----------|-------------|
| `FOCUS_PROVIDER` | No | Destination provider. One of `s3`, `gcs`, `vantage`. Defaults to `s3`. |
| `FOCUS_FORMAT` | No | Output format. One of `parquet`, `csv`. Defaults to `parquet`. |
| `FOCUS_FREQUENCY` | No | Export cadence. Prefer `hourly` or `daily` for production; `interval` is intended for short test loops. Defaults to `hourly`. |
| `FOCUS_CRON_OFFSET` | No | Minute offset used for hourly/daily cron triggers. Defaults to `5`. |
| `FOCUS_INTERVAL_SECONDS` | No | Interval (seconds) when `FOCUS_FREQUENCY="interval"`. |
| `FOCUS_PREFIX` | No | Object key prefix/folder. Defaults to `focus_exports`. |

### S3 destination

| Variable | Required | Description |
|----------|----------|-------------|
| `FOCUS_S3_BUCKET_NAME` | Yes | Destination bucket for exported files. |
| `FOCUS_S3_REGION_NAME` | No | AWS region for the bucket. |
| `FOCUS_S3_ENDPOINT_URL` | No | Custom endpoint (useful for S3-compatible storage). |
| `FOCUS_S3_ACCESS_KEY` | Yes | AWS access key for uploads. |
| `FOCUS_S3_SECRET_KEY` | Yes | AWS secret key for uploads. |
| `FOCUS_S3_SESSION_TOKEN` | No | AWS session token if using temporary credentials. |

### GCS destination

| Variable | Required | Description |
|----------|----------|-------------|
| `FOCUS_GCS_BUCKET_NAME` | Yes | Destination GCS bucket for exported files. |
| `FOCUS_GCS_PATH_SERVICE_ACCOUNT` | No | Path to a service account JSON key file. Falls back to Application Default Credentials (ADC) if unset. |

## Setup via Config

### Configure environment variables

<Tabs>
<TabItem value="s3" label="S3">

```bash
export FOCUS_PROVIDER="s3"
export FOCUS_PREFIX="focus_exports"
export FOCUS_S3_BUCKET_NAME="my-litellm-focus-bucket"
export FOCUS_S3_REGION_NAME="us-east-1"
export FOCUS_S3_ACCESS_KEY="AKIA..."
export FOCUS_S3_SECRET_KEY="..."
```

</TabItem>
<TabItem value="gcs" label="GCS">

```bash
export FOCUS_PROVIDER="gcs"
export FOCUS_PREFIX="focus_exports"
export FOCUS_GCS_BUCKET_NAME="my-litellm-focus-bucket"

# Optional: path to service account JSON. Omit to use Application Default Credentials.
export FOCUS_GCS_PATH_SERVICE_ACCOUNT="/path/to/service-account.json"
```

The service account (or ADC principal) needs the `storage.objects.create` permission on the destination bucket (`roles/storage.objectCreator` or broader).

</TabItem>
</Tabs>

### Update LiteLLM config

```yaml
model_list:
  - model_name: {{openai_large}}
    litellm_params:
      model: openai/{{openai_large}}
      api_key: sk-your-key

litellm_settings:
  callbacks: ["focus"]
```

### Start the proxy

```bash
litellm --config /path/to/config.yaml
```

During boot LiteLLM registers the Focus logger and a background job that runs according to the configured frequency.

## Planned Enhancements
- Add "Setup on UI" flow alongside the current configuration-based setup.
- Add Azure Blob to the Destination options.

## Related Links

- [Focus](https://focus.finops.org/)
