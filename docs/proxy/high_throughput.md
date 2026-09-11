# Scale the LiteLLM Gateway for high-throughput workloads

Large prompts put meaningful work on the gateway before a request reaches the model provider. Authentication, budget checks, token counting, spend tracking, metrics collection, and database connections can all compete with request processing.

This deployment profile separates that work and scales the gateway using request volume and token volume. In our large-prompt benchmark, it sustained 3,000 requests per second with 50K to 100K-token prompts while using 33 gateway pods. See the [full benchmark](../benchmarks.md#high-throughput-profile-3000-rps-with-50k-to-100k-token-prompts) for the test setup and results.

:::warning Development preview
The high-throughput deployment profile is still in development and is available in nightly builds. The install example below pins the earliest available version. Use the latest nightly for evaluation, and validate it in a non-production environment before rollout.
:::

## When to use this profile

Use this profile when your deployment has one or more of these characteristics:

- Thousands of requests per second
- Prompts with tens of thousands of tokens
- Multiple gateway workers per pod
- Strict database connection limits
- Long-running streaming requests

For a new deployment, start with [Deploy with Helm](./deploy.md) and the [production checklist](./prod.md). Apply this profile after you have a working componentized deployment with external Postgres and Redis.

## How the deployment works

The componentized chart runs the gateway, management backend, Admin UI, and database migrations independently. Only the gateway handles inference traffic, so each part can scale without increasing every other component.

This profile changes the gateway in six ways:

| Setting | What it does |
|---|---|
| `gateway.numWorkers` | Runs four request workers in each gateway pod. |
| `database.connectionPool` | Shares a small PgBouncer pool across all workers in a pod. |
| `LITELLM_RUST=1` | Moves large-prompt token counting to the Rust fast path. |
| `gateway.metricsServer` and `gateway.collector` | Moves metrics scraping and spend processing out of the request workers. |
| `gateway.hpa` | Scales on requests per second, tokens per second, CPU, and memory. |
| Keep-alive and rollout settings | Protects long-running requests during idle periods, scaling, and upgrades. |

All of these settings are opt-in. Upgrading the chart does not enable the profile automatically.

## Deploy the profile

Create the database and master-key Secrets first. Then add the following values to your existing componentized deployment.

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

  metricsServer:
    enabled: true
  serviceMonitor:
    enabled: true
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

Install the earliest nightly that contains the complete profile:

```bash
helm upgrade --install litellm \
  oci://ghcr.io/berriai/litellm/chart/litellm \
  --version 1.102.0-dev.2 \
  -f values.yaml
```

Add your `model_list`, ingress, database read replica, and other environment-specific values as described in [Deploy with Helm](./deploy.md#deploy-with-helm). `fullnameOverride: litellm` gives the resources the short names used in the verification commands below.

## Count large prompts without blocking requests

Budget enforcement counts prompt tokens before a request is sent to the model provider. For 50K to 100K-token prompts, this can become the largest CPU cost in the gateway request path.

Set `LITELLM_RUST=1` to use the Rust token-counting fast path. In testing, token counting for 50K, 75K, and 100K-token bodies fell from 46, 53, and 100 ms to 4.9, 6.8, and 10.2 ms. This was the largest single improvement in the profile.

The Rust path is off by default. Enable it only after confirming that the Rust extension loads in your gateway image.

## Run four workers with CPU headroom

The benchmark used four gateway workers in each pod, with a 4 vCPU request and a 16 vCPU limit. This keeps scheduling predictable while allowing the workers and Rust tokenizer threads to use short CPU bursts without throttling the entire pod.

At 700 RPS, a 4 vCPU limit caused throttling even though average CPU stayed below that limit. Raising the limit to 16 removed the throttling and reduced p99 latency from 830 ms to 670 ms. Eight workers per pod did not improve latency and used 50 percent more memory, so four workers is the tested starting point for this traffic shape.

Measure your own workload before changing the worker count. Provider latency, prompt size, streaming duration, and enabled callbacks all affect the right value.

## Share database connections across workers

Without PgBouncer, every gateway worker opens its own Prisma connection pool. Adding workers or pods can therefore multiply database connections quickly.

`database.connectionPool.enabled` starts one PgBouncer pool in each gateway pod. All workers in that pod share the same upstream connection budget. In the 1,000 RPS test, Postgres held 86 to 175 connections across 11 to 29 pods, with no waiting clients in PgBouncer.

Start with the chart default of 20 upstream connections per pod. The benchmark used 8 because that workload did not queue. Choose a value based on your database limit, gateway replica count, and observed PgBouncer wait time.

## Move background work out of request workers

Two sidecars keep operational work away from inference traffic:

- `gateway.metricsServer` serves Prometheus metrics on port 4001, so scrapes do not reach the request workers.
- `gateway.collector` handles spend calculation, spend logs, counters, and budget reconciliation after the response.

The collector improved tail latency in testing. At 700 RPS, p99 fell from 1.8 seconds to 830 ms. Total compute stayed roughly the same because the work moved to the sidecar. Treat this as request isolation, not a compute reduction.

The metrics port does not use virtual-key authentication. Keep it off public ingress. Enable `gateway.serviceMonitor` when you use the Prometheus Operator.

## Scale on requests and tokens

CPU alone can react too slowly to a sudden increase in large requests. The high-throughput profile lets the HorizontalPodAutoscaler use four signals at once:

- Requests per second per pod
- Tokens per second per pod
- Gateway CPU
- Gateway memory

The HPA follows whichever signal requires the most replicas. In testing, the request-rate metric triggered scale-out about 48 seconds after load began.

The RPS and TPS targets require a Prometheus Adapter that exposes `litellm_requests_per_second` and `litellm_tokens_per_second` through the Kubernetes custom metrics API. The exact adapter rules are documented in [Scale on requests and tokens per pod](./deploy.md#scale-on-requests-and-tokens-per-pod).

If you do not run a Prometheus Adapter, remove `targetRequestsPerSecond` and `targetTokensPerSecond`. The HPA will continue to scale on CPU and memory.

Choose RPS and TPS targets from a measured pod. The example values include headroom for the benchmark workload, but they are not universal limits.

## Keep long requests alive during scaling

Set `KEEPALIVE_TIMEOUT` above your load balancer's idle timeout. The example uses 75 seconds for an AWS Application Load Balancer with a 60-second idle timeout. This prevents the gateway from closing a connection before the load balancer expects it to close.

The rollout settings give long requests time to finish:

- `maxUnavailable: 0` keeps existing capacity during an upgrade.
- The `preStop` delay gives the load balancer time to stop sending new requests.
- `terminationGracePeriodSeconds` is longer than the configured request timeout.
- The PodDisruptionBudget limits simultaneous pod disruption.

Match these values to your longest allowed request and your load balancer's deregistration behavior.

The startup probe gives a new four-worker pod time to load before Kubernetes applies liveness checks. `allow_requests_on_db_unavailable: true` keeps a temporary slow database health check from removing an otherwise usable pod during scale-out. Decide whether this availability tradeoff matches your database failure policy.

## Verify the deployment

Each gateway pod should have the gateway, metrics, and collector containers:

```bash
kubectl -n <namespace> get pods -l app.kubernetes.io/component=gateway \
  -o custom-columns=POD:.metadata.name,CONTAINERS:.spec.containers[*].name
```

Confirm the worker, connection-pool, Rust, and keep-alive settings:

```bash
kubectl -n <namespace> exec deploy/litellm-gateway -c gateway -- \
  env | grep -E 'NUM_WORKERS|LITELLM_PGBOUNCER|LITELLM_RUST|KEEPALIVE'

kubectl -n <namespace> exec deploy/litellm-gateway -c gateway -- \
  python -c "import litellm.rust_bridge._native; print('rust ok')"
```

Confirm that Prometheus metrics and the Kubernetes custom metrics API are available:

```bash
kubectl -n <namespace> port-forward svc/litellm-gateway-metrics 4001:4001 &
curl -s localhost:4001/metrics/ | grep -c '^litellm_'

kubectl get --raw \
  /apis/custom.metrics.k8s.io/v1beta1/namespaces/<namespace>/pods/*/litellm_requests_per_second

kubectl get --raw \
  /apis/custom.metrics.k8s.io/v1beta1/namespaces/<namespace>/pods/*/litellm_tokens_per_second

kubectl -n <namespace> describe hpa litellm-gateway
```

The HPA output should list RPS, TPS, CPU, and memory. Immediately after a rollout, new pods may briefly report `FailedGetPodsMetric` until their first request creates a metrics series.

## Benchmark results

The [benchmark report](../benchmarks.md#high-throughput-profile-3000-rps-with-50k-to-100k-token-prompts) documents the test conditions, before-and-after results, client-visible failures, and one-variable-at-a-time measurements behind this profile.
