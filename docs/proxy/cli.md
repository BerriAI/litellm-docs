# CLI Arguments

This page documents all command-line interface (CLI) arguments available for the LiteLLM proxy server.

## Server Configuration

### --host
   - **Default:** `'0.0.0.0'`
   - The host for the server to listen on.
   - **Usage:** 
     ```shell
     litellm --host 127.0.0.1
     ```
   - **Usage - set Environment Variable:** `HOST`
    ```shell
    export HOST=127.0.0.1
    litellm
    ```

### --port
   - **Default:** `4000`
   - The port to bind the server to.
   - **Usage:** 
     ```shell
     litellm --port 8080
     ```
  - **Usage - set Environment Variable:** `PORT`
    ```shell
    export PORT=8080
    litellm
    ```

### --num_workers
   - **Default:** Number of logical CPUs in the system, or `4` if that cannot be determined
   - The number of worker processes to spin up (uvicorn, gunicorn, or Granian `--workers`).
   - **Usage:** 
     ```shell
     litellm --num_workers 4
     ```
  - **Usage - set Environment Variable:** `NUM_WORKERS`
    ```shell
    export NUM_WORKERS=4
    litellm
    ```

### --config
   - **Short form:** `-c`
   - **Default:** `None`
   - Path to the proxy configuration file (e.g., config.yaml).
   - **Usage:** 
     ```shell
     litellm --config path/to/config.yaml
     ```

### --log_config
   - **Default:** `None`
   - **Type:** `str`
   - Path to the logging configuration file for uvicorn.
   - **Usage:** 
     ```shell
     litellm --log_config path/to/log_config.conf
     ```

### --keepalive_timeout
   - **Default:** `None`
   - **Type:** `int`
   - Set the uvicorn keepalive timeout in seconds (uvicorn timeout_keep_alive parameter).
   - **Usage:** 
     ```shell
     litellm --keepalive_timeout 30
     ```
  - **Usage - set Environment Variable:** `KEEPALIVE_TIMEOUT`
    ```shell
    export KEEPALIVE_TIMEOUT=30
    litellm
    ```

### --timeout_worker_healthcheck
   - **Default:** `None` (uvicorn's own default of 5 seconds applies)
   - **Type:** `int`
   - Set the uvicorn worker health-check timeout in seconds (uvicorn `timeout_worker_healthcheck` parameter). When running uvicorn with `--num_workers` > 1, the supervisor process pings each worker; a worker that does not respond within this window (for example because its event loop is blocked by synchronous work) is killed with SIGKILL and replaced. A kill shows up in the logs as `Waiting for child process [<pid>]` followed by `Child process [<pid>] died`. Raise this value if healthy workers are being recycled during long synchronous operations.
   - Requires `uvicorn>=0.37.0`. On older uvicorn versions the flag has no effect: LiteLLM prints a `Ignoring the flag` warning at startup and uvicorn's built-in 5 second timeout applies. If you set this flag, check your startup logs for that warning to confirm it took effect.
   - Only applies when running uvicorn directly with `--num_workers` > 1; ignored under `--run_gunicorn` / `--run_hypercorn`.
   - **Usage:** 
     ```shell
     litellm --num_workers 4 --timeout_worker_healthcheck 30
     ```
  - **Usage - set Environment Variable:** `TIMEOUT_WORKER_HEALTHCHECK`
    ```shell
    export TIMEOUT_WORKER_HEALTHCHECK=30
    litellm
    ```

### --max_requests_before_restart
   - **Default:** `None`
   - **Type:** `int`
   - Restart worker after this many requests. This is useful for mitigating memory growth over time.
   - For uvicorn: maps to `limit_max_requests`
   - For gunicorn: maps to `max_requests`
   - **Usage:** 
     ```shell
     litellm --max_requests_before_restart 10000
     ```
  - **Usage - set Environment Variable:** `MAX_REQUESTS_BEFORE_RESTART`
    ```shell
    export MAX_REQUESTS_BEFORE_RESTART=10000
    litellm
    ```

### --max_requests_before_restart_jitter
   - **Default:** `None`
   - **Type:** `int`
   - Adds a random amount in `[0, jitter]` to `--max_requests_before_restart` for each worker so workers recycle at staggered request counts instead of all at once. Has no effect without `--max_requests_before_restart`.
   - For uvicorn: maps to `limit_max_requests_jitter` (requires `uvicorn>=0.41.0`; on older versions the flag is ignored with a warning)
   - For gunicorn: maps to `max_requests_jitter`
   - **Usage:** 
     ```shell
     litellm --max_requests_before_restart 10000 --max_requests_before_restart_jitter 1000
     ```
  - **Usage - set Environment Variable:** `MAX_REQUESTS_BEFORE_RESTART_JITTER`
    ```shell
    export MAX_REQUESTS_BEFORE_RESTART=10000
    export MAX_REQUESTS_BEFORE_RESTART_JITTER=1000
    litellm
    ```

## Server Backend Options

### --run_gunicorn
   - **Default:** `False`
   - **Type:** `bool` (Flag)
   - Starts proxy via gunicorn instead of uvicorn. Better for managing multiple workers in production.
   - **Usage:** 
     ```shell
     litellm --run_gunicorn
     ```

### --run_hypercorn
   - **Default:** `False`
   - **Type:** `bool` (Flag)
   - Starts proxy via hypercorn instead of uvicorn. Supports HTTP/2.
   - **Usage:** 
     ```shell
     litellm --run_hypercorn
     ```

### --run_granian
   - **Default:** `False`
   - **Type:** `bool` (Flag)
   - **Status:** Beta. Opt in when you want higher gateway throughput; uvicorn remains the default.
   - Starts the proxy via [Granian](https://github.com/emmett-framework/granian) (Rust-backed ASGI server) instead of uvicorn. Supports HTTP/1 and HTTP/2.
   - **Why use it:** Granian moves the HTTP layer off Python into a Rust runtime, which tends to handle concurrent proxy traffic more predictably than uvicorn alone. In LiteLLM load tests, Granian showed a **10–20 RPS improvement** over an equivalent uvicorn multi-worker setup, with **better stability under sustained load and fewer request failures**.
   - **Requirements:** Python {{python_min_version}}+ and the `granian` package (included in `litellm[proxy]`).
   - **Limitations when using Granian:**
     - `--max_requests_before_restart` is not supported (Granian uses `workers_lifetime` in seconds, not a per-request limit).
     - `--ciphers` is not applied.
     - `--keepalive_timeout` and `--log_config` apply to uvicorn only.
   - **Usage:** 
     ```shell
     litellm --config config.yaml --run_granian --num_workers 4
     ```

### --skip_server_startup
   - **Default:** `False`
   - **Type:** `bool` (Flag)
   - Skip starting the server after setup (useful for database migrations only).
   - **Usage:** 
     ```shell
     litellm --skip_server_startup
     ```

## SSL/TLS Configuration

### --ssl_keyfile_path
   - **Default:** `None`
   - **Type:** `str`
   - Path to the SSL keyfile. Use this when you want to provide SSL certificate when starting proxy.
   - **Usage:** 
     ```shell
     litellm --ssl_keyfile_path /path/to/key.pem --ssl_certfile_path /path/to/cert.pem
     ```
  - **Usage - set Environment Variable:** `SSL_KEYFILE_PATH`
    ```shell
    export SSL_KEYFILE_PATH=/path/to/key.pem
    litellm
    ```

### --ssl_certfile_path
   - **Default:** `None`
   - **Type:** `str`
   - Path to the SSL certfile. Use this when you want to provide SSL certificate when starting proxy.
   - **Usage:** 
     ```shell
     litellm --ssl_certfile_path /path/to/cert.pem --ssl_keyfile_path /path/to/key.pem
     ```
  - **Usage - set Environment Variable:** `SSL_CERTFILE_PATH`
    ```shell
    export SSL_CERTFILE_PATH=/path/to/cert.pem
    litellm
    ```

### --ciphers
   - **Default:** `None`
   - **Type:** `str`
   - Ciphers to use for the SSL setup. Only used with `--run_hypercorn`.
   - **Usage:** 
     ```shell
     litellm --run_hypercorn --ssl_keyfile_path /path/to/key.pem --ssl_certfile_path /path/to/cert.pem --ciphers "ECDHE+AESGCM"
     ```

## Model Configuration

### --model or -m
   - **Default:** `None`
   - The model name to pass to LiteLLM.
   - **Usage:** 
     ```shell
     litellm --model {{openai_small}}
     ```

### --alias
   - **Default:** `None`
   - An alias for the model, for user-friendly reference. Use this to give a litellm model name (e.g., "huggingface/codellama/CodeLlama-7b-Instruct-hf") a more user-friendly name ("codellama").
   - **Usage:** 
     ```shell
     litellm --alias my-gpt-model
     ```

### --api_base
   - **Default:** `None`
   - The API base for the model LiteLLM should call.
   - **Usage:** 
     ```shell
     litellm --model huggingface/tinyllama --api_base https://k58ory32yinf1ly0.us-east-1.aws.endpoints.huggingface.cloud
     ```

### --api_version
   - **Default:** `2024-07-01-preview`
   - For Azure services, specify the API version.
   - **Usage:** 
     ```shell
     litellm --model azure/gpt-deployment --api_version 2023-08-01 --api_base https://<your api base>"
     ```

### --headers
   - **Default:** `None`
   - Headers for the API call (as JSON string).
   - **Usage:** 
     ```shell
     litellm --model my-model --headers '{"Authorization": "Bearer token"}'
     ```

### --add_key
   - **Default:** `None`
   - Add a key to the model configuration.
   - **Usage:** 
     ```shell
     litellm --add_key my-api-key
     ```

### --save
   - **Type:** `bool` (Flag)
   - Save the model-specific config.
   - **Usage:** 
     ```shell
     litellm --model {{openai_small}} --save
     ```

## Model Parameters

### --temperature
   - **Default:** `None`
   - **Type:** `float`
   - Set the temperature for the model.
   - **Usage:** 
     ```shell
     litellm --temperature 0.7
     ```

### --max_tokens
   - **Default:** `None`
   - **Type:** `int`
   - Set the maximum number of tokens for the model output.
   - **Usage:** 
     ```shell
     litellm --max_tokens 50
     ```

### --request_timeout
   - **Default:** `None`
   - **Type:** `int`
   - Set the timeout in seconds for completion calls.
   - **Usage:** 
     ```shell
     litellm --request_timeout 300
     ```

### --max_budget
   - **Default:** `None`
   - **Type:** `float`
   - Set max budget for API calls. Works for hosted models like OpenAI, TogetherAI, Anthropic, etc.
   - **Usage:** 
     ```shell
     litellm --max_budget 100.0
     ```

### --drop_params
   - **Type:** `bool` (Flag)
   - Drop any unmapped params.
   - **Usage:** 
     ```shell
     litellm --drop_params
     ```

### --add_function_to_prompt
   - **Type:** `bool` (Flag)
   - If a function passed but unsupported, pass it as a part of the prompt.
   - **Usage:** 
     ```shell
     litellm --add_function_to_prompt
     ```

## Database Configuration

### --iam_token_db_auth
   - **Default:** `False`
   - **Type:** `bool` (Flag)
   - Authenticates to PostgreSQL on Amazon RDS or Amazon Aurora with a short-lived IAM token instead of a stored password.
   - LiteLLM generates the token with boto3 and refreshes it before it expires.
   - This option supports AWS only. For Azure Database for PostgreSQL, use [`--azure_postgresql_auth`](#--azure_postgresql_auth) instead. For Google Cloud SQL, run the Cloud SQL Auth Proxy with `--auto-iam-authn`, then configure `DATABASE_URL` to use the local proxy connection. Do not enable this flag for Cloud SQL.
   - **Required Environment Variables:**
     - `DATABASE_HOST` - The RDS database host
     - `DATABASE_PORT` - The database port
     - `DATABASE_USER` - The database user
     - `DATABASE_NAME` - The database name
     - `DATABASE_SCHEMA` (optional) - The database schema
   - **Usage:** 
     ```shell
     litellm --iam_token_db_auth
     ```
   - **Usage - set Environment Variable:** `IAM_TOKEN_DB_AUTH`
     ```shell
     export IAM_TOKEN_DB_AUTH=True
     export DATABASE_HOST=mydb.us-east-1.rds.amazonaws.com
     export DATABASE_PORT=5432
     export DATABASE_USER=mydbuser
     export DATABASE_NAME=mydb
     litellm
     ```

#### Amazon ECS setup

For LiteLLM running on Amazon ECS:

1. Enable IAM database authentication on the Amazon RDS or Aurora PostgreSQL instance.
2. Configure the PostgreSQL user for IAM authentication.
3. Grant the ECS task role permission to connect to the database as that user.
4. Set `IAM_TOKEN_DB_AUTH=True` and the required `DATABASE_*` variables in the ECS task definition.

LiteLLM uses the task role's AWS credentials to generate and refresh the database token. A static database password is not required.

These settings are read from the task environment when LiteLLM starts. To change the flag or connection parameters, deploy a new task definition or restart the proxy tasks. Token refreshes do not require a restart.

### --azure_postgresql_auth
   - **Default:** `False`
   - **Type:** `bool` (Flag)
   - Authenticates to Azure Database for PostgreSQL Flexible Server with a short-lived Microsoft Entra ID access token instead of a stored password.
   - LiteLLM requests the token for the `https://ossrdbms-aad.database.windows.net/.default` scope through the Azure Identity library and refreshes it before it expires.
   - This option supports Azure only, and it cannot be combined with `--iam_token_db_auth`. The proxy exits at startup when both are enabled.
   - **Required Environment Variables:**
     - `DATABASE_HOST` - The server host, such as `myserver.postgres.database.azure.com`
     - `DATABASE_USER` - The Microsoft Entra principal that exists as a PostgreSQL role, such as a managed identity name or a user principal name
     - `DATABASE_NAME` - The database name
     - `DATABASE_PORT` (optional) - The database port, `5432` by default
     - `DATABASE_SCHEMA` (optional) - The database schema
   - **Usage:**
     ```shell
     litellm --azure_postgresql_auth
     ```
   - **Usage - set Environment Variable:** `AZURE_POSTGRESQL_AUTH`
     ```shell
     export AZURE_POSTGRESQL_AUTH=True
     export DATABASE_HOST=myserver.postgres.database.azure.com
     export DATABASE_USER=litellm-proxy
     export DATABASE_NAME=litellm
     litellm
     ```

#### Choosing the Azure identity

LiteLLM reads the credential from the environment, so one flag covers every hosting model.

| Identity | How to select it |
| --- | --- |
| User-assigned managed identity | Set `AZURE_CLIENT_ID` to the identity's client ID. |
| System-assigned managed identity | Set nothing extra when the host has one attached. |
| Workload identity on AKS | Let the workload identity webhook inject `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_AUTHORITY_HOST`, and `AZURE_FEDERATED_TOKEN_FILE` into the pod. |
| Service principal | Set `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, and `AZURE_CLIENT_SECRET`. |
| Local development | Run `az login` and LiteLLM uses that session. |

#### Setting DATABASE_USER

Put the principal in `DATABASE_USER` exactly as PostgreSQL knows it, including any `@`. A user principal name such as `litellm@contoso.onmicrosoft.com` goes in as it is, and LiteLLM percent-encodes it while assembling the connection URL. A value that is already percent-encoded, such as `litellm%40contoso.onmicrosoft.com`, is passed through unchanged, so a deployment carried over from RDS IAM authentication keeps working.

#### Azure Kubernetes Service setup

For LiteLLM running on AKS with workload identity:

1. Enable Microsoft Entra authentication on the Azure Database for PostgreSQL Flexible Server.
2. Create the PostgreSQL role for the workload identity, either by adding it as a Microsoft Entra administrator or by having an existing administrator run `pgaadauth_create_principal`.
3. Grant that role the privileges LiteLLM needs on the database.
4. Annotate the LiteLLM service account with the identity's client ID and label the pod for workload identity.
5. Set `AZURE_POSTGRESQL_AUTH=True` and the required `DATABASE_*` variables on the deployment.

LiteLLM uses the pod's federated token to request and refresh the database token. A static database password is not required, so the server can keep password authentication disabled.

These settings are read from the environment when LiteLLM starts. To change the flag or the connection parameters, restart the proxy. Token refreshes do not require a restart.

#### Deploying with the Helm chart

The chart turns the flag on per database endpoint. Setting `database.writer.useAzureEntraAuth` emits `AZURE_POSTGRESQL_AUTH=true` and omits `DATABASE_PASSWORD`, so the writer needs no password in its Secret. The username still comes from `passwordSecret.usernameKey`.

```yaml
database:
  writer:
    host: myserver.postgres.database.azure.com
    dbname: litellm
    useAzureEntraAuth: true
    passwordSecret:
      name: litellm-writer-secret
      usernameKey: username
```

A read replica takes the same key under `database.reader`, and it requires the writer to use Entra authentication as well because the proxy reads one global toggle. Setting `useIAMAuth` and `useAzureEntraAuth` on the same endpoint fails the render with a message naming both.

### --use_prisma_db_push
   - **Default:** `False`
   - **Type:** `bool` (Flag)
   - Use `prisma db push` instead of `prisma migrate` for database schema updates. This is useful when you want to quickly sync your database schema without creating migration files.
   - **Usage:** 
     ```shell
     litellm --use_prisma_db_push
     ```

## Debugging

### --debug
   - **Default:** `False`
   - **Type:** `bool` (Flag)
   - Enable debugging mode for the input.
   - **Usage:** 
     ```shell
     litellm --debug
     ```
  - **Usage - set Environment Variable:** `DEBUG`
    ```shell
    export DEBUG=True
    litellm
    ```

### --detailed_debug
   - **Default:** `False`
   - **Type:** `bool` (Flag)
   - Enable detailed debugging mode to view verbose debug logs.
   - **Usage:** 
     ```shell
     litellm --detailed_debug
     ```
  - **Usage - set Environment Variable:** `DETAILED_DEBUG`
    ```shell
    export DETAILED_DEBUG=True
    litellm
    ```

### --local
   - **Default:** `False`
   - **Type:** `bool` (Flag)
   - For local debugging purposes.
   - **Usage:** 
     ```shell
     litellm --local
     ```

## Testing & Health Checks

### --test
   - **Type:** `bool` (Flag)
   - Proxy chat completions URL to make a test request to.
   - **Usage:** 
     ```shell
     litellm --test
     ```

### --test_async
   - **Default:** `False`
   - **Type:** `bool` (Flag)
   - Calls async endpoints `/queue/requests` and `/queue/response`.
   - **Usage:** 
     ```shell
     litellm --test_async
     ```

### --num_requests
   - **Default:** `10`
   - **Type:** `int`
   - Number of requests to hit async endpoint with (used with `--test_async`).
   - **Usage:** 
     ```shell
     litellm --test_async --num_requests 100
     ```

### --health
   - **Type:** `bool` (Flag)
   - Runs a health check on all models in config.yaml.
   - **Usage:** 
     ```shell
     litellm --health
     ```

## Other Options

### --version
   - **Short form:** `-v`
   - **Type:** `bool` (Flag)
   - Print LiteLLM version and exit.
   - **Usage:** 
     ```shell
     litellm --version
     ```

### --telemetry
   - **Default:** `True`
   - **Type:** `bool`
   - Help track usage of this feature. Turn off for privacy.
   - **Usage:** 
     ```shell
     litellm --telemetry False
     ```

### --use_queue
   - **Default:** `False`
   - **Type:** `bool` (Flag)
   - To use celery workers for async endpoints.
   - **Usage:** 
     ```shell
     litellm --use_queue
     ```
