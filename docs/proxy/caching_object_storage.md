---
title: S3 and GCS Cache
description: Back the LiteLLM proxy's response cache with an S3 or GCS bucket.
---

# S3 and GCS Cache

Object storage trades latency for durability and cost. A bucket is far slower than Redis on every
lookup, but it is cheap, shared across every replica, and survives a restart. Use it when the cache
hits are worth saving and a few hundred milliseconds of lookup is not a problem.

## S3

### Step 1: Add `cache` to the config.yaml

```yaml
model_list:
  - model_name: {{openai_small}}
    litellm_params:
      model: {{openai_small}}
  - model_name: text-embedding-ada-002
    litellm_params:
      model: text-embedding-ada-002

litellm_settings:
  set_verbose: True
  cache: True # set cache responses to True
  cache_params: # set cache params for s3
    type: s3
    s3_bucket_name: cache-bucket-litellm # AWS Bucket Name for S3
    s3_region_name: us-west-2 # AWS Region Name for S3
    s3_aws_access_key_id: os.environ/AWS_ACCESS_KEY_ID # us os.environ/<variable name> to pass environment variables. This is AWS Access Key ID for S3
    s3_aws_secret_access_key: os.environ/AWS_SECRET_ACCESS_KEY # AWS Secret Access Key for S3
    s3_endpoint_url: https://s3.amazonaws.com # [OPTIONAL] S3 endpoint URL, if you want to use Backblaze/cloudflare s3 buckets
```

### Step 2: Run proxy with config

```shell
$ litellm --config /path/to/config.yaml
```

## GCS

### Step 1: Add `cache` to the config.yaml

```yaml
model_list:
  - model_name: {{openai_small}}
    litellm_params:
      model: {{openai_small}}
  - model_name: text-embedding-ada-002
    litellm_params:
      model: text-embedding-ada-002

litellm_settings:
  set_verbose: True
  cache: True # set cache responses to True
  cache_params: # set cache params for gcs
    type: gcs
    gcs_bucket_name: cache-bucket-litellm # GCS Bucket Name for caching
    gcs_path_service_account: os.environ/GCS_PATH_SERVICE_ACCOUNT # use os.environ/<variable name> to pass environment variables. This is the path to your GCS service account JSON file
    gcs_path: cache/ # [OPTIONAL] GCS path prefix for cache objects
```

### Step 2: Add GCS Credentials to .env

Set the GCS environment variables in your .env file:

```shell
GCS_BUCKET_NAME="your-gcs-bucket-name"
GCS_PATH_SERVICE_ACCOUNT="/path/to/service-account.json"
```

### Step 3: Run proxy with config

```shell
$ litellm --config /path/to/config.yaml
```
