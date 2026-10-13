# Scale for 100T+ tokens per month

Benchmark throughput: **13.5 billion tokens per minute (TPM)**. [View results](../benchmarks.md#high-throughput-profile-3000-rps-with-50k-to-100k-token-prompts).

## Requirements

- [LiteLLM microservices Helm chart](./deploy.md#deploy-with-helm) `1.104.2` or later.
- External PostgreSQL and Redis.
- Kubernetes 1.30+ and Metrics Server for CPU and memory autoscaling.
- Prometheus Operator to scrape each pod through a ServiceMonitor.
- Prometheus Adapter with the [RPS and TPS rules](./deploy.md#scale-on-requests-and-tokens-per-pod) for request and token autoscaling.

## Configure the gateway

### 1. Configure HPA

**Use RPS and TPS targets to scale with traffic, alongside CPU and memory targets for resource use.** The HPA uses the metric that asks for the most replicas. This example targets 83 requests and 6.25 million tokens per second per pod.

```yaml
gateway:
  hpa:
    enabled: true # Default: true
    minReplicas: 2 # Default: 1
    maxReplicas: 200 # Default: 10
    targetRequestsPerSecond: "83" # Default: ""
    targetTokensPerSecond: "6.25M" # Default: ""
    targetCPUUtilizationPercentage: 60 # Default: 70
    targetMemoryUtilizationPercentage: 80 # Default: 80
    behavior: # Default: {}
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
```

Configure the [Prometheus Adapter rules](./deploy.md#scale-on-requests-and-tokens-per-pod) to expose these metrics to Kubernetes. Token metrics update when responses finish, so use both request and token targets for streaming traffic.

### 2. Set workers and resources

Run four workers per pod. Request 4 vCPUs and 16 GiB of memory, with a 16-vCPU limit for bursts.

```yaml
gateway:
  numWorkers: 4 # Default: 1
  logLevel: ERROR # Default: INFO
  resources:
    requests:
      cpu: "4" # Default: "1"
      memory: 16Gi # Default: 4Gi
    limits:
      cpu: "16" # Default: "2"
      memory: 16Gi # Default: 4Gi
```

### 3. Share database connections

Enable PgBouncer to share eight PostgreSQL connections across the workers and collector in each pod. Size this pool against your database connection limit and maximum replica count.

```yaml
database:
  connectionPool:
    enabled: true # Default: false
    maxDbConnections: 8 # Default: 20
    maxClientConn: 1000 # Default: 1000
```

### 4. Run metrics and spend processing in sidecars

Enable the metrics server and spend collector. Add `prometheus` to your callbacks, and use Redis to buffer spend updates for batch writes.

```yaml
gateway:
  metricsServer:
    enabled: true # Default: false
  serviceMonitor:
    enabled: true # Default: false
  collector:
    enabled: true # Default: false
  config:
    proxy_config: # Default: {}
      general_settings:
        proxy_batch_write_at: 60
        use_redis_transaction_buffer: true
      litellm_settings:
        callbacks:
          - prometheus
        json_logs: true
```

Set `gateway.serviceMonitor.labels` to match your Prometheus instance's ServiceMonitor selector.

### 5. Set connection and shutdown timeouts

Add `KEEPALIVE_TIMEOUT` to `gateway.extraEnv` with a value above your load balancer's idle timeout. These settings allow 600 seconds per request and 620 seconds for shutdown, including a 10-second connection-draining delay.

```yaml
gateway:
  extraEnv: # Default: []
    - name: KEEPALIVE_TIMEOUT
      value: "75"
  config:
    proxy_config: # Default: {}
      litellm_settings:
        request_timeout: 600
  terminationGracePeriodSeconds: 620 # Default: "" (Kubernetes uses 30s)
  lifecycle: # Default: {}
    preStop:
      exec:
        command: ["sh", "-c", "sleep 10"]
  strategy: # Default: {}
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 0
      maxSurge: 25%
  startupProbe: # Default: {}
    httpGet: { path: /health/readiness, port: http }
    failureThreshold: 30
    periodSeconds: 10
  pdb:
    enabled: true # Default: false
    maxUnavailable: 10% # Default: ""
```
