---
title: L7 proxy with LiteLLM
sidebar_label: L7 proxy with LiteLLM
description: Buffer short traffic bursts and route requests to healthy LiteLLM replicas with an L7 proxy. This example uses HAProxy on Kubernetes.
toc_max_heading_level: 2
---

import HAProxyKubernetesArchitecture from '@site/src/components/HAProxyKubernetesArchitecture';

# L7 proxy with LiteLLM

{/* keep-version-note */}

An L7 proxy buffers short traffic bursts, limits concurrent requests, and routes traffic to healthy LiteLLM replicas. This example uses **HAProxy on Kubernetes**, with LiteLLM admission control and KEDA autoscaling. **HAProxy and KEDA are optional**; reuse existing ingress and autoscaling components when they provide the controls below.

<HAProxyKubernetesArchitecture />

## Capacity planning

Keep warm replicas across nodes and zones, with headroom for a failed pod and rollout surge. Size memory for concurrent requests, queued payloads, and streams; budget database connections for maximum replicas, workers, and migrations. See [Sizing & Scaling](../sizing.md), [connection limits](../../prod.md#bound-database-connections), and [GKE with Helm](../cloud/gcp.md#gke-with-helm).

## Load balancing

LiteLLM's admission queue protects each worker, but queued requests stay with that worker. HAProxy adds per-pod connection limits and short queues **before requests reach LiteLLM**, reducing pressure on workers during bursts. Reuse your existing ingress if it already provides equivalent limits and buffering.

Each HAProxy replica owns its queues. Requests in its **unassigned backend queue** can use any ready pod, including newly added pods; requests in a per-server queue are already assigned to that pod.

This example assumes HTTP/1.1 clients and one worker per pod. Terminate TLS at ingress and replace the addresses with pod IPs maintained through service discovery. Route directly to pods: a Kubernetes Service VIP hides individual pod capacity. Tune the limits to your workload.

```text title="haproxy.cfg"
defaults
    mode http
    timeout connect 3s
    timeout check 3s
    timeout client 180s
    timeout server 180s
    timeout queue 2s

frontend gateway
    bind :8080
    maxconn 1024
    default_backend gateways

backend gateways
    balance leastconn
    option http-server-close
    option httpchk GET /health/readiness
    http-check expect status 200
    server pod1 10.0.0.11:4000 check maxconn 64 maxqueue 8
    server pod2 10.0.0.12:4000 check maxconn 64 maxqueue 8
```

Per-server `maxconn` caps active upstream requests; `maxqueue` limits assigned waiting requests. Frontend `maxconn` bounds accepted client connections, and queue expiry returns `503`. Client/server timeouts measure **inactivity**, not total duration. Limits apply per HAProxy replica; account for the OS listener backlog too.

## Admission control

Enable [per-worker admission control](../../server_tuning.md#per-worker-admission-control) with a small queue:

```yaml
general_settings:
  max_in_flight_requests_per_worker: 64
  max_queued_requests_per_worker: 8
  admission_queue_timeout_seconds: 1.0
```

A full queue or queue timeout returns `503` with `retry-after: 1`. Clients should honor the header and use bounded retries with jitter and a total deadline. Coordinate [router retries](../../../routing.md); avoid replaying partial streams or requests with uncertain side effects.

Apply [key and team rate limits](../../users.md) with [shared Redis](../../redis_requirements.md) for tenant quotas. These controls do not move queued requests between workers or replace admission limits.

## Autoscaling

**KEDA is not required for request-based autoscaling.** It connects Prometheus queries to Kubernetes HPA and manages the HPA for you. [HPA with Prometheus Adapter](../autoscaling.md#scale-on-requests-and-tokens-per-pod) also supports request-based scaling; keep that setup if you already use it.

Scale on `litellm_admission_admitted_requests` and `litellm_admission_queued_requests` alongside RPS. Neither gauge includes HAProxy queues, and completed-request counters lag long streams. Monitor queue depth, rejections, CPU, and memory too.

For this KEDA example, install KEDA and the Prometheus Operator, then merge these Helm values, preserving existing callbacks. It targets 48 outstanding requests per pod; tune this against your worker limits.

```yaml
gateway:
  config:
    proxy_config:
      litellm_settings:
        callbacks: [prometheus]
  metricsServer:
    enabled: true
  serviceMonitor:
    enabled: true
  hpa:
    enabled: false
  keda:
    enabled: true
    minReplicaCount: 4
    maxReplicaCount: 20
    pollingInterval: 15
    prometheus:
      serverAddress: http://prometheus-operated.monitoring.svc:9090
      targetRequestsPerSecond: "50"
    triggers:
      - type: prometheus
        metricType: AverageValue
        metadata:
          serverAddress: http://prometheus-operated.monitoring.svc:9090
          query: 'sum(litellm_admission_admitted_requests{namespace="litellm",job="litellm-gateway-metrics"}) + sum(litellm_admission_queued_requests{namespace="litellm",job="litellm-gateway-metrics"})'
          threshold: "48"
          ignoreNullValues: "false"
```

Set your namespace, metrics Service job label, address, and thresholds, and confirm both gauges exist. `ignoreNullValues: "false"` treats missing results as an error; configure [KEDA fallback](../autoscaling.md#keda-alternative) for metrics failures.

Keep warm capacity: short queues absorb bursts but do not guarantee requests can wait for new pods to start. Metrics sidecars can serve frozen counters when a worker is blocked, so monitor external health probes and request latency as well as scrape failures.
