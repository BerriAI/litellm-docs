---
title: Server Tuning
description: Optional deep tuning for the LiteLLM Proxy container; alternative ASGI servers, worker recycling, hitless restarts, TLS, keepalive, and loading config from object storage.
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Server Tuning

Reach for this page only when the defaults are not enough. Most deployments should run one Uvicorn worker per pod and scale horizontally, as described in the [production checklist](./prod.md#sizing-and-workers). The options below matter when you pack multiple workers into one container, terminate TLS at the proxy, serve HTTP/2, or cannot mount a config file on your host. See the [CLI reference](./cli.md) for every flag.

## Uvicorn vs. Gunicorn

LiteLLM Proxy runs on [Uvicorn](https://uvicorn.dev/) by default. Passing `--run_gunicorn` instead starts [Gunicorn](https://gunicorn.org/) as a process manager that supervises [Uvicorn worker processes](https://uvicorn.dev/deployment/#gunicorn) (`uvicorn.workers.UvicornWorker`). In both cases your application code still runs on Uvicorn; the difference is which process manages and recycles the workers.

| | Uvicorn (default) | Gunicorn (`--run_gunicorn`) |
|---|---|---|
| **When to use** | Recommended for almost all deployments, especially Kubernetes with one worker per pod. | Choose when you run **multiple workers in a single container** and want a mature process manager to supervise and recycle them. |
| **Worker recycling** | Uvicorn's [`limit_max_requests`](https://uvicorn.dev/settings/#resource-limits). | Gunicorn's [`max_requests`](https://gunicorn.org/reference/settings/#max_requests), the battle-tested mechanism Gunicorn has shipped for years. |
| **Process supervision** | Uvicorn's built-in multiprocess manager. | Gunicorn's [arbiter](https://gunicorn.org/design/#arbiter), which restarts workers one at a time as they exit. |

:::tip Recommendation

On Kubernetes, run **one Uvicorn worker per pod** and scale **horizontally** (more pods) rather than vertically (more workers per pod). One process per pod keeps latency predictable under load, lets the Horizontal Pod Autoscaler use the [thresholds in the production checklist](./prod.md#machine-specifications) accurately, and makes rolling restarts hitless because Kubernetes drains one pod at a time. Reach for Gunicorn only when you must pack multiple workers into one container.

:::

### Recycle workers

If you observe gradual memory growth under sustained load, recycle each worker after a fixed number of requests to bound memory usage. `--max_requests_before_restart` maps to Uvicorn's [`limit_max_requests`](https://uvicorn.dev/settings/#resource-limits) (default server) and to Gunicorn's [`max_requests`](https://gunicorn.org/reference/settings/#max_requests) under `--run_gunicorn`. Configure it via CLI flag or environment variable:

```shell
# CLI
CMD ["--port", "4000", "--config", "./proxy_server_config.yaml", "--num_workers", "1", "--max_requests_before_restart", "10000"]

# or ENV (for deployment manifests / containers)
export MAX_REQUESTS_BEFORE_RESTART=10000
```

:::tip

When you run **multiple workers in one container** and rely on `--max_requests_before_restart`, prefer `--run_gunicorn`. Gunicorn's [`max_requests`](https://gunicorn.org/reference/settings/#max_requests) recycling is more mature than Uvicorn's, and its [arbiter](https://gunicorn.org/design/#arbiter) restarts workers one at a time so the pod keeps serving traffic while a worker is replaced.

:::

```shell
# Multiple workers in one container, with Gunicorn-managed recycling
CMD ["--port", "4000", "--config", "./proxy_server_config.yaml", "--num_workers", "4", "--run_gunicorn", "--max_requests_before_restart", "10000"]
```

When several workers boot together and serve a similar amount of traffic, they reach the request threshold at almost the same time and recycle in lockstep, dropping a chunk of capacity at once. Add `--max_requests_before_restart_jitter` to offset each worker's threshold by a random amount in `[0, jitter]` so restarts stagger instead of synchronizing. It maps to Uvicorn's [`limit_max_requests_jitter`](https://uvicorn.dev/settings/#resource-limits) (requires `uvicorn>=0.41.0`) and Gunicorn's [`max_requests_jitter`](https://gunicorn.org/reference/settings/#max_requests_jitter), and has no effect without `--max_requests_before_restart`.

```shell
# Stagger recycling so workers don't all restart at once
CMD ["--port", "4000", "--config", "./proxy_server_config.yaml", "--num_workers", "4", "--run_gunicorn", "--max_requests_before_restart", "10000", "--max_requests_before_restart_jitter", "1000"]
```

### Keep restarts hitless

A restart is "hitless" when in-flight requests finish before the process exits, so no client sees a dropped connection. Two cases matter in production:

**Worker recycling (from `--max_requests_before_restart`).** Both servers stop accepting new connections on the recycled worker and let outstanding requests drain before it exits, then a replacement worker starts. Gunicorn additionally guarantees in-flight requests up to its [`graceful_timeout`](https://gunicorn.org/reference/settings/#graceful_timeout) (30s by default) on [`SIGTERM`](https://gunicorn.org/signals/). With one worker per pod, recycling briefly reduces that pod's capacity, which is why we recommend scaling horizontally so the load balancer can route around it.

**Rolling deploys and pod restarts (Kubernetes).** Make restarts hitless at the orchestration layer rather than relying on the server alone:

- Use a [`RollingUpdate`](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/#rolling-update-deployment) strategy (the Deployment default) so new pods become Ready before old pods are terminated.
- Keep a [readiness probe](https://kubernetes.io/docs/concepts/configuration/liveness-readiness-startup-probes/) on `/health/readiness` so Kubernetes only sends traffic to pods that can serve it, and stops routing to a pod as soon as termination begins.
- Set [`terminationGracePeriodSeconds`](https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/#pod-termination) to comfortably exceed your longest expected request (LiteLLM's request timeout defaults to 600s; see the [recommended config](./prod.md#set-a-request-timeout)). On termination Kubernetes sends `SIGTERM`, and both Uvicorn and Gunicorn shut down [gracefully](https://uvicorn.dev/deployment/) by draining in-flight requests before exiting.
- Optionally add a small [`preStop` hook](https://kubernetes.io/docs/concepts/containers/container-lifecycle-hooks/#container-hooks) (for example `sleep 5`) to give the load balancer time to deregister the pod before the server begins shutting down, eliminating the brief window where traffic can still arrive at a terminating pod.

```yaml title="Kubernetes Deployment snippet for hitless rolling restarts"
spec:
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 0   # never drop below desired replica count
      maxSurge: 1         # add one new pod at a time
  template:
    spec:
      terminationGracePeriodSeconds: 620   # > your longest request (request_timeout: 600)
      containers:
        - name: litellm
          readinessProbe:
            httpGet:
              path: /health/readiness
              port: 4000
          lifecycle:
            preStop:
              exec:
                command: ["sh", "-c", "sleep 5"]
```

## TLS at the proxy

For TLS terminated by the proxy itself (rather than your load balancer), pass the key and cert paths:

```shell
docker run docker.litellm.ai/berriai/litellm:latest \
    --ssl_keyfile_path ssl_test/keyfile.key \
    --ssl_certfile_path ssl_test/certfile.crt
```

## HTTP/2 with Hypercorn

To serve HTTP/2, build an image with hypercorn installed and pass `--run_hypercorn`:

```shell
FROM docker.litellm.ai/berriai/litellm:latest
WORKDIR /app
COPY config.yaml .
RUN chmod +x ./docker/entrypoint.sh
EXPOSE 4000/tcp
RUN uv add hypercorn
CMD ["--port", "4000", "--config", "config.yaml"]
```

```shell
docker run \
    -v $(pwd)/proxy_config.yaml:/app/config.yaml \
    -p 4000:4000 \
    -e DATABASE_URL=postgresql://<user>:<password>@<host>:<port>/<dbname> \
    -e LITELLM_MASTER_KEY="sk-1234" \
    your_custom_docker_image \
    --config /app/config.yaml \
    --run_hypercorn
```

## Granian ASGI server [Beta]

:::info Beta feature
`--run_granian` is in **beta**. Uvicorn is still the default server. Try Granian when you need more gateway throughput or see instability under load with uvicorn; report issues on [GitHub](https://github.com/BerriAI/litellm/issues).
:::

[Granian](https://github.com/emmett-framework/granian) is a Rust-backed ASGI server. In LiteLLM benchmarks it showed a 10 to 20 RPS improvement over uvicorn with the same worker count, steadier latency under sustained load, and lower error rates (see [PR #26027](https://github.com/BerriAI/litellm/pull/26027)). Scale throughput with `--num_workers`.

```shell
docker run docker.litellm.ai/berriai/litellm:latest \
    --config /app/config.yaml \
    --port 4000 \
    --run_granian \
    --num_workers 4
```

Both `--ssl_certfile_path` and `--ssl_keyfile_path` are required when enabling TLS with Granian. Not supported with Granian: `--max_requests_before_restart` (use Gunicorn for per-request worker recycling) and `--ciphers` (Hypercorn only). See [CLI server backend options](/docs/proxy/cli#server-backend-options).

## Keepalive timeout

Defaults to 5 seconds; between requests, connections must receive new data within this period or be disconnected.

```shell
docker run docker.litellm.ai/berriai/litellm:latest \
    --keepalive_timeout 75
```

Or set `KEEPALIVE_TIMEOUT=75` as an env var.

## Load config.yaml from S3 or GCS

Use this if you cannot mount a config file on your deployment service (AWS Fargate, Railway, etc.). LiteLLM reads `config.yaml` from the bucket at startup.

<Tabs>
<TabItem value="gcs" label="GCS Bucket">

```shell
docker run --name litellm-proxy \
   -e DATABASE_URL=<database_url> \
   -e LITELLM_CONFIG_BUCKET_TYPE="gcs" \
   -e LITELLM_CONFIG_BUCKET_NAME="litellm-proxy" \
   -e LITELLM_CONFIG_BUCKET_OBJECT_KEY="proxy_config.yaml" \
   -p 4000:4000 \
   docker.litellm.ai/berriai/litellm-database:latest
```

</TabItem>
<TabItem value="s3" label="s3">

```shell
docker run --name litellm-proxy \
   -e DATABASE_URL=<database_url> \
   -e LITELLM_CONFIG_BUCKET_NAME="litellm-proxy" \
   -e LITELLM_CONFIG_BUCKET_OBJECT_KEY="litellm_proxy_config.yaml" \
   -p 4000:4000 \
   docker.litellm.ai/berriai/litellm-database:latest
```

</TabItem>
</Tabs>

## Disable pulling live model prices

Set `LITELLM_LOCAL_MODEL_COST_MAP="True"` to use the bundled [model prices file](https://github.com/BerriAI/litellm/blob/main/model_prices_and_context_window.json) instead of fetching it at startup, if you see long cold starts or have network egress restrictions.
