# High-Throughput Gateway Profile

This page is the deployment profile behind the [v1.102.0 benchmark](../benchmarks.md#v11020-3000-rps-with-50k-to-100k-token-prompts): the componentized Helm chart with several uvicorn workers per pod, an in-pod PgBouncer, Rust admission token counting, a metrics sidecar and a collector sidecar, and a HorizontalPodAutoscaler that follows requests and tokens per second. Use it when the gateway has to hold thousands of requests per second with large prompts (tens of thousands of tokens each). For a first deployment read [Deploy](./deploy.md) and the [production checklist](./prod.md) instead; this page assumes both.

Everything below is available from chart `1.102.0-dev.2` (appVersion `v1.102.0-dev.2`). Each knob is off by default, so an existing componentized release keeps its behavior when you upgrade the chart and only changes once you set the values.

## What the chart deploys

The chart at `oci://ghcr.io/berriai/litellm/chart/litellm` runs the proxy as four components with their own Deployments, Services, and scaling: `gateway` serves LLM traffic on port 4000, `backend` serves the management API, `ui` serves the admin UI on port 3000, and a `migrations` Job applies the Prisma schema. The images are `ghcr.io/berriai/litellm-gateway`, `litellm-backend`, `litellm-ui`, and `litellm-migrations`, and every tag defaults to the chart's appVersion. Postgres and Redis are external and required: the chart has no bundled subcharts, and rendering fails without `database.writer.host`. Point `redis.host` at your Redis; the gateway uses it for cross-pod rate limits, budgets, and the spend buffer. Redis Cluster and serverless Redis need `redis_startup_nodes` in `cache_params` (see [Redis caching](./caching_redis.md) and [ElastiCache](./elasticache_iam.md)).

Only the gateway sees inference traffic, so this page only tunes the gateway. The backend and UI stay at their chart defaults.

## Install

Create the Secrets first: one holding the database username and password, one holding the master key. Then install with values like these, which are the profile that produced the benchmark numbers:

```yaml title="values.yaml"
fullnameOverride: litellm

masterKey:
  secretName: litellm-masterkey
  secretKey: masterkey

database:
  writer:
    host: "<postgres-endpoint>"
    port: 5432
    dbname: litellm
    passwordSecret:
      name: litellm-db
      usernameKey: username
      passwordKey: password
  # one PgBouncer per gateway pod, shared by all of its workers
  connectionPool:
    enabled: true
    maxDbConnections: 8
    maxClientConn: 1000

redis:
  host: "<redis-endpoint>"
  port: 6379
  passwordSecret:
    name: litellm-env
    passwordKey: REDIS_PASSWORD

gateway:
  numWorkers: 4
  logLevel: ERROR
  extraEnv:
    - name: LITELLM_RUST
      value: "1"
    - name: KEEPALIVE_TIMEOUT
      value: "75"
  # metrics on their own port and process, scraped per pod
  metricsServer:
    enabled: true
  serviceMonitor:
    enabled: true
  # spend pipeline off the inference workers
  collector:
    enabled: true
  resources:
    requests:
      cpu: "4"
      memory: 16Gi
    limits:
      cpu: "16"
      memory: 16Gi
  hpa:
    enabled: true
    minReplicas: 2
    maxReplicas: 200
    targetCPUUtilizationPercentage: 60
    targetMemoryUtilizationPercentage: 80
    targetRequestsPerSecond: "83"
    targetTokensPerSecond: "6.25M"
    behavior:
      scaleUp:
        stabilizationWindowSeconds: 0
        policies:
          - type: Percent
            value: 100
            periodSeconds: 15
          - type: Pods
            value: 20
            periodSeconds: 15
      scaleDown:
        stabilizationWindowSeconds: 300
        policies:
          - type: Percent
            value: 25
            periodSeconds: 60
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 0
      maxSurge: 25%
  lifecycle:
    preStop:
      exec:
        command: ["sh", "-c", "sleep 10"]
  terminationGracePeriodSeconds: 620
  startupProbe:
    httpGet: { path: /health/readiness, port: http }
    failureThreshold: 30
    periodSeconds: 10
  pdb:
    enabled: true
    maxUnavailable: 10%
  config:
    general_settings:
      proxy_batch_write_at: 60
      use_redis_transaction_buffer: true
      allow_requests_on_db_unavailable: true
    litellm_settings:
      callbacks:
        - prometheus
      request_timeout: 600
      json_logs: true
```

```bash
helm upgrade --install litellm \
  oci://ghcr.io/berriai/litellm/chart/litellm \
  --version 1.102.0-dev.2 \
  -f values.yaml
```

Add your `model_list`, ingress, and any read replica the same way as in [Deploy with Helm](./deploy.md#deploy-with-helm). `fullnameOverride: litellm` gives the resources the short names used in the commands below (`litellm-gateway`, `litellm-gateway-metrics`); without it the chart prefixes them with the release name. The pod size (4 vCPU request, 16Gi) and the HPA targets are what the benchmark ran with, and the sections below explain how each was chosen so you can rescale them for your traffic.

## Workers per pod

`gateway.numWorkers` sets the number of uvicorn worker processes in the gateway container (`NUM_WORKERS`). The [production checklist](./prod.md#autoscaling) recommends one worker per pod and scaling on replicas, and that remains the safe default. The benchmark ran four workers on a 4 vCPU request because the per-pod sidecars (PgBouncer, metrics, collector) and the per-pod database connection budget are amortized over more workers that way, and because large prompts make each request CPU heavy enough that a worker is rarely idle waiting on the provider. Eight workers on the same pod gave no latency change and used 50 percent more memory, so four is the tested sweet spot for this shape.

Set the CPU limit well above the request. With `limits.cpu: "4"` on a 4-worker pod the container was CFS throttled in 27 to 39 percent of scheduler periods at 700 rps while averaging only 2.3 to 2.6 cores: four event loops plus the Rust tokenizer threads plus PgBouncer burst past four cores inside a 100 ms period and every worker in the pod stalls until the next one, which showed up directly in p50 and p95. Raising the limit to 16 with the request left at 4 took the throttled ratio to zero and p99 at 700 rps from 830 to 670 ms. Scheduling and the HPA still use the request.

## PgBouncer per pod

`database.connectionPool.enabled` starts a PgBouncer inside the gateway container, and the workers connect to it over loopback. Without it every worker opens its own Prisma pool straight to Postgres, so a pod's footprint against the database connection ceiling is `numWorkers x connection_limit` and grows with each replica; with it a pod holds at most `maxDbConnections` upstream connections however many workers it runs. The chart's starting profile is `maxDbConnections: 20` for four workers, which fits roughly 200 gateway replicas under a 5,000-connection ceiling. The benchmark ran `maxDbConnections: 8`: the PgBouncer console under the 1k rps soak showed 33 active clients, zero waiting, and an average wait of 1 microsecond, so eight upstream connections were not a queue and Postgres saw 86 to 175 connections for 11 to 29 pods instead of the 880 to 5,200 that direct per-worker pools would have opened.

The chart emits `LITELLM_PGBOUNCER_ENABLED`, `LITELLM_PGBOUNCER_MAX_DB_CONNECTIONS`, and `LITELLM_PGBOUNCER_MAX_CLIENT_CONN` on the gateway container and its collector sidecar only. The backend runs a single worker and the migrations Job keeps a direct connection, so neither changes. Pair `maxClientConn` with the pool size: the workers, the collector, and any in-process background jobs all count as clients. With `database.writer.useIAMAuth` or `useAzureEntraAuth` the pool mints and renews the database token itself; see the comments in the [chart's values.yaml](https://github.com/BerriAI/litellm/blob/main/helm/litellm/values.yaml) for the exact behavior of your chart version.

No run was made with PgBouncer disabled on this workload, so the connection counts above are the measured effect and there is no latency comparison to quote.

## Rust admission token counting

Budget reservation counts prompt tokens at admission, before the request is forwarded, for any key, team, or user that carries a `max_budget` and any model with a price. On a 50k to 100k-token body that count is the single largest CPU cost in the request path. `LITELLM_RUST=1` moves it to the Rust extension that ships in the gateway image (`litellm.rust_bridge._native`), which counts on a thread pool off the event loop and, for models on the Anthropic tokenizer, uses a byte-level fast path instead of the regex pre-tokenizer. It is off by default; the chart has no dedicated value for it, so set it through `gateway.extraEnv` as above.

Measured on the live bodies, the count went from 46, 53, and 100 ms per 50k, 75k, and 100k body to 4.9, 6.8, and 10.2 ms. Fleet-wide at 1,000 rps this was the change that made the workload fit: gateway CPU per request fell from about 170 ms to about 23 ms, p95 from 730 to 300 ms, p99 from 880 to 360 ms, the settled pod count from 65 or more to 11 to 29 depending on the run, and the gateway working set from 262 GiB to 28 to 70 GiB. Without the flag the Python tokenizer path measured 84 to 197 ms per body, and under contention the pre-fast-path Rust count was slower still because its regex ran on blocking threads competing with the event loops for CPU.

Setting `LITELLM_LOCAL_MODEL_COST_MAP="True"` makes the price lookup use the [map bundled with the image](./server_tuning.md#disable-pulling-live-model-prices) so pods start without egress; the benchmark set it.

## Metrics sidecar and ServiceMonitor

`gateway.metricsServer.enabled` adds a `metrics` container that serves the workers' multiprocess Prometheus files on port 4001 and a ClusterIP Service named `<gateway>-metrics`, so a scrape never lands on an inference worker. The port has no virtual-key auth; keep it off any public ingress. The sidecar cost about 2 millicores per pod at 700 rps. `gateway.serviceMonitor.enabled` renders a Prometheus Operator ServiceMonitor against that Service at a 15s interval, and because every pod is its own target each sample carries the `pod` label the autoscaling queries below group by. The chart refuses to render the ServiceMonitor without the metrics server, since the http port answers an unauthenticated scrape with 401. Details are in [Isolate Prometheus scraping from inference traffic](./prometheus.md#isolate-prometheus-scraping-from-inference-traffic).

## Collector sidecar

`gateway.collector.enabled` adds a `collector` container (same image, `python -m litellm.proxy.collector`) that runs the post-response spend pipeline: cost calculation, spend logs, spend counters, and budget reservation reconciliation. The uvicorn workers serialize a compact event over a Unix socket and go back to serving requests. The sidecar shares the pod's env, proxy config, PgBouncer, and Redis spend buffer, so the per-pod database connection budget does not change. Delivery is at-most-once inside the pod: `onUnavailable: fallback` (the default) runs the pipeline in the worker when the sidecar is unreachable or the `bufferSize` is full, so spend stays exact at the price of gateway CPU for that request; `drop` discards the event instead and under-reports spend.

In the 700 rps A/B the collector took the spend work out of the workers entirely (py-spy inclusive share of the success handler went from 3.9 percent to about zero) and improved the tail, p99 from 1,800 to 830 ms and max from 6,375 to 2,870 ms, while adding 3.7 to 4.2 cores fleet-wide for the sidecars themselves, about 4 ms of CPU per request. Total gateway compute at 700 rps was unchanged, so treat it as a request-path isolation and tail-latency change, not a compute saving. With `scaleOnGatewayContainerCpu: true` (the default) and a CPU target set, the HPA renders a `ContainerResource` metric for the `gateway` container only, so the sidecar's CPU never drives inference replicas; that needs Kubernetes 1.30 or newer.

## Keep-alive

The gateway launcher honors `KEEPALIVE_TIMEOUT` by passing `--timeout-keep-alive` to uvicorn. Set it above your load balancer's idle timeout (the AWS ALB default is 60s, so `75`), otherwise uvicorn closes idle connections first and the load balancer answers the next request on that connection with a 502. In the 200 rps A/B this took ALB-generated 502s from 15 (99.981 percent success) to zero, and without it the failure shows up on every HPA scale-out. The same rule for the classic image is in [server tuning](./server_tuning.md#keepalive-timeout).

## Autoscaling on requests and tokens per second

`gateway.hpa` accepts CPU, memory, requests per second, and tokens per second targets at once and follows whichever asks for the most replicas. The RPS and TPS targets are opt-in and render `autoscaling/v2` `Pods` metrics named `litellm_requests_per_second` and `litellm_tokens_per_second`, which a [Prometheus Adapter](https://github.com/kubernetes-sigs/prometheus-adapter) has to serve from the counters the ServiceMonitor scrapes. The adapter rules, the reason the `rate()` window should stay at `[1m]` with a 15s scrape, and the KEDA alternative for `litellm-helm` are all in [Scale on requests and tokens per pod](./deploy.md#scale-on-requests-and-tokens-per-pod); this section only covers how the targets were chosen.

Set the targets from a measured pod. The passing 1,000 rps runs sat at about 91 rps and 6.8M tokens per second per pod on 11 pods with CPU at 60 percent of the request, so targets of `83` rps and `6.25M` tokens per second give about 12 pods at 1,000 rps with headroom, and the same fleet math scaled the benchmark to 33 pods at 3,000 rps. CPU at 60 percent and memory at 80 percent stay as backstops. Because the token counter is incremented when a response completes, RPS reacts first and TPS follows; do not set a TPS target alone if traffic is dominated by multi-minute streams.

Scale up fast and down slowly. `scaleUp.stabilizationWindowSeconds: 0` with 100 percent or 20 pods per 15s lets the HPA follow a traffic step as fast as nodes can be provisioned, which is the real limiter; `scaleDown` on the Kubernetes default 300s window at 25 percent per minute keeps the fleet from collapsing between bursts. In the 200-user check the HPA read the new RPS value and added a replica within about 48 seconds of load start. Freshly started pods have no request counter series until their first request, so right after a rollout the HPA may report `FailedGetPodsMetric` on the custom metrics and fall back to CPU and memory until a few requests land; under real traffic this clears within one scrape.

Two settings keep scale-out from feeding on itself. `allow_requests_on_db_unavailable: true` keeps `/health/readiness` returning 200 when the probe's 2s database ping times out on a saturated pod; without it cold pods flipped NotReady, the HPA excluded them and the load balancer dropped them, and the warm-up ramp stalled at 41 to 55 rps. The `startupProbe` with 30 failures at 10s covers the slower cold start of four workers plus PgBouncer so a new pod is not liveness-killed while it loads.

## Hitless rollouts with long requests

A 600s `request_timeout`, `terminationGracePeriodSeconds: 620`, a 10s `preStop` sleep so the load balancer deregisters the pod before uvicorn starts draining, `maxUnavailable: 0` with `maxSurge: 25%`, and a PodDisruptionBudget of `maxUnavailable: 10%` together let a chart upgrade or node rotation finish in-flight requests. The same pattern is described for the classic image in [Keep restarts hitless](./server_tuning.md#keep-restarts-hitless).

## Verify the rollout

Each gateway pod should show three containers, and the environment should carry the pool and Rust settings:

```bash
kubectl -n <ns> get pods -l app.kubernetes.io/component=gateway \
  -o custom-columns=POD:.metadata.name,CONTAINERS:.spec.containers[*].name
kubectl -n <ns> exec deploy/litellm-gateway -c gateway -- \
  env | grep -E 'NUM_WORKERS|LITELLM_PGBOUNCER|LITELLM_RUST|KEEPALIVE'
kubectl -n <ns> exec deploy/litellm-gateway -c gateway -- \
  python -c "import litellm.rust_bridge._native; print('rust ok')"
```

The metrics Service should answer without a key, and the adapter should be serving the two per-second metrics per pod:

```bash
kubectl -n <ns> port-forward svc/litellm-gateway-metrics 4001:4001 &
curl -s localhost:4001/metrics/ | grep -c '^litellm_'
kubectl get --raw /apis/custom.metrics.k8s.io/v1beta1/namespaces/<ns>/pods/*/litellm_requests_per_second
kubectl get --raw /apis/custom.metrics.k8s.io/v1beta1/namespaces/<ns>/pods/*/litellm_tokens_per_second
kubectl -n <ns> describe hpa litellm-gateway
```

The HPA description lists all four metrics with their current values. Send a streaming and a non-streaming request through a virtual key with a `max_budget` and compare `usage.prompt_tokens` on both: they should match, which confirms the admission count is being reused for the streaming usage chunk instead of re-tokenizing the prompt.

## Measured results

The [benchmarks page](../benchmarks.md#v11020-3000-rps-with-50k-to-100k-token-prompts) has the full comparison of this profile against `v1.101.0` on the same load generator, including the conditions and the caveats about what the gateway-side and client-side numbers each measure.
