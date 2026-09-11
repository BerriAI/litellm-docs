---
title: Cache Settings
description: Every cache_params setting the LiteLLM proxy accepts in config.yaml.
---

# Cache Settings

Every cache option lives under `litellm_settings.cache_params` in the proxy `config.yaml`. Which
keys apply depends on `type`.

## Set Cache Params on config.yaml

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
  cache: True # set cache responses to True, litellm defaults to using a redis cache
  cache_params: # cache_params are optional
    type: "redis" # The type of cache to initialize. Can be "local", "redis", "s3", or "gcs". Defaults to "local".
    host: "localhost" # The host address for the Redis cache. Required if type is "redis".
    port: 6379 # The port number for the Redis cache. Required if type is "redis".
    password: "your_password" # The password for the Redis cache. Required if type is "redis".

    # Optional configurations
    supported_call_types:
      ["acompletion", "atext_completion", "aembedding", "atranscription"]
      # /chat/completions, /completions, /embeddings, /audio/transcriptions
```

## Supported `cache_params` on proxy config.yaml

```yaml
cache_params:
  # ttl
  ttl: Optional[float]
  default_in_memory_ttl: Optional[float]
  default_in_redis_ttl: Optional[float]
  max_connections: Optional[Int]

  # Type of cache (options: "local", "redis", "s3", "gcs")
  type: s3

  # List of litellm call types to cache for
  # Options: "completion", "acompletion", "embedding", "aembedding"
  supported_call_types:
    ["acompletion", "atext_completion", "aembedding", "atranscription"]
    # /chat/completions, /completions, /embeddings, /audio/transcriptions

  # Redis cache parameters
  host: localhost # Redis server hostname or IP address
  port: "6379" # Redis server port (as a string)
  password: secret_password # Redis server password
  namespace: Optional[str] = None,

  # GCP IAM Authentication for Redis
  gcp_service_account: "projects/-/serviceAccounts/your-sa@project.iam.gserviceaccount.com" # GCP service account for IAM authentication
  gcp_ssl_ca_certs: "./server-ca.pem" # Path to SSL CA certificate file for GCP Memorystore Redis
  ssl: true # Enable SSL for secure connections
  ssl_cert_reqs: null # Set to null for self-signed certificates
  ssl_check_hostname: false # Set to false for self-signed certificates

  # S3 cache parameters
  s3_bucket_name: your_s3_bucket_name # Name of the S3 bucket
  s3_region_name: us-west-2 # AWS region of the S3 bucket
  s3_api_version: 2006-03-01 # AWS S3 API version
  s3_use_ssl: true # Use SSL for S3 connections (options: true, false)
  s3_verify: true # SSL certificate verification for S3 connections (options: true, false)
  s3_endpoint_url: https://s3.amazonaws.com # S3 endpoint URL
  s3_aws_access_key_id: your_access_key # AWS Access Key ID for S3
  s3_aws_secret_access_key: your_secret_key # AWS Secret Access Key for S3
  s3_aws_session_token: your_session_token # AWS Session Token for temporary credentials

  # GCS cache parameters
  gcs_bucket_name: your_gcs_bucket_name # Name of the GCS bucket
  gcs_path_service_account: /path/to/service-account.json # Path to GCS service account JSON file
  gcs_path: cache/ # [OPTIONAL] GCS path prefix for cache objects

  # Semantic cache parameters (redis-semantic, valkey-semantic, qdrant-semantic)
  similarity_threshold: 0.8 # Minimum cosine similarity for a cached response to be served
  semantic_cache_embedding_timeout: 5.0 # Seconds the prompt embedding may take before the lookup gives up
```
