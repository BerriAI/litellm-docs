
```yaml
environment_variables: {}

model_list:
  - model_name: string
    litellm_params: {}
    model_info:
      id: string
      mode: embedding
      input_cost_per_token: 0
      output_cost_per_token: 0
      max_tokens: 2048
      base_model: {{openai_large}}
      additionalProp1: {}

litellm_settings:
  # Logging/Callback settings
  success_callback: ["langfuse"]  # list of success callbacks
  failure_callback: ["sentry"]  # list of failure callbacks
  callbacks: ["otel"]  # list of callbacks - runs on success and failure
  service_callbacks: ["datadog", "prometheus"]  # logs redis, postgres failures on datadog, prometheus
  turn_off_message_logging: boolean  # prevent the messages and responses from being logged to on your callbacks, but request metadata will still be logged. Useful for privacy/compliance when handling sensitive data.
  redact_user_api_key_info: boolean  # Redact information about the user api key (hashed token, user_id, team id, etc.), from logs. Currently supported for Langfuse, OpenTelemetry, Logfire, ArizeAI logging.
  langfuse_default_tags: ["cache_hit", "cache_key", "proxy_base_url", "user_api_key_alias", "user_api_key_user_id", "user_api_key_user_email", "user_api_key_team_alias", "semantic-similarity", "proxy_base_url"] # default tags for Langfuse Logging
  langfuse_enable_update_trace_keys: boolean  # allow callers to copy named request metadata onto an existing Langfuse trace.
  # Networking settings
  request_timeout: 10 # (int) llm requesttimeout in seconds. Raise Timeout error if call takes longer than 10s. Sets litellm.request_timeout
  force_ipv4: boolean # If true, litellm will force ipv4 for all LLM requests. Some users have seen httpx ConnectionError when using ipv6 + Anthropic API. HTTP(S)_PROXY / NO_PROXY are still honored

  # Cost tracking settings
  cost_discount_config:
    vertex_ai: 0.05 # Apply a 5% discount to Vertex AI costs
    gemini: 0.05 # Apply a 5% discount to Gemini costs
  cost_margin_config:
    global: 0.05 # Apply a 5% margin to all providers
    openai: 0.10 # Apply a 10% margin to OpenAI costs
  
  # Debugging - see debugging docs for more options
  # Use `--debug` or `--detailed_debug` CLI flags, or set LITELLM_LOG env var to "INFO", "DEBUG", or "ERROR"
  json_logs: boolean # if true, logs will be in json format
  request_correlation_in_logs: boolean # if true, stamps every log line with the request's trace_id and session_id

  # Fallbacks, reliability
  default_fallbacks: ["claude-opus"] # set default_fallbacks, in case a specific model group is misconfigured / bad.
  content_policy_fallbacks: [{ "gpt-3.5-turbo-small": ["claude-opus"] }] # fallbacks for ContentPolicyErrors
  context_window_fallbacks: [{ "gpt-3.5-turbo-small": ["gpt-3.5-turbo-large", "claude-opus"] }] # fallbacks for ContextWindowExceededErrors

  # MCP Aliases - Map aliases to MCP server names for easier tool access
  mcp_aliases: {
      "github": "github_mcp_server",
      "zapier": "zapier_mcp_server",
      "deepwiki": "deepwiki_mcp_server",
    } # Maps friendly aliases to MCP server names. Only the first alias for each server is used

  # Caching settings
  cache: true
  cache_params: # set cache params for redis
    type: redis # type of cache to initialize (options: "local", "redis", "s3", "gcs")

    # Optional - Redis Settings
    host: "localhost" # The host address for the Redis cache. Required if type is "redis".
    port: 6379 # The port number for the Redis cache. Required if type is "redis".
    password: "your_password" # The password for the Redis cache. Required if type is "redis".
    namespace: "litellm.caching.caching" # namespace for redis cache
    max_connections: 100  # [OPTIONAL] Set Maximum number of Redis connections. Passed directly to redis-py. 
    # Optional - Redis Cluster Settings
    redis_startup_nodes: [{ "host": "127.0.0.1", "port": "7001" }]

    # Optional - Redis Sentinel Settings
    service_name: "mymaster"
    sentinel_nodes: [["localhost", 26379]]

    # Optional - GCP IAM Authentication for Redis
    gcp_service_account: "projects/-/serviceAccounts/your-sa@project.iam.gserviceaccount.com" # GCP service account for IAM authentication
    gcp_ssl_ca_certs: "./server-ca.pem" # Path to SSL CA certificate file for GCP Memorystore Redis
    ssl: true # Enable SSL for secure connections
    ssl_cert_reqs: null # Set to null for self-signed certificates
    ssl_check_hostname: false # Set to false for self-signed certificates

    # Optional - Qdrant Semantic Cache Settings
    qdrant_semantic_cache_embedding_model: openai-embedding # the model should be defined on the model_list
    qdrant_collection_name: test_collection
    qdrant_quantization_config: binary
    qdrant_semantic_cache_vector_size: 1536 # vector size must match embedding model dimensionality
    similarity_threshold: 0.8 # similarity threshold for semantic cache

    # Optional - S3 Cache Settings
    s3_bucket_name: cache-bucket-litellm # AWS Bucket Name for S3
    s3_region_name: us-west-2 # AWS Region Name for S3
    s3_aws_access_key_id: os.environ/AWS_ACCESS_KEY_ID # us os.environ/<variable name> to pass environment variables. This is AWS Access Key ID for S3
    s3_aws_secret_access_key: os.environ/AWS_SECRET_ACCESS_KEY # AWS Secret Access Key for S3
    s3_endpoint_url: https://s3.amazonaws.com # [OPTIONAL] S3 endpoint URL, if you want to use Backblaze/cloudflare s3 bucket

    # Optional - GCS Cache Settings
    gcs_bucket_name: cache-bucket-litellm # GCS Bucket Name for caching
    gcs_path_service_account: os.environ/GCS_PATH_SERVICE_ACCOUNT # Path to GCS service account JSON file
    gcs_path: cache/ # [OPTIONAL] GCS path prefix for cache objects

    # Common Cache settings
    # Optional - Supported call types for caching
    supported_call_types:
      ["acompletion", "atext_completion", "aembedding", "atranscription"]
      # /chat/completions, /completions, /embeddings, /audio/transcriptions
    mode: default_off # if default_off, you need to opt in to caching on a per call basis
    ttl: 600 # ttl for caching
    disable_copilot_system_to_assistant: False # DEPRECATED - GitHub Copilot API supports system prompts.

  # Virtual key auth cache — shares API key / virtual-key auth across workers via Redis.
  # Reduces DB round trips when caches are cold on new workers or pods.
  # Requires litellm_settings.cache: true AND cache_params.type: redis above.
  enable_redis_auth_cache: false

callback_settings:
  otel:
    message_logging: boolean # OTEL logging callback specific settings

general_settings:
  completion_model: string
  store_prompts_in_spend_logs: boolean
  forward_client_headers_to_llm_api: boolean
  disable_spend_logs: boolean  # turn off writing each transaction to the db
  disable_master_key_return: boolean  # turn off returning master key on UI (checked on '/user/info' endpoint)
  disable_retry_on_max_parallel_request_limit_error: boolean  # turn off retries when max parallel request limit is reached
  disable_reset_budget: boolean  # turn off reset budget scheduled task
  disable_adding_master_key_hash_to_db: boolean  # turn off storing master key hash in db, for spend tracking
  disable_responses_id_security: boolean  # turn off response ID security checks that prevent users from accessing other users' responses
  allow_unmanaged_response_ids: boolean  # let keys address response IDs this proxy never issued, e.g. raw provider IDs
  disable_auto_add_proxy_admin_to_teams: boolean  # if true, a proxy admin calling /team/new is no longer auto-added to the new team as team admin
  enforce_fallback_model_access: boolean  # if true, router_settings fallbacks only run when the calling key, team and project may call the fallback model
  enable_jwt_auth: boolean  # allow proxy admin to auth in via jwt tokens with 'litellm_proxy_admin' in claims
  enforce_user_param: boolean  # requires all openai endpoint requests to have a 'user' param
  reject_clientside_metadata_tags: boolean  # if true, rejects requests with client-side 'metadata.tags' to prevent users from influencing budgets
  missing_session_id: generate  # or "reject". What to do with LLM API requests that carry no session id; unset keeps the legacy behavior
  disable_batch_input_file_rate_limiting: boolean  # skip TPM/RPM accounting for batch input files
  skip_batch_input_file_rate_limiting_for_providers: ["hosted_vllm"]  # apply the batch accounting skip only to these providers
  disable_budget_reservation: boolean  # disable pre-request budget reservation; may allow overspend under concurrency
  allowed_routes: ["route1", "route2"]  # list of allowed proxy API routes - a user can access. (currently JWT-Auth only)
  key_management_system: google_kms  # either google_kms or azure_kms
  master_key: string
  maximum_spend_logs_retention_period: 30d # The maximum time to retain spend logs before deletion.
  maximum_spend_logs_retention_interval: 1d # interval in which the spend log cleanup task should run in.
  user_mcp_management_mode: restricted  # or "view_all"

  # Database Settings
  database_url: string
  database_connection_pool_limit: 0  # default 10
  database_connection_timeout: 0  # default 60s
  database_connect_timeout: 0  # Prisma `connect_timeout` URL param (seconds). Unset => Prisma default.
  database_socket_timeout: 0  # Prisma `socket_timeout` URL param (seconds). Idle/slow connections beyond this are closed.
  database_statement_timeout: 0  # Postgres statement_timeout (seconds). Caps how long any one statement may run, and therefore how long it can hold locks. Unset => no bound.
  database_lock_timeout: 0  # Postgres lock_timeout (seconds). Caps how long a statement waits for a lock another transaction holds. Unset => no bound.
  database_extra_connection_params: {}  # Extra key/value pairs appended to the Prisma DATABASE_URL / DIRECT_URL query string (e.g. sslmode, pgbouncer, statement_cache_size). Overrides LiteLLM defaults.
  database_disable_prepared_statements: boolean  # if true, appends pgbouncer=true to the Prisma connection URL, disabling server-side prepared statements. For PgBouncer transaction pooling and avoiding "cached plan must not change result type" errors during rolling migrations.
  allow_requests_on_db_unavailable: boolean  # if true, will allow requests that can not connect to the DB to verify Virtual Key to still work 
  fail_closed_budget_enforcement: boolean  # if true, validates spend against the DB for every budgeted request and rejects with 503 when spend cannot be verified against Redis or the DB

  custom_auth: string
  max_parallel_requests: 0 # the max parallel requests allowed per deployment
  global_max_parallel_requests: 0 # the max parallel requests allowed on the proxy all up
  infer_model_from_keys: true
  background_health_checks: true
  health_check_interval: 300
  alerting: ["slack", "email"]
  alerting_threshold: 0
  use_client_credentials_pass_through_routes: boolean  # use client credentials for all pass through routes like "/vertex-ai", /bedrock/. When this is True Virtual Key auth will not be applied on these endpoints

worker_registry:                    # top-level key, not nested under general_settings
  - worker_id: string               # unique id for the worker
    name: string                    # display name shown in the UI
    url: string                     # full URL of the worker, must start with http:// or https://

router_settings:
  routing_strategy: simple-shuffle # Literal["simple-shuffle", "least-busy", "usage-based-routing","latency-based-routing"], default="simple-shuffle" - RECOMMENDED for best performance
  redis_host: <your-redis-host>           # string
  redis_password: <your-redis-password>   # string
  redis_port: <your-redis-port>           # string
  enable_pre_call_checks: true            # bool - Before call is made check if a call is within model context window 
  allowed_fails: 3 # cooldown model if it fails > 1 call in a minute. 
  cooldown_time: 30 # (in seconds) how long to cooldown model if fails/min > allowed_fails
  disable_cooldowns: True                  # bool - Disable cooldowns for all models 
  enable_tag_filtering: True                # bool - Use tag based routing for requests
  tag_filtering_match_any: True             # bool - Tag matching behavior (only when enable_tag_filtering=true). `true`: match if deployment has ANY requested tag; `false`: match only if deployment has ALL requested tags
  tag_routing_prefix: "route:"              # string - Opt-in marker prefix (default ""). A request tag starting with this exact string is stripped and matched as an explicit routing directive, skipping the known-tag-vocabulary heuristic. Unprefixed tags keep matching as today.
  retry_policy: {                          # Dict[str, int]: retry policy for different types of exceptions
    "AuthenticationErrorRetries": 3,
    "TimeoutErrorRetries": 3,
    "RateLimitErrorRetries": 3,
    "ContentPolicyViolationErrorRetries": 4,
    "InternalServerErrorRetries": 4
  }
  allowed_fails_policy: {
    "BadRequestErrorAllowedFails": 1000, # Allow 1000 BadRequestErrors before cooling down a deployment
    "AuthenticationErrorAllowedFails": 10, # int 
    "TimeoutErrorAllowedFails": 12, # int 
    "RateLimitErrorAllowedFails": 10000, # int 
    "ContentPolicyViolationErrorAllowedFails": 15, # int 
    "InternalServerErrorAllowedFails": 20, # int 
  }
  content_policy_fallbacks: [{"{{anthropic}}": ["my-fallback-model"]}] # List[Dict[str, List[str]]]: Fallback model for content policy violations
  fallbacks: [{"{{anthropic}}": ["my-fallback-model"]}] # List[Dict[str, List[str]]]: Fallback model for all errors

```

### litellm_settings - Reference

| Name | Type | Description |
|------|------|-------------|
| success_callback | array of strings | List of success callbacks. [Doc Proxy logging callbacks](logging), [Doc Metrics](prometheus) |
| failure_callback | array of strings | List of failure callbacks [Doc Proxy logging callbacks](logging), [Doc Metrics](prometheus) |
| callbacks | array of strings | List of callbacks - runs on success and failure [Doc Proxy logging callbacks](logging), [Doc Metrics](prometheus) |
| service_callbacks | array of strings | System health monitoring - Logs redis, postgres failures on specified services (e.g. datadog, prometheus) [Doc Metrics](prometheus) |
| turn_off_message_logging | boolean | If true, prevents messages and responses from being logged to callbacks, but request metadata will still be logged. Useful for privacy/compliance when handling sensitive data [Proxy Logging](logging) |
| modify_params | boolean | If true, allows modifying the parameters of the request before it is sent to the LLM provider |
| enable_preview_features | boolean | If true, enables preview features - e.g. Azure O1 Models with streaming support.|
| LITELLM_DISABLE_STOP_SEQUENCE_LIMIT | Disable validation for stop sequence limit (default: 4) |  
| redact_user_api_key_info | boolean | If true, redacts information about the user api key from logs [Proxy Logging](logging#redacting-userapikeyinfo) |
| mcp_aliases | object | Maps friendly aliases to MCP server names for easier tool access. Only the first alias for each server is used. [MCP Aliases](../mcp#mcp-aliases) |
| langfuse_default_tags | array of strings | Default tags for Langfuse Logging. Use this if you want to control which LiteLLM-specific fields are logged as tags by the LiteLLM proxy. By default LiteLLM Proxy logs no LiteLLM-specific fields as tags. [Further docs](/docs/proxy/logging#litellm-tags---cache_hit-cache_key) |
| set_verbose | boolean | [DEPRECATED - see debugging docs](./debugging) Use `--debug` or `--detailed_debug` CLI flags, or set `LITELLM_LOG` env var to "INFO", "DEBUG", or "ERROR" instead. |
| json_logs | boolean | If true, logs will be in json format. If you need to store the logs as JSON, just set the `litellm.json_logs = True`. We currently just log the raw POST request from litellm as a JSON [Further docs](./debugging) |
| request_correlation_in_logs | boolean | If true, stamps every log line (plaintext or JSON) with the request's `trace_id` and `session_id`, and adds a `session_id` field to `StandardLoggingPayload`. [Further docs](./debugging#request-correlation-ids) |
| default_fallbacks | array of strings | List of fallback models to use if a specific model group is misconfigured / bad. [Further docs](./reliability#default-fallbacks) |
| request_timeout | integer | The timeout for requests in seconds. If not set, the default value is `6000 seconds`. [For reference OpenAI Python SDK defaults to `600 seconds`.](https://github.com/openai/openai-python/blob/main/src/openai/_constants.py) |
| force_ipv4 | boolean | If true, litellm will force ipv4 for all LLM requests. Some users have seen httpx ConnectionError when using ipv6 + Anthropic API. `HTTP_PROXY` / `HTTPS_PROXY` / `NO_PROXY` are still honored on both the aiohttp and httpx transports; on the httpx transport only direct connections are pinned to IPv4, the hop to the proxy itself is not |
| disable_aiohttp_transport | boolean | If true, LLM requests go through plain httpx instead of the default aiohttp transport. Set this (or the `DISABLE_AIOHTTP_TRANSPORT` env var) if you see aiohttp connector errors such as a `CancelledError` surfacing as `No response returned` on `/v1/responses`, `/v1/chat/completions` or `/v1/messages`. **Default is False** |
| content_policy_fallbacks | array of objects | Fallbacks to use when a ContentPolicyViolationError is encountered. [Further docs](./reliability#content-policy-fallbacks) |
| context_window_fallbacks | array of objects | Fallbacks to use when a ContextWindowExceededError is encountered. [Further docs](./reliability#context-window-fallbacks) |
| cache | boolean | If true, enables caching. [Further docs](./caching) |
| cache_params | object | Parameters for the cache. [Further docs](./caching#supported-cache_params-on-proxy-configyaml) |
| enable_redis_auth_cache | boolean | When `true`, stores virtual-key auth payloads in Redis (same client as response caching) so every worker/pod shares cached auth lookups—fewer repeated database reads on cache misses. **Requires `cache: true` and `cache_params.type: redis`** (Redis or Redis Cluster). Optional: set `general_settings.user_api_key_cache_ttl` so TTL applies consistently to memory and Redis. [Further docs](./caching#virtual-key-authentication-cache-redis) |
| disable_end_user_cost_tracking | boolean | If true, turns off end user cost tracking on prometheus metrics + litellm spend logs table on proxy. |
| enable_end_user_cost_tracking_prometheus_only | boolean | If true, includes the `end_user` label on Prometheus metrics. Disabled by default to keep Prometheus cardinality bounded. [Further docs](./prometheus#tracking-end_user-on-prometheus) |
| cost_discount_config | object | Provider-specific percentage discounts applied to cost calculations. Configure under `litellm_settings`. [Further docs](./provider_discounts) |
| cost_margin_config | object | Provider-specific or global percentage/fixed margins applied to cost calculations. Configure under `litellm_settings`. [Further docs](./provider_margins) |
| key_generation_settings | object | Restricts who can generate keys. [Further docs](./virtual_keys.md#restricting-key-generation) |
| disable_add_transform_inline_image_block | boolean | For Fireworks AI models - if true, turns off the auto-add of `#transform=inline` to the url of the image_url, if the model is not a vision model. |
| use_chat_completions_url_for_anthropic_messages | boolean | If true, routes OpenAI `/v1/messages` requests through chat/completions instead of the Responses API. Can also be set via env var `LITELLM_USE_CHAT_COMPLETIONS_URL_FOR_ANTHROPIC_MESSAGES=true`. |
| route_all_chat_openai_to_responses | boolean | If true, routes all OpenAI `/chat/completions` requests through the Responses API bridge. Recommended for OpenAI models. Can also be set via env var `LITELLM_ROUTE_ALL_CHAT_OPENAI_TO_RESPONSES=true`. |
| skip_system_message_in_guardrail | boolean | If true, unified guardrails omit `role: system` from scanned input on **chat completions** and **Anthropic `/v1/messages`** only; Lakera v2 also honors this on chat completions. The LLM still receives full messages. Per-guardrail override: `litellm_params.skip_system_message_in_guardrail` on each guardrail. [Guardrails quick start](./guardrails/quick_start#skip-system-messages-in-guardrail-evaluation) |
| skip_tool_message_in_guardrail | boolean | If true, unified guardrails omit `role: tool` from scanned input on **chat completions** and **Anthropic `/v1/messages`** only; Lakera v2 also honors this on chat completions. The LLM still receives full messages. Per-guardrail override: `litellm_params.skip_tool_message_in_guardrail` on each guardrail. [Guardrails quick start](./guardrails/quick_start#skip-tool-messages-in-guardrail-evaluation) |
| disable_hf_tokenizer_download | boolean | If true, it defaults to using the openai tokenizer for all models (including huggingface models). |
| enable_json_schema_validation | boolean | If true, enables json schema validation for all requests. |
| enable_key_alias_format_validation | boolean | If true, validates `key_alias` format on `/key/generate` and `/key/update`. Must be 2-255 chars, start/end with alphanumeric, only allow `a-zA-Z0-9_-/.@`. Default `false`. |
| require_managed_files | boolean | Default `false`. When `true`, `POST /v1/files` requires `target_model_names` and rejects classic provider file uploads with `400`. Use to enforce LiteLLM managed files for file ownership and access control. [Further docs](./litellm_managed_files#optional-enforce-managed-files-on-upload) |
| user_url_validation | boolean | Default `true`. When `true`, the proxy validates user-controlled URLs (e.g. OpenAPI `spec_path` when it is an `http(s)` URL, image URLs, and similar) before fetching: DNS is resolved and connections to non–globally-routable addresses (RFC1918, loopback, link-local, etc.) are blocked unless the **hostname in the URL** is listed in `user_url_allowed_hosts`. Set to `false` to skip validation (only if you trust who can supply URLs). **Must be set under `litellm_settings`**, not `general_settings`. |
| user_url_allowed_hosts | array of strings | Hostnames allowed to resolve to private/internal IPs when `user_url_validation` is `true`. Match the host **as it appears in the URL** (e.g. `api.corp.internal`, `127.0.0.1`, `127.0.0.1:8080`, `[::1]:443`). For split-horizon DNS, allowlist the public hostname, not the resolved `10.x` address. **Must be set under `litellm_settings`**, not `general_settings`. See [MCP from OpenAPI](../mcp_openapi#internal-spec-urls-ssrf). |
| disable_copilot_system_to_assistant | boolean | **DEPRECATED** - GitHub Copilot API supports system prompts. |
| default_team_params | object | Default parameters applied to every new team created via `/team/new` (including SSO auto-created teams). Fills in fields that are omitted or `null` in the request, except `budget_duration`: an explicit `"budget_duration": null` skips the default and creates a never-resetting budget. Sub-fields: `max_budget` (float), `budget_duration` (string, e.g. `"30d"`), `tpm_limit` (integer), `rpm_limit` (integer), `team_member_permissions` (array of strings, e.g. `["/team/daily/activity", "/key/generate"]`), `models` (array of strings — only applied to SSO auto-created teams). |
| budget_reset_time | string | Available in the next release (after `v1.94.0`). Wall-clock time of day (in the configured `timezone`) that day/week/month budgets reset at, as a quoted 24-hour `"HH:MM"` or `"HH:MM:SS"` string, e.g. `"09:00"`. Defaults to midnight when unset; sub-day durations ignore it. A malformed value fails config load at startup. [Further docs](./budget_reset_and_tz#configuring-the-reset-time-of-day) |
| overwrite_user_with_key_hash | boolean | Available in `v1.95.0` and later. Default `false`. When `true`, force-sets the outgoing `user` on chat/completions to the calling key's identity, overriding any client-supplied value and setting it even when absent: a virtual key's sha256 hash (equal to `user_api_key_hash` in spend logs) or the `litellm_proxy_master_key` alias for master-key requests. Gives a stable, tamper-proof end-user id so provider-side abuse monitoring or other handling keyed on `user` maps back to one key. Only affects proxy-validated keys; custom-auth and JWT requests are left untouched. [Further docs](./virtual_keys#overwrite-outgoing-user-with-the-key-hash) |

### general_settings - Reference

| Name | Type | Description |
|------|------|-------------|
| completion_model | string | The model to use for all completions, overriding any `model` specified in the request |
| enable_drain_endpoint | boolean | If true, exposes the unauthenticated `GET /health/drain` endpoint used by Kubernetes `preStop` hooks to drain in-flight requests before shutdown. Off by default; only enable it when the health port is reachable solely from inside the cluster, since any caller that reaches it can take the pod out of rotation. See `GRACEFUL_SHUTDOWN_TIMEOUT`. |
| drain_endpoint_token | string | Shared secret for the `/health/drain` endpoint. When set, drain calls must carry a matching `X-Drain-Token` header (compared with `secrets.compare_digest`) or are rejected with 401; the kubelet supplies it from the preStop `httpGet.httpHeaders`. Also settable via the `DRAIN_ENDPOINT_TOKEN` env var. |
| disable_spend_logs | boolean | If true, turns off writing each transaction to the database |
| disable_spend_updates | boolean | If true, turns off all spend updates to the DB. Including key/user/team spend updates. |
| disable_master_key_return | boolean | If true, turns off returning master key on UI. (checked on '/user/info' endpoint) |
| disable_retry_on_max_parallel_request_limit_error | boolean | If true, turns off retries when max parallel request limit is reached |
| disable_reset_budget | boolean | If true, turns off reset budget scheduled task |
| disable_adding_master_key_hash_to_db | boolean | If true, turns off storing master key hash in db |
| disable_responses_id_security | boolean | If true, disables response ID security checks that prevent users from accessing response IDs from other users. When false (default), response IDs are encrypted with user information to ensure users can only access their own responses. Applies to /v1/responses endpoints |
| allow_unmanaged_response_ids | boolean | If true, lets keys address response IDs this proxy never issued, such as raw provider IDs or IDs handed out before response ID encryption was on. When false (default), those IDs are refused with 403 because the proxy cannot tell who owns them. IDs the proxy did issue stay owner-checked either way. Applies to /v1/responses endpoints |
| disable_auto_add_proxy_admin_to_teams | boolean | Default `false`. When a user calls `/team/new`, LiteLLM auto-adds that caller to the new team as a team admin. Set this to `true` so proxy admins are no longer auto-added; members you explicitly list in `members_with_roles` are still added, and non-admin callers (e.g. internal users) are still auto-added. Also toggleable from the Admin UI under **Settings > Router Settings > General Settings**. |
| enforce_fallback_model_access | boolean | Default `false`. When `true`, a fallback configured in `router_settings` (`fallbacks`, `context_window_fallbacks`, `content_policy_fallbacks`, `default_fallbacks`) only runs if the calling key, its team and its project are allowed to call the fallback model; unauthorized targets are skipped and the primary model's error is returned when none remain. [More information here](reliability#enforce-key-model-access-on-fallbacks) |
| enable_jwt_auth | boolean | allow proxy admin to auth in via jwt tokens with 'litellm_proxy_admin' in claims. [Doc on JWT Tokens](token_auth) |
| enforce_user_param | boolean | If true, requires all OpenAI endpoint requests to have a 'user' param. [Doc on call hooks](call_hooks)|
| reject_clientside_metadata_tags | boolean | If true, rejects requests that contain client-side 'metadata.tags' to prevent users from influencing budgets by sending different tags. Tags can only be inherited from the API key metadata. |
| missing_session_id | string | What to do with LLM API requests that carry no session id (`x-litellm-session-id` header, `metadata.session_id`, W3C `baggage` `session.id`, etc.). `generate` creates one id per request and stamps it into `litellm_session_id`, `litellm_trace_id` and `metadata.session_id`, so the `session_id` column in SpendLogs and the session id sent to logging callbacks such as Langfuse match. `reject` returns a `400` for such requests. Unset keeps the legacy behavior, where SpendLogs falls back to the trace id while callbacks receive no session id. MCP routes are not affected. |
| disable_batch_input_file_rate_limiting | boolean | Default `false`. Set to `true` to skip TPM and RPM accounting for batch input files at submission. Files are still read when an API key has a model allowlist. See [Batch rate limiting](../batches#how-rate-limiting-for-batches-api-works). |
| skip_batch_input_file_rate_limiting_for_providers | array of strings | Skips batch input-file TPM and RPM accounting for the listed providers, for example `["hosted_vllm"]`. LiteLLM determines the provider from the selected route. Files are still read when an API key has a model allowlist. |
| skip_batch_input_file_rate_limiting_for_models | array of strings | Deprecated. This setting has no effect and produces a startup warning. Use `skip_batch_input_file_rate_limiting_for_providers` or `disable_batch_input_file_rate_limiting` instead. |
| disable_budget_reservation | boolean | Default `false`. Set to `true` to disable pre-request cost reservation. This can allow concurrent requests to exceed a configured budget; requests are still rejected when the budget is already exhausted. LiteLLM logs a warning while this option is enabled. See [Budget reservation](./users#budget-reservation). |
| allowed_routes | array of strings | List of allowed proxy API routes a user can access [Doc on controlling allowed routes](/docs/proxy/public_routes#define-public-admin-only-and-allowed-routes)|
| key_management_system | string | Specifies the key management system. [Doc Secret Managers](../secret) |
| master_key | string | The master key for the proxy [Set up Virtual Keys](virtual_keys) |
| database_url | string | The URL for the database connection [Set up Virtual Keys](virtual_keys) |
| database_connection_pool_limit | integer | The limit for database connection pool [Setting DB Connection Pool limit](./configs.md#configure-db-pool-limits--connection-timeouts) |
| database_connection_timeout | integer | The timeout for database connections in seconds [Setting DB Connection Pool limit, timeout](./configs.md#configure-db-pool-limits--connection-timeouts) |
| database_connect_timeout | float | Maps to the Prisma [`connect_timeout`](https://www.prisma.io/docs/orm/overview/databases/postgresql) URL param (seconds). Bounds how long the engine waits to establish a new connection before failing. Defaults to Prisma's built-in value when unset. |
| database_socket_timeout | float | Maps to the Prisma [`socket_timeout`](https://www.prisma.io/docs/orm/overview/databases/postgresql) URL param (seconds). When set, an idle or slow connection that has not produced data within this window is closed. **Use this to cap idle Prisma connections from LiteLLM.** |
| database_statement_timeout | float | Postgres [`statement_timeout`](https://www.postgresql.org/docs/current/runtime-config-client.html) in seconds, delivered on `DATABASE_URL` as `options=-c statement_timeout=<ms>`. Caps how long any single statement may run, and therefore how long it can hold its row locks. Without it a batch write that outlives the Prisma client's HTTP read timeout keeps running server side after the client has given up, and later writes queue behind those locks. Not applied to `DIRECT_URL`, so migrations are never cancelled. Unset means no bound. [Bounding statement and lock time](configs#bounding-statement-and-lock-time) |
| database_lock_timeout | float | Postgres [`lock_timeout`](https://www.postgresql.org/docs/current/runtime-config-client.html) in seconds, delivered on `DATABASE_URL` as `options=-c lock_timeout=<ms>`. Caps how long a statement waits for a lock another transaction already holds, so a blocked write fails fast instead of consuming the whole statement budget. Keep it well below `database_statement_timeout`. Unset means no bound. [Bounding statement and lock time](configs#bounding-statement-and-lock-time) |
| database_extra_connection_params | object | Escape hatch — extra key/value pairs appended verbatim to the Prisma `DATABASE_URL` / `DIRECT_URL` query string (e.g. `sslmode`, `pgbouncer`, `statement_cache_size`). Keys here override any default LiteLLM sets. |
| database_disable_prepared_statements | boolean | Appends `pgbouncer=true` to the Prisma connection URL, disabling reuse of server-side prepared statements. Use behind PgBouncer transaction pooling, or to avoid `cached plan must not change result type` errors during rolling schema migrations. An explicit `pgbouncer` key in `database_extra_connection_params` takes precedence. [Disable Server-Side Prepared Statements](configs#disable-server-side-prepared-statements) |
| allow_requests_on_db_unavailable | boolean | If true, allows requests to succeed even if DB is unreachable. **Only use this if running LiteLLM in your VPC** This will allow requests to work even when LiteLLM cannot connect to the DB to verify a Virtual Key [Doc on graceful db unavailability](prod#gracefully-handle-db-unavailability) |
| fail_closed_budget_enforcement | boolean | Default `false`. When `true`, budget checks validate spend against the authoritative database for every budgeted request (key, team, user, organization, end-user, tag, and per-window budgets) instead of trusting only the cross-pod Redis counter, and a request is rejected with a `503` when current spend can be verified against neither Redis nor the database. Use this when a configured budget must be a hard ceiling even while Redis is degraded or restarting; leave it off to keep healthy under-budget traffic off the database. [Doc on budget enforcement](./users#hard-budget-enforcement-fail-closed) |
| custom_auth | string | Write your own custom authentication logic [Doc Custom Auth](./custom_auth) |
| max_parallel_requests | integer | The max parallel requests allowed per deployment |
| global_max_parallel_requests | integer | The max parallel requests allowed on the proxy overall |
| max_in_flight_requests_per_worker | integer | Per worker process cap on concurrently admitted requests. Requests above it wait in a bounded queue, and the rest get a `503` with `retry-after: 1`. Off unless set. See [Per-worker admission control](./server_tuning#per-worker-admission-control) |
| max_queued_requests_per_worker | integer | How many requests may wait for a slot per worker before new arrivals are rejected. Defaults to `max_in_flight_requests_per_worker` |
| admission_queue_timeout_seconds | float | Default `1.0`. A queued request that gets no slot within this time is rejected with a `503` |
| cancel_on_disconnect | boolean | If true, cancels the in-flight upstream LLM request (non-streaming) when the client disconnects, freeing backend capacity (e.g. a vLLM GPU slot). The cancelled request is logged as a 499 failure. Default `false` |
| infer_model_from_keys | boolean | If true, infers the model from the provided keys |
| background_health_checks | boolean | If true, enables background health checks. [Doc on health checks](health) |
| health_check_interval | integer | The interval for health checks in seconds [Doc on health checks](health) |
| alerting | array of strings | List of alerting methods [Doc on Slack Alerting](alerting) |
| alerting_threshold | integer | The threshold for triggering alerts [Doc on Slack Alerting](alerting) |
| use_client_credentials_pass_through_routes | boolean | If true, uses client credentials for all pass-through routes. [Doc on pass through routes](pass_through) |
| health_check_details | boolean | If false, hides health check details (e.g. remaining rate limit). [Doc on health checks](health) |
| public_routes | List[str] | (Enterprise Feature) Control list of public routes |
| alert_types | List[str] | Control list of alert types to send to slack (Doc on alert types)[./alerting.md] |
| enforced_params | List[str] | (Enterprise Feature) List of params that must be included in all requests to the proxy |
| enable_oauth2_auth | boolean | (Enterprise Feature) If true, enables oauth2.0 authentication on LLM + info routes |
| use_x_forwarded_for | str | If true, uses the `X-Forwarded-For` header to derive the client IP and the proxy's public origin from `X-Forwarded-Proto` / `X-Forwarded-Host` / `X-Forwarded-Port` (used for MCP OAuth, and for deciding whether session/SSO/SAML cookies should be marked `Secure` behind a TLS-terminating reverse proxy). Headers are honored only when `mcp_trusted_proxy_ranges` is also set and the request peer's IP falls inside one of those CIDRs. For ingressed deployments, prefer [`PROXY_BASE_URL`](#environment-variables---reference). See [Security best practices — Secure cookies behind a reverse proxy](./security_best_practices#8-configure-secure-cookies-behind-a-tls-terminating-reverse-proxy) and [MCP OAuth — Reverse proxy and ingress configuration](../mcp_oauth#reverse-proxy-and-ingress-configuration). |
| service_account_settings | List[Dict[str, Any]] | Set `service_account_settings` if you want to create settings that only apply to service account keys (Doc on service accounts)[./service_accounts.md] | 
| image_generation_model | str | The default model to use for image generation - ignores model set in request |
| store_model_in_db | boolean | If true, enables storing model + credential information in the DB. |
| supported_db_objects | List[str] | Fine-grained control over which object types to load from the database when `store_model_in_db` is True. Available types: `"models"`, `"mcp"`, `"guardrails"`, `"vector_stores"`, `"pass_through_endpoints"`, `"prompts"`, `"model_cost_map"`. If not set, all object types are loaded (default behavior). Example: `supported_db_objects: ["mcp"]` to only load MCP servers from DB. |
| user_mcp_management_mode | string | Controls what non-admins can see on the MCP dashboard. `restricted` (default) only lists MCP servers that the user’s teams are explicitly allowed to access. `view_all` lets every user see the full MCP server list. Tool list/call always respects per-key permissions, so users still cannot run MCP calls without access. |
| store_prompts_in_spend_logs | boolean | If true, allows prompts and responses to be stored in the spend logs table. |
| scope_spend_list_endpoints_to_caller | boolean | When `true` (default), `/spend/keys` and `/spend/users` return only the caller's rows for non-admin API keys. Set to `false` to disable scoping. See [Spend list endpoints](./cost_tracking.md#spend-list-endpoints-spendkeys-and-spendusers). |
| legacy_unscoped_spend_list_endpoints | boolean | When `true`, restores pre-scoping behavior for `/spend/keys` and `/spend/users` (non-admin keys may list all rows). Overrides `scope_spend_list_endpoints_to_caller`. Env: `LITELLM_LEGACY_UNSCOPED_SPEND_LIST_ENDPOINTS`. |
| max_request_size_mb | int | The maximum size for requests in MB. Requests above this size will be rejected. |
| max_response_size_mb | int | The maximum size for responses in MB. LLM Responses above this size will not be sent. |
| max_batch_file_size_mb | int | The maximum size in MB for a batch input file uploaded to `/v1/files` with `purpose="batch"`. Larger uploads are rejected with a `413` before reaching the provider. Unset means no cap. See [Batch input file validation](../batches#batch-input-file-validation) |
| proxy_budget_rescheduler_min_time | int | The minimum time (in seconds) to wait before checking db for budget resets. **Default is 597 seconds** |
| proxy_budget_rescheduler_max_time | int | The maximum time (in seconds) to wait before checking db for budget resets. **Default is 605 seconds** |
| proxy_batch_write_at | int | Time (in seconds) to wait before batch writing spend logs to the db. **Default is 10 seconds** |
| proxy_batch_polling_interval | int | Time (in seconds) to wait before polling a batch, to check if it's completed. **Default is 6000 seconds (1 hour)** |
| proxy_config_reload_interval_seconds | int | How often each pod reloads config-in-DB objects (models, credentials, guardrails, etc.) from the database when `store_model_in_db` is enabled. Lower values speed up cross-pod convergence at the cost of more DB load; applied on proxy startup. Env: `PROXY_CONFIG_RELOAD_INTERVAL_SECONDS`. **Default is 30 seconds** |
| scheduled_job_stagger | dict | Spreads the proxy's scheduled background jobs across a window instead of firing them together on every replica. Keys: `enabled` (bool, default `true`), `window_seconds` (int, default `300`), `identity` (str, replaces the `POD_NAME`/`HOSTNAME`-derived component of the offset hash), `offsets` (dict of scheduler job id to seconds, where `0` pins a job to its unshifted schedule). See [Staggering scheduled jobs](./prod.md#stagger-scheduled-background-jobs) |
| alerting_args | dict | Args for Slack Alerting [Doc on Slack Alerting](./alerting.md) |
| custom_key_generate | str | Custom function for key generation [Doc on custom key generation](./virtual_keys.md#custom-keygenerate) |
| custom_key_update | str | Custom function for key updates. Required if `custom_key_generate` policies should also apply to key edits [Doc on custom key update](./virtual_keys.md#custom-keyupdate) |
| allowed_ips | List[str] | List of IPs allowed to access the proxy. If not set, all IPs are allowed. |
| embedding_model | str | The default model to use for embeddings - ignores model set in request |
| alert_to_webhook_url | Dict[str] | [Specify a webhook url for each alert type.](./alerting.md#map-slack-channels-to-alert-type) |
| key_management_settings | List[Dict[str, Any]] | Settings for key management system (e.g. AWS KMS, Azure Key Vault) [Doc on key management](../secret.md) |
| allow_user_auth | boolean | (Deprecated) old approach for user authentication. |
| user_api_key_cache_ttl | int | The time (in seconds) to cache user api keys in memory. |
| disable_prisma_schema_update | boolean | If true, turns off automatic schema updates to DB |
| litellm_key_header_name | str | If set, allows passing LiteLLM keys as a custom header. [Doc on custom headers](./virtual_keys.md#pass-litellm-key-in-custom-header) |
| moderation_model | str | The default model to use for moderation. |
| custom_sso | str | Path to a python file that implements custom SSO logic. [Doc on custom SSO](./custom_sso.md) |
| allow_cli_sso_verification_uri_complete | boolean | Default `false`. When `true`, `POST /sso/cli/start` also returns `verification_uri_complete`, and `lite login` opens the browser verification page with the code already filled in so the user only confirms it. Off by default so the code has to be typed by hand. [Doc on CLI SSO](./cli_sso.md#pre-fill-the-verification-code) |
| allow_client_side_credentials | boolean | If true, allows passing client side credentials to the proxy. (Useful when testing finetuning models) [Doc on client side credentials](./virtual_keys.md) |
| admin_only_routes | List[str] | (Enterprise Feature) List of routes that are only accessible to admin users. [Doc on admin only routes](/docs/proxy/public_routes#define-public-admin-only-and-allowed-routes) |
| use_azure_key_vault | boolean | If true, load keys from azure key vault | 
| use_google_kms | boolean | If true, load keys from google kms |
| spend_report_frequency | str | Specify how often you want a Spend Report to be sent (e.g. "1d", "2d", "30d") [More on this](./alerting.md) |
| ui_access_mode | Literal["admin_only"] | If set, restricts access to the UI to admin users only. [Docs](./ui.md#disable-admin-ui) |
| max_failed_login_attempts | integer | Number of failed Admin UI sign-in attempts allowed for one username, from any source address, within `failed_login_window_seconds`, before further attempts for that username are refused with 429. Failed attempts receive an escalating delay before this ceiling. Configurable from config.yaml only. Defaults to 50 |
| max_failed_login_attempts_per_source | integer | Number of failed Admin UI sign-in attempts allowed from one source address, across every username, within `failed_login_window_seconds`, before further attempts from that address are refused with 429. Configurable from config.yaml only. Defaults to 250 |
| failed_login_window_seconds | integer | Fixed window in seconds over which failed Admin UI sign-in attempts are counted. The window starts at the first failure and is not extended by later attempts. Configurable from config.yaml only. Defaults to 900 |
| litellm_jwtauth | Dict[str, Any] | Settings for JWT authentication. [Docs](./token_auth.md) |
| litellm_license | str | The license key for the proxy. [Docs](../enterprise.md#how-do-i-set-up-and-verify-an-enterprise-license) |
| oauth2_config_mappings | Dict[str, str] | Define the OAuth2 config mappings | 
| pass_through_endpoints | List[Dict[str, Any]] | Define the pass through endpoints. [Docs](./pass_through) |
| pass_through_request_timeout | float | Upstream request timeout in seconds for pass-through routes (custom endpoints and native provider passthrough). Default: `600`. Per-endpoint `timeout` overrides this. [Docs](./pass_through#request-timeouts) |
| enable_oauth2_proxy_auth | boolean | (Enterprise Feature) If true, enables oauth2.0 authentication |
| forward_openai_org_id | boolean | If true, forwards the OpenAI Organization ID to the backend LLM call (if it's OpenAI). |
| forward_client_headers_to_llm_api | boolean | If true, forwards the client headers (any `x-` headers and `anthropic-beta` headers) to the backend LLM call |
| maximum_spend_logs_retention_period               | str                   | Used to set the max retention time for spend logs in the db, after which they will be auto-purged                                                                                                                                                                                                                             |
| maximum_spend_logs_retention_interval             | str                   | Used to set the interval in which the spend log cleanup task should run in.                                                                                                                                                                                                                                                   |
| alert_type_config | dict | Configuration mapping alert types to their handler settings |
| always_include_stream_usage | boolean | If true, includes usage metrics in every streaming response chunk |
| sse_keepalive_ping_interval_seconds | Optional[float] | Proxy-wide default for the streaming keepalive described in [Timeouts](./timeout#keepalive-pings-for-idle-streaming-connections). Applies to every deployment that doesn't set its own `keepalive_seconds`, and to pass-through routes, which have no deployment of their own. Also covers the window before the upstream has answered at all, which per-deployment `keepalive_seconds` cannot reach. Defaults to None (off). |
| auto_redirect_ui_login_to_sso | boolean | If true, automatically redirects UI login page to SSO provider |
| control_plane_url | string | URL of the Global Control Plane that administers this instance. Enables the `/v3/login` and `/v3/login/exchange` endpoints so the control plane UI can authenticate against this instance cross-origin. No state is shared with the control plane. [Docs](./global_control_plane.md) |
| custom_auth_run_common_checks | boolean | If true, runs LiteLLM's standard auth validation alongside custom auth (key/team/user/project model allowlists, budgets, rate limits). Default is `false` — see [Custom Auth — Enforce model access](/docs/proxy/custom_auth#enforce-budgets-and-model-access) |
| custom_ui_sso_sign_in_handler | string | Custom handler for SSO sign-in logic in the UI |
| database_connection_pool_timeout | integer | Database connection pool timeout in seconds |
| disable_error_logs | boolean | If true, suppresses error tracking and storage in the database |
| enable_health_check_routing | boolean | If true, enables health check-driven request routing to avoid unhealthy deployments |
| background_health_check_model_groups | Optional[List[str]] | Opt-in allowlist of model group names for background health checks. When set, only listed groups are probed and health-check routing applies only to them; unlisted groups keep their configured routing behavior. Defaults to None (all groups) |
| health_check_ignore_transient_errors | boolean | If true, 429 (rate limit) and 408 (timeout) health check failures are ignored and do not affect routing or cooldown |
| enable_mcp_registry | boolean | If true, enables access to the centralized MCP server registry |
| enforce_rbac | boolean | If true, enables role-based access control (RBAC) for all proxy operations |
| forward_llm_provider_auth_headers | boolean | If true, forwards provider-specific auth headers to LLM API calls |
| health_check_concurrency | integer | Maximum number of concurrent health check operations |
| health_check_skip_disabled_background_models | boolean | If true, skips health probes for deployments with `model_info.disable_background_health_check: true` on on-demand `GET /health` and related health runs (not only the background loop). [Doc on health checks](health) |
| health_check_staleness_threshold | integer | Maximum age in seconds for health check results before marking deployments as stale |
| maximum_spend_logs_cleanup_batch_size | integer | Rows deleted per `DELETE` statement during spend log cleanup. Default is 1000. Overrides the `SPEND_LOG_CLEANUP_BATCH_SIZE` environment default when both are set. See [spend log deletion](spend_logs_deletion) |
| maximum_spend_logs_cleanup_max_batches | integer | `DELETE` statements issued per table per spend log cleanup run, exactly that many and no more. Default is 500, so a run deletes at most 500,000 rows per table at the default batch size. Overrides the `SPEND_LOG_RUN_LOOPS` environment default when both are set. See [spend log deletion](spend_logs_deletion) |
| maximum_spend_logs_cleanup_run_budget | string | Wall-clock budget for an entire spend log cleanup run, shared across every table it cleans, as a duration string such as `5m`. Default is `5m`. When it is spent the run stops and resumes from the same cutoff on the next tick, though it can overrun by at most one batch timeout since the budget is checked between statements. Overrides the `SPEND_LOG_CLEANUP_RUN_BUDGET_SECONDS` environment default when both are set. See [spend log deletion](spend_logs_deletion) |
| maximum_spend_logs_cleanup_batch_timeout | string | Postgres `statement_timeout` and `lock_timeout` applied to every statement a spend log cleanup run issues, as a duration string such as `30s`. Default is `30s`, so no single statement can pin a lock while user traffic queues behind it. Cancelled statements count as batch failures, so do not set this below the time one batch legitimately needs. Overrides the `SPEND_LOG_CLEANUP_BATCH_TIMEOUT_SECONDS` environment default when both are set. See [spend log deletion](spend_logs_deletion) |
| maximum_spend_logs_cleanup_cron | string | Cron expression for scheduling automatic spend log cleanup tasks. Use day names (`sun`, `mon`, ...) rather than numbers in the weekday field: the scheduler numbers weekdays 0=Monday through 6=Sunday, unlike standard cron. See [spend log deletion](spend_logs_deletion) |
| mcp_client_side_auth_header_name | string | HTTP header name for client-side MCP server credentials |
| mcp_internal_ip_ranges | list | CIDR ranges considered internal for non-public MCP server access control |
| mcp_required_fields | list | List of required field names for MCP server submissions |
| mcp_trusted_proxy_ranges | list | CIDR ranges of proxies trusted to forward `X-Forwarded-*` headers. Required (in addition to `use_x_forwarded_for: true`) for the MCP OAuth `authorize` endpoint to derive its public origin from those headers, and for session/SSO/SAML cookies to be marked `Secure` from `X-Forwarded-Proto` behind a TLS-terminating reverse proxy. Without this, headers are ignored and the proxy falls back to the request's literal scheme/base URL. For ingressed deployments, prefer [`PROXY_BASE_URL`](#environment-variables---reference). Despite the `mcp_` prefix, this is the general request trust boundary LiteLLM uses for `X-Forwarded-*` headers, not an MCP-only setting. See [Security best practices — Secure cookies behind a reverse proxy](./security_best_practices#8-configure-secure-cookies-behind-a-tls-terminating-reverse-proxy) and [MCP OAuth — Reverse proxy and ingress configuration](../mcp_oauth#reverse-proxy-and-ingress-configuration). |
| require_end_user_mcp_access_defined | boolean | If true, requires end users to have explicit MCP access permissions defined |
| require_key_mcp_access_defined | boolean | If true, a key with an empty MCP server list no longer inherits its team's servers; the team becomes a ceiling and the key must grant MCP servers explicitly (directly or via an access group). See [MCP Permission Management](../mcp_control#require-keys-to-define-their-own-mcp-access) |
| role_permissions | list | List of role-based permission configurations |
| search_tools | list | List of search tool configurations for enabling web search capabilities |
| token_rate_limit_type | string | Rate limit counting method: "total", "output", or "input" tokens |
| use_redis_transaction_buffer | boolean | If true, buffers database transactions in Redis before writing |
| use_shared_health_check | boolean | If true, uses Redis-backed shared health check state across multiple proxy instances |
| user_header_mappings | dict | Map custom request headers to user IDs using lookup rules |
| user_header_name | string | HTTP header name to extract user identity from requests |

### worker_registry - Reference

Top-level key. Set it on a [Global Control Plane](./global_control_plane.md) to list the independent proxies its UI administers.

| Name | Type | Description |
|------|------|-------------|
| worker_id | string | Unique identifier for the worker. Required |
| name | string | Display name shown in the worker selector. Required |
| url | string | Full URL of the worker instance, must start with `http://` or `https://`. Required |

### router_settings - Reference

:::info

Most values can also be set via `litellm_settings`. If you see overlapping values, settings on
`router_settings` will override those on `litellm_settings`. :::

```yaml
router_settings:
  routing_strategy: simple-shuffle # Literal["simple-shuffle", "least-busy", "usage-based-routing","latency-based-routing"], default="simple-shuffle" - RECOMMENDED for best performance
  redis_host: <your-redis-host>           # string
  redis_password: <your-redis-password>   # string
  redis_port: <your-redis-port>           # string
  enable_pre_call_checks: true            # bool - Before call is made check if a call is within model context window
  allowed_fails: 3 # cooldown model if it fails > 1 call in a minute.
  cooldown_time: 30 # (in seconds) how long to cooldown model if fails/min > allowed_fails
  disable_cooldowns: True                  # bool - Disable cooldowns for all models
  enable_tag_filtering: True                # bool - Use tag based routing for requests
  tag_filtering_match_any: True             # bool - Tag matching behavior (only when enable_tag_filtering=true). `true`: match if deployment has ANY requested tag; `false`: match only if deployment has ALL requested tags
  tag_routing_prefix: "route:"              # string - Opt-in marker prefix (default ""). A request tag starting with this exact string is stripped and matched as an explicit routing directive, skipping the known-tag-vocabulary heuristic. Unprefixed tags keep matching as today.
  retry_policy: {                          # Dict[str, int]: retry policy for different types of exceptions
    "AuthenticationErrorRetries": 3,
    "TimeoutErrorRetries": 3,
    "RateLimitErrorRetries": 3,
    "ContentPolicyViolationErrorRetries": 4,
    "InternalServerErrorRetries": 4
  }
  allowed_fails_policy: {
    "BadRequestErrorAllowedFails": 1000, # Allow 1000 BadRequestErrors before cooling down a deployment
    "AuthenticationErrorAllowedFails": 10, # int
    "TimeoutErrorAllowedFails": 12, # int
    "RateLimitErrorAllowedFails": 10000, # int
    "ContentPolicyViolationErrorAllowedFails": 15, # int
    "InternalServerErrorAllowedFails": 20, # int
  }
  content_policy_fallbacks: [{"{{anthropic}}": ["my-fallback-model"]}] # List[Dict[str, List[str]]]: Fallback model for content policy violations
  fallbacks: [{"{{anthropic}}": ["my-fallback-model"]}] # List[Dict[str, List[str]]]: Fallback model for all errors
```

| Name | Type | Description |
|------|------|-------------|
| routing_strategy | string | The strategy used for routing requests. Options: "simple-shuffle", "least-busy", "usage-based-routing", "latency-based-routing". Default is "simple-shuffle". [More information here](../routing) |
| redis_host | string | The host address for the Redis server. **Only set this if you have multiple instances of LiteLLM Proxy and want current tpm/rpm tracking to be shared across them** |
| redis_password | string | The password for the Redis server. **Only set this if you have multiple instances of LiteLLM Proxy and want current tpm/rpm tracking to be shared across them** |
| redis_port | string | The port number for the Redis server. **Only set this if you have multiple instances of LiteLLM Proxy and want current tpm/rpm tracking to be shared across them**|
| redis_db | int | The database number for the Redis server. **Only set this if you have multiple instances of LiteLLM Proxy and want current tpm/rpm tracking to be shared across them**|
| enable_pre_call_check | boolean | If true, checks if a call is within the model's context window before making the call. [More information here](reliability) |
| content_policy_fallbacks | array of objects | Specifies fallback models for content policy violations. [More information here](reliability) |
| fallbacks | array of objects | Specifies fallback models for all types of errors. [More information here](reliability) |
| enable_tag_filtering | boolean | If true, uses tag based routing for requests [Tag Based Routing](tag_routing) |
| enable_weighted_failover | boolean | If true and `routing_strategy` is `simple-shuffle`, a retryable failure on one deployment re-picks (weighted) across other deployments in the same model group before cross-group fallbacks. Default: false. |
| fallback_access_check | Optional[FallbackAccessCheck] | SDK only. An async predicate `(model, request_kwargs, llm_router) -> bool` the router consults before each cross-model fallback attempt; targets it rejects are skipped. The proxy injects its own check and exposes it through `general_settings.enforce_fallback_model_access`. [More information here](reliability#enforce-key-model-access-on-fallbacks) |
| tag_filtering_match_any | boolean | Tag matching behavior (only when enable_tag_filtering=true). `true`: match if deployment has ANY requested tag; `false`: match only if deployment has ALL requested tags |
| tag_routing_prefix | string | Default `""` (no-op). A request tag starting with this exact string is stripped and matched as an explicit, trusted routing directive, exempt from the heuristic that otherwise infers routing intent from deployment tag vocabulary. Unprefixed tags keep matching as today. [Tag Based Routing](tag_routing) |
| cooldown_time | integer | The duration (in seconds) to cooldown a model if it exceeds the allowed failures. |
| disable_cooldowns | boolean | If true, disables cooldowns for all models. [More information here](reliability) |
| retry_policy | object | Specifies the number of retries for different types of exceptions. [More information here](reliability) |
| allowed_fails | integer | The number of failures allowed before cooling down a model. [More information here](reliability) |
| allowed_fails_policy | object | Specifies the number of allowed failures for different error types before cooling down a deployment. [More information here](reliability) |
| default_max_parallel_requests | Optional[int] | The default maximum number of parallel requests for a deployment. |
| default_priority | (Optional[int]) | The default priority for a request. Only for '.scheduler_acompletion()'. Default is None. | 
| polling_interval | (Optional[float]) | frequency of polling queue. Only for '.scheduler_acompletion()'. Default is 3ms. |
| max_fallbacks | Optional[int] | The maximum number of fallbacks to try before exiting the call. Defaults to 5. |
| default_litellm_params | Optional[dict] | The default litellm parameters to add to all requests (e.g. `temperature`, `max_tokens`). |
| timeout | Optional[float] | The default timeout for a request. Default is 10 minutes. |
| stream_timeout | Optional[float] | The default timeout for a streaming request. If not set, the 'timeout' value is used. |
| ttft_timeout | Optional[float] | Raise a `litellm.Timeout` if no first token arrives within this many seconds of the connection being accepted, to detect providers that hang before sending any content. When set, a non-streaming call is internally promoted to streaming and the caller still receives a standard response. Best set per deployment. Defaults to None (off). |
| stream_idle_timeout | Optional[float] | Raise a `litellm.Timeout` if the gap between consecutive tokens exceeds this many seconds, to detect providers that stall mid-stream. Keep it well above the model's per-token p99 so it acts as a freeze detector rather than a slowness detector. Best set per deployment. Defaults to None (off). |
| keepalive_seconds | Optional[float] | Send an SSE `: ping` comment on a streaming response whenever the upstream model goes silent for longer than this many seconds, repeating every `keepalive_seconds` until real content resumes. Use this to stop load balancers or reverse proxies from closing SSE connections that look idle during long silent gaps (e.g. extended thinking before the first visible token). Operator-only by default: a request-level `keepalive_seconds` in the request body is ignored unless the deployment also sets `allow_client_keepalive_override: true`, in which case a request can narrow or change the deployment's value, including disabling it with an explicit `0`. A deployment-level `0` is always a hard disable a request can't override, regardless of override permission. Effective value is clamped to the range 1-300 seconds. Defaults to None (off). |
| allow_client_keepalive_override | Optional[bool] | Whether a request's `keepalive_seconds` is allowed to override this deployment's `keepalive_seconds`. Defaults to `false`, meaning `keepalive_seconds` is operator-only for this deployment and any request-level value is silently ignored. |
| debug_level | Literal["DEBUG", "INFO"] | The debug level for the logging library in the router. Defaults to "INFO". |
| client_ttl | int | Time-to-live for cached clients in seconds. Defaults to 3600. |
| cache_kwargs | dict | Additional keyword arguments for the cache initialization. Use this for non-string Redis parameters that may fail when set via `REDIS_*` environment variables. |
| routing_strategy_args | dict | Additional keyword arguments for the routing strategy - e.g. lowest latency routing default ttl |
| model_group_alias | dict | Model group alias mapping. E.g. `{"claude-3-haiku": "claude-3-haiku-20240229"}` |
| num_retries | int | Number of retries for a request. Defaults to 3. |
| default_fallbacks | Optional[List[str]] | Fallbacks to try if no model group-specific fallbacks are defined. |
| caching_groups | Optional[List[tuple]] | List of model groups for caching across model groups. Defaults to None. - e.g. caching_groups=[("openai-gpt-3.5-turbo", "azure-gpt-3.5-turbo")]|
| alerting_config | AlertingConfig | [SDK-only arg] Slack alerting configuration. Defaults to None. [Further Docs](../routing.md#alerting-) |
| assistants_config | AssistantsConfig | Set on proxy via `assistant_settings`. [Further docs](../assistants.md) |
| set_verbose | boolean | [DEPRECATED PARAM - see debug docs](./debugging) If true, sets the logging level to verbose. |
| retry_after | int | Time to wait before retrying a request in seconds. Defaults to 0. If `x-retry-after` is received from LLM API, this value is overridden. |
| provider_budget_config | ProviderBudgetConfig | Provider budget configuration. Use this to set llm_provider budget limits. example $100/day to OpenAI, $100/day to Azure, etc. Defaults to None. [Further Docs](./provider_budget_routing.md) |
| enable_pre_call_checks | boolean | If true, checks if a call is within the model's context window before making the call. **Required** for `model_info.max_input_tokens` enforcement. Default: false. [More information here](reliability) |
| model_group_retry_policy | Dict[str, RetryPolicy] | [SDK-only arg] Set retry policy for model groups. |
| context_window_fallbacks | List[Dict[str, List[str]]] | Fallback models for context window violations. |
| redis_url | str | URL for Redis server. **Known performance issue with Redis URL.** |
| cache_responses | boolean | Flag to enable caching LLM Responses, if cache set under `router_settings`. If true, caches responses. Defaults to False. |
| router_general_settings | RouterGeneralSettings | [SDK-Only] Router general settings - contains optimizations like 'async_only_mode'. [Docs](../routing.md#router-general-settings) |
| optional_pre_call_checks | List[str] | List of pre-call checks to add to the router. Supported: `router_budget_limiting`, `prompt_caching`, `responses_api_deployment_check`, `encrypted_content_affinity` (requires LiteLLM >= 1.82.3), `deployment_affinity`, `session_affinity`, `forward_client_headers_by_model_group` |
| deployment_affinity_ttl_seconds | int | TTL (seconds) for user-key → deployment affinity mapping when `deployment_affinity` is enabled (configured at Router init / proxy startup). Defaults to `3600` (1 hour). |
| model_group_affinity_config | Dict[str, List[str]] | Per-model-group affinity flags. Keys are model group names; values are lists of checks to enable (`deployment_affinity`, `responses_api_deployment_check`, `session_affinity`). Groups not listed fall back to the global `optional_pre_call_checks`. [Docs](../response_api.md#per-model-group-affinity-configuration) |
| ignore_invalid_deployments | boolean | If true, ignores invalid deployments. Default for proxy is True - to prevent invalid models from blocking other models from being loaded. |
| auto_router_capability_limit | Optional[AutoRouterCapabilityLimit] | SDK only. A callable `() -> Optional[int]` the router consults on every registration and model write for how many complexity routers may claim each licensed auto-router capability (`classifier_type: heuristic_v2`, and operator-defined `tier_definitions`); None means unlimited. Each capability holds its own count. The proxy injects its own resolver backed by the license (one router per capability unless the license `allowed_features` includes `auto_router`) and ignores this key in `router_settings`. |
| heuristic_v2_router_limit | Optional[HeuristicV2RouterLimit] | SDK only. Current name of `auto_router_capability_limit` until [BerriAI/litellm#39674](https://github.com/BerriAI/litellm/pull/39674) renames the Router kwarg; same callable `() -> Optional[int]` ceiling on `classifier_type: heuristic_v2` routers. |
| search_tools | List[SearchToolTypedDict] | List of search tool configurations for Search API integration. Each tool specifies a search_tool_name and litellm_params with search_provider, api_key, api_base, etc. [Further Docs](../search/index.md) |
| guardrail_list | List[GuardrailTypedDict] | List of guardrail configurations for guardrail load balancing. Enables load balancing across multiple guardrail deployments with the same guardrail_name. [Further Docs](./guardrails/guardrail_load_balancing.md) |
| enable_health_check_routing | boolean | If true, enables health check-driven deployment filtering to avoid routing requests to unhealthy deployments |
| background_health_check_model_groups | Optional[List[str]] | Model groups that background health checks and health-check routing are scoped to. On the proxy this is usually set via `general_settings.background_health_check_model_groups`. Defaults to None (all groups) |
| health_check_staleness_threshold | integer | Maximum age in seconds for cached health check results before marking deployments as stale |
| health_check_ignore_transient_errors | boolean | If true, 429 (rate limit) and 408 (timeout) health check failures are ignored and do not affect routing or cooldown |
| routing_groups | Optional[List[RoutingGroup]] | List of model groups that each apply their own routing strategy to a subset of models. Each group has a `group_name`, `models` (list of model names matched against the request's model), `routing_strategy`, and optional `routing_strategy_args`. Defaults to None. |
| plugins | Optional[List[RoutingPlugin]] | [SDK-only arg] Pipeline of routing plugins that run before the routing decision is made. Each plugin implements `async def run(context: RoutingContext) -> RoutingContext`, reading/narrowing `candidate_models` and attaching `signals` for the next plugin (or the final routing decision) to read. A plugin narrowing candidates to zero raises rather than falling back to the unfiltered pool. Defaults to None. |


### environment variables - Reference

| Name | Description |
|------|-------------|
| LITELLM_DISABLE_LOGIN_RATE_LIMIT | Set to `true` to turn off the Admin UI failed sign-in attempt accounting entirely |
| A2A_API_BASE | Base URL for A2A agent requests
| ACTIONS_ID_TOKEN_REQUEST_TOKEN | Token for requesting ID in GitHub Actions
| ACTIONS_ID_TOKEN_REQUEST_URL | URL for requesting ID token in GitHub Actions
| AGENTOPS_ENVIRONMENT | Environment for AgentOps logging integration
| AGENTOPS_API_KEY | API Key for AgentOps logging integration
| AGENTOPS_SERVICE_NAME | Service Name for AgentOps logging integration
| AI21_API_BASE | Base URL for AI21. Default is https://api.ai21.com/studio/v1
| AIMLAPI_KEY | Alternative spelling of `AIML_API_KEY` for AI/ML API image generation, read only when `AIML_API_KEY` is unset
| AISPEND_ACCOUNT_ID | Account ID for AI Spend
| AISPEND_API_KEY | API Key for AI Spend
| AIOHTTP_CONNECTOR_LIMIT | Connection limit for aiohttp connector. When set to 0, no limit is applied. **Default is 0**
| AIOHTTP_CONNECTOR_LIMIT_PER_HOST | Connection limit per host for aiohttp connector. When set to 0, no limit is applied. **Default is 0**
| AIOHTTP_KEEPALIVE_TIMEOUT | Keep-alive timeout for aiohttp connections in seconds. **Default is 120**
| AIOHTTP_SO_KEEPALIVE | Enable TCP `SO_KEEPALIVE` on aiohttp sockets so idle provider connections are detected and reaped before NAT/load balancers silently drop them. **Default is False**
| AIOHTTP_TCP_KEEPCNT | Number of unacknowledged TCP keepalive probes before the connection is considered dead (applies when `AIOHTTP_SO_KEEPALIVE=True`). **Default is 5**
| AIOHTTP_TCP_KEEPIDLE | Seconds an aiohttp TCP connection must be idle before keepalive probes are sent (applies when `AIOHTTP_SO_KEEPALIVE=True`). **Default is 60**
| AIOHTTP_TCP_KEEPINTVL | Seconds between successive aiohttp TCP keepalive probes (applies when `AIOHTTP_SO_KEEPALIVE=True`). **Default is 30**
| AIOHTTP_TRUST_ENV | Flag to pass `trust_env=True` to the underlying aiohttp `ClientSession`, so aiohttp itself also reads `~/.netrc` and the `SSL_CERT_FILE` / `SSL_CERT_DIR` env vars. Not required for proxies: LiteLLM already resolves `HTTP_PROXY` / `HTTPS_PROXY` / `NO_PROXY` for every request unless `DISABLE_AIOHTTP_TRUST_ENV` is set. **Default is False**
| AIOHTTP_TTL_DNS_CACHE | DNS cache time-to-live for aiohttp in seconds. **Default is 300**
| AKTO_GUARDRAIL_API_BASE | Base URL for the Akto Guardrail API (e.g. `http://localhost:9090`). Used by the Akto guardrail integration.
| AKTO_API_KEY | API key for authenticating with the Akto Guardrail service.
| ALEPH_ALPHA_API_BASE | Base URL for Aleph Alpha. Default is https://api.aleph-alpha.com/complete
| ALEPH_ALPHA_API_KEY | API key for Aleph Alpha
| ALERTING_WEBHOOK_URL | Provider-neutral fallback for `SLACK_WEBHOOK_URL`; used for Slack-format alerts when `SLACK_WEBHOOK_URL` is unset (e.g. Rocket.Chat or Mattermost incoming webhooks)
| ALLOWED_EMAIL_DOMAINS | List of email domains allowed for access
| AMAZON_NOVA_API_BASE | Base URL for Amazon Nova. Default is https://api.nova.amazon.com/v1
| ANTHROPIC_AWS_API_BASE | Base URL for Claude on AWS, read after `ANTHROPIC_AWS_BASE_URL`
| ANTHROPIC_AWS_API_KEY | API key for Claude on AWS. When it is set, requests carry the key instead of being signed with AWS SigV4
| ANTHROPIC_AWS_BASE_URL | Base URL for Claude on AWS, read before `ANTHROPIC_AWS_API_BASE`. When neither is set the endpoint is derived from the resolved AWS region
| ANTHROPIC_AWS_WORKSPACE_ID | Anthropic workspace ID sent with Claude on AWS requests, unless a workspace ID is passed per request. `ANTHROPIC_WORKSPACE_ID` is accepted as a fallback
| ANTHROPIC_WORKSPACE_ID | Fallback for `ANTHROPIC_AWS_WORKSPACE_ID`
| ANYSCALE_API_BASE | Base URL for Anyscale. Default is https://api.endpoints.anyscale.com/v1
| APISERPENT_API_BASE | Base URL for the APISerpent search provider
| APSCHEDULER_COALESCE | Whether to combine multiple pending executions of a job into one. **Default is False**
| APSCHEDULER_MAX_INSTANCES | Maximum number of concurrent instances of each job. **Default is 1**
| APSCHEDULER_MISFIRE_GRACE_TIME | Grace time in seconds for misfired jobs. **Default is 1**
| APSCHEDULER_REPLACE_EXISTING | Whether to replace existing jobs with the same ID. **Default is False**
| ARIZE_API_KEY | API key for Arize platform integration
| ARIZE_SPACE_KEY | Space key for Arize platform
| ARGILLA_BATCH_SIZE | Batch size for Argilla logging
| ARGILLA_API_KEY | API key for Argilla platform
| ARGILLA_SAMPLING_RATE | Sampling rate for Argilla logging
| ARGILLA_DATASET_NAME | Dataset name for Argilla logging
| ARGILLA_BASE_URL | Base URL for Argilla service
| ARK_API_BASE | Base URL for Volcengine Ark responses, read after `VOLCENGINE_API_BASE`
| ATHINA_API_KEY | API key for Athina service
| ATHINA_BASE_URL | Base URL for Athina service (defaults to `https://log.athina.ai`)
| AUTH_STRATEGY | Strategy used for authentication (e.g., OAuth, API key)
| AUTO_REDIRECT_UI_LOGIN_TO_SSO | Flag to enable automatic redirect of UI login page to SSO when SSO is configured. Default is **false**
| AUDIO_SPEECH_CHUNK_SIZE | Chunk size for audio speech processing. Default is 1024
| ANTHROPIC_API_KEY | API key for Anthropic service. Uses `x-api-key` header for authentication.
| ANTHROPIC_AUTH_TOKEN | Alternative auth token for Anthropic service. Uses `Authorization: Bearer` header instead of `x-api-key`. Used as fallback when `ANTHROPIC_API_KEY` is not set.
| ANTHROPIC_API_BASE | Base URL for Anthropic API. Default is https://api.anthropic.com
| ANTHROPIC_BASE_URL | Alternative to `ANTHROPIC_API_BASE` for setting the Anthropic API base URL. Used as fallback when `ANTHROPIC_API_BASE` is not set.
| ANTHROPIC_TOKEN_COUNTING_BETA_VERSION | Beta version header for Anthropic token counting API. Default is `token-counting-2024-11-01`
| AWS_ACCESS_KEY_ID | Access Key ID for AWS services
| AWS_BATCH_ROLE_ARN | ARN of the AWS IAM role for batch operations
| AWS_BEDROCK_RUNTIME_ENDPOINT | Endpoint URL for the Bedrock runtime, used when neither `api_base` nor `aws_bedrock_runtime_endpoint` is passed per request. Overrides the endpoint LiteLLM would otherwise derive from the AWS region
| AWS_DEFAULT_REGION | Default AWS region for service interactions when AWS_REGION is not set
| AWS_PROFILE_NAME | AWS CLI profile name to be used
| AWS_REGION | AWS region for service interactions (takes precedence over AWS_DEFAULT_REGION)
| AWS_REGION_NAME | Default AWS region for service interactions
| AWS_ROLE_ARN | ARN of the AWS IAM role to assume for authentication
| AWS_ROLE_NAME | Role name for AWS IAM usage
| AWS_S3_BUCKET_NAME | Name of the AWS S3 bucket for file operations
| AWS_S3_OUTPUT_BUCKET_NAME | Name of the AWS S3 output bucket for batch operations
| AWS_SECRET_ACCESS_KEY | Secret Access Key for AWS services
| AWS_SESSION_NAME | Name for AWS session
| AWS_WEB_IDENTITY_TOKEN | Web identity token for AWS
| AWS_WEB_IDENTITY_TOKEN_FILE | Path to file containing web identity token for AWS
| AZURE_API_VERSION | Version of the Azure API being used
| AZURE_AI_API_BASE | Base URL for Azure AI services (e.g., Azure AI Anthropic)
| AZURE_AI_API_KEY | API key for Azure AI services (e.g., Azure AI Anthropic)
| AZURE_AUTHORITY_HOST | Azure authority host URL
| AZURE_CERTIFICATE_PASSWORD | Password for Azure OpenAI certificate
| AZURE_CLIENT_ID | Client ID for Azure services
| AZURE_CLIENT_SECRET | Client secret for Azure services
| AZURE_COMPUTER_USE_INPUT_COST_PER_1K_TOKENS | Input cost per 1K tokens for Azure Computer Use service
| AZURE_COMPUTER_USE_OUTPUT_COST_PER_1K_TOKENS | Output cost per 1K tokens for Azure Computer Use service
| AZURE_DEFAULT_RESPONSES_API_VERSION | Version of the Azure Default Responses API being used. Default is "preview"
| AZURE_DOCUMENT_INTELLIGENCE_API_VERSION | API version for Azure Document Intelligence service
| AZURE_DOCUMENT_INTELLIGENCE_DEFAULT_DPI | Default DPI (dots per inch) setting for Azure Document Intelligence service
| AZURE_SPEECH_API_BASE | Base URL for Azure Speech audio transcription
| AZURE_SPEECH_API_KEY | API key for Azure Speech audio transcription
| AZURE_TENANT_ID | Tenant ID for Azure Active Directory
| AZURE_USERNAME | Username for Azure services, use in conjunction with AZURE_PASSWORD for azure ad token with basic username/password workflow
| AZURE_PASSWORD | Password for Azure services, use in conjunction with AZURE_USERNAME for azure ad token with basic username/password workflow
| AZURE_FEDERATED_TOKEN_FILE | File path to Azure federated token
| AZURE_FILE_SEARCH_COST_PER_GB_PER_DAY | Cost per GB per day for Azure File Search service
| AZURE_POSTGRESQL_AUTH | Set to `True` to authenticate Azure Database for PostgreSQL Flexible Server with a short-lived Microsoft Entra ID access token. LiteLLM requests the token for the `https://ossrdbms-aad.database.windows.net/.default` scope through the Azure Identity library and refreshes it before it expires. Cannot be combined with `IAM_TOKEN_DB_AUTH`. Requires `DATABASE_HOST`, `DATABASE_USER`, and `DATABASE_NAME`. For identity options and AKS workload identity setup, see [`--azure_postgresql_auth`](./cli#--azure_postgresql_auth). |
| AZURE_SCOPE | For EntraID Auth, Scope for Azure services, defaults to "https://cognitiveservices.azure.com/.default"
| AZURE_SENTINEL_DCR_IMMUTABLE_ID | Immutable ID of the Data Collection Rule for Azure Sentinel logging
| AZURE_SENTINEL_STREAM_NAME | Stream name for Azure Sentinel logging
| AZURE_SENTINEL_AUDIT_STREAM_NAME | Stream name for Azure Sentinel audit logs; falls back to AZURE_SENTINEL_STREAM_NAME when unset
| AZURE_SENTINEL_CLIENT_SECRET | Client secret for Azure Sentinel authentication
| AZURE_SENTINEL_ENDPOINT | Endpoint for Azure Sentinel logging
| AZURE_SENTINEL_TENANT_ID | Tenant ID for Azure Sentinel authentication
| AZURE_SENTINEL_CLIENT_ID | Client ID for Azure Sentinel authentication
| AZURE_SENTINEL_AUTHORITY_HOST | Microsoft Entra authority host for Azure Sentinel logging, e.g. "https://login.microsoftonline.us" for Azure Government; falls back to AZURE_AUTHORITY_HOST, then to the Azure Public Cloud authority
| AZURE_KEY_VAULT_URI | URI for Azure Key Vault
| AZURE_OPERATION_POLLING_TIMEOUT | Timeout in seconds for Azure operation polling
| AZURE_STORAGE_ACCOUNT_KEY | The Azure Storage Account Key to use for Authentication to Azure Blob Storage logging
| AZURE_STORAGE_ACCOUNT_NAME | Name of the Azure Storage Account to use for logging to Azure Blob Storage
| AZURE_STORAGE_FILE_SYSTEM | Name of the Azure Storage File System to use for logging to Azure Blob Storage.  (Typically the Container name)
| AZURE_STORAGE_TENANT_ID | The Application Tenant ID to use for Authentication to Azure Blob Storage logging
| AZURE_STORAGE_CLIENT_ID | The Application Client ID to use for Authentication to Azure Blob Storage logging
| AZURE_STORAGE_CLIENT_SECRET | The Application Client Secret to use for Authentication to Azure Blob Storage logging
| AZURE_STORAGE_ENDPOINT_SUFFIX | The storage endpoint suffix to use for Azure Blob Storage logging, e.g. core.usgovcloudapi.net for Azure Government. Defaults to core.windows.net
| AZURE_VECTOR_STORE_COST_PER_GB_PER_DAY | Cost per GB per day for Azure Vector Store service
| BACKGROUND_HEALTH_CHECK_MAX_TOKENS | Optional global default for `max_tokens` on proxy background health checks when a model has no `health_check_max_tokens`. If unset, non-wildcard models default to 5. Applies to wildcard routes when set. Default is unset
| BACKGROUND_HEALTH_CHECK_MAX_TOKENS_REASONING | For **non-wildcard** reasoning models (`supports_reasoning(model)=true`), this takes precedence over `BACKGROUND_HEALTH_CHECK_MAX_TOKENS` when set. If unset, reasoning models fall back to `BACKGROUND_HEALTH_CHECK_MAX_TOKENS` (if set) or default behavior. Wildcard routes ignore this. Default is unset
| BACKGROUND_INTERACTION_COST_POLLING_ENABLED | Set to `false` to stop the proxy polling `background=true` Interactions API requests for their final usage. Cost for those requests then goes untracked. Default is `true`
| BACKGROUND_INTERACTION_COST_POLL_INITIAL_INTERVAL_SECONDS | Delay in seconds before the first poll of a background interaction. The interval doubles on each retry. Default is 5
| BACKGROUND_INTERACTION_COST_POLL_MAX_INTERVAL_SECONDS | Ceiling in seconds that the background interaction poll interval backs off to. Default is 60
| BACKGROUND_INTERACTION_COST_POLL_TIMEOUT_SECONDS | How long in seconds to keep polling a background interaction before giving up and releasing its budget reservation. Default is 3600 (1 hour)
| BASETEN_API_BASE | Base URL for Baseten. Default is https://inference.baseten.co/v1
| BATCH_STATUS_POLL_INTERVAL_SECONDS | Interval in seconds for polling batch status. Default is 3600 (1 hour)
| BATCH_STATUS_POLL_MAX_ATTEMPTS | Maximum number of attempts for polling batch status. Default is 24 (for 24 hours)
| BEDROCK_API_BASE | Base URL for Bedrock rerank requests
| BEDROCK_MANTLE_API_BASE | Base URL for Bedrock Mantle
| BEDROCK_MAX_POLICY_SIZE | Maximum size for Bedrock policy. Default is 75
| BEDROCK_MIN_THINKING_BUDGET_TOKENS | Minimum thinking budget in tokens for Bedrock reasoning models. Bedrock returns a 400 error if budget_tokens is below this value. Requests with lower values are clamped to this minimum. Default is 1024
| BERRISPEND_ACCOUNT_ID | Account ID for BerriSpend service
| BFL_API_BASE | Base URL for Black Forest Labs image generation and editing
| BLACK_FOREST_LABS_API_KEY | API key for Black Forest Labs, read after `BFL_API_KEY`
| BRAINTRUST_API_KEY | API key for Braintrust integration
| BRAINTRUST_API_BASE | Base URL for Braintrust API. Default is https://api.braintrustdata.com/v1
| BRAINTRUST_MOCK | Enable mock mode for Braintrust integration testing. When set to true, intercepts Braintrust API calls and returns mock responses without making actual network calls. Default is false
| BRAINTRUST_MOCK_LATENCY_MS | Mock latency in milliseconds for Braintrust API calls when mock mode is enabled. Simulates network round-trip time. Default is 100ms
| BRAVE_API_BASE | Base URL for the Brave search provider
| CACHED_STREAMING_CHUNK_DELAY | Delay in seconds for cached streaming chunks. Default is 0.02
| CEREBRAS_API_BASE | Base URL for Cerebras. Default is https://api.cerebras.ai/v1
| CHATGPT_API_BASE | Base URL for ChatGPT API. Default is https://chatgpt.com/backend-api/codex
| CHATGPT_AUTH_FILE | Filename for ChatGPT authentication data. Default is "auth.json"
| CHATGPT_DEFAULT_INSTRUCTIONS | Default system instructions for ChatGPT provider
| CHATGPT_ORIGINATOR | Originator identifier for ChatGPT API requests. Default is "codex_cli_rs"
| CHATGPT_TOKEN_DIR | Directory to store ChatGPT authentication tokens. Default is "~/.config/litellm/chatgpt"
| CHATGPT_USER_AGENT | Custom user agent string for ChatGPT API requests
| CHATGPT_USER_AGENT_SUFFIX | Suffix to append to the ChatGPT user agent string
| CIRCLE_OIDC_TOKEN | OpenID Connect token for CircleCI
| CIRCLE_OIDC_TOKEN_V2 | Version 2 of the OpenID Connect token for CircleCI
| CLI_JWT_EXPIRATION_HOURS | Expiration time in hours for CLI-generated JWT tokens. Default is 24 hours. Can also be set via LITELLM_CLI_JWT_EXPIRATION_HOURS
| CLI_SSO_CLAIM_MAP | Comma-separated allowlist mapping OIDC claim paths to LiteLLM user `metadata` keys for CLI SSO (e.g. `employment_type->acme_employment_type,org_info.department->department`). Scalar values are also returned in `/sso/cli/poll` as `attribution_metadata`. Alias: `LITELLM_CLI_SSO_CLAIM_MAP`
| CLOUDFLARE_API_BASE | Base URL for Cloudflare Workers AI
| CLOUDZERO_API_KEY | CloudZero API key for authentication
| CLOUDZERO_CONNECTION_ID | CloudZero connection ID for data submission
| CLOUDZERO_EXPORT_INTERVAL_MINUTES | Interval in minutes for CloudZero data export operations
| CLOUDZERO_MAX_FETCHED_DATA_RECORDS | Maximum number of data records to fetch from CloudZero
| CLOUDZERO_TIMEZONE | Timezone for date handling (default: UTC)
| CODESTRAL_API_BASE | Base URL for Codestral. Default is https://codestral.mistral.ai/v1
| COGNITION_API_BASE | Base URL for Cognition. Default is https://api.cognition.ai/v1
| COGNITION_API_KEY | API key for Cognition
| COMETAPI_API_BASE | Base URL for CometAPI, read after `COMETAPI_BASE_URL`. Default is https://api.cometapi.com/v1
| COMETAPI_API_KEY | API key for CometAPI, read after `COMETAPI_KEY`
| COMETAPI_BASE_URL | Base URL for CometAPI image generation, read before `COMETAPI_API_BASE`
| CONFIG_FILE_PATH | File path for configuration file
| CRW_API_BASE | Base URL for the FastCRW search provider
| CYBERARK_ACCOUNT | CyberArk account name for secret management
| CYBERARK_API_BASE | Base URL for CyberArk API
| CYBERARK_API_KEY | API key for CyberArk secret management service
| CYBERARK_CLIENT_CERT | Path to client certificate for CyberArk authentication
| CYBERARK_CLIENT_KEY | Path to client key for CyberArk authentication
| CYBERARK_USERNAME | Username for CyberArk authentication
| CYBERARK_SSL_VERIFY | Flag to enable or disable SSL certificate verification for CyberArk. Default is True
| CONFIDENT_API_KEY | API key for DeepEval integration
| CUSTOM_TIKTOKEN_CACHE_DIR | Custom directory for Tiktoken cache
| CONFIDENT_API_KEY | API key for Confident AI (Deepeval) Logging service
| COHERE_API_BASE | Base URL for Cohere API. Default is https://api.cohere.com
| COMPETITOR_LLM_TEMPERATURE | Temperature setting for the LLM used in competitor discovery. Default is 0.3
| CURSOR_API_BASE | API base URL for Cursor AI provider integration. Default is https://api.cursor.com
| DASHSCOPE_API_BASE_IMAGE | Base URL for DashScope image generation. Default is https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation
| DASHSCOPE_API_BASE_RERANK | Base URL for DashScope rerank. Default is https://dashscope.aliyuncs.com/compatible-api/v1/reranks
| DATABASE_HOST | Hostname for the database server
| DATABASE_HOST_READ_REPLICA | Hostname for the read-replica database server. Only used by the componentized deployment when `IAM_TOKEN_DB_AUTH=True` or `AZURE_POSTGRESQL_AUTH=True` to assemble `DATABASE_URL_READ_REPLICA` from the discrete database env vars
| DATABASE_NAME | Name of the database
| DATABASE_NAME_READ_REPLICA | Database name for the read replica (defaults to `DATABASE_NAME`). Only used by the componentized deployment when `IAM_TOKEN_DB_AUTH=True` or `AZURE_POSTGRESQL_AUTH=True`
| DATABASE_PASSWORD | Password for the database user
| DATABASE_PORT | Port number for database connection
| DATABASE_PORT_READ_REPLICA | Port number for the read replica (default 5432). Only used by the componentized deployment when `IAM_TOKEN_DB_AUTH=True` or `AZURE_POSTGRESQL_AUTH=True`
| DATABASE_SCHEMA | Schema name used in the database
| DATABASE_SCHEMA_READ_REPLICA | Schema name for the read replica (defaults to `DATABASE_SCHEMA`). Only used by the componentized deployment when `IAM_TOKEN_DB_AUTH=True` or `AZURE_POSTGRESQL_AUTH=True`
| DATABASE_URL | Connection URL for the database
| DATABASE_URL_READ_REPLICA | Optional read-replica connection URL. When set, the proxy routes read-only queries (find_*, count, group_by, query_raw/_first) to this endpoint while writes continue to use `DATABASE_URL`. Falls back to writer-only behavior when unset. With `IAM_TOKEN_DB_AUTH=True` or `AZURE_POSTGRESQL_AUTH=True`, the reader token is auto-refreshed alongside the writer
| DATABASE_USER | Username for database connection
| DATABASE_USER_READ_REPLICA | Database user for the read replica (defaults to `DATABASE_USER`). Only used by the componentized deployment when `IAM_TOKEN_DB_AUTH=True` or `AZURE_POSTGRESQL_AUTH=True`
| DATABASE_USERNAME | Alias for database user
| DATABRICKS_API_BASE | Base URL for Databricks API
| DATABRICKS_API_KEY | API key (Personal Access Token) for Databricks API authentication
| DATABRICKS_CLIENT_ID | Client ID for Databricks OAuth M2M authentication (Service Principal application ID)
| DATABRICKS_CLIENT_SECRET | Client secret for Databricks OAuth M2M authentication
| DATABRICKS_USER_AGENT | Custom user agent string for Databricks API requests. Used for partner telemetry attribution
| DATAFORSEO_API_BASE | Base URL for the DataForSEO search provider
| DAYS_IN_A_MONTH | Days in a month for calculation purposes. Default is 28
| DAYS_IN_A_WEEK | Days in a week for calculation purposes. Default is 7
| DAYS_IN_A_YEAR | Days in a year for calculation purposes. Default is 365
| DEEPGRAM_API_BASE | Base URL for Deepgram audio transcription. Default is https://api.deepgram.com/v1
| DEEPINFRA_API_BASE | Base URL for DeepInfra. Default is https://api.deepinfra.com/v1/openai
| DEEPSEEK_ANTHROPIC_API_BASE | Base URL for DeepSeek's Anthropic-compatible `/messages` endpoint, read before `DEEPSEEK_API_BASE`
| DEEPSEEK_API_BASE | Base URL for DeepSeek. Default is https://api.deepseek.com/beta
| DISABLE_KEY_NAME | Flag to stop storing the abbreviated key name on generated keys. That abbreviation is what the UI shows to identify which key spent what, so setting this makes spend harder to attribute to a key. **Default is False**
| DRAIN_ENDPOINT_TOKEN | Shared secret required on the `X-Drain-Token` header to call the `/health/drain` endpoint. When set (here or via `general_settings.drain_endpoint_token`), drain calls without the matching token are rejected with 401; when unset the endpoint keeps its opt-in-only behavior. Have the kubelet send it from the preStop `httpGet.httpHeaders`. |
| DYNAMOAI_API_KEY | API key for DynamoAI Guardrails service
| DYNAMOAI_API_BASE | Base URL for DynamoAI API. Default is https://api.dynamo.ai
| DYNAMOAI_MODEL_ID | Model ID for DynamoAI tracking/logging purposes
| DYNAMOAI_POLICY_IDS | Comma-separated list of DynamoAI policy IDs to apply
| DD_BASE_URL | Base URL for Datadog integration
| DATADOG_BASE_URL | (Alternative to DD_BASE_URL) Base URL for Datadog integration
| ELEVENLABS_API_BASE | Base URL for ElevenLabs. Default is https://api.elevenlabs.io
| EMPOWER_API_BASE | Base URL for Empower. Default is https://app.empower.dev/api/v1
| EXA_API_BASE | Base URL for the Exa AI search provider
| FAL_AI_API_BASE | Base URL for fal.ai image generation
| FEATHERLESS_AI_API_BASE | Base URL for Featherless AI, read before `FEATHERLESS_API_BASE`
| FEATHERLESS_API_BASE | Alias for `FEATHERLESS_AI_API_BASE`
| FEATHERLESS_API_KEY | Alias for `FEATHERLESS_AI_API_KEY`
| FIRECRAWL_API_BASE | Base URL for the Firecrawl search provider
| FIREWORKSAI_API_KEY | Alias for the Fireworks AI API key, read after `FIREWORKS_API_KEY` and `FIREWORKS_AI_API_KEY`
| FIREWORKS_ACCOUNT_ID | Fireworks AI account ID, required to list models from Fireworks AI's `/models` endpoint. That request fails with an explicit error when it is unset
| FIREWORKS_AI_TOKEN | Last of the four accepted names for the Fireworks AI API key, after `FIREWORKS_API_KEY`, `FIREWORKS_AI_API_KEY` and `FIREWORKSAI_API_KEY`
| FIREWORKS_API_BASE | Base URL for Fireworks AI. Default is https://api.fireworks.ai/inference/v1
| FRIENDLIAI_API_KEY | API key for FriendliAI, with `FRIENDLI_TOKEN` accepted as a fallback
| FRIENDLI_API_BASE | Base URL for FriendliAI. Default is https://api.friendli.ai/serverless/v1
| GALADRIEL_API_BASE | Base URL for Galadriel. Default is https://api.galadriel.com/v1
| GDC_API_BASE | Base URL for GDC
| GDC_API_KEY | API key for GDC
| GIGACHAT_ACCESS_TOKEN | Pre-issued access token for GigaChat, used directly instead of exchanging credentials at `GIGACHAT_AUTH_URL`
| GIGACHAT_API_BASE | Base URL for GigaChat
| GIGACHAT_API_KEY | Credentials for GigaChat, read after `GIGACHAT_CREDENTIALS` and exchanged for an access token at `GIGACHAT_AUTH_URL`
| GIGACHAT_AUTH_URL | OAuth token endpoint used to exchange GigaChat credentials for an access token. Defaults to the GigaChat production auth URL
| GITHUB_API_BASE | Base URL for GitHub Models. Default is https://models.inference.ai.azure.com
| GOOGLE_PSE_API_BASE | Base URL for the Google Programmable Search Engine search provider
| GROQ_API_BASE | Base URL for Groq. Default is https://api.groq.com/openai/v1
| HYPERBOLIC_API_BASE | Base URL for Hyperbolic
| INCEPTION_API_BASE | Base URL for Inception. Default is https://api.inceptionlabs.ai/v1
| JINA_AI_API_BASE | Base URL for Jina AI embeddings. Default is https://api.jina.ai/v1
| JINA_AI_API_KEY | API key for Jina AI
| JINA_AI_TOKEN | Fallback for `JINA_AI_API_KEY`
| JINA_API_KEY | Fallback for `JINA_AI_API_KEY`
| LANGFLOW_API_BASE | Base URL for Langflow. Default is http://localhost:7860
| LANGFLOW_API_KEY | API key for Langflow
| LEMONADE_API_KEY | API key for Lemonade
| LINKUP_API_BASE | Base URL for the Linkup search provider
| LLAMAFILE_API_KEY | API key for llamafile. llamafile does not require one, so a placeholder is used when this is unset
| LLAMA_API_BASE | Base URL for Llama API. Default is https://api.llama.com/compat/v1
| MANUS_API_BASE | Base URL for Manus. Default is https://api.manus.im
| MARITALK_API_BASE | Base URL for MariTalk. Default is https://chat.maritaca.ai/api
| MARITALK_API_KEY | API key for MariTalk
| MISTRAL_AZURE_API_BASE | Base URL for Mistral models served through Azure AI
| MISTRAL_AZURE_API_KEY | API key for Mistral models served through Azure AI
| MODELSCOPE_API_BASE | Base URL for ModelScope
| MODELSCOPE_API_KEY | API key for ModelScope
| MORPH_API_BASE | Base URL for Morph. Default is https://api.morphllm.com/v1
| NEBIUS_API_BASE | Base URL for Nebius. Default is https://api.studio.nebius.ai/v1
| NIMBLE_API_BASE | Base URL for the Nimble search provider. Default is https://sdk.nimbleway.com/v2
| NLP_CLOUD_API_BASE | Base URL for NLP Cloud. Default is https://api.nlpcloud.io/v1/gpu/
| NOVITA_API_BASE | Base URL for Novita. Default is https://api.novita.ai/v3/openai
| NSCALE_API_BASE | Base URL for Nscale
| OLLAMA_API_BASE | Base URL for Ollama. Default is http://localhost:11434
| OLLAMA_API_KEY | API key for Ollama, for deployments that sit behind an authenticating proxy
| OPENAI_LIKE_API_BASE | Base URL for the `openai_like` provider, used to reach any OpenAI-compatible endpoint
| OPENAI_LIKE_API_KEY | API key for the `openai_like` provider. Left empty when unset, since some OpenAI-compatible servers need no key
| OPENAI_PROJECT | OpenAI project ID sent on OpenAI requests, equivalent to passing `project`
| OR_API_KEY | API key for OpenRouter, read after `OPENROUTER_API_KEY`
| OVHCLOUD_API_BASE | Base URL for OVHcloud AI Endpoints
| PARALLEL_AI_API_BASE | Base URL for the Parallel AI search provider
| PERPLEXITY_API_BASE | Base URL for Perplexity. Default is https://api.perplexity.ai
| PG_VECTOR_API_BASE | Base URL for a pgvector vector store
| PG_VECTOR_API_KEY | API key for a pgvector vector store
| PINSTRIPES_API_KEY | API key for Pinstripes
| PROMETHEUS_SELECTED_INSTANCE | Prometheus `instance` label to restrict to when the proxy queries `PROMETHEUS_URL` for fallback metrics. Series carrying any other instance are skipped; when unset, every instance is counted
| QWEN_AI_PLATFORM_API_BASE | Base URL for Qwen AI Platform (mainland China). Default is https://dashscope.aliyuncs.com/compatible-mode/v1
| QWEN_AI_PLATFORM_API_BASE_IMAGE | Base URL for Qwen AI Platform image generation. Default is https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation
| QWEN_AI_PLATFORM_API_BASE_RERANK | Base URL for Qwen AI Platform rerank. Default is https://dashscope.aliyuncs.com/compatible-api/v1/reranks
| QWEN_AI_PLATFORM_API_KEY | API key for Qwen AI Platform, read before the `DASHSCOPE_API_KEY` fallback
| QWENCLOUD_API_BASE | Base URL for QwenCloud. Default is https://dashscope-intl.aliyuncs.com/compatible-mode/v1
| QWENCLOUD_API_BASE_IMAGE | Base URL for QwenCloud image generation. Default is https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation
| QWENCLOUD_API_BASE_RERANK | Base URL for QwenCloud rerank. Default is https://dashscope-intl.aliyuncs.com/compatible-api/v1/reranks
| QWENCLOUD_API_KEY | API key for QwenCloud, read before the `DASHSCOPE_API_KEY` fallback
| REDIS_AZURE_AD_TOKEN | Flag enabling Azure AD authentication for Redis. Set it to `true`, not to a token. Ignored with a warning when a GCP IAM service account is configured as well. **Default is False**
| REDUCTO_API_KEY | API key for Reducto OCR
| REPLICATE_API_BASE | Base URL for Replicate. Default is https://api.replicate.com/v1
| RUNWAYML_API_BASE | Base URL for RunwayML
| RUNWAYML_API_SECRET | API key for RunwayML, read before `RUNWAYML_API_KEY`
| SAMBANOVA_API_BASE | Base URL for SambaNova. Default is https://api.sambanova.ai/v1
| SCX_API_BASE | Base URL for SCX.ai. Default is https://api.scx.ai/v1
| SCX_API_KEY | API key for SCX.ai
| SEARCHAPI_API_BASE | Base URL for the SearchApi search provider
| SERPER_API_BASE | Base URL for the Serper search provider
| SONIOX_API_BASE | Base URL for Soniox. Default is https://api.soniox.com
| SONIOX_API_KEY | API key for Soniox
| SPACE_ID | Last of the four accepted names for the watsonx deployment space ID, after `WATSONX_DEPLOYMENT_SPACE_ID`, `WATSONX_SPACE_ID` and `WX_SPACE_ID`
| STABILITY_API_BASE | Base URL for Stability AI image generation and editing
| TAVILY_API_BASE | Base URL for the Tavily search provider
| TINYFISH_API_BASE | Base URL for the TinyFish search provider
| TOGETHER_AI_API_BASE | Base URL for Together AI. Default is https://api.together.xyz/v1
| TOGETHER_AI_API_KEY | Alias for the Together AI API key, read after `TOGETHER_API_KEY` and before `TOGETHERAI_API_KEY`
| TOGETHER_AI_TOKEN | Last of the four accepted names for the Together AI API key, after `TOGETHER_API_KEY`, `TOGETHER_AI_API_KEY` and `TOGETHERAI_API_KEY`
| TOGETHER_API_KEY | First of the four accepted names for the Together AI API key, ahead of `TOGETHER_AI_API_KEY`, `TOGETHERAI_API_KEY` and `TOGETHER_AI_TOKEN`
| TOPAZ_API_BASE | Base URL for Topaz Labs. Default is https://api.topazlabs.com
| V0_API_BASE | Base URL for v0. Default is https://api.v0.dev/v1
| VERCEL_AI_GATEWAY_API_BASE | Base URL for the Vercel AI Gateway. Default is https://ai-gateway.vercel.sh/v1
| VERTEXAI_API_BASE | Base URL for Vertex AI, read before `VERTEX_API_BASE`
| VERTEX_API_BASE | Alias for `VERTEXAI_API_BASE`
| VERTEX_CREDENTIALS | Fallback for `VERTEXAI_CREDENTIALS`: either a path to a Vertex AI service account JSON file or the JSON itself
| VLLM_API_BASE | Base URL for a self-hosted vLLM server
| VOLCENGINE_API_BASE | Base URL for Volcengine. Default is https://ark.cn-beijing.volces.com/api/v3
| VOYAGE_AI_API_KEY | Alias for the Voyage AI API key, read after `VOYAGE_API_KEY`
| VOYAGE_AI_TOKEN | Last of the three accepted names for the Voyage AI API key, after `VOYAGE_API_KEY` and `VOYAGE_AI_API_KEY`
| VOYAGE_API_BASE | Base URL for Voyage AI rerank requests
| WANDB_API_BASE | Base URL for Weights & Biases Inference. Default is https://api.inference.wandb.ai/v1
| WATSONX_IAM_URL | IBM Cloud IAM token endpoint used to exchange a watsonx API key for a bearer token. Default is https://iam.cloud.ibm.com/identity/token
| WATSONX_REGION | Region for watsonx.ai, with `WX_REGION` and then `REGION` accepted as fallbacks
| WATSONX_SPACE_ID | Deployment space ID for watsonx.ai, read after `WATSONX_DEPLOYMENT_SPACE_ID`
| WML_URL | Last of the four accepted names for the watsonx base URL, after `WATSONX_API_BASE`, `WATSONX_URL` and `WX_URL`
| WORKER_CONFIG | Serialized proxy configuration that the `litellm` CLI passes to the worker processes it starts. Set by the CLI itself; to point the proxy at a config file of your own use `CONFIG_FILE_PATH`
| WX_API_KEY | Alias for the watsonx API key, read first when generating an IAM token and after `WATSONX_APIKEY` and `WATSONX_API_KEY` when authenticating a request
| WX_PROJECT_ID | Alias for `WATSONX_PROJECT_ID`, with `PROJECT_ID` accepted as a further fallback
| WX_REGION | Alias for `WATSONX_REGION`
| WX_SPACE_ID | Alias for `WATSONX_SPACE_ID`
| WX_URL | Alias for the watsonx base URL, read after `WATSONX_API_BASE` and `WATSONX_URL`
| XAI_API_BASE | Base URL for xAI. Default is https://api.x.ai
| XAI_OAUTH_API_BASE | Base URL for the xAI OAuth flow, read before `XAI_API_BASE`
| XAI_OAUTH_AUTH_FILE | Name of the file, inside `XAI_OAUTH_TOKEN_DIR`, that holds the xAI OAuth tokens written by `litellm xai-oauth login`. Default is auth.json
| XAI_OAUTH_TOKEN_DIR | Directory holding the xAI OAuth token file. Default is ~/.config/litellm/xai_oauth
| YOUCOM_API_BASE | Base URL for the You.com search provider
| ZAI_API_BASE | Base URL for Z.ai
| _DATADOG_BASE_URL | (Alternative to DD_BASE_URL) Base URL for Datadog integration
| DD_AGENT_HOST | Hostname or IP of DataDog agent (e.g., "localhost"). When set, logs are sent to agent instead of direct API
| DD_AGENT_PORT | Port of DataDog agent for log intake. Default is 10518
| DD_API_KEY | API key for Datadog integration
| DD_APP_KEY | Application key for Datadog Cost Management integration. Required along with DD_API_KEY for cost metrics
| DD_BATCH_SIZE | Number of log events buffered before flushing to Datadog. Clamped to [1, 1000]; defaults to 1000. Lower it (e.g. 50) if batches exceed Datadog's 5MB request limit
| DD_SITE | Site URL for Datadog (e.g., datadoghq.com)
| DD_SOURCE | Source identifier for Datadog logs
| DD_TRACER_STREAMING_CHUNK_YIELD_RESOURCE | Resource name for Datadog tracing of streaming chunk yields. Default is "streaming.chunk.yield"
| DD_ENV | Environment identifier for Datadog logs. Only supported for `datadog_llm_observability` callback
| DD_LLMOBS_ML_APP | Default ml_app name for Datadog LLM Observability (Application column). Falls back to DD_SERVICE. Can be overridden per-request via `metadata.ml_app`.
| DD_SERVICE | Service identifier for Datadog logs. Defaults to "litellm-server"
| DD_VERSION | Version identifier for Datadog logs. Defaults to "unknown"
| DATADOG_MOCK | Enable mock mode for Datadog integration testing. When set to true, intercepts Datadog API calls and returns mock responses without making actual network calls. Default is false
| DATADOG_MOCK_LATENCY_MS | Mock latency in milliseconds for Datadog API calls when mock mode is enabled. Simulates network round-trip time. Default is 100ms
| DEBUG_OTEL | Enable debug mode for OpenTelemetry
| DEFAULT_ALLOWED_FAILS | Maximum failures allowed before cooling down a model. Default is 3
| DEFAULT_A2A_AGENT_TIMEOUT | Default timeout in seconds for A2A (Agent-to-Agent) protocol requests. Default is 6000
| DEFAULT_ACCESS_GROUP_CACHE_TTL | Time-to-live in seconds for cached access group information. Default is 600 (10 minutes)
| DEFAULT_ANTHROPIC_CHAT_MAX_TOKENS | Default maximum tokens for Anthropic chat completions. Default is 4096
| DEFAULT_BATCH_SIZE | Default batch size for operations. Default is 512
| DEFAULT_CHUNK_OVERLAP | Default chunk overlap for RAG text splitters. Default is 200
| DEFAULT_CHUNK_SIZE | Default chunk size for RAG text splitters. Default is 1000
| DEFAULT_CLIENT_DISCONNECT_CHECK_TIMEOUT_SECONDS | Timeout in seconds for checking client disconnection. Default is 1
| DEFAULT_COOLDOWN_REDIS_READ_INTERVAL_SECONDS | How often each worker re-reads deployment cooldowns from Redis, in seconds. A lower value lets a cooldown set by one replica reach the others sooner, at the cost of more Redis reads. Default is 1
| DEFAULT_COOLDOWN_TIME_SECONDS | Duration in seconds to cooldown a model after failures. Default is 5
| DEFAULT_CRON_JOB_LOCK_TTL_SECONDS | Time-to-live for cron job locks in seconds. Default is 60 (1 minute)
| DEFAULT_DATAFORSEO_LOCATION_CODE | Default location code for DataForSEO search API. Default is 2250 (France)
| DEFAULT_FAILURE_THRESHOLD_PERCENT | Threshold percentage of failures to cool down a deployment. Default is 0.5 (50%)
| DEFAULT_FAILURE_THRESHOLD_MINIMUM_REQUESTS | Minimum number of requests before applying error rate cooldown. Prevents cooldown from triggering on first failure. Default is 5
| DEFAULT_FLUSH_INTERVAL_SECONDS | Default interval in seconds for flushing operations. Default is 5
| DEFAULT_HEALTH_CHECK_INTERVAL | Default interval in seconds for health checks. Default is 300 (5 minutes)
| DEFAULT_HEALTH_CHECK_PROMPT | Default prompt used during health checks for non-image models. Default is "test from litellm"
| DEFAULT_IMAGE_HEIGHT | Default height for images. Default is 300
| DEFAULT_IMAGE_TOKEN_COUNT | Default token count for images. Default is 250
| DEFAULT_IMAGE_WIDTH | Default width for images. Default is 300
| DEFAULT_IN_MEMORY_TTL | Default time-to-live for in-memory cache in seconds. Default is 5
| DEFAULT_MANAGEMENT_OBJECT_IN_MEMORY_CACHE_TTL | Default time-to-live in seconds for management objects (User, Team, Key, Organization) in memory cache. Default is 60 seconds.
| DEFAULT_MAX_LRU_CACHE_SIZE | Default maximum size for LRU cache. Default is 64
| DEFAULT_MAX_RECURSE_DEPTH | Default maximum recursion depth. Default is 100
| DEFAULT_MAX_RECURSE_DEPTH_SENSITIVE_DATA_MASKER | Default maximum recursion depth for sensitive data masker. Default is 10
| DEFAULT_MAX_RETRIES | Default maximum retry attempts. Default is 2
| DEFAULT_MAX_TOKENS | Default maximum tokens for LLM calls. Default is 4096
| DEFAULT_MAX_TOKENS_FOR_TRITON | Default maximum tokens for Triton models. Default is 2000
| DEFAULT_MAX_REDIS_BATCH_CACHE_SIZE | Default maximum size for redis batch cache. Default is 1000
| DEFAULT_MCP_SEMANTIC_FILTER_EMBEDDING_MODEL | Default embedding model for MCP semantic tool filtering. Default is "text-embedding-3-small"
| DEFAULT_MCP_SEMANTIC_FILTER_SIMILARITY_THRESHOLD | Default similarity threshold for MCP semantic tool filtering. Default is 0.3
| DEFAULT_MCP_SEMANTIC_FILTER_TOP_K | Default number of top results to return for MCP semantic tool filtering. Default is 10
| MCP_NPM_CACHE_DIR | Directory for npm cache used by STDIO MCP servers. In containers the default (~/.npm) may not exist or be read-only. Default is `/tmp/.npm_mcp_cache`
| LITELLM_MCP_CLIENT_TIMEOUT | MCP client connection timeout in seconds (stdio and HTTP/SSE transports). Default is 60
| LITELLM_MCP_TOOL_LISTING_TIMEOUT | Timeout in seconds for listing tools from an MCP server. Default is 30
| LITELLM_MCP_METADATA_TIMEOUT | HTTP client timeout in seconds for OAuth metadata fetching. Default is 10
| LITELLM_MCP_OAUTH_DISCOVERY_ON_STARTUP | Set to `1`, `true`, `yes`, or `on` to fetch remote MCP OAuth metadata eagerly while servers are registered at startup, which lets an unreachable OAuth server delay proxy readiness. Default is unset: metadata is fetched in a background task that the first request needing it joins, and a failed fetch is retried after a cooldown
| LITELLM_MCP_HEALTH_CHECK_TIMEOUT | Health check timeout in seconds for MCP servers. Default is 10
| LITELLM_MCP_STDIO_EXTRA_COMMANDS | Comma-separated extra command basenames allowed for MCP stdio transport beyond the built-in allowlist. Example: `my-mcp-bin`. Empty by default
| MCP_OAUTH2_TOKEN_CACHE_DEFAULT_TTL | Default TTL in seconds for MCP OAuth2 token cache. Default is 3600
| MCP_OAUTH2_TOKEN_CACHE_MAX_SIZE | Maximum number of entries in MCP OAuth2 token cache. Default is 200
| MCP_OAUTH2_TOKEN_CACHE_MIN_TTL | Minimum TTL in seconds for MCP OAuth2 token cache. Default is 10
| MCP_OAUTH2_TOKEN_EXPIRY_BUFFER_SECONDS | Seconds to subtract from token expiry when computing cache TTL. Default is 60
| MCP_SSO_ASSERTION_CACHE_TTL_SECONDS | TTL in seconds for the per-process cache of SSO identity assertions read on the MCP `oauth2_id_jag` path. A login on another pod becomes visible within one TTL. Default is 60
| MCP_PER_USER_TOKEN_DEFAULT_TTL | Default TTL in seconds for per-user MCP OAuth tokens stored in Redis. Default is 43200 (12 hours)
| MCP_PER_USER_TOKEN_EXPIRY_BUFFER_SECONDS | Seconds to subtract from per-user MCP OAuth token expiry when computing Redis TTL. Default is 60
| MCP_TOKEN_EXCHANGE_CACHE_MAX_SIZE | Maximum number of entries in the MCP OAuth2 token exchange cache. Default is 500
| MCP_TRUSTED_REDIRECT_ORIGINS | Comma-separated allowlist of additional `redirect_uri` origins accepted by the MCP OAuth `authorize` endpoint, beyond same-origin and loopback. Each entry is `host` or `host:port`; a `*.suffix` prefix matches any strictly-deeper subdomain. HTTPS only. Use this for first-party OAuth clients on sister domains (e.g. `app.example.com`). For ingressed deployments where the proxy's own origin is wrong, set [`PROXY_BASE_URL`](#environment-variables---reference) instead. See [MCP OAuth — Reverse proxy and ingress configuration](../mcp_oauth#reverse-proxy-and-ingress-configuration).
| DEFAULT_MOCK_RESPONSE_COMPLETION_TOKEN_COUNT | Default token count for mock response completions. Default is 20
| DEFAULT_MOCK_RESPONSE_PROMPT_TOKEN_COUNT | Default token count for mock response prompts. Default is 10
| DEFAULT_MODEL_CREATED_AT_TIME | Default creation timestamp for models. Default is 1677610602
| DEFAULT_NUM_WORKERS_LITELLM_PROXY | Default number of workers for LiteLLM proxy when `NUM_WORKERS` is not set. Default is 1. **On a single container, VM, or bare-metal host, set NUM_WORKERS to the number of vCPUs available** (e.g. `NUM_WORKERS=8` or `--num_workers 8`); CPU, memory, and the database connection pool are all per worker, so size the host and `database_connection_pool_limit` accordingly. On Kubernetes run one worker per pod and scale with replicas instead, see [Production Best Practices](./prod.md#workers-and-scaling).
| DEFAULT_PROMPT_INJECTION_SIMILARITY_THRESHOLD | Default threshold for prompt injection similarity. Default is 0.7
| DEFAULT_POLLING_INTERVAL | Default polling interval for schedulers in seconds. Default is 0.03
| DEFAULT_REASONING_EFFORT_DISABLE_THINKING_BUDGET | Default reasoning effort disable thinking budget. Default is 0
| DEFAULT_REASONING_EFFORT_HIGH_THINKING_BUDGET | Default high reasoning effort thinking budget. Default is 4096
| DEFAULT_REASONING_EFFORT_LOW_THINKING_BUDGET | Default low reasoning effort thinking budget. Default is 1024
| DEFAULT_REASONING_EFFORT_MAX_THINKING_BUDGET | Default `max` reasoning effort thinking budget for legacy Anthropic models that use `thinking.budget_tokens` (Claude 4.5 series + Haiku). On Claude 4.6/4.7 the `max` tier is routed via adaptive `output_config.effort=max` instead and ignores this constant. Default is 16384
| DEFAULT_REASONING_EFFORT_MEDIUM_THINKING_BUDGET | Default medium reasoning effort thinking budget. Default is 2048
| DEFAULT_REASONING_EFFORT_MINIMAL_THINKING_BUDGET | Default minimal reasoning effort thinking budget. Default is 512
| DEFAULT_REASONING_EFFORT_MINIMAL_THINKING_BUDGET_GEMINI_2_5_FLASH | Default minimal reasoning effort thinking budget for Gemini 2.5 Flash. Default is 512
| DEFAULT_REASONING_EFFORT_MINIMAL_THINKING_BUDGET_GEMINI_2_5_FLASH_LITE | Default minimal reasoning effort thinking budget for Gemini 2.5 Flash Lite. Default is 512
| DEFAULT_REASONING_EFFORT_MINIMAL_THINKING_BUDGET_GEMINI_2_5_PRO | Default minimal reasoning effort thinking budget for Gemini 2.5 Pro. Default is 512
| DEFAULT_REASONING_EFFORT_XHIGH_THINKING_BUDGET | Default `xhigh` reasoning effort thinking budget for legacy Anthropic models that use `thinking.budget_tokens`. Continues the 2&times; progression 1024 &rarr; 2048 &rarr; 4096 &rarr; 8192 from low/medium/high. On Claude 4.6/4.7 the `xhigh` tier is routed via adaptive `output_config.effort=xhigh` instead and ignores this constant. Default is 8192
| DEFAULT_REDIS_MAJOR_VERSION | Default Redis major version to assume when version cannot be determined. Default is 7
| DEFAULT_REDIS_SYNC_INTERVAL | Default Redis synchronization interval in seconds. Default is 1
| DEFAULT_SEMANTIC_GUARD_EMBEDDING_MODEL | Default embedding model for Semantic Guard (route-matching guardrail). Default is "text-embedding-3-small"
| DEFAULT_SEMANTIC_GUARD_SIMILARITY_THRESHOLD | Default similarity threshold for Semantic Guard route matching. Default is 0.75
| DEFAULT_REPLICATE_GPU_PRICE_PER_SECOND | Default price per second for Replicate GPU. Default is 0.001400
| DEFAULT_REPLICATE_POLLING_DELAY_SECONDS | Default delay in seconds for Replicate polling. Default is 1
| DEFAULT_REPLICATE_POLLING_RETRIES | Default number of retries for Replicate polling. Default is 5
| DEFAULT_SQS_BATCH_SIZE | Default batch size for SQS logging. Default is 512
| DEFAULT_SQS_FLUSH_INTERVAL_SECONDS | Default flush interval for SQS logging. Default is 10
| DEFAULT_S3_BATCH_SIZE | Default batch size for S3 logging. Default is 512
| DEFAULT_S3_FLUSH_INTERVAL_SECONDS | Default flush interval for S3 logging. Default is 10
| DEFAULT_SLACK_ALERTING_THRESHOLD | Default threshold for Slack alerting. Default is 300
| DEFAULT_SOFT_BUDGET | Default soft budget for LiteLLM proxy keys. Default is 50.0
| DEFAULT_TRIM_RATIO | Default ratio of tokens to trim from prompt end. Default is 0.75
| DEFAULT_GOOGLE_VIDEO_DURATION_SECONDS | Default duration for video generation in seconds in google. Default is 8
| DIRECT_URL | Direct URL for service endpoint
| DISABLE_ADMIN_UI | Toggle to disable the admin UI
| LITELLM_HIDE_DEFAULT_CREDENTIALS_HINT | Flag to hide the "Default Credentials" info card on the admin UI login page (`/ui/login` and `/fallback/login`). Useful when UI credentials are managed via `UI_USERNAME` / `UI_PASSWORD` or SSO and the hardcoded hint about `admin` + `MASTER_KEY` becomes misleading or is flagged by security scanners. **Default is false**
| LITELLM_ENABLE_HSTS | Flag to send the `Strict-Transport-Security` response header on proxy and UI responses. Only takes effect for deployments served over HTTPS. **Default is false**
| DISABLE_AIOHTTP_TRANSPORT | Flag to disable aiohttp transport. When this is set to True, litellm will use httpx instead of aiohttp. **Default is False**
| DISABLE_AIOHTTP_TRUST_ENV | Flag to stop LiteLLM from resolving `HTTP_PROXY` / `HTTPS_PROXY` / `NO_PROXY` for requests on the aiohttp transport. By default these env vars are honored without any extra setting. Has no effect on the httpx transport (`DISABLE_AIOHTTP_TRANSPORT=True`), which always honors them. **Default is False**
| DISABLE_PRISMA_HEALTH_CHECK_ON_STARTUP | Flag to skip the `SELECT 1` verification query the proxy runs against the database once Prisma has connected and migrations have been applied. The Prisma connection itself is unaffected; only the extra reachability probe is skipped, so a database that accepts the connection but cannot serve queries is discovered on the first request instead of at startup. **Default is False**
| DISABLE_SCHEMA_UPDATE | Toggle to disable schema updates
| DYNAMIC_RATE_LIMIT_ERROR_THRESHOLD_PER_MINUTE | Threshold for deployment failures per minute before enforcing rate limits in parallel request limiter. Default is 1
| DOCS_DESCRIPTION | Description text for documentation pages
| DOCS_FILTERED | Flag indicating filtered documentation
| DOCS_TITLE | Title of the documentation pages
| DOCS_URL | The path to the Swagger API documentation. **By default this is "/"**
| EMAIL_LOGO_URL | URL for the logo used in emails
| EMAIL_BUDGET_ALERT_TTL | Time-to-live for email budget alerts in seconds
| EMAIL_BUDGET_ALERT_MAX_SPEND_ALERT_PERCENTAGE | Maximum spend percentage for triggering email budget alerts
| EMAIL_SUPPORT_CONTACT | Support contact email address
| EMAIL_SIGNATURE | Custom HTML footer/signature for all emails. Can include HTML tags for formatting and links.
| EMAIL_SUBJECT_INVITATION | Custom subject template for invitation emails. 
| EMAIL_SUBJECT_KEY_CREATED | Custom subject template for key creation emails. 
| EMAIL_BUDGET_ALERT_MAX_SPEND_ALERT_PERCENTAGE | Percentage of max budget that triggers alerts (as decimal: 0.8 = 80%). Default is 0.8
| EMAIL_BUDGET_ALERT_TTL | Time-to-live for budget alert deduplication in seconds. Default is 86400 (24 hours)
| ENFORCE_PRISMA_MIGRATION_CHECK | When a database migration fails, exit nonzero instead of continuing. The standalone migration entrypoint (`litellm/proxy/prisma_migration.py`, used by the Helm migrations Job and the Docker entrypoint) enforces this by default, so a failed migration fails the Job rather than letting a deploy proceed against a stale schema; set it to `false` there to get the old log-and-continue behavior. Proxy startup itself still defaults to log-and-continue and only exits when this is set to `true` or `--enforce_prisma_migration_check` is passed
| ENKRYPTAI_API_BASE | Base URL for EnkryptAI Guardrails API. **Default is https://api.enkryptai.com**
| ENKRYPTAI_API_KEY | API key for EnkryptAI Guardrails service
| EXPERIMENTAL_OPENAI_BASE_LLM_HTTP_HANDLER | Flag to send `openai` chat completion requests through LiteLLM's shared HTTP handler instead of the OpenAI Python SDK client. **Default is False**
| EXPERIMENTAL_UI_LOGIN | Controls the self-signed admin UI session token. When true, a successful UI login returns an encrypted token carrying the user's role and model access with a fixed 10 minute expiry rather than issuing a database-backed virtual key. Independently of that, the proxy tries to decrypt any incoming token that does not start with `sk-` as one of these session tokens unless this is explicitly set to false. **Default is unset**
| FAROS_API_KEY | API key for sending LLM usage data to Faros AI
| FAROS_API_URL | Base URL for the Faros AI API. Default is https://prod.api.faros.ai
| FAROS_GRAPH | Faros graph that LiteLLM usage data is written to. Default is "default"
| FAROS_ORIGIN | Origin recorded on rows written to Faros by LiteLLM. Default is "litellm"
| FAROS_TOOL_CATEGORY | Tool category recorded on Faros vcs_UserTool rows. Default is "LiteLLM"
| FAROS_USER_SOURCE | Source recorded on Faros vcs_User rows for LiteLLM users. Default is "LiteLLM"
| FIREWORKS_AI_4_B | Size parameter for Fireworks AI 4B model. Default is 4
| FIREWORKS_AI_16_B | Size parameter for Fireworks AI 16B model. Default is 16
| FIREWORKS_AI_56_B_MOE | Size parameter for Fireworks AI 56B MOE model. Default is 56
| FIREWORKS_AI_80_B | Size parameter for Fireworks AI 80B model. Default is 80
| FIREWORKS_AI_176_B_MOE | Size parameter for Fireworks AI 176B MOE model. Default is 176
| FOCUS_PROVIDER | Destination provider for Focus exports (e.g., `s3`). Defaults to `s3`.
| FOCUS_FORMAT | Output format for Focus exports. Defaults to `parquet`.
| FOCUS_FREQUENCY | Frequency for scheduled Focus exports (`hourly`, `daily`, or `interval`). Defaults to `hourly`.
| FOCUS_CRON_OFFSET | Minute offset used when scheduling hourly/daily Focus exports. Defaults to `5` minutes.
| FOCUS_INTERVAL_SECONDS | Interval (in seconds) for Focus exports when `frequency` is `interval`.
| FOCUS_PREFIX | Object key prefix (or folder) used when uploading Focus export files. Defaults to `focus_exports`.
| FOCUS_S3_BUCKET_NAME | S3 bucket to upload Focus export files when using the S3 destination.
| FOCUS_S3_REGION_NAME | AWS region for the Focus export S3 bucket.
| FOCUS_S3_ENDPOINT_URL | Custom endpoint for the Focus export S3 client (optional; useful for S3-compatible storage).
| FOCUS_S3_ACCESS_KEY | AWS access key ID used by the Focus export S3 client.
| FOCUS_S3_SECRET_KEY | AWS secret access key used by the Focus export S3 client.
| FOCUS_S3_SESSION_TOKEN | AWS session token used by the Focus export S3 client (optional).
| MAVVRIK_API_KEY | API key for the Mavvrik FOCUS export integration.
| MAVVRIK_API_ENDPOINT | Tenant API endpoint for the Mavvrik FOCUS export, e.g. `https://api.mavvrik.ai/<tenant_id>`.
| MAVVRIK_CONNECTION_ID | AI cost connection ID for the Mavvrik FOCUS export.
| MAVVRIK_FOCUS_MAX_ROWS | Maximum rows per export window for the Mavvrik FOCUS destination. Default is 500000.
| FOCUS_GCS_BUCKET_NAME | GCS bucket to upload Focus export files when using the GCS destination.
| FOCUS_GCS_PATH_SERVICE_ACCOUNT | Path to a service account JSON key file for the Focus export GCS client. Falls back to Application Default Credentials if unset.
| FUNCTION_DEFINITION_TOKEN_COUNT | Token count for function definitions. Default is 9
| GALILEO_API_KEY | API key for Galileo Cloud (hosted). Used with the v2 spans API when `success_callback` includes `galileo`.
| GALILEO_BASE_URL | Base URL for Galileo platform. For Galileo Cloud, use `https://api.galileo.ai`. For enterprise/self-hosted, replace `console` with `api` in your console URL.
| GALILEO_LOG_STREAM_ID | Log stream ID for Galileo Cloud v2 spans logging (optional).
| GALILEO_PASSWORD | Password for Galileo enterprise Observe authentication
| GALILEO_PROJECT_ID | Project ID for Galileo usage
| GALILEO_USERNAME | Username for Galileo enterprise Observe authentication
| GOOGLE_SECRET_MANAGER_PROJECT_ID | Project ID for Google Secret Manager
| GRACEFUL_SHUTDOWN_TIMEOUT | Seconds the proxy waits for in-flight requests to drain on shutdown (SIGTERM or the `/health/drain` preStop hook) before proceeding with teardown. **Default is 30**
| GCS_BUCKET_NAME | Name of the Google Cloud Storage bucket
| GCS_MOCK | Enable mock mode for GCS integration testing. When set to true, intercepts GCS API calls and returns mock responses without making actual network calls. Default is false
| GCS_MOCK_LATENCY_MS | Mock latency in milliseconds for GCS API calls when mock mode is enabled. Simulates network round-trip time. Default is 150ms
| GCS_PATH_SERVICE_ACCOUNT | Path to the Google Cloud service account JSON file
| GCS_FLUSH_INTERVAL | Flush interval for GCS logging (in seconds). Specify how often you want a log to be sent to GCS. **Default is 20 seconds**
| GCS_BATCH_SIZE | Batch size for GCS logging. Specify after how many logs you want to flush to GCS. If `BATCH_SIZE` is set to 10, logs are flushed every 10 logs. **Default is 2048**
| GCS_USE_BATCHED_LOGGING | Enable batched logging for GCS. When enabled (default), multiple log payloads are combined into single GCS object uploads (NDJSON format), dramatically reducing API calls. When disabled, sends each log individually as separate GCS objects (legacy behavior). **Default is true**
| GCS_PUBSUB_TOPIC_ID | PubSub Topic ID to send LiteLLM SpendLogs to.
| GCS_PUBSUB_PROJECT_ID | PubSub Project ID to send LiteLLM SpendLogs to.
| GENERIC_AUTHORIZATION_ENDPOINT | Authorization endpoint for generic OAuth providers
| GENERIC_CLIENT_ID | Client ID for generic OAuth providers
| GENERIC_CLIENT_SECRET | Client secret for generic OAuth providers
| GENERIC_CLIENT_STATE | State parameter for generic client authentication
| GENERIC_CLIENT_USE_PKCE | Enable PKCE (Proof Key for Code Exchange) for generic OAuth providers. Set to "true" when your OAuth provider requires PKCE. **Default is false**
| GENERIC_SSO_HEADERS | Comma-separated list of additional headers to add to the request - e.g. Authorization=Bearer `<token>`, Content-Type=application/json, etc.
| GENERIC_INCLUDE_CLIENT_ID | Include client ID in requests for OAuth
| GENERIC_INCLUDE_TOKEN_CLAIMS | When true, also source generic OIDC SSO user claims from the ID token and access token when UserInfo is incomplete. UserInfo claims take precedence
| GENERIC_SCOPE | Scope settings for generic OAuth providers
| GENERIC_TOKEN_ENDPOINT | Token endpoint for generic OAuth providers
| GENERIC_USER_DISPLAY_NAME_ATTRIBUTE | Attribute for user's display name in generic auth
| GENERIC_USER_EMAIL_ATTRIBUTE | Attribute for user's email in generic auth
| GENERIC_USER_EXTRA_ATTRIBUTES | Comma-separated list of additional fields to extract from generic SSO provider response (e.g., "department,employee_id,groups"). Accessible via `CustomOpenID.extra_fields` in custom SSO handlers. Supports dot notation for nested fields
| GENERIC_USER_FIRST_NAME_ATTRIBUTE | Attribute for user's first name in generic auth
| GENERIC_USER_ID_ATTRIBUTE | Attribute for user ID in generic auth. Use a claim that is unique and immutable per account, such as `sub`; defaults to `preferred_username`
| GENERIC_USER_LAST_NAME_ATTRIBUTE | Attribute for user's last name in generic auth
| GENERIC_USER_PROVIDER_ATTRIBUTE | Attribute specifying the user's provider
| GENERIC_USER_ROLE_ATTRIBUTE | Attribute specifying the user's role
| GENERIC_USERINFO_ENDPOINT | Endpoint to fetch user information in generic OAuth
| GENERIC_LOGGER_ENDPOINT | Endpoint URL for the Generic Logger callback to send logs to
| GENERIC_LOGGER_HEADERS | JSON string of headers to include in Generic Logger callback requests
| GENERIC_ROLE_MAPPINGS_DEFAULT_ROLE | Default LiteLLM role to assign when no role mapping matches in generic SSO. Used with GENERIC_ROLE_MAPPINGS_ROLES
| GENERIC_ROLE_MAPPINGS_GROUP_CLAIM | The claim/attribute name in the SSO token that contains the user's groups. Used for role mapping
| GENERIC_ROLE_MAPPINGS_ROLES | Python dict string mapping LiteLLM roles to SSO group names. Example: `{"proxy_admin": ["admin-group"], "internal_user": ["users"]}`
| GENERIC_USER_ROLE_MAPPINGS | Alternative to GENERIC_ROLE_MAPPINGS_ROLES for configuring user role mappings from SSO
| GEMINI_API_BASE | Base URL for Gemini API. Default is https://generativelanguage.googleapis.com
| GALILEO_API_KEY | API key for Galileo Cloud (hosted). Used with the v2 spans API when `success_callback` includes `galileo`.
| GALILEO_BASE_URL | Base URL for Galileo platform. For Galileo Cloud, use `https://api.galileo.ai`. For enterprise/self-hosted, replace `console` with `api` in your console URL.
| GALILEO_LOG_STREAM_ID | Log stream ID for Galileo Cloud v2 spans logging (optional).
| GALILEO_PASSWORD | Password for Galileo enterprise Observe authentication
| GALILEO_PROJECT_ID | Project ID for Galileo usage
| GALILEO_USERNAME | Username for Galileo enterprise Observe authentication
| GITHUB_COPILOT_TOKEN_DIR | Directory to store GitHub Copilot token for `github_copilot` llm provider
| GITHUB_COPILOT_API_KEY_FILE | File to store GitHub Copilot API key for `github_copilot` llm provider
| GITHUB_COPILOT_ACCESS_TOKEN_FILE | File to store GitHub Copilot access token for `github_copilot` llm provider
| GITHUB_COPILOT_API_BASE | Base URL for GitHub Copilot API. For GitHub Enterprise subscriptions with custom host, it is similar to https://copilot-api.my-company.ghe.com. Default is https://api.githubcopilot.com
| GITHUB_COPILOT_DEVICE_CODE_URL | URL for GitHub Copilot device code authentication. For GitHub Enterprise subscriptions with custom host, it is similar to https://my-company.ghe.com/login/device/code. Default is https://github.com/login/device/code
| GITHUB_COPILOT_ACCESS_TOKEN_URL | URL for GitHub Copilot access token retrieval. For GitHub Enterprise subscriptions with custom host, it is similar to https://my-company.ghe.com/login/oauth/access_token. Default is https://github.com/login/oauth/access_token
| GITHUB_COPILOT_API_KEY_URL | URL for GitHub Copilot API key retrieval. For GitHub Enterprise subscriptions with custom host, it is similar to https://my-company.ghe.com/api/v3/copilot_internal/v2/token. Default is https://api.github.com/copilot_internal/v2/token
| GITHUB_COPILOT_CLIENT_ID | Client ID for GitHub Copilot device flow authentication. This is used by the `github_copilot` provider for device code authentication. Default is "Iv1.b507a08c87ecfe98"
| GREENSCALE_API_KEY | API key for Greenscale service
| GREENSCALE_ENDPOINT | Endpoint URL for Greenscale service
| GRAYSWAN_API_BASE | Base URL for GraySwan API. Default is https://api.grayswan.ai
| GRAYSWAN_API_KEY | API key for GraySwan Cygnal service
| GRAYSWAN_REASONING_MODE | Reasoning mode for GraySwan guardrail
| GRAYSWAN_VIOLATION_THRESHOLD | Violation threshold for GraySwan guardrail
| GOOGLE_APPLICATION_CREDENTIALS | Path to Google Cloud credentials JSON file
| GOOGLE_CLIENT_ID | Client ID for Google OAuth
| GOOGLE_CLIENT_SECRET | Client secret for Google OAuth
| GOOGLE_KMS_RESOURCE_NAME | Name of the resource in Google KMS
| GUARDRAILS_AI_API_BASE | Base URL for Guardrails AI API
| GUARDRAIL_SCANNED_MESSAGES_CACHE_TTL_SECONDS | TTL in seconds for the per-session cache that remembers which message segments a guardrail already scanned when `only_scan_new_messages` is enabled. Default is 86400 (24 hours)
| HEALTH_CHECK_TIMEOUT_SECONDS | Timeout in seconds for health checks. Default is 60
| HEROKU_API_BASE | Base URL for Heroku API
| HEROKU_API_KEY | API key for Heroku services
| HF_API_BASE | Base URL for Hugging Face API
| HCP_VAULT_ADDR | Address for [Hashicorp Vault Secret Manager](../secret_managers/hashicorp_vault.md)
| HCP_VAULT_APPROLE_MOUNT_PATH | Mount path for AppRole authentication in [Hashicorp Vault Secret Manager](../secret_managers/hashicorp_vault.md). Default is "approle"
| HCP_VAULT_APPROLE_ROLE_ID | Role ID for AppRole authentication in [Hashicorp Vault Secret Manager](../secret_managers/hashicorp_vault.md)
| HCP_VAULT_APPROLE_SECRET_ID | Secret ID for AppRole authentication in [Hashicorp Vault Secret Manager](../secret_managers/hashicorp_vault.md)
| HCP_VAULT_CLIENT_CERT | Path to client certificate for [Hashicorp Vault Secret Manager](../secret_managers/hashicorp_vault.md)
| HCP_VAULT_CLIENT_KEY | Path to client key for [Hashicorp Vault Secret Manager](../secret_managers/hashicorp_vault.md)
| HCP_VAULT_MOUNT_NAME | Mount name for [Hashicorp Vault Secret Manager](../secret_managers/hashicorp_vault.md)
| HCP_VAULT_NAMESPACE | Namespace for [Hashicorp Vault Secret Manager](../secret_managers/hashicorp_vault.md)
| HCP_VAULT_PATH_PREFIX | Path prefix for [Hashicorp Vault Secret Manager](../secret_managers/hashicorp_vault.md)
| HCP_VAULT_TOKEN | Token for [Hashicorp Vault Secret Manager](../secret_managers/hashicorp_vault.md)
| HCP_VAULT_CERT_ROLE | Role for [Hashicorp Vault Secret Manager Auth](../secret_managers/hashicorp_vault.md)
| HELICONE_API_KEY | API key for Helicone service
| HELICONE_API_BASE | Base URL for Helicone service, defaults to `https://api.helicone.ai`
| HELICONE_MOCK | Enable mock mode for Helicone integration testing. When set to true, intercepts Helicone API calls and returns mock responses without making actual network calls. Default is false
| HELICONE_MOCK_LATENCY_MS | Mock latency in milliseconds for Helicone API calls when mock mode is enabled. Simulates network round-trip time. Default is 100ms
| HOSTNAME | Hostname for the server, this will be [emitted to `datadog` logs](https://docs.litellm.ai/docs/proxy/logging#datadog)
| HOURS_IN_A_DAY | Hours in a day for calculation purposes. Default is 24
| HIDDENLAYER_API_BASE | Base URL for HiddenLayer API. Defaults to `https://api.hiddenlayer.ai`
| HIDDENLAYER_AUTH_URL | Authentication URL for HiddenLayer. Defaults to `https://auth.hiddenlayer.ai`
| HIDDENLAYER_CLIENT_ID | Client ID for HiddenLayer SaaS authentication
| HIDDENLAYER_CLIENT_SECRET | Client secret for HiddenLayer SaaS authentication
| HUGGINGFACE_API_BASE | Base URL for Hugging Face API
| HUGGINGFACE_API_KEY | API key for Hugging Face API
| HUMANLOOP_PROMPT_CACHE_TTL_SECONDS | Time-to-live in seconds for cached prompts in Humanloop. Default is 60
| IAM_TOKEN_DB_AUTH | Set to `True` to authenticate PostgreSQL on Amazon RDS or Amazon Aurora with a short-lived IAM token. LiteLLM generates and refreshes the token with boto3. This option does not support Google Cloud SQL; use the Cloud SQL Auth Proxy with `--auto-iam-authn` instead. Cannot be combined with `AZURE_POSTGRESQL_AUTH`. Requires `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_USER`, and `DATABASE_NAME`. For ECS task-role setup and restart behavior, see [`--iam_token_db_auth`](./cli#--iam_token_db_auth). |
| IBM_GUARDRAILS_API_BASE | Base URL for IBM Guardrails API
| IBM_GUARDRAILS_AUTH_TOKEN | Authorization bearer token for IBM Guardrails API
| INITIAL_RETRY_DELAY | Initial delay in seconds for retrying requests. Default is 0.5
| JITTER | Jitter factor for retry delay calculations. Default is 0.75
| JSON_LOGS | Enable JSON formatted logging
| JWT_AUDIENCE | Expected audience for JWT tokens
| JWT_ISSUER | Expected issuer (`iss` claim) for JWT tokens. When set, PyJWT verifies the `iss` claim and rejects tokens from other issuers
| JWT_PUBLIC_KEY_URL | URL to fetch public key for JWT verification
| LAGO_API_BASE | Base URL for Lago API
| LAGO_API_CHARGE_BY | Parameter to determine charge basis in Lago
| LAGO_API_EVENT_CODE | Event code for Lago API events
| LAGO_API_KEY | API key for accessing Lago services
| LANGFUSE_BASE_URL | Base URL for Langfuse service |
| LANGFUSE_DEBUG | Toggle debug mode for Langfuse
| LANGFUSE_FLUSH_INTERVAL | Interval for flushing Langfuse logs
| LANGFUSE_TRACING_ENVIRONMENT | Environment for Langfuse tracing
| LANGFUSE_HOST | Deprecated host URL for Langfuse service |
| LANGFUSE_MOCK | Enable mock mode for Langfuse integration testing. When set to true, intercepts Langfuse API calls and returns mock responses without making actual network calls. Default is false
| LANGFUSE_MOCK_LATENCY_MS | Mock latency in milliseconds for Langfuse API calls when mock mode is enabled. Simulates network round-trip time. Default is 100ms
| LANGFUSE_PUBLIC_KEY | Public key for Langfuse authentication
| LANGFUSE_RELEASE | Release version of Langfuse integration
| LANGFUSE_SECRET_KEY | Secret key for Langfuse authentication
| LANGFUSE_PROPAGATE_TRACE_ID | Flag to enable propagating trace ID to Langfuse. Default is False
| LANGSMITH_API_KEY | API key for Langsmith platform
| LANGSMITH_BASE_URL | Base URL for Langsmith service
| LANGSMITH_BATCH_SIZE | Batch size for operations in Langsmith
| LANGSMITH_DEFAULT_RUN_NAME | Default name for Langsmith run
| LANGSMITH_PROJECT | Project name for Langsmith integration
| LANGSMITH_SAMPLING_RATE | Sampling rate for Langsmith logging
| LANGSMITH_TENANT_ID | Tenant ID for Langsmith multi-tenant deployments
| LANGSMITH_MOCK | Enable mock mode for Langsmith integration testing. When set to true, intercepts Langsmith API calls and returns mock responses without making actual network calls. Default is false
| LANGSMITH_MOCK_LATENCY_MS | Mock latency in milliseconds for Langsmith API calls when mock mode is enabled. Simulates network round-trip time. Default is 100ms
| LANGTRACE_API_KEY | API key for Langtrace service
| LASSO_API_BASE | Base URL for Lasso API
| LASSO_API_KEY | API key for Lasso service
| LASSO_USER_ID | User ID for Lasso service
| LASSO_CONVERSATION_ID | Conversation ID for Lasso service
| LENGTH_OF_LITELLM_GENERATED_KEY | Length of keys generated by LiteLLM. Default is 16
| LEGACY_MULTI_INSTANCE_RATE_LIMITING | Flag to enable legacy multi-instance rate limiting. **Default is False**
| LITERAL_API_KEY | API key for Literal integration
| LITERAL_API_URL | API URL for Literal service
| LITERAL_BATCH_SIZE | Batch size for Literal operations
| LITELLM_ANTHROPIC_BETA_HEADERS_URL | Custom URL for fetching Anthropic beta headers configuration. Default is the GitHub main branch URL
| LITELLM_ANTHROPIC_DISABLE_URL_SUFFIX | Disable automatic URL suffix appending for Anthropic API base URLs. When set to `true`, prevents LiteLLM from automatically adding `/v1/messages` or `/v1/complete` to custom Anthropic API endpoints
| LITELLM_ANTHROPIC_PROMPT_CACHING_TTL | Cache lifetime for the breakpoints injected by `LITELLM_ENABLE_ANTHROPIC_PROMPT_CACHING`, either `5m` or `1h`. Defaults to Anthropic's 5 minute ephemeral cache. `1h` suits long agentic sessions but doubles the cache write premium. Any other value falls back to the default. Can also be set via `litellm_settings.anthropic_prompt_caching_ttl`
| LITELLM_ENABLE_ANTHROPIC_PROMPT_CACHING | When set to `true`, automatically injects Anthropic `cache_control` breakpoints on the system prompt and the trailing turn for Anthropic and Bedrock Claude models, so clients such as Claude Code that never set `cache_control` themselves still get prompt caching. Default is `false`. Requests that already carry their own `cache_control` are left untouched. Note that the provider caches a prefix against the upstream credentials that sent it rather than per end user, so enabling this makes every caller's prompts cacheable on that shared account; leave it off if callers sharing a set of credentials must not learn whether another caller recently sent a given prompt. Can also be set via `litellm_settings.enable_anthropic_prompt_caching`
| LITELLM_ASSETS_PATH | Path to directory for UI assets and logos. Used when running with read-only filesystem (e.g., Kubernetes). Default is `/var/lib/litellm/assets` in Docker.
| LITELLM_AUTOROUTER_PRESETS_URL | Custom URL for fetching the auto-router preset catalog. Default is the GitHub main branch URL
| LITELLM_BILLING_METRICS_ENDPOINT | Collector URL for [enterprise billable-request metering](billing_metrics). Requires an enterprise license; unset disables metering
| LITELLM_BILLING_METRICS_CLIENT_CERT | mTLS client certificate for billable-request metering. Accepts a file path or inline PEM content
| LITELLM_BILLING_METRICS_CLIENT_KEY | Private key matching `LITELLM_BILLING_METRICS_CLIENT_CERT`. Accepts a file path or inline PEM content
| LITELLM_BILLING_METRICS_CA_CERT | CA bundle for verifying the metering collector. Only for private or test collectors; unset uses the system trust store
| LITELLM_BILLING_METRICS_EXPORT_INTERVAL_MS | Push cadence for billable-request metering in milliseconds. Default is 60000
| LITELLM_BLOG_POSTS_URL | Custom URL for fetching LiteLLM blog posts JSON. Default is the GitHub main branch URL
| LITELLM_CLI_DISABLE_KEYRING | Set on the machine running the `lite` CLI to `1`, `true`, `yes`, or `on` to keep the CLI away from the OS keychain, so the credential from `lite login` stays in `~/.litellm/token.json` (`0600`) instead. Unset by default, which stores the credential in the keychain whenever one is reachable
| LITELLM_CLI_JWT_EXPIRATION_HOURS | Expiration time in hours for CLI-generated JWT tokens. Default is 24 hours
| LITELLM_CLI_SSO_CLAIM_MAP | Alias for `CLI_SSO_CLAIM_MAP` — allowlisted OIDC claims for CLI SSO attribution metadata
| LITELLM_CORS_ALLOW_CREDENTIALS | Set to `true` to explicitly allow credentials in CORS responses. When not set, credentials are disabled automatically if `LITELLM_CORS_ORIGINS` is `*` (wildcard) to prevent the browser security misconfiguration of reflecting any origin with credentials
| LITELLM_CORS_ORIGINS | Comma-separated list of allowed CORS origins (e.g. `https://app.example.com,https://admin.example.com`). Defaults to `*` (all origins) when not set
| LITELLM_DD_AGENT_HOST | Hostname or IP of DataDog agent for LiteLLM-specific logging. When set, logs are sent to agent instead of direct API
| LITELLM_DEPLOYMENT_ENVIRONMENT | Environment name for the deployment (e.g., "production", "staging"). Used as a fallback when OTEL_ENVIRONMENT_NAME is not set. Sets the `environment` tag in telemetry data
| LITELLM_DETAILED_TIMING | When true, adds detailed per-phase timing headers to responses (`x-litellm-timing-{pre-processing,llm-api,post-processing,message-copy}-ms`). Default is false. See [latency overhead docs](../troubleshoot/latency_overhead.md)
| LITELLM_DD_AGENT_PORT | Port of DataDog agent for LiteLLM-specific log intake. Default is 10518
| LITELLM_DD_LLM_OBS_PORT | Port for Datadog LLM Observability agent. Default is 8126
| LITELLM_DEFAULT_EMBEDDING_ENCODING_FORMAT | Default `encoding_format` for OpenAI-compatible embedding calls when it is not set on the request or in model `litellm_params` (e.g. `float`, `base64`). Fallback is `float`. See [Embeddings](./embedding.md#embedding-encoding-format).
| LITELLM_DEV_ENV_HOT_RELOAD | Internal flag the proxy sets on itself when started with `--reload`, signalling reloaded workers to re-read `.env` with `override=True` so edits to existing keys take effect on reload. Not meant to be set by users
| LITELLM_DONT_SHOW_FEEDBACK_BOX | Flag to hide feedback box in LiteLLM UI
| LITELLM_DROP_PARAMS | Parameters to drop in LiteLLM requests
| LITELLM_MODIFY_PARAMS | Parameters to modify in LiteLLM requests
| LITELLM_EMAIL | Email associated with LiteLLM account
| LITELLM_FAVICON_URL | Custom URL for the LiteLLM UI favicon. When set, overrides the default favicon
| LITELLM_GLOBAL_MAX_PARALLEL_REQUEST_RETRIES | Maximum retries for parallel requests in LiteLLM
| LITELLM_GLOBAL_MAX_PARALLEL_REQUEST_RETRY_TIMEOUT | Timeout for retries of parallel requests in LiteLLM
| LITELLM_DISABLE_ACCESS_LOG_PATHS | Comma-separated list of URL paths to exclude from uvicorn access logs (e.g., `/health,/metrics`). Useful for suppressing noisy health-check log entries. |
| LITELLM_DISABLE_LAZY_LOADING | When set to "1", "true", "yes", or "on", disables lazy loading of attributes (currently only affects encoding/tiktoken). This ensures encoding is initialized before VCR starts recording HTTP requests, fixing VCR cassette creation issues. See [issue #18659](https://github.com/BerriAI/litellm/issues/18659)
| LITELLM_DISABLE_NO_REDIS_WARNING | When set to "true", hides the Admin UI banner shown while no Redis is configured. Set it only on single-worker deployments; see [What Needs Redis](./redis_requirements.md).
| LITELLM_DISABLE_REDACT_SECRETS | When set to "true", disables automatic redaction of secrets (API keys, tokens, credentials) from proxy log output. Secret redaction is enabled by default.
| LITELLM_DISABLE_ACCESS_LOG_PATHS | Comma-separated list of exact request paths whose uvicorn access-log lines should be dropped (e.g. health checks, root probes, metrics scrapes that flood logs). Path is matched against the portion before any query string. Empty/unset disables filtering.
| LITELLM_MIGRATION_DIR | Custom migrations directory for prisma migrations, used for baselining db in read-only file systems.
| LITELLM_HOSTED_UI | URL of the hosted UI for LiteLLM
| LITELLM_UI_API_DOC_BASE_URL | Optional override for the API Reference base URL (used in sample code/docs) when the admin UI runs on a different host than the proxy. Defaults to `PROXY_BASE_URL` when unset.
| LITELLM_UI_PATH | Path to directory for Admin UI files. Used when running with read-only filesystem (e.g., Kubernetes). Default is `/var/lib/litellm/ui` in Docker.
| LITELLM_UI_SESSION_DURATION | Duration for UI login session (username/password, SSO, invitation links). Format: "30s", "30m", "24h", "7d". Does not apply to EXPERIMENTAL_UI_LOGIN flow, which uses a fixed 10-minute expiry for security. Default is "24h"
| LITELLM_EXPIRED_UI_SESSION_KEY_CLEANUP_BATCH_SIZE | Maximum number of expired LiteLLM dashboard session keys to delete per cleanup run. Default is 1000.
| LITELLM_EXPIRED_UI_SESSION_KEY_CLEANUP_ENABLED | Set to `true` to enable the background cleanup job for expired LiteLLM dashboard session keys. Default is `false`.
| LITELLM_EXPIRED_UI_SESSION_KEY_CLEANUP_INTERVAL_SECONDS | Interval in seconds for how often to run the expired LiteLLM dashboard session key cleanup job. Default is 86400 (24 hours).
| LITELM_ENVIRONMENT | Environment of LiteLLM Instance, used by logging services. Currently only used by DeepEval.
| LITELLM_KEY_ROTATION_ENABLED | Enable auto-key rotation for LiteLLM (boolean). Default is false.
| LITELLM_KEY_ROTATION_CHECK_INTERVAL_SECONDS | Interval in seconds for how often to run job that auto-rotates keys. Default is 86400 (24 hours).
| LITELLM_KEY_ROTATION_GRACE_PERIOD | Duration to keep old key valid after rotation (e.g. "24h", "2d"). Default is empty (immediate revoke). Used for scheduled rotations and as fallback when not specified in regenerate request.
| LITELLM_KEY_ROTATION_LOCK_TTL_SECONDS | TTL in seconds for the distributed lock used by the key rotation job. Default is 600 (10 minutes).
| LITELLM_JOB_ROLE | Which scheduled background jobs this process registers. `all` (the default when unset) and `worker` register every job; `serving` registers no single-owner job, so a serving deployment can leave budget resets, spend log cleanup, key rotation, usage exports and the other shared jobs to a dedicated worker deployment. Case insensitive; an unrecognized value falls back to `all` with a warning. See [Run background jobs on a dedicated worker](./prod.md#run-background-jobs-on-a-dedicated-worker).
| LITELLM_LICENSE | License key for LiteLLM usage
| LITELLM_LOCAL_ANTHROPIC_BETA_HEADERS | Set to `True` to use the local bundled Anthropic beta headers config only, disabling remote fetching. Default is `False`
| LITELLM_LOCAL_AUTOROUTER_PRESETS | Set to `True` to serve the auto-router preset catalog bundled with the package only, disabling remote fetching. Default is `False`
| LITELLM_OIDC_ALLOWED_CREDENTIAL_DIRS | Comma-separated list of absolute directories from which the `oidc/file/` provider is permitted to read token files. Defaults to `/var/run/secrets,/run/secrets`.
| LITELLM_LOCAL_BLOG_POSTS | When set to `True`, uses the local bundled blog posts only, disabling remote fetching from GitHub. Default is `False`
| LITELLM_LOCAL_MODEL_COST_MAP | Local configuration for model cost mapping in LiteLLM
| LITELLM_LOCAL_POLICY_TEMPLATES | When set to "true", uses local backup policy templates instead of fetching from GitHub. Policy templates are fetched from https://raw.githubusercontent.com/BerriAI/litellm/main/policy_templates.json by default, with automatic fallback to local backup on failure
| LITELLM_LOG | Enable detailed logging for LiteLLM
| LITELLM_MODEL_COST_MAP_URL | URL for fetching model cost map data. Default is https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json
| LITELLM_LOG_FILE | File path to write LiteLLM logs to. When set, logs will be written to both console and the specified file
| LITELLM_LOGGER_NAME | Name for OTEL logger 
| LITELLM_METER_NAME | Name for OTEL Meter 
| LITELLM_OTEL_INTEGRATION_ENABLE_EVENTS | Optionally enable semantic logs (`gen_ai.content.prompt`/`gen_ai.content.completion`, or `gen_ai.client.inference.operation.details` in semconv mode) for OTEL. Default `false`. See [OpenTelemetry](/docs/observability/opentelemetry_integration#configuration-reference)
| LITELLM_OTEL_INTEGRATION_ENABLE_METRICS | Optionally enable semantic metrics (TTFT, TPOT, response duration, cost, token usage) for OTEL. Default `false`. See [OpenTelemetry](/docs/observability/opentelemetry_integration#metrics-reference)
| LITELLM_OTEL_BAGGAGE_TEAM_METADATA_KEYS | Comma-separated allowlist of team-metadata sub-keys promoted onto OTEL spans under `litellm.team.metadata`. Empty by default, so none of a team's free-form metadata is sent to your tracing backend until each sub-key is explicitly allowlisted. Also settable as `baggage_team_metadata_keys` under `callback_settings.otel` in config.yaml. See [OpenTelemetry](/docs/observability/opentelemetry_integration).
| LITELLM_ENABLE_PYROSCOPE | If true, enables Pyroscope CPU profiling. Profiles are sent to PYROSCOPE_SERVER_ADDRESS. Off by default. See [Pyroscope profiling](/docs/proxy/pyroscope_profiling).
| LITELLM_ENABLE_TEAM_STALE_ALIAS_BYPASS | When `true`, if a team's legacy `model_aliases` entry maps a public model name to an internal `model_name_<team_id>_<uuid>` deployment, pre-call handling can skip that rewrite when team-scoped sibling deployments exist for the public name—so load balancing / `order` apply across siblings. Default is `false` for backwards compatibility. See [Team-scoped models and legacy aliases](./load_balancing#team-scoped-models-and-legacy-model_aliases). When stale aliases are detected and this flag is off, the proxy may log a one-time warning.
| PYROSCOPE_APP_NAME | Application name reported to Pyroscope. Required when LITELLM_ENABLE_PYROSCOPE is true. No default.
| PYROSCOPE_SERVER_ADDRESS | Pyroscope server URL to send profiles to. Required when LITELLM_ENABLE_PYROSCOPE is true. No default.
| PYROSCOPE_SAMPLE_RATE | Optional. Sample rate for Pyroscope profiling (integer). No default; when unset, the pyroscope-io library default is used.
| PYROSCOPE_GRAFANA_USER | Optional. Grafana Cloud Pyroscope user/tenant ID for basic auth. Required when PYROSCOPE_GRAFANA_API_TOKEN is set.
| PYROSCOPE_GRAFANA_API_TOKEN | Optional. Grafana Cloud API/access policy token for Pyroscope basic auth. Required when PYROSCOPE_GRAFANA_USER is set.
| LITELLM_MASTER_KEY | Master key for proxy authentication
| LITELLM_MAX_BUDGET_PER_SESSION_TTL | TTL in seconds for session budget counters used by the max-budget-per-session limiter. Default is 3600 (1 hour)
| LITELLM_MAX_ITERATIONS_TTL | TTL in seconds for session iteration counters used by the max-iterations limiter. Default is 3600 (1 hour)
| LITELLM_MAX_STREAMING_DURATION_SECONDS | Maximum duration in seconds allowed for a streaming response. Streams exceeding this duration are terminated with a Timeout error. Default is None (no limit)
| LITELLM_STORE_AUDIT_LOGS | Flag to record an audit log entry for every create, update and delete performed on management objects such as keys, teams and users. Environment equivalent of `litellm_settings.store_audit_logs`, read only when the config leaves that setting unset, and writing the entries requires an enterprise license. **Defaults to True on an enterprise license, False otherwise**
| LITELLM_STREAM_INACTIVITY_TIMEOUT_SECONDS | Maximum seconds to wait for the next chunk from an async streaming provider before raising a Timeout. Guards against a provider that keeps the connection warm with keepalive bytes but stops sending content. Default is None (disabled)
| LITELLM_MODE | Operating mode for LiteLLM (e.g., production, development)
| LITELLM_NON_ROOT | Flag to run LiteLLM in non-root mode for enhanced security in Docker containers
| LITELLM_RATE_LIMIT_WINDOW_SIZE | Rate limit window size for LiteLLM. Default is 60
| LITELLM_REASONING_AUTO_SUMMARY | If set to "true", automatically enables detailed reasoning summaries (`summary: "detailed"`) for reasoning models across all translation paths (Anthropic adapter, Responses API, etc.). Default is "false"
| LITELLM_SALT_KEY | Salt key for encryption in LiteLLM
| LITELLM_SET_REPLICA_IDENTITY_FULL | Set to `true` to run `ALTER TABLE ... REPLICA IDENTITY FULL` on every LiteLLM table at the end of each migration run. Logical replication consumers such as Neon or lakehouse sync need FULL replica identity to read the old row of an UPDATE or DELETE; Prisma leaves new tables at the Postgres default. Requires the migration user to own the tables. Default is `false`
| LITELLM_SENSITIVE_ROUTING_TTL | TTL in seconds for sticky sensitive-data routing decisions; controls how long a session stays pinned to the on-premise model selected by a routing guardrail. Default is 3600
| LITELLM_SSL_CIPHERS | SSL/TLS cipher configuration for faster handshakes. Controls cipher suite preferences for OpenSSL connections.
| LITELLM_SECRET_AWS_KMS_LITELLM_LICENSE | AWS KMS encrypted license for LiteLLM
| LITELLM_TOKEN | Access token for LiteLLM integration
| LITELLM_TPM_TOKEN_RESERVATION_ENABLED | Default `true`. Set to `false` to disable pre-request TPM reservation in the v3 rate limiter and apply actual usage after each real-time request completes. This removes one Redis operation per request, but concurrent requests may temporarily exceed the TPM limit. This setting does not apply to `POST /v1/batches`, which uses a [separate input-file limiter](../batches#how-rate-limiting-for-batches-api-works). See [Estimated output tokens](./users#estimated-output-tokens-requests-without-max_tokens). |
| LITELLM_USE_CHAT_COMPLETIONS_URL_FOR_ANTHROPIC_MESSAGES | When set to "true", routes OpenAI /v1/messages requests through chat/completions instead of the Responses API for Anthropic models. Can also be set via `litellm_settings.use_chat_completions_url_for_anthropic_messages`
| LITELLM_ROUTE_ALL_CHAT_OPENAI_TO_RESPONSES | When set to "true", routes all OpenAI /chat/completions requests through the Responses API bridge. Recommended for OpenAI models. Can also be set via `litellm_settings.route_all_chat_openai_to_responses`
| LITELLM_GEMINI_LIVE_DEFER_SETUP | When set to "true", defers Gemini/Vertex Live setup until the client sends `session.update` (required for runtime tool injection). Default is "false" for backwards compatibility, which auto-sends setup on connect. Can also be set via `litellm.gemini_live_defer_setup`
| LITELLM_USE_LEGACY_INTERACTIONS_SCHEMA | When set to "true", uses the legacy Google Interactions API schema (`outputs` array, `2026-05-07` revision) instead of the new schema (`steps` array, `2026-05-20` revision). The legacy schema will be sunset on June 8, 2026. Can also be set via `litellm_settings.use_legacy_interactions_schema`
| LITELLM_USER_AGENT | Custom user agent string for LiteLLM API requests. Used for partner telemetry attribution
| LITELLM_WORKER_STARTUP_HOOKS | Comma-separated list of `module.path:function_name` callables to run in each worker process during startup. Runs early in the worker lifecycle (before config/DB loading). Useful for re-initializing per-process state like [gflags](https://github.com/google/python-gflags). See [Worker Startup Hooks](/docs/proxy/worker_startup_hooks) for details
| LITELLM_PRINT_STANDARD_LOGGING_PAYLOAD | If true, prints the standard logging payload to the console - useful for debugging
| LITELLM_PRISMA_BOOTSTRAP_TIMEOUT | Seconds allowed for the one-time install of the Node toolchain the Prisma CLI runs on, performed once per container before any migration. Raise it on slow or bandwidth-constrained nodes where the install takes longer than ten minutes. A non-positive or non-numeric value is ignored with a warning and the default applies. **Default is 600**
| LITELLM_PRISMA_COMMAND_TIMEOUT | Seconds any single Prisma command other than `prisma migrate deploy` may run before it is killed and retried. Raise it when the migration status, resolve, or db push steps against a large or heavily loaded database legitimately take longer than a minute. A value that is not a positive number is ignored with a warning and the default applies, so a typo cannot accidentally disable the timeout. **Default is 60**
| LITELLM_PRISMA_MIGRATE_DEPLOY_TIMEOUT | Seconds one `prisma migrate deploy` may run before it is killed and retried. That command applies every pending migration in one go, so a fresh or long-idle database needs far longer than any other Prisma command. Raise it when applying the backlog takes longer than ten minutes; lower it to fail faster on a database that never answers. A value that is not a positive number is ignored with a warning and the default applies. When it is not set, the budget is the larger of 600 and `LITELLM_PRISMA_COMMAND_TIMEOUT`, so a deployment that already raised the per-command timeout to get through a slow deploy keeps that larger budget. **Default is 600**
| LITELM_ENVIRONMENT | Environment for LiteLLM Instance. This is currently only logged to DeepEval to determine the environment for DeepEval integration.
| LITELLM_ASYNCIO_QUEUE_MAXSIZE | Maximum size for asyncio queues (e.g. log queues, spend update queues, and cookbook examples such as realtime audio in `nova_sonic_realtime.py`). Bounds in-memory growth to prevent OOM. Default is 1000.
| LOGFIRE_TOKEN | Token for Logfire logging service
| LOGFIRE_BASE_URL | Base URL for Logfire logging service (useful for self hosted deployments)
| LOGGING_WORKER_CONCURRENCY | Maximum number of concurrent coroutine slots for the logging worker on the asyncio event loop. Default is 100. Setting too high will flood the event loop with logging tasks which will lower the overall latency of the requests.
| LOGGING_WORKER_MAX_QUEUE_SIZE | Maximum size of the logging worker queue. When the queue is full, the worker aggressively clears tasks to make room instead of dropping logs. Default is 50,000
| LOGGING_WORKER_MAX_TIME_PER_COROUTINE | Maximum time in seconds allowed for each coroutine in the logging worker before timing out. Default is 20.0
| LOGGING_WORKER_CLEAR_PERCENTAGE | Percentage of the queue to extract when clearing. Default is 50% 
| MAX_BASE64_LENGTH_FOR_LOGGING | Maximum number of base64 characters to keep in logging payloads. Data URIs exceeding this are replaced with a size placeholder. Set to 0 to disable truncation. Default is 64
| MAX_COMPETITOR_NAMES | Maximum number of competitor names allowed in policy template enrichment. Default is 100
| MAX_EXCEPTION_MESSAGE_LENGTH | Maximum length for exception messages. Default is 2000
| MAX_ITERATIONS_TO_CLEAR_QUEUE | Maximum number of iterations to attempt when clearing the logging worker queue during shutdown. Default is 200
| MAX_TIME_TO_CLEAR_QUEUE | Maximum time in seconds to spend clearing the logging worker queue during shutdown. Default is 5.0
| LOGGING_WORKER_AGGRESSIVE_CLEAR_COOLDOWN_SECONDS | Cooldown time in seconds before allowing another aggressive clear operation when the queue is full. Default is 0.5 
| MAX_STRING_LENGTH_PROMPT_IN_DB | Maximum length for strings in spend logs when sanitizing request bodies. Strings longer than this will be truncated. Default is 1000
| MAX_IN_MEMORY_QUEUE_FLUSH_COUNT | Maximum count for in-memory queue flush operations. Default is 1000
| MAX_IMAGE_URL_DOWNLOAD_SIZE_MB | Maximum size in MB for downloading images from URLs. Prevents memory issues from downloading very large images. Images exceeding this limit will be rejected before download. Set to 0 to completely disable image URL handling (all image_url requests will be blocked). Default is 50MB (matching [OpenAI's limit](https://platform.openai.com/docs/guides/images-vision?api-mode=chat#image-input-requirements))
| MAX_LONG_SIDE_FOR_IMAGE_HIGH_RES | Maximum length for the long side of high-resolution images. Default is 2000
| MAX_REDIS_BUFFER_DEQUEUE_COUNT | Maximum count for Redis buffer dequeue operations. Default is 100
| MAX_REQUEST_BODY_SIZE_TO_REPAIR_MB | Maximum request body size in MB that LiteLLM will attempt to repair when it fails to parse as JSON. The repair fallback runs two full-body regex passes to fix invalid surrogate escapes, which blocks the event loop on large malformed payloads. Bodies above this size skip the repair and return a 400 immediately; bodies at or below it are still repaired. Set to 0 to disable the cap and always attempt repair. Default is 1 (MB)
| MAX_SHORT_SIDE_FOR_IMAGE_HIGH_RES | Maximum length for the short side of high-resolution images. Default is 768
| MAX_SIZE_IN_MEMORY_QUEUE | Maximum size for in-memory queue. Default is 10000
| MAX_SIZE_PER_ITEM_IN_MEMORY_CACHE_IN_KB | Maximum size in KB for each item in memory cache. Default is 512 or 1024
| MAX_SPENDLOG_ROWS_TO_QUERY | Maximum number of spend log rows to query. Default is 1,000,000
| MAX_TEAM_LIST_LIMIT | Maximum number of teams to list. Default is 20
| MAX_TILE_HEIGHT | Maximum height for image tiles. Default is 512
| MAX_TILE_WIDTH | Maximum width for image tiles. Default is 512
| MAX_TOKEN_TRIMMING_ATTEMPTS | Maximum number of attempts to trim a token message. Default is 10
| MAXIMUM_TRACEBACK_LINES_TO_LOG | Maximum number of lines to log in traceback in LiteLLM Logs UI. Default is 100
| MAX_RETRY_DELAY | Maximum delay in seconds for retrying requests. Default is 8.0
| MAX_LANGFUSE_INITIALIZED_CLIENTS | Maximum number of Langfuse clients to initialize on proxy. Default is 50. This is set since langfuse initializes 1 thread everytime a client is initialized. We've had an incident in the past where we reached 100% cpu utilization because Langfuse was initialized several times.
| MAX_MCP_SEMANTIC_FILTER_TOOLS_HEADER_LENGTH | Maximum header length for MCP semantic filter tools. Default is 150
| MAX_POLICY_ESTIMATE_IMPACT_ROWS | Maximum number of rows returned when estimating the impact of a policy. Default is 1000
| MAX_PAYLOAD_SIZE_FOR_DEBUG_LOG | Maximum payload size in bytes for full DEBUG serialization. Payloads exceeding this will be truncated in logs. Default is 102400 (100 KB)
| MIN_NON_ZERO_TEMPERATURE | Minimum non-zero temperature value. Default is 0.0001
| MINIMUM_CUSTOM_KEY_LENGTH | Minimum length for user supplied key values on /key/generate and /key/regenerate. Default is 16
| MINIMUM_PROMPT_CACHE_TOKEN_COUNT | Minimum token count for caching a prompt. Default is 1024
| MISTRAL_API_BASE | Base URL for Mistral API. Default is https://api.mistral.ai
| MISTRAL_API_KEY | API key for Mistral API
| MICROSOFT_AUTHORIZATION_ENDPOINT | Custom authorization endpoint URL for Microsoft SSO (overrides default Microsoft OAuth authorization endpoint)
| MICROSOFT_CLIENT_ID | Client ID for Microsoft services
| MICROSOFT_CLIENT_SECRET | Client secret for Microsoft services
| MICROSOFT_GRAPH_ENDPOINT | Microsoft Graph API base URL used when syncing Entra ID group memberships during SSO. Defaults to `https://graph.microsoft.com/v1.0`. Set to `https://graph.microsoft.us/v1.0` for Azure Government Cloud (GCC High)
| MICROSOFT_SERVICE_PRINCIPAL_ID | Service Principal ID for Microsoft Enterprise Application. (This is an advanced feature if you want litellm to auto-assign members to Litellm Teams based on their Microsoft Entra ID Groups)
| MICROSOFT_TENANT | Tenant ID for Microsoft Azure
| MICROSOFT_TOKEN_ENDPOINT | Custom token endpoint URL for Microsoft SSO (overrides default Microsoft OAuth token endpoint)
| MICROSOFT_USER_DISPLAY_NAME_ATTRIBUTE | Field name for user display name in Microsoft SSO response. Default is `displayName`
| MICROSOFT_USER_EMAIL_ATTRIBUTE | Field name for user email in Microsoft SSO response. Default is `userPrincipalName`
| MICROSOFT_USER_FIRST_NAME_ATTRIBUTE | Field name for user first name in Microsoft SSO response. Default is `givenName`
| MICROSOFT_USER_ID_ATTRIBUTE | Field name for user ID in Microsoft SSO response. Default is `id`
| MICROSOFT_USER_LAST_NAME_ATTRIBUTE | Field name for user last name in Microsoft SSO response. Default is `surname`
| MICROSOFT_USERINFO_ENDPOINT | Custom userinfo endpoint URL for Microsoft SSO (overrides default Microsoft Graph userinfo endpoint)
| MODEL_COST_MAP_MAX_SHRINK_RATIO | Maximum allowed shrinkage ratio when validating a fetched model cost map against the local backup. Rejects the fetched map if it is smaller than this fraction of the backup. Default is 0.5
| MODEL_COST_MAP_MIN_MODEL_COUNT | Minimum number of models a fetched cost map must contain to be considered valid. Default is 50
| NEW_RELIC_APP_NAME | Application name for New Relic AI Monitoring integration |
| NEW_RELIC_LICENSE_KEY | License key for New Relic authentication |
| NO_DOCS | Flag to disable Swagger UI documentation
| NO_OPENAPI | Flag to disable the /openapi.json endpoint
| NO_REDOC | Flag to disable Redoc documentation
| NO_PROXY | List of addresses to bypass proxy
| NON_LLM_CONNECTION_TIMEOUT | Timeout in seconds for non-LLM service connections. Default is 15
| OAUTH_TOKEN_INFO_ENDPOINT | Endpoint for OAuth token info retrieval
| OPENAI_BASE_URL | Base URL for OpenAI API
| OPENAI_API_BASE | Base URL for OpenAI API. Default is https://api.openai.com/
| OPENAI_API_KEY | API key for OpenAI services
| OPENAI_CHATGPT_API_BASE | Alternative to CHATGPT_API_BASE. Base URL for ChatGPT API
| OPENAI_FILE_SEARCH_COST_PER_1K_CALLS | Cost per 1000 calls for OpenAI file search. Default is 0.0025
| OPENAI_IDENTITY_PROVIDER_ID | Identity provider ID (`idp_...`) for OpenAI workload identity federation. When this, `OPENAI_SERVICE_ACCOUNT_ID`, and `OPENAI_IDENTITY_TOKEN_FILE` are all set and no OpenAI API key is configured, the proxy authenticates `openai/` models by exchanging the OIDC token for a short-lived bearer (RFC 8693). These env vars are the proxy-wide default; the same three values can be set per deployment or per credential as `openai_identity_provider_id`, `openai_service_account_id`, and `openai_identity_token_file`, which take precedence. See [OpenAI workload identity federation](../providers/openai#workload-identity-federation-no-api-key). Requires `openai>=2.32.0`
| OPENAI_IDENTITY_TOKEN_FILE | Path to the OIDC subject token file used for OpenAI workload identity federation, e.g. the Kubernetes projected service account token path
| OPENAI_ORGANIZATION | Organization identifier for OpenAI
| OPENAI_SERVICE_ACCOUNT_ID | OpenAI platform service account ID (`user-...`) that workload identity federation authenticates as. Unrelated to LiteLLM virtual-key service accounts
| OPENAPI_URL | The path to the OpenAPI JSON endpoint. **By default this is "/openapi.json"**
| OPENID_BASE_URL | Base URL for OpenID Connect services
| OPENID_CLIENT_ID | Client ID for OpenID Connect authentication
| OPENID_CLIENT_SECRET | Client secret for OpenID Connect authentication
| OPENMETER_API_ENDPOINT | API endpoint for OpenMeter integration
| OPENMETER_API_KEY | API key for OpenMeter services
| OPENMETER_EVENT_TYPE | Type of events sent to OpenMeter
| OPENMETER_TRUST_REQUEST_USER | If false, ignore the request body `user` and resolve the OpenMeter subject from the authenticated key's user_id. Defaults to true
| ONYX_API_BASE | Base URL for Onyx Security AI Guard service (defaults to https://ai-guard.onyx.security)
| ONYX_API_KEY | API key for Onyx Security AI Guard service
| ONYX_TIMEOUT | Timeout in seconds for Onyx Guard server requests. Default is 10
| OTEL_ENDPOINT | OpenTelemetry endpoint for traces
| OTEL_EXPORTER_OTLP_ENDPOINT | OpenTelemetry endpoint for traces
| OTEL_ENVIRONMENT_NAME | Environment name for OpenTelemetry
| OTEL_EXPORTER | Exporter type for OpenTelemetry
| OTEL_EXPORTER_OTLP_PROTOCOL | Exporter type for OpenTelemetry
| OTEL_HEADERS | Headers for OpenTelemetry requests
| OTEL_MODEL_ID | Model ID for OpenTelemetry tracing
| OTEL_EXPORTER_OTLP_HEADERS | Headers for OpenTelemetry requests
| OTEL_SERVICE_NAME | Service name identifier for OpenTelemetry
| OTEL_TRACER_NAME | Tracer name for OpenTelemetry tracing
| OTEL_LOGS_EXPORTER | Exporter type for OpenTelemetry logs (e.g., console)
| OTEL_IGNORE_CONTEXT_PROPAGATION | When true, ignore parent span context propagation (inbound `traceparent` headers and any active span) so every LiteLLM trace is its own root. Default `false`
| OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT | Controls whether prompts and completions are captured in OpenTelemetry traces. Accepts `NO_CONTENT` (default per spec), `SPAN_ONLY`, `EVENT_ONLY`, `SPAN_AND_EVENT`, or the boolean form (`true` maps to `EVENT_ONLY`, `false` to `NO_CONTENT`)
| OTEL_SEMCONV_STABILITY_OPT_IN | Set to `gen_ai_latest_experimental` to emit spans following the latest [OpenTelemetry GenAI semantic conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-spans/). Renames the LLM-call span to `{operation} {model}`, suppresses `raw_gen_ai_request`, adds `gen_ai.provider.name`, and consolidates events. Comma-separable per OTEL spec
| USE_OTEL_LITELLM_REQUEST_SPAN | When `true`, the proxy emits a discrete `litellm_request` span per LLM call as a child of the `Received Proxy Server Request` span. Default `false` (since v1.81.0); LLM-call attributes are set directly on the proxy root span. See [Why don't I see a `litellm_request` span?](/docs/observability/opentelemetry_integration#why-dont-i-see-a-litellm_request-span)
| OTEL_DEBUG | When `true`, prints exporter and span-creation diagnostics to stderr. Useful when traces aren't reaching your backend. Default `false`
| DEBUG_OTEL | Alias for `OTEL_DEBUG`
| PAGERDUTY_API_KEY | API key for PagerDuty Alerting
| PANW_PRISMA_AIRS_API_KEY | API key for PANW Prisma AIRS service
| PANW_PRISMA_AIRS_API_BASE | Base URL for PANW Prisma AIRS service
| PHOENIX_API_KEY | API key for Arize Phoenix
| PHOENIX_COLLECTOR_ENDPOINT | API endpoint for Arize Phoenix
| PHOENIX_COLLECTOR_HTTP_ENDPOINT | API http endpoint for Arize Phoenix
| PILLAR_API_BASE | Base URL for Pillar API Guardrails
| PILLAR_API_KEY | API key for Pillar API Guardrails
| PILLAR_ON_FLAGGED_ACTION | Action to take when content is flagged ('block' or 'monitor')
| PKCE_STRICT_CACHE_MISS | When set to `true`, the SSO callback will return a 401 error if the PKCE code_verifier is not found in the cache (e.g. due to a cache miss across pods). When `false` (default), it logs a warning and continues without the code_verifier.
| POD_NAME | Pod name for the server, this will be [emitted to `datadog` logs](https://docs.litellm.ai/docs/proxy/logging#datadog) as `POD_NAME` 
| POSTHOG_API_KEY | API key for PostHog analytics integration
| POSTHOG_API_URL | Base URL for PostHog API (defaults to https://us.i.posthog.com)
| POSTHOG_MOCK | Enable mock mode for PostHog integration testing. When set to true, intercepts PostHog API calls and returns mock responses without making actual network calls. Default is false
| POSTHOG_MOCK_LATENCY_MS | Mock latency in milliseconds for PostHog API calls when mock mode is enabled. Simulates network round-trip time. Default is 100ms
| PRISMA_AUTH_RECONNECT_LOCK_TIMEOUT_SECONDS | Lock timeout in seconds for Prisma auth reconnection. Default is 0.1
| PRISMA_AUTH_RECONNECT_TIMEOUT_SECONDS | Timeout in seconds for Prisma auth reconnection attempts. Default is 2.0
| PRISMA_HEALTH_WATCHDOG_ENABLED | Enable the Prisma DB health watchdog that monitors and reconnects on connection loss. Default is true
| PRISMA_HEALTH_WATCHDOG_INTERVAL_SECONDS | Interval in seconds for Prisma health watchdog probes. Default is 30
| PRISMA_HEALTH_WATCHDOG_PROBE_TIMEOUT_SECONDS | Timeout in seconds for each Prisma health probe. Default is 5.0
| PRISMA_RECONNECT_COOLDOWN_SECONDS | Cooldown in seconds between Prisma reconnection attempts. Default is 15
| PRISMA_RECONNECT_ESCALATION_THRESHOLD | Number of consecutive reconnect failures before escalating the reconnection strategy. Default is 3
| PRISMA_WATCHDOG_RECONNECT_TIMEOUT_SECONDS | Timeout in seconds for Prisma watchdog-initiated reconnection. Default is 30.0
| PREDIBASE_API_BASE | Base URL for Predibase API
| PRESIDIO_ANALYZER_API_BASE | Base URL for Presidio Analyzer service
| PRESIDIO_ANONYMIZER_API_BASE | Base URL for Presidio Anonymizer service
| PROMETHEUS_BUDGET_METRICS_PER_REQUEST_TIMEOUT | Maximum seconds to spend emitting per-request Prometheus budget metrics before skipping; on timeout the emission is dropped in isolation so a slow Redis/DB lookup cannot cancel the whole success-logging event. Default is 5.0
| PROMETHEUS_BUDGET_METRICS_REFRESH_INTERVAL_MINUTES | Refresh interval in minutes for Prometheus budget metrics. Default is 5
| PROMETHEUS_FALLBACK_STATS_SEND_TIME_HOURS | Fallback time in hours for sending stats to Prometheus. Default is 9
| PROMETHEUS_URL | URL for Prometheus service
| PROMPTLAYER_API_KEY | API key for PromptLayer integration
| PROXY_ADMIN_ID | Admin identifier for proxy server
| PROXY_BASE_URL | Base URL for proxy service. Also used by the MCP OAuth `authorize` endpoint as the proxy's public origin when validating browser-supplied `redirect_uri` values, and to decide whether session/SSO/SAML cookies are marked `Secure` — set this to the exact origin users see in their address bar (e.g. `https://llm.example.com`) when LiteLLM runs behind a TLS-terminating ingress. Full origin only: scheme + host (+ port if non-default), no trailing slash, no path. When set, it takes precedence over `X-Forwarded-*` headers (which only apply when [`use_x_forwarded_for`](#general_settings---reference) is `true` AND the request peer is in [`mcp_trusted_proxy_ranges`](#general_settings---reference)). See [Security best practices — Secure cookies behind a reverse proxy](./security_best_practices#8-configure-secure-cookies-behind-a-tls-terminating-reverse-proxy) and [MCP OAuth — Reverse proxy and ingress configuration](../mcp_oauth#reverse-proxy-and-ingress-configuration).
| PROXY_BATCH_WRITE_AT | Time in seconds to wait before batch writing spend logs to the database. Default is 10
| PROXY_BATCH_POLLING_INTERVAL | Time in seconds to wait before polling a batch, to check if it's completed. Default is 6000s (1 hour)
| PROXY_BATCH_POLLING_ENABLED | Set to `false` to disable the `CheckBatchCost` and `CheckResponsesCost` background polling jobs entirely. Useful for emergency mitigation on installs with large numbers of stale managed objects. Default is `true`
| PROXY_CONFIG_RELOAD_INTERVAL_SECONDS | How often each pod reloads config-in-DB objects (models, credentials, guardrails, etc.) from the database when `store_model_in_db` is enabled. Lower values speed up cross-pod convergence at the cost of more DB load; applied on proxy startup. Default is 30
| MAX_OBJECTS_PER_POLL_CYCLE | Maximum number of managed objects (batches / responses) fetched per polling cycle. Prevents OOM on installs with many stale rows. Default is `50`
| MANAGED_OBJECT_STALENESS_CUTOFF_DAYS | Managed objects older than this many days in a non-terminal state are marked `stale_expired` at the start of each poll cycle and skipped. Default is `7`
| PROXY_BUDGET_RESCHEDULER_MAX_TIME | Maximum time in seconds to wait before checking database for budget resets. Default is 605
| PROXY_BUDGET_RESCHEDULER_MIN_TIME | Minimum time in seconds to wait before checking database for budget resets. Default is 597
| PYTHON_GC_THRESHOLD | GC thresholds ('gen0,gen1,gen2', e.g. '1000,50,50'); defaults to Python’s values.
| PROXY_LOGOUT_URL | URL for logging out of the proxy service
| QDRANT_API_BASE | Base URL for Qdrant API
| QDRANT_API_KEY | API key for Qdrant service
| QDRANT_SCALAR_QUANTILE | Scalar quantile for Qdrant operations. Default is 0.99
| QDRANT_URL | Connection URL for Qdrant database
| QDRANT_VECTOR_SIZE | Vector size for Qdrant operations. Default is 1536
| REDIS_CONNECTION_POOL_TIMEOUT | Timeout in seconds for Redis connection pool. Default is 5
| REDIS_CIRCUIT_BREAKER_ENABLED | When false, the Redis circuit breaker is disabled and never opens. Default is true
| REDIS_CIRCUIT_BREAKER_FAILURE_THRESHOLD | Number of consecutive failures before the Redis circuit breaker opens. Default is 5
| REDIS_CIRCUIT_BREAKER_RECOVERY_TIMEOUT | Time in seconds before the Redis circuit breaker attempts recovery after opening. Default is 60
| REDIS_CIRCUIT_BREAKER_TIMEOUT_MIN_DURATION | Minimum duration in seconds a streak of timeout-only failures must persist before the Redis circuit breaker opens; hard connectivity failures still open it at the failure threshold. Default is 5.0
| REDIS_CLUSTER_NODES | JSON-formatted list of Redis cluster startup nodes for Redis Cluster mode. Example: `[{"host": "node1", "port": 6379}]`
| REDIS_HOST | Hostname for Redis server
| REDIS_PASSWORD | Password for Redis service
| REDIS_PORT | Port number for Redis server
| REDIS_SOCKET_TIMEOUT | Timeout in seconds for Redis socket operations. Default is 0.1
| REDIS_GCP_SERVICE_ACCOUNT | GCP service account for IAM authentication with Redis. Format: "projects/-/serviceAccounts/name@project.iam.gserviceaccount.com"
| REDIS_GCP_SSL_CA_CERTS | Path to SSL CA certificate file for secure GCP Memorystore Redis connections
| REDOC_URL | The path to the Redoc Fast API documentation. **By default this is "/redoc"**
| REPEATED_STREAMING_CHUNK_LIMIT | Limit for repeated streaming chunks to detect looping. Default is 100
| REALTIME_CREDENTIAL_RESOLUTION_TIMEOUT_SECONDS | Timeout in seconds for fetching the Vertex AI access token before a realtime session starts. Default is 20.0
| REALTIME_WEBSOCKET_MAX_MESSAGE_SIZE_BYTES | Maximum size in bytes for WebSocket messages in realtime connections. Default is None.
| REPLICATE_MODEL_NAME_WITH_ID_LENGTH | Length of Replicate model names with ID. Default is 64
| REPLICATE_POLLING_DELAY_SECONDS | Delay in seconds for Replicate polling operations. Default is 0.5
| REQUEST_TIMEOUT | Timeout in seconds for requests. Default is 6000
| RESET_BUDGET_JOB_BATCH_SIZE | Maximum rows the budget reset job reads and commits per transaction. Default is 500
| RESET_BUDGET_JOB_MAX_CHUNKS_PER_RUN | Maximum batches each budget reset phase processes per run; leftovers wait for the next run. Default is 100
| RESPONSES_SESSION_LOOKUP_MAX_ATTEMPTS | How many times `/v1/responses` looks up the session behind a `previous_response_id` before giving up, so a follow-up sent right after the previous turn does not beat that turn's spend log to the database. Default is 3
| RESPONSES_SESSION_LOOKUP_RETRY_INTERVAL | Seconds to wait between those session lookup attempts. Default is 0.2
| ROOT_REDIRECT_URL | URL to redirect root path (/) to when DOCS_URL is set to something other than "/" (DOCS_URL is "/" by default)
| ROUTER_MAX_FALLBACKS | Maximum number of fallbacks for router. Default is 5
| RUBRIK_API_KEY | Bearer token for authenticating with the Rubrik webhook service
| RUBRIK_BATCH_SIZE | Number of log entries to buffer before flushing to Rubrik. Default is 512
| RUBRIK_SAMPLING_RATE | Fraction of requests to log to Rubrik (0.0 to 1.0). Default is 1.0
| RUBRIK_WEBHOOK_URL | Base URL of the Rubrik webhook service for tool blocking and batch logging
| RUNWAYML_DEFAULT_API_VERSION | Default API version for RunwayML service. Default is "2024-11-06"
| RUNWAYML_POLLING_TIMEOUT | Timeout in seconds for RunwayML image generation polling. Default is 600 (10 minutes)
| S3_VECTORS_DEFAULT_DIMENSION | Default vector dimension for S3 Vectors RAG ingestion. Default is 1024
| S3_VECTORS_DEFAULT_DISTANCE_METRIC | Default distance metric for S3 Vectors RAG ingestion. Options: "cosine", "euclidean". Default is "cosine"
| SECRET_MANAGER_REFRESH_INTERVAL | Refresh interval in seconds for secret manager. Default is 86400 (24 hours)
| SEMANTIC_CACHE_EMBEDDING_TIMEOUT_SECONDS | Deadline in seconds for the embedding call a semantic cache makes before each request. Exceeding it skips the cache instead of holding the request. Default is 5.0
| SERVER_ROOT_PATH | Root path for the server application
| SEND_USER_API_KEY_ALIAS | Flag to send user API key alias to Zscaler AI Guard. Default is False
| SEND_USER_API_KEY_TEAM_ID | Flag to send user API key team ID to Zscaler AI Guard. Default is False
| SEND_USER_API_KEY_USER_ID | Flag to send user API key user ID to Zscaler AI Guard. Default is False
| SET_VERBOSE | [DEPRECATED] Use `LITELLM_LOG` instead with values "INFO", "DEBUG", or "ERROR". See [debugging docs](./debugging)
| SINGLE_DEPLOYMENT_TRAFFIC_FAILURE_THRESHOLD | Minimum number of requests to consider "reasonable traffic" for single-deployment cooldown logic. Default is 1000
| SLACK_DAILY_REPORT_FREQUENCY | Frequency of daily Slack reports (e.g., daily, weekly)
| SLACK_WEBHOOK_URL | Webhook URL for Slack integration
| SMTP_HOST | Hostname for the SMTP server
| SMTP_PASSWORD | Password for SMTP authentication (do not set if SMTP does not require auth)
| SMTP_PORT | Port number for SMTP server
| SMTP_SENDER_EMAIL | Email address used as the sender in SMTP transactions
| SMTP_SENDER_LOGO | Logo used in emails sent via SMTP
| SMTP_TIMEOUT | Timeout in seconds for SMTP connections and operations (default: 30)
| SMTP_TLS | Flag to enable or disable TLS for SMTP connections
| SMTP_USE_SSL | Set to "True" to force implicit SSL (SMTP_SSL) on any port. Not needed for port 465, which uses implicit SSL automatically; other ports use STARTTLS by default (see SMTP_TLS)
| SMTP_USERNAME | Username for SMTP authentication (do not set if SMTP does not require auth)
| SENDGRID_API_KEY | API key for SendGrid email service
| RESEND_API_KEY | API key for Resend email service
| SENDGRID_SENDER_EMAIL | Email address used as the sender in SendGrid email transactions 
| SPEND_LOGS_URL | URL for retrieving spend logs
| SPEND_LOG_CLEANUP_BATCH_SIZE | Number of logs deleted per batch during cleanup. Default is 1000
| STALE_OBJECT_CLEANUP_BATCH_SIZE | Max number of stale managed objects updated per cleanup cycle. Default is 1000
| SSL_CERTIFICATE | Path to the SSL certificate file
| SSL_ECDH_CURVE | ECDH curve for SSL/TLS key exchange (e.g., 'X25519' to disable PQC).
| SSL_SECURITY_LEVEL | [BETA] Security level for SSL/TLS connections. E.g. `DEFAULT@SECLEVEL=1`
| SSL_VERIFY | Flag to enable or disable SSL certificate verification
| SSL_CERT_FILE | Path to the SSL certificate file for custom CA bundle
| SUPABASE_KEY | API key for Supabase service
| SUPABASE_URL | Base URL for Supabase instance
| STORE_MODEL_IN_DB | If true, enables storing model + credential information in the DB. 
| STORE_PROMPTS_IN_SPEND_LOGS | Flag to persist the request and response payloads of each call on its SpendLogs row, so prompts and completions are visible in the logs UI. Environment equivalent of `general_settings.store_prompts_in_spend_logs`; either source enabling it is enough. **Default is False**
| SYSTEM_MESSAGE_TOKEN_COUNT | Token count for system messages. Default is 4
| TEST_EMAIL_ADDRESS | Email address used for testing purposes
| TOGETHER_AI_4_B | Size parameter for Together AI 4B model. Default is 4
| TOGETHER_AI_8_B | Size parameter for Together AI 8B model. Default is 8
| TOGETHER_AI_21_B | Size parameter for Together AI 21B model. Default is 21
| TOGETHER_AI_41_B | Size parameter for Together AI 41B model. Default is 41
| TOGETHER_AI_80_B | Size parameter for Together AI 80B model. Default is 80
| TOGETHER_AI_110_B | Size parameter for Together AI 110B model. Default is 110
| TOGETHER_AI_EMBEDDING_150_M | Size parameter for Together AI 150M embedding model. Default is 150
| TOGETHER_AI_EMBEDDING_350_M | Size parameter for Together AI 350M embedding model. Default is 350
| TOOL_CHOICE_OBJECT_TOKEN_COUNT | Token count for tool choice objects. Default is 4
| TOOL_POLICY_CACHE_TTL_SECONDS | TTL in seconds for caching tool policy guardrail results. Default is 60
| UI_LOGO_PATH | Path to the logo image used in the UI
| UI_LOGO_PATH_DARK | Path to the logo image used in the UI in dark mode. Falls back to UI_LOGO_PATH when unset
| UI_PASSWORD | Password for accessing the UI
| UI_USERNAME | Username for accessing the UI
| UPSTREAM_LANGFUSE_DEBUG | Flag to enable debugging for upstream Langfuse
| UPSTREAM_LANGFUSE_HOST | Host URL for upstream Langfuse service
| UPSTREAM_LANGFUSE_PUBLIC_KEY | Public key for upstream Langfuse authentication
| UPSTREAM_LANGFUSE_RELEASE | Release version identifier for upstream Langfuse
| UPSTREAM_LANGFUSE_SECRET_KEY | Secret key for upstream Langfuse authentication
| USE_AWS_KMS | Flag to enable AWS Key Management Service for encryption
| USE_DDPROFILER | Flag to start the Datadog continuous profiler when the proxy boots. Independent of `USE_DDTRACE`. **Default is False**
| USE_DDTRACE | Flag to enable Datadog tracing. Runs `ddtrace.patch_all()` at proxy startup and swaps LiteLLM's internal no-op tracer for the real ddtrace tracer, so LiteLLM's own spans are emitted too. **Default is False**
| USE_LITELLM_PROXY | Flag to route every `litellm` SDK completion call through a LiteLLM proxy by default, which lets model names stay in their original provider format such as `gemini/gemini-3.5-flash`. Environment equivalent of `litellm.use_litellm_proxy = True`. **Default is False**
| USE_PRISMA_MIGRATE | Removed in [PR #13555](https://github.com/BerriAI/litellm/pull/13555); `prisma migrate deploy` is now the default. Setting this has no effect and it is safe to remove.
| VANTAGE_API_KEY | API key for Vantage cost-import integration
| VANTAGE_BASE_URL | Base URL for Vantage API. Default is `https://api.vantage.sh`
| VANTAGE_EXPORT_FREQUENCY | Export frequency for Vantage — `hourly` (default), `daily`, or `interval`
| VANTAGE_EXPORT_INTERVAL_SECONDS | Interval in seconds when VANTAGE_EXPORT_FREQUENCY is `interval`
| VANTAGE_INTEGRATION_TOKEN | Vantage integration token for the cost-import endpoint
| WANDB_API_KEY | API key for Weights & Biases (W&B) logging integration
| WANDB_HOST | Host URL for Weights & Biases (W&B) service
| WANDB_PROJECT_ID | Project ID for Weights & Biases (W&B) logging integration
| WEBHOOK_URL | URL for receiving webhooks from external services
| SPEND_LOG_RUN_LOOPS | Constant for setting how many runs of 1000 batch deletes should spend_log_cleanup task run
| SPEND_LOG_CLEANUP_BATCH_SIZE | Number of logs deleted per batch during cleanup. Default is 1000
| SPEND_LOG_PARTITION_INTERVAL | Granularity of LiteLLM_SpendLogs partitions when the table is partitioned: day, week, or month. Default is day
| SPEND_LOG_PARTITION_PRECREATE_AHEAD | Number of future spend-log partitions to pre-create on each cleanup run. Default is 7
| SPEND_LOG_QUEUE_POLL_INTERVAL | Polling interval in seconds for spend log queue. Default is 2.0
| SPEND_LOG_QUEUE_SIZE_THRESHOLD | Threshold for spend log queue size before processing. Default is 100
| SPEND_LOG_WRITE_BATCH_MAX_BYTES | Max serialized payload, in bytes, of a single spend-log write statement sent to the database. Bounds the Prisma query engine's resident memory, which is a high-water mark set by the largest statement it executes. Lower it if pods store prompts and responses and you need a tighter memory floor. Default is 2000000
| SPEND_LOG_WRITE_BATCH_MAX_ROWS | Max rows in a single spend-log write statement, applied alongside `SPEND_LOG_WRITE_BATCH_MAX_BYTES` so whichever budget binds first splits the statement. The query engine costs memory per row as well as per byte, so this is the budget that binds when `store_prompts_in_spend_logs` is off and rows are small. Raise it to trade memory for fewer round trips. Default is 100
| SPEND_LOG_QUEUE_MAX_BYTES | Memory budget, in bytes, for spend logs waiting in memory to be written. When the database is unreachable the failed batch is requeued instead of dropped, so the queue grows for as long as the outage lasts; past this budget the oldest logs are dropped and an error is logged. Raise it to keep more spend through a longer outage, lower it on memory-constrained pods, especially when prompts and responses are stored in spend logs. Default is 64000000
| SPEND_LOG_CLEANUP_MAX_CONSECUTIVE_BATCH_FAILURES | Number of consecutive batch failures tolerated before the spend log cleanup run aborts. Default is 3
| SPEND_LOG_CLEANUP_BATCH_FAILURE_BACKOFF_SECONDS | Backoff in seconds between failed spend log cleanup batches. Default is 0.5
| SPEND_LOG_CLEANUP_RUN_BUDGET_SECONDS | Wall-clock budget in seconds for a whole spend log cleanup run, shared across every table it cleans. The run stops when the budget is spent and resumes from the same cutoff on the next tick. Sets the default for `general_settings.maximum_spend_logs_cleanup_run_budget`, which overrides it when set. Default is 300
| SPEND_LOG_CLEANUP_BATCH_TIMEOUT_SECONDS | Postgres `statement_timeout` and `lock_timeout` in seconds applied to every statement a spend log cleanup run issues, so no single statement holds a lock while user traffic queues behind it. Sets the default for `general_settings.maximum_spend_logs_cleanup_batch_timeout`, which overrides it when set. Default is 30
| SPEND_LOG_CLEANUP_REMAINING_COUNT_CAP | Upper bound on the probe that counts how many expired rows are still waiting, so reporting the backlog cannot itself become a full scan of a large table. Counts saturate at this value. Default is 100000
| SPEND_COUNTER_RESEED_LOCKS_MAX_SIZE | Max size of the per-counter LRU lock dict used to coalesce concurrent spend-counter reseeds from the DB on the enforcement path. Default is 10000.
| COROUTINE_CHECKER_MAX_SIZE_IN_MEMORY | Maximum size for CoroutineChecker in-memory cache. Default is 1000
| DEFAULT_SHARED_HEALTH_CHECK_TTL | Time-to-live in seconds for cached health check results in shared health check mode. Default is 300 (5 minutes)
| DEFAULT_SHARED_HEALTH_CHECK_LOCK_TTL | Time-to-live in seconds for health check lock in shared health check mode. Default is 60 (1 minute)
| ZSCALER_AI_GUARD_API_KEY | API key for Zscaler AI Guard service
| ZSCALER_AI_GUARD_POLICY_ID | Policy ID for Zscaler AI Guard guardrails
| ZSCALER_AI_GUARD_URL | Base URL for Zscaler AI Guard API. Default is https://api.us1.zseclipse.net/v1/detection/execute-policy
