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
| **When to use** | Recommended for almost all deployments, especially Kubernetes with one worker per pod. | Choose when you run **multiple workers in a single container** and want Gunicorn to supervise them. Gunicorn ignores `--keepalive_timeout`, so avoid it behind a load balancer that reuses connections (see [Keepalive timeout](#keepalive-timeout)). |
| **Worker recycling** | Uvicorn's [`limit_max_requests`](https://uvicorn.dev/settings/#resource-limits). | Gunicorn's [`max_requests`](https://gunicorn.org/reference/settings/#max_requests). Both drop requests on each recycle today (see [Recycle workers](#recycle-workers)). |
| **Process supervision** | Uvicorn's built-in multiprocess manager. | Gunicorn's [arbiter](https://gunicorn.org/design/#arbiter), which restarts workers one at a time as they exit. |

:::tip[Recommendation]

On Kubernetes, run **one Uvicorn worker per pod** and scale **horizontally** (more pods) rather than vertically (more workers per pod). One process per pod keeps latency predictable under load, lets the Horizontal Pod Autoscaler use the [thresholds in the production checklist](./prod.md#autoscaling) accurately, and makes rolling restarts hitless because Kubernetes drains one pod at a time. Reach for Gunicorn only when you must pack multiple workers into one container.

:::

### Recycle workers

If you observe gradual memory growth under sustained load, you can recycle each worker after a fixed number of requests to bound memory usage. Treat this as a last resort after raising the memory limit or adding replicas, because each recycle drops requests today (see the warning below). `--max_requests_before_restart` maps to Uvicorn's [`limit_max_requests`](https://uvicorn.dev/settings/#resource-limits) (default server) and to Gunicorn's [`max_requests`](https://gunicorn.org/reference/settings/#max_requests) under `--run_gunicorn`. Configure it via CLI flag or environment variable:

```shell
# CLI
CMD ["--port", "4000", "--config", "./proxy_server_config.yaml", "--num_workers", "2", "--max_requests_before_restart", "10000", "--max_requests_before_restart_jitter", "1000"]

# or ENV (for deployment manifests / containers)
export MAX_REQUESTS_BEFORE_RESTART=10000
```

:::danger[Recycling drops requests]

A recycle is not hitless on either server. When a worker reaches its limit it closes all of its idle keep-alive connections at once. A reverse proxy or load balancer that reuses connections to LiteLLM (Traefik, nginx with upstream `keepalive`, Cloud Run, most cloud load balancers) can send a request down one of those connections at that moment, and it returns a `502` to the client. Under steady load nearly every connection the worker held loses one request, so each recycle shows up as a burst of 5xx at the proxy, while the same load with recycling off has none. Switching to `--run_gunicorn` does not help, since Gunicorn recycling fails the same way.

From v1.108.0, a recycle also cancels any request still running `GRACEFUL_SHUTDOWN_TIMEOUT` seconds (30 by default) after the recycle starts. A non-streaming call cut off this way gets a `500`, and a stream stops partway with no `[DONE]` and no error, so a client can mistake a cut-off answer for a complete one. LLM calls often run longer than 30 seconds.

If you still need recycling, set a high limit so recycles are rare, add jitter, and raise `GRACEFUL_SHUTDOWN_TIMEOUT` above your longest request (`request_timeout`) so long calls can finish. The same variable bounds the drain on `SIGTERM`, so keep `terminationGracePeriodSeconds` above it. None of these settings stop the `502`s from closed keep-alive connections.

:::

:::warning

Only use `--max_requests_before_restart` with two or more workers. With `--num_workers 1` there is no other worker to keep serving, so hitting the limit takes the whole pod out of service: Uvicorn exits the process with code 0 and the container restarts, and Gunicorn accepts no connections until the replacement worker has booted. The proxy prints a warning at startup when the flag is set with a single worker. Every HTTP request counts toward the limit, health probes included, so two probes every 15 seconds use up 11,520 requests a day on their own. With one worker per pod, rely on Kubernetes replacing pods instead.

:::

When several workers boot together and serve a similar amount of traffic, they reach the request threshold at almost the same time and recycle in lockstep, dropping a chunk of capacity at once. Add `--max_requests_before_restart_jitter` to offset each worker's threshold by a random amount in `[0, jitter]` so restarts stagger instead of synchronizing. It maps to Uvicorn's [`limit_max_requests_jitter`](https://uvicorn.dev/settings/#resource-limits) (requires `uvicorn>=0.41.0`) and Gunicorn's [`max_requests_jitter`](https://gunicorn.org/reference/settings/#max_requests_jitter), and has no effect without `--max_requests_before_restart`.

```shell
# Stagger recycling so workers don't all restart at once
CMD ["--port", "4000", "--config", "./proxy_server_config.yaml", "--num_workers", "4", "--max_requests_before_restart", "10000", "--max_requests_before_restart_jitter", "1000"]
```

### Keep restarts hitless

A restart is "hitless" when in-flight requests finish before the process exits, so no client sees a dropped connection. Two cases matter in production:

**Worker recycling (from `--max_requests_before_restart`).** Recycling is not hitless today, with any number of workers. The recycled worker stops accepting new connections and drains the requests it is serving, but it closes its idle keep-alive connections at once, so a keep-alive proxy in front returns `502` for requests it sends down them, and from v1.108.0 it cancels requests still running after `GRACEFUL_SHUTDOWN_TIMEOUT` (30s by default). See [Recycle workers](#recycle-workers). With one worker per pod, recycling also takes the pod out of service instead of reducing its capacity, so never use `--max_requests_before_restart` there.

**Rolling deploys and pod restarts (Kubernetes).** Make restarts hitless at the orchestration layer rather than relying on the server alone:

- Use a [`RollingUpdate`](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/#rolling-update-deployment) strategy (the Deployment default) so new pods become Ready before old pods are terminated.
- Keep a [readiness probe](https://kubernetes.io/docs/concepts/configuration/liveness-readiness-startup-probes/) on `/health/readiness` so Kubernetes only sends traffic to pods that can serve it, and stops routing to a pod as soon as termination begins.
- Set [`terminationGracePeriodSeconds`](https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/#pod-termination) to comfortably exceed your longest expected request (LiteLLM's request timeout defaults to 600s; see the [recommended config](./prod.md#set-a-request-timeout)). On termination Kubernetes sends `SIGTERM`, and both Uvicorn and Gunicorn shut down [gracefully](https://uvicorn.dev/deployment/) by draining in-flight requests before exiting. From v1.108.0 that drain waits at most `GRACEFUL_SHUTDOWN_TIMEOUT` (30s by default) and then cancels what is still running, so raise it to cover your longest request and keep `terminationGracePeriodSeconds` above it.
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
          env:
            - name: GRACEFUL_SHUTDOWN_TIMEOUT
              value: "600"    # drain long requests on SIGTERM; keep below terminationGracePeriodSeconds
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
    -e LITELLM_MASTER_KEY="sk-<paste-a-long-random-key>" \
    your_custom_docker_image \
    --config /app/config.yaml \
    --run_hypercorn
```

## Outbound HTTP/2 to providers

<SinceVersion v="1.103.0" />

The server flags above only affect the hop from your clients to LiteLLM. Calls from LiteLLM to LLM providers use HTTP/1.1 by default because the default aiohttp transport has no HTTP/2 client. The one exception is [Vertex AI Search vector store search](#vertex-ai-search-vector-stores). This covers calls through LiteLLM's own HTTP client. Calls LiteLLM makes through a provider SDK, such as the `google-cloud-aiplatform` and Vertex AI speech clients over gRPC or the AWS CRT client for Bedrock realtime, use the protocol that SDK picks, and `http2` does not change it. Set `http2: true` under `litellm_settings` (or the `LITELLM_HTTP2` environment variable) to have LiteLLM negotiate HTTP/2 with providers over TLS; upstreams that do not offer `h2` via ALPN fall back to HTTP/1.1 automatically, and plain `http://` upstreams stay on HTTP/1.1.

```yaml
litellm_settings:
  http2: true
```

Enabling this routes provider traffic through httpx instead of aiohttp, which was chosen as the default for its higher HTTP/1.1 throughput. Load test with the flag on before enabling it fleet-wide. Clients you pass in yourself through `litellm.client_session` or `litellm.aclient_session` are used as is and are not switched to HTTP/2. Deployments on the `aiohttp_openai/` provider always use aiohttp and stay on HTTP/1.1; LiteLLM logs a warning if the flag is on for such a request. With `http2` true, synchronous calls through LiteLLM's HTTP client that run in several threads at once share one HTTP/2 connection and can fail, so use the async methods for concurrent calls.

### Vertex AI Search vector stores

<SinceVersion v="1.109.0" />

Searches on a `vertex_ai/search_api` vector store negotiate HTTP/2 by default, through the proxy and through `litellm.vector_stores.asearch` in the SDK, so a burst of searches shares a few Google connections per worker instead of opening one connection per search. The synchronous `litellm.vector_stores.search` stays on HTTP/1.1 unless `http2` is true. With `http2` true, synchronous searches sent from several threads at once can fail like any other synchronous call, so use `asearch` for concurrent searches.

With the default settings (`http2` unset and the aiohttp transport on), these searches go through httpx but keep some of the aiohttp pool settings. LiteLLM opens one more connection for every 100 searches in flight, up to one connection per 100 of `AIOHTTP_CONNECTOR_LIMIT`, rounded up, which is 10 connections at the default of 1000, and `AIOHTTP_CONNECTOR_LIMIT=0` removes the cap. Each connection runs at most 100 searches at once, and past that cap a new search waits inside LiteLLM for a free slot on an open connection. That wait has no timeout, and the search's own `timeout` does not count it. So here the limit caps connections, not searches in flight, and a limit of 50 still runs up to 100 searches at once on one connection. `AIOHTTP_KEEPALIVE_TIMEOUT` and `DISABLE_AIOHTTP_TRUST_ENV` also apply, while `AIOHTTP_CONNECTOR_LIMIT_PER_HOST`, `AIOHTTP_TTL_DNS_CACHE` and the `AIOHTTP_SO_KEEPALIVE` settings do not.

With `http2` true or `DISABLE_AIOHTTP_TRANSPORT=True`, these searches use the httpx default pool limits like every other provider on httpx, so none of the `AIOHTTP_*` settings apply and the searches in a worker share one connection, so past 100 searches in flight the rest wait inside LiteLLM for a free slot, with no timeout on that wait.

If Google closes a connection with an HTTP/2 GOAWAY while a search is in flight on it, LiteLLM retries that search once and logs `Vector store search connection was closed by an HTTP/2 GOAWAY, retrying once`. Google may have already run the first attempt, so that search can count as two queries.

To keep these searches on HTTP/1.1, set `http2: false` under `litellm_settings`, `LITELLM_HTTP2=False` (`0`, `no` and `off` also work), or `litellm.http2 = False` in the SDK. This turns HTTP/2 off for every provider call through LiteLLM's HTTP client, Vertex AI Search included. A true value in the setting or the env var wins over a false one in the other, so remove `LITELLM_HTTP2=True` before you set `http2: false`.

```yaml
litellm_settings:
  http2: false
```

In the SDK, a search that passes its own `ssl.SSLContext` as `ssl_verify` stays on HTTP/1.1 while `http2` is unset, so LiteLLM leaves the ALPN protocols on that context alone. With `http2` true, LiteLLM sets that context to offer `h2`.

## Granian ASGI server [Beta]

:::info[Beta feature]
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

Both `--ssl_certfile_path` and `--ssl_keyfile_path` are required when enabling TLS with Granian. Not supported with Granian: `--max_requests_before_restart` and `--ciphers` (Hypercorn only). See [CLI server backend options](/docs/proxy/cli#server-backend-options).

## Per-worker admission control

A worker whose event loop is saturated keeps accepting connections, so during a load spike callers wait for seconds with no overload signal, and the liveness probe (which runs on the same loop) slows down enough that Kubernetes restarts the pod and pushes the load onto the remaining replicas. Admission control puts a hard cap on how much work each worker process takes on and turns the excess into an explicit, fast `503` that clients can retry against.

```yaml
general_settings:
  max_in_flight_requests_per_worker: 64   # requests being processed at once, per worker process
  max_queued_requests_per_worker: 64      # requests waiting for a slot; defaults to the in-flight cap
  admission_queue_timeout_seconds: 1.0    # a queued request is rejected after waiting this long
```

The feature is off until `max_in_flight_requests_per_worker` is set. When a request arrives and the worker has a free slot it runs immediately. Otherwise it waits in the queue until a slot frees or the timeout elapses. If the queue is already full, or the wait times out, the client gets:

```
HTTP/1.1 503 Service Unavailable
retry-after: 1

{"error":{"message":"Worker at capacity: 64 in-flight, 64 queued requests. Retry later.","type":"overloaded_error","code":"503"}}
```

A slot is held for the whole response, so a streaming completion counts as one in-flight request until its last chunk is sent, and a client disconnect (queued or in flight) releases the slot immediately. The probe and metrics paths (`/health/liveliness`, `/health/liveness`, `/health/readiness`, `/health/readiness/details`, `/health/backlog`, `/health/drain`, `/metrics`) bypass the gate, so an overloaded worker still answers its liveness probe quickly while a wedged process does not. Rejections happen before authentication, so they are not attributed to a key in spend logs. The limits are read on the first request and need a restart to change.

The cap is per worker process and works the same on uvicorn and Granian. A pod started with `--num_workers 4` and `max_in_flight_requests_per_worker: 64` admits up to 256 concurrent requests, and a deployment of N replicas admits N times that, so size it from the per-worker throughput you measured rather than the deployment total. It is a good fit with an HPA: replicas that are already saturated shed load with `503`s instead of accumulating latency while new replicas come up. It complements `global_max_parallel_requests`, which is a deployment-wide limit coordinated through Redis: use the global limit to bound total load on your providers and the per-worker limit to keep any single event loop from drowning without depending on Redis.

Monitor it with `/health/backlog` (fields `in_flight_requests`, `admitted_requests`, `queued_requests`, `rejected_requests`) or the Prometheus metrics `litellm_admission_admitted_requests`, `litellm_admission_queued_requests`, and `litellm_admission_rejected_requests_total{reason="queue_full"|"queue_timeout"}`; see [Pod health metrics](/docs/proxy/prometheus#pod-health-metrics). A steady stream of `queue_timeout` rejections means the worker is at capacity and needs more replicas; `queue_full` rejections mean spikes are arriving faster than the queue can absorb, so raise the queue size or add capacity.

## Request header buffer size

When Uvicorn selects h11, the default server and `--run_gunicorn` use a 16 KiB buffer for incomplete HTTP headers. Set [`--max_request_header_size`](./cli#--max_request_header_size) or `MAX_REQUEST_HEADER_SIZE` in bytes to allow larger headers added by an upstream gateway.

```shell
litellm --config config.yaml --max_request_header_size 131072
```

This allows up to 128 KiB to accumulate while a header block is incomplete. Setting the value preserves Uvicorn's automatic parser selection. Uvicorn normally selects httptools when it is installed, and httptools ignores this setting. The configured buffer applies when h11 is selected. The setting does not apply to Hypercorn or Granian. With h11's default buffer, large headers can intermittently return `400 Invalid HTTP request received.` depending on how they are split across reads. See [Uvicorn's incomplete-event buffer setting and its 16384-byte default](https://uvicorn.dev/settings/#implementation).

## Keepalive timeout

Defaults to 5 seconds; between requests, connections must receive new data within this period or be disconnected.

Behind a reverse proxy or load balancer that keeps idle connections to LiteLLM open for reuse, set LiteLLM's keep-alive longer than that proxy's idle timeout for upstream connections. Otherwise LiteLLM closes a connection the proxy still considers open, the proxy sends a request down it, and the client gets a `502`. Traefik keeps idle backend connections for 90 seconds by default (`idleConnTimeout`), and nginx uses the upstream `keepalive_timeout` (60 seconds by default), so `--keepalive_timeout 95` covers both defaults. Raise it further if you changed those values or your load balancer uses a longer idle timeout.

`--run_gunicorn` ignores `--keepalive_timeout` and `KEEPALIVE_TIMEOUT`, and its workers keep Gunicorn's 2-second keep-alive, so behind a load balancer that reuses connections, run the default Uvicorn server instead.

```shell
docker run docker.litellm.ai/berriai/litellm:latest \
    --keepalive_timeout 95
```

Or set `KEEPALIVE_TIMEOUT=95` as an env var.

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
   docker.litellm.ai/berriai/litellm:latest
```

</TabItem>
<TabItem value="s3" label="s3">

```shell
docker run --name litellm-proxy \
   -e DATABASE_URL=<database_url> \
   -e LITELLM_CONFIG_BUCKET_NAME="litellm-proxy" \
   -e LITELLM_CONFIG_BUCKET_OBJECT_KEY="litellm_proxy_config.yaml" \
   -p 4000:4000 \
   docker.litellm.ai/berriai/litellm:latest
```

</TabItem>
</Tabs>

## Disable pulling live model prices

Set `LITELLM_LOCAL_MODEL_COST_MAP="True"` to use the bundled [model prices file](https://github.com/BerriAI/litellm/blob/main/model_prices_and_context_window.json) instead of fetching it at startup, if you see long cold starts or have network egress restrictions.
