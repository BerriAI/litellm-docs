import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';
import Image from '@theme/IdealImage';

# Docker, Helm, Terraform

:::info No Limits on LiteLLM OSS
There are **no limits** on the number of users, keys, or teams you can create on LiteLLM OSS.
:::

You can find the Dockerfile to build litellm proxy [here](https://github.com/BerriAI/litellm/blob/main/Dockerfile)

Official images are published to `ghcr.io/berriai` (`litellm`, `litellm-database` which bundles prisma for use with Postgres, and `litellm-non_root`) and mirrored at `docker.litellm.ai/berriai`. The snippets below use the `docker.litellm.ai` mirror.

> Note: for production sizing, see [machine specifications](./prod.md#2-recommended-machine-specifications).

## Quick Start

:::info
Facing issues with pulling the docker image? Email us at support@berri.ai.
:::

<Tabs>

<TabItem value="docker" label="Docker">

```
docker pull docker.litellm.ai/berriai/litellm:latest
```

[**See all docker images**](https://github.com/orgs/BerriAI/packages)

</TabItem>

<TabItem value="cli" label="LiteLLM CLI">

```shell
$ uv tool install 'litellm[proxy]'
```

</TabItem>

<TabItem value="docker-compose" label="Docker Compose (Proxy + DB)">

Use this docker compose to spin up the proxy with a postgres database running locally. 

```bash
# Get the docker compose file
curl -O https://raw.githubusercontent.com/BerriAI/litellm/main/docker-compose.yml
curl -O https://raw.githubusercontent.com/BerriAI/litellm/main/prometheus.yml

# Add the master key - you can change this after setup
echo 'LITELLM_MASTER_KEY="sk-1234"' > .env

# Add the litellm salt key - you cannot change this after adding a model
# It is used to encrypt / decrypt your LLM API Key credentials
# We recommend - https://1password.com/password-generator/ 
# password generator to get a random hash for litellm salt key
echo 'LITELLM_SALT_KEY="sk-1234"' >> .env

# Start
docker compose up
```

</TabItem>
</Tabs>

### Verify Docker image signatures

All LiteLLM Docker images are signed with [cosign](https://docs.sigstore.dev/cosign/overview/). Every release is signed with the same key introduced in [commit `0112e53`](https://github.com/BerriAI/litellm/commit/0112e53046018d726492c814b3644b7d376029d0).

**Verify using the pinned commit hash (recommended):**

A commit hash is cryptographically immutable, so this is the strongest way to ensure you are using the original signing key:

```bash
cosign verify \
  --key https://raw.githubusercontent.com/BerriAI/litellm/0112e53046018d726492c814b3644b7d376029d0/cosign.pub \
  ghcr.io/berriai/litellm:<release-tag>
```

**Verify using a release tag (convenience):**

Tags are protected in this repository and resolve to the same key. This option is easier to read but relies on tag protection rules:

```bash
cosign verify \
  --key https://raw.githubusercontent.com/BerriAI/litellm/<release-tag>/cosign.pub \
  ghcr.io/berriai/litellm:<release-tag>
```

Replace `<release-tag>` with the version you are deploying (e.g. `v1.89.4`).

Expected output:

```
The following checks were performed on each of these signatures:
  - The cosign claims were validated
  - The signatures were verified against the specified public key
```

Learn more about LiteLLM's release signing in the [CI/CD v2 announcement](https://docs.litellm.ai/blog/ci-cd-v2-improvements#verify-docker-image-signatures). For a complete guide covering all image variants, CI/CD enforcement, and deployment best practices, see the [Docker Image Security Guide](./docker_image_security.md).

### Docker Run

#### Step 1. CREATE config.yaml 

Example `litellm_config.yaml` 

```yaml
model_list:
  - model_name: azure-gpt-4o
    litellm_params:
      model: azure/<your-azure-model-deployment>
      api_base: os.environ/AZURE_API_BASE # runs os.getenv("AZURE_API_BASE")
      api_key: os.environ/AZURE_API_KEY # runs os.getenv("AZURE_API_KEY")
      api_version: "2025-01-01-preview"
```



#### Step 2. RUN Docker Image

```shell
docker run \
    -v $(pwd)/litellm_config.yaml:/app/config.yaml \
    -e AZURE_API_KEY=d6*********** \
    -e AZURE_API_BASE=https://openai-***********/ \
    -p 4000:4000 \
    docker.litellm.ai/berriai/litellm:latest \
    --config /app/config.yaml --detailed_debug
```

Get the latest image [here](https://github.com/berriai/litellm/pkgs/container/litellm)

#### Step 3. Test it

Open the Admin UI at `http://0.0.0.0:4000/ui`, go to the **Test Key** playground, pick `azure-gpt-4o` (the model you set in step 1), and send a message.

### Docker Run - CLI Args

See all supported CLI args [here](https://docs.litellm.ai/docs/proxy/cli): 

Here's how you can run the docker image and pass your config to `litellm`
```shell
docker run docker.litellm.ai/berriai/litellm:latest --config your_config.yaml
```

Here's how you can run the docker image and start litellm on port 8002 with `num_workers=8`
```shell
docker run docker.litellm.ai/berriai/litellm:latest --port 8002 --num_workers 8
```


### Use litellm as a base image

```shell
# Use the provided base image
FROM docker.litellm.ai/berriai/litellm:latest

# Set the working directory to /app
WORKDIR /app

# Copy the configuration file into the container at /app
COPY config.yaml .

# Make sure your docker/entrypoint.sh is executable
RUN chmod +x ./docker/entrypoint.sh

# Expose the necessary port
EXPOSE 4000/tcp

# Override the CMD instruction with your desired command and arguments
# WARNING: FOR PROD DO NOT USE `--detailed_debug` it slows down response times, instead use the following CMD
# CMD ["--port", "4000", "--config", "config.yaml"]

CMD ["--port", "4000", "--config", "config.yaml", "--detailed_debug"]
```

### Terraform

To provision the full infrastructure stack with Terraform on AWS or GCP, use the official modules described in [Deploy to Cloud](./deploy_cloud.md#deploy-with-terraform-aws-and-gcp). To manage LiteLLM resources (keys, teams, models) with Terraform, use [terraform-provider-litellm](https://github.com/BerriAI/terraform-provider-litellm) (s/o [Nicholas Cecere](https://www.linkedin.com/in/nicholas-cecere-24243549/)).

### Kubernetes

A config file based litellm instance runs as a Deployment that loads `config.yaml` from a ConfigMap, with api keys declared as env vars attached from an opaque Secret. The manifest below defines a ConfigMap, a Secret, a Deployment, and a Service; apply it with `kubectl apply -f deployment.yaml`.

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: litellm-config-file
data:
  config.yaml: |
      model_list: 
        - model_name: gpt-4o
          litellm_params:
            model: azure/gpt-4o-ca
            api_base: https://my-endpoint-canada-berri992.openai.azure.com/
            api_key: os.environ/CA_AZURE_OPENAI_API_KEY
---
apiVersion: v1
kind: Secret
type: Opaque
metadata:
  name: litellm-secrets
data:
  CA_AZURE_OPENAI_API_KEY: bWVvd19pbV9hX2NhdA== # your api key in base64
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: litellm-deployment
  labels:
    app: litellm
spec:
  replicas: 1
  selector:
    matchLabels:
      app: litellm
  template:
    metadata:
      labels:
        app: litellm
    spec:
      containers:
      - name: litellm
        image: docker.litellm.ai/berriai/litellm:main-v1.90.2 # pin a version, do not use :latest
        args:
          - "--config"
          - "/app/proxy_server_config.yaml"
        ports:
        - containerPort: 4000
        volumeMounts:
        - name: config-volume
          mountPath: /app/proxy_server_config.yaml
          subPath: config.yaml
        envFrom:
        - secretRef:
            name: litellm-secrets
        livenessProbe:
          httpGet:
            path: /health/liveliness
            port: 4000
          initialDelaySeconds: 120
          periodSeconds: 15
        readinessProbe:
          httpGet:
            path: /health/readiness
            port: 4000
          initialDelaySeconds: 120
          periodSeconds: 15
      volumes:
        - name: config-volume
          configMap:
            name: litellm-config-file
---
apiVersion: v1
kind: Service
metadata:
  name: litellm-service
spec:
  selector:
    app: litellm
  ports:
    - protocol: TCP
      port: 4000
      targetPort: 4000
  type: NodePort
```

Port-forward to reach the proxy locally:

```bash
kubectl port-forward service/litellm-service 4000:4000
```

To connect a database (Virtual Keys, spend tracking), use the `docker.litellm.ai/berriai/litellm-database` image and add `DATABASE_URL` and `LITELLM_MASTER_KEY` to the Secret; nothing else in the manifest changes. See [Deploy with Database](#deploy-with-database). To run more than one instance behind a load balancer, see [Multi-region and scaling](./multi_region.md).

:::info
To avoid issues with predictability, difficulties in rollback, and inconsistent environments, pin a version or SHA digest (for example, `litellm:main-v1.90.2` or `litellm@sha256:12345abcdef...`) instead of `litellm:latest`.
:::


### Helm Chart

:::info

[BETA] Helm Chart is BETA. If you run into an issues/have feedback please let us know [https://github.com/BerriAI/litellm/issues](https://github.com/BerriAI/litellm/issues)

:::

The canonical chart lives at [`deploy/charts/litellm-helm`](https://github.com/BerriAI/litellm/tree/main/deploy/charts/litellm-helm) in the litellm repo and is published as an OCI artifact at `oci://ghcr.io/berriai/litellm-helm`, the published chart versions carry litellm release numbers (for example, `1.90.2`). This section covers a local quickstart; for a production install on EKS, GKE, or AKS with managed Postgres and Redis, see [Deploy to Cloud](./deploy_cloud.md#deploy-with-helm).

<Tabs>

<TabItem value="helm-oci" label="OCI registry (recommended)">

Inspect the default values, then install with your own `values.yaml`:

```bash
# View the chart's configurable values
helm show values oci://ghcr.io/berriai/litellm-helm > values.yaml

# Install (or upgrade) the release
helm install litellm oci://ghcr.io/berriai/litellm-helm -f values.yaml
```

Set your proxy config and master key in `values.yaml`; see the [chart values reference](https://github.com/BerriAI/litellm/blob/main/deploy/charts/litellm-helm/values.yaml). Pin a chart version with `--version <version>` for reproducible installs.

</TabItem>

<TabItem value="helm-source" label="From source">

Install directly from a checkout of the litellm repo:

```bash
git clone https://github.com/BerriAI/litellm.git
helm install litellm deploy/charts/litellm-helm --set masterkey=sk-1234
```

</TabItem>
</Tabs>

Expose the service to localhost:

```bash
kubectl --namespace default port-forward service/litellm 4000:4000
```

Your LiteLLM Proxy Server is now running on `http://127.0.0.1:4000`. To run multiple replicas behind a load balancer, see [Multi-region and scaling](./multi_region.md).

#### Make LLM API Requests

Open the Admin UI at `http://127.0.0.1:4000/ui`, log in with your master key, and send a request from the **Test Key** playground. To call the proxy from code, see [making your first LLM API request](user_keys); LiteLLM is compatible with the OpenAI SDK, Anthropic SDK, Mistral SDK, LlamaIndex, and Langchain (JS, Python).

## Deployment Options

| Docs                                                                                              | When to Use                                                                                                                                           |
| ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Quick Start](#quick-start)                                                                       | call 100+ LLMs + Load Balancing                                                                                                                       |
| [Deploy with Database](#deploy-with-database)                                                     | + use Virtual Keys + Track Spend (Note: When deploying with a database providing a `DATABASE_URL` and `LITELLM_MASTER_KEY` are required in your env ) |
| [Deploy with Redis](#deploy-with-redis)                                                           | + load balance across multiple litellm containers (optionally with a database)                                                                        |

### Deploy with Database
##### Docker, Kubernetes, Helm Chart

:::warning High Traffic Deployments (1000+ RPS)

If you expect high traffic (1000+ requests per second), **Redis is required** to prevent database connection exhaustion and deadlocks.

Add this to your config:
```yaml
general_settings:
  use_redis_transaction_buffer: true

litellm_settings:
  cache: true
  cache_params:
    type: redis
    host: your-redis-host
```

See [Resolve DB Deadlocks](/docs/proxy/db_deadlocks) for details.

:::

Requirements:
- Need a postgres database (e.g. [Supabase](https://supabase.com/), [Neon](https://neon.tech/), etc) Set `DATABASE_URL=postgresql://<user>:<password>@<host>:<port>/<dbname>` in your env 
- Set a `LITELLM_MASTER_KEY`, this is your Proxy Admin key - you can use this to create other keys (must start with `sk-`)

<Tabs>

<TabItem value="docker-deploy" label="Dockerfile">

We maintain a [separate Dockerfile](https://github.com/BerriAI/litellm/pkgs/container/litellm-database) for reducing build time when running LiteLLM proxy with a connected Postgres Database 

```shell
docker pull docker.litellm.ai/berriai/litellm-database:latest
```

```shell
docker run \
    -v $(pwd)/litellm_config.yaml:/app/config.yaml \
    -e LITELLM_MASTER_KEY=sk-1234 \
    -e DATABASE_URL=postgresql://<user>:<password>@<host>:<port>/<dbname> \
    -e AZURE_API_KEY=d6*********** \
    -e AZURE_API_BASE=https://openai-***********/ \
    -p 4000:4000 \
    docker.litellm.ai/berriai/litellm-database:latest \
    --config /app/config.yaml --detailed_debug
```

Your LiteLLM Proxy Server is now running on `http://0.0.0.0:4000`.

</TabItem>
<TabItem value="kubernetes-deploy" label="Kubernetes">

Use the canonical manifest from the [Kubernetes](#kubernetes) section above. The DB-connected variant is the same manifest with `DATABASE_URL` and `LITELLM_MASTER_KEY` added to the Secret and the image set to `docker.litellm.ai/berriai/litellm-database:main-v1.90.2` (bundles prisma). Nothing else changes.

</TabItem>

<TabItem value="helm-deploy" label="Helm">

Use the [Helm chart](#helm-chart) described above. Set `DATABASE_URL` and `LITELLM_MASTER_KEY` in your `values.yaml` (see the [chart values reference](https://github.com/BerriAI/litellm/blob/main/deploy/charts/litellm-helm/values.yaml)), then run `helm install litellm oci://ghcr.io/berriai/litellm-helm -f values.yaml`.

</TabItem>
</Tabs>

### Deploy with Redis
Use Redis when you need litellm to load balance across multiple litellm containers

The only change required is setting Redis on your `config.yaml`
LiteLLM Proxy supports sharing rpm/tpm shared across multiple litellm instances, pass `redis_host`, `redis_password` and `redis_port` to enable this. (LiteLLM will use Redis to track rpm/tpm usage )

```yaml
model_list:
  - model_name: gpt-4o
    litellm_params:
      model: azure/<your-deployment-name>
      api_base: <your-azure-endpoint>
      api_key: <your-azure-api-key>
      rpm: 6      # Rate limit for this deployment: in requests per minute (rpm)
  - model_name: gpt-4o
    litellm_params:
      model: azure/gpt-4o-ca
      api_base: https://my-endpoint-canada-berri992.openai.azure.com/
      api_key: <your-azure-api-key>
      rpm: 6
router_settings:
  redis_host: <your redis host>
  redis_password: <your redis password>
  redis_port: 1992
```

Start docker container with config

```shell
docker run docker.litellm.ai/berriai/litellm:latest --config your_config.yaml
```

To combine Redis with a database (Virtual Keys and spend tracking), keep the same `router_settings` above, switch to the `litellm-database` image, and pass `DATABASE_URL`:

```shell
docker run --name litellm-proxy \
-e DATABASE_URL=postgresql://<user>:<password>@<host>:<port>/<dbname> \
-p 4000:4000 \
docker.litellm.ai/berriai/litellm-database:latest --config your_config.yaml
```

To scale across regions or many instances, see [Multi-region and scaling](./multi_region.md).

###  (Non Root) - without Internet Connection

By default `prisma generate` downloads [prisma's engine binaries](https://www.prisma.io/docs/orm/reference/environment-variables-reference#custom-engine-file-locations). This might cause errors when running without internet connection. 

Use this docker image to deploy litellm with pre-generated prisma binaries.

```bash
docker pull docker.litellm.ai/berriai/litellm-non_root:latest
```

[Published Docker Image link](https://github.com/BerriAI/litellm/pkgs/container/litellm-non_root)

## Advanced Deployment Settings

### 1. Custom server root path (Proxy base url)

Refer to [Custom Root Path](./custom_root_ui) for more details.


### 2. SSL Certification 

Use this, If you need to set ssl certificates for your on prem litellm proxy

Pass `ssl_keyfile_path` (Path to the SSL keyfile) and `ssl_certfile_path` (Path to the SSL certfile) when starting litellm proxy 

```shell
docker run docker.litellm.ai/berriai/litellm:latest \
    --ssl_keyfile_path ssl_test/keyfile.key \
    --ssl_certfile_path ssl_test/certfile.crt
```

Provide an ssl certificate when starting litellm proxy server 

### 3. Http/2 with Hypercorn

Use this if you want to run the proxy with hypercorn to support http/2

Step 1. Build your custom docker image with hypercorn

```shell
# Use the provided base image
FROM docker.litellm.ai/berriai/litellm:latest

# Set the working directory to /app
WORKDIR /app

# Copy the configuration file into the container at /app
COPY config.yaml .

# Make sure your docker/entrypoint.sh is executable
RUN chmod +x ./docker/entrypoint.sh

# Expose the necessary port
EXPOSE 4000/tcp

# Key change: install hypercorn
RUN uv add hypercorn

# Override the CMD instruction with your desired command and arguments
# WARNING: FOR PROD DO NOT USE `--detailed_debug` it slows down response times, instead use the following CMD
# CMD ["--port", "4000", "--config", "config.yaml"]

CMD ["--port", "4000", "--config", "config.yaml", "--detailed_debug"]
```

Step 2. Pass the `--run_hypercorn` flag when starting the proxy

```shell
docker run \
    -v $(pwd)/proxy_config.yaml:/app/config.yaml \
    -p 4000:4000 \
    -e LITELLM_LOG="DEBUG"\
    -e SERVER_ROOT_PATH="/api/v1"\
    -e DATABASE_URL=postgresql://<user>:<password>@<host>:<port>/<dbname> \
    -e LITELLM_MASTER_KEY="sk-1234"\
    your_custom_docker_image \
    --config /app/config.yaml
    --run_hypercorn
```

### 4. Granian ASGI server (higher throughput) [Beta]

:::info Beta feature
`--run_granian` is in **beta**. Uvicorn is still the default server. Try Granian when you need more gateway throughput or see instability under load with uvicorn; report issues on [GitHub](https://github.com/BerriAI/litellm/issues).
:::

Use this to run the proxy with [Granian](https://github.com/emmett-framework/granian), a Rust-backed ASGI server. The HTTP stack runs in Rust instead of pure Python, which helps the proxy stay responsive when many clients hit health checks, auth, routing, and caching at once.

**Why it helps:**
- **Higher throughput**: In LiteLLM benchmarks, Granian showed a **10–20 RPS improvement** over uvicorn with the same worker count (see [PR #26027](https://github.com/BerriAI/litellm/pull/26027)).
- **Better stability**: Sustained load tests showed steadier latency and fewer spikes than uvicorn.
- **Fewer failures**: Error rates under load were lower (near-zero failures in the compared runs vs uvicorn).

Granian is included in `litellm[proxy]` and requires Python 3.9+. Scale throughput with `--num_workers`.

**Example** (benchmark setup from [PR #26027](https://github.com/BerriAI/litellm/pull/26027)):

```shell
litellm --config config.yaml --port 4000 --run_granian --num_workers 4
```

Or with Docker:

```shell
docker run docker.litellm.ai/berriai/litellm:latest \
    --config /app/config.yaml \
    --port 4000 \
    --run_granian \
    --num_workers 4
```

**SSL:** Both `--ssl_certfile_path` and `--ssl_keyfile_path` are required when enabling TLS with Granian.

**Not supported with Granian:**
- `--max_requests_before_restart` (use Gunicorn if you need per-request worker recycling)
- `--ciphers` (Hypercorn only)

See [CLI Arguments, Server Backend Options](/docs/proxy/cli#server-backend-options) for full flag details.

### 5. Keepalive Timeout

Defaults to 5 seconds. Between requests, connections must receive new data within this period or be disconnected.


Usage Example:
In this example, we set the keepalive timeout to 75 seconds.

```shell showLineNumbers title="docker run"
docker run docker.litellm.ai/berriai/litellm:latest \
    --keepalive_timeout 75
```

Or set via environment variable:
In this example, we set the keepalive timeout to 75 seconds.

```shell showLineNumbers title="Environment Variable"
export KEEPALIVE_TIMEOUT=75
docker run docker.litellm.ai/berriai/litellm:latest
```


### Restart Workers After N Requests

Use this to mitigate memory growth by recycling workers after a fixed number of requests. When set, each worker restarts after completing the specified number of requests. Defaults to disabled when unset.

Usage Examples:

```shell showLineNumbers title="docker run (CLI flag)"
docker run docker.litellm.ai/berriai/litellm:latest \
    --max_requests_before_restart 10000
```

Or set via environment variable:

```shell showLineNumbers title="Environment Variable"
export MAX_REQUESTS_BEFORE_RESTART=10000
docker run docker.litellm.ai/berriai/litellm:latest
```


### 6. config.yaml file on s3, GCS Bucket Object/url

Use this if you cannot mount a config file on your deployment service (example - AWS Fargate, Railway etc)

LiteLLM Proxy will read your config.yaml from an s3 Bucket or GCS Bucket 

<Tabs>
<TabItem value="gcs" label="GCS Bucket">

Set the following .env vars 
```shell
LITELLM_CONFIG_BUCKET_TYPE = "gcs"                              # set this to "gcs"         
LITELLM_CONFIG_BUCKET_NAME = "litellm-proxy"                    # your bucket name on GCS
LITELLM_CONFIG_BUCKET_OBJECT_KEY = "proxy_config.yaml"         # object key on GCS
```

Start litellm proxy with these env vars - litellm will read your config from GCS 

```shell
docker run --name litellm-proxy \
   -e DATABASE_URL=<database_url> \
   -e LITELLM_CONFIG_BUCKET_NAME=<bucket_name> \
   -e LITELLM_CONFIG_BUCKET_OBJECT_KEY="<object_key>> \
   -e LITELLM_CONFIG_BUCKET_TYPE="gcs" \
   -p 4000:4000 \
   docker.litellm.ai/berriai/litellm-database:latest --detailed_debug
```

</TabItem>

<TabItem value="s3" label="s3">

Set the following .env vars 
```shell
LITELLM_CONFIG_BUCKET_NAME = "litellm-proxy"                    # your bucket name on s3 
LITELLM_CONFIG_BUCKET_OBJECT_KEY = "litellm_proxy_config.yaml"  # object key on s3
```

Start litellm proxy with these env vars - litellm will read your config from s3 

```shell
docker run --name litellm-proxy \
   -e DATABASE_URL=<database_url> \
   -e LITELLM_CONFIG_BUCKET_NAME=<bucket_name> \
   -e LITELLM_CONFIG_BUCKET_OBJECT_KEY="<object_key>> \
   -p 4000:4000 \
   docker.litellm.ai/berriai/litellm-database:latest
```
</TabItem>
</Tabs>

### 7. Disable pulling live model prices

Disable pulling the model prices from LiteLLM's [hosted model prices file](https://github.com/BerriAI/litellm/blob/main/model_prices_and_context_window.json), if you're seeing long cold start times or network security issues.

```env
export LITELLM_LOCAL_MODEL_COST_MAP="True"
```

This will use the local model prices file instead.

## Platform-specific Guide

For managed cloud deployments on AWS (ECS, EKS, CloudFormation), GCP (GKE, Cloud Run), and Azure (AKS), including the Terraform modules, see [Deploy to Cloud (AWS, GCP, Azure)](./deploy_cloud.md).

Render and Railway are quick options not covered by that guide:

<Tabs>
<TabItem value="render" label="Render deploy">

### Render 

https://render.com/

<iframe width="840" height="500" src="https://www.loom.com/embed/805964b3c8384b41be180a61442389a3" frameborder="0" webkitallowfullscreen mozallowfullscreen allowfullscreen></iframe>



</TabItem>
<TabItem value="railway" label="Railway">

### Railway 

https://railway.app

**Step 1: Click the button** to deploy to Railway

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/S7P9sn?referralCode=t3ukrU)

**Step 2:** Set `PORT` = 4000 on Railway Environment Variables

</TabItem>
</Tabs>


## Extras 

### IAM-based Auth for RDS DB 

1. Set AWS env var 

```bash
export AWS_WEB_IDENTITY_TOKEN='/path/to/token'
export AWS_ROLE_NAME='arn:aws:iam::123456789012:role/MyRole'
export AWS_SESSION_NAME='MySession'
```

[**See all Auth options**](https://github.com/BerriAI/litellm/blob/089a4f279ad61b7b3e213d8039fb9b75204a7abc/litellm/proxy/auth/rds_iam_token.py#L165)

2. Add RDS credentials to env

```bash
export DATABASE_USER="db-user"
export DATABASE_PORT="5432"
export DATABASE_HOST="database-1-instance-1.cs1ksmwz2xt3.us-west-2.rds.amazonaws.com"
export DATABASE_NAME="database-1-instance-1"
export DATABASE_SCHEMA="schema-name" # skip to use the default "public" schema
```

3. Run proxy with iam+rds


```bash
litellm --config /path/to/config.yaml --iam_token_db_auth
```

### Blocking web crawlers

Note: This is an [enterprise only feature](https://docs.litellm.ai/docs/enterprise).

To block web crawlers from indexing the proxy server endpoints, set the `block_robots` setting to `true` in your `litellm_config.yaml` file.

```yaml showLineNumbers title="litellm_config.yaml"
general_settings:
  block_robots: true
```

#### How it works

When this is enabled, the `/robots.txt` endpoint will return a 200 status code with the following content:

```shell showLineNumbers title="robots.txt"
User-agent: *
Disallow: /
```

## Deployment FAQ

**Q: Is Postgres the only supported database, or do you support other ones (like Mongo)?**

A: We explored MySQL but that was hard to maintain and led to bugs for customers. Currently, PostgreSQL is our primary supported database for production deployments.

Because LiteLLM talks to the database through Prisma over the PostgreSQL wire protocol, any Postgres-wire-compatible distributed SQL database works as a drop-in replacement. [YugabyteDB](https://www.yugabyte.com/) is used in production this way; point `DATABASE_URL` at its YSQL endpoint (`postgresql://<user>:<password>@<host>:<port>/<dbname>`) and LiteLLM runs its migrations and queries unchanged. This is a good fit if you need horizontal scale or multi-region high availability beyond what a single Postgres instance provides.


**Q: If there is Postgres downtime, how does LiteLLM react? Does it fail-open or is there API downtime?**

A: You can gracefully handle DB unavailability if it's on your VPC. See our production guide for more details: [Gracefully Handle DB Unavailability](https://docs.litellm.ai/docs/proxy/prod#6-if-running-litellm-on-vpc-gracefully-handle-db-unavailability)
