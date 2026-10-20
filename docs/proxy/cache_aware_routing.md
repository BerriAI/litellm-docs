---
title: Cache-Aware Routing
sidebar_label: Cache-Aware Routing
description: Keep requests from the same session on one Kubernetes inference pod so it can reuse its prompt cache, with automatic pod discovery and retry routing.
---

import CacheAwareRoutingDiagram from '@site/src/components/CacheAwareRoutingDiagram';
import CrossClusterRoutingDiagram from '@site/src/components/CacheAwareRoutingDiagram/CrossCluster';

# Cache-Aware Routing

## Overview

Route requests from the same session to the same inference pod so the server can reuse its prompt cache. This is useful for multi-turn conversations and agent workloads served by self-hosted models on Kubernetes.

LiteLLM discovers pod IPs behind a Kubernetes headless service and uses the request's session ID to select a pod. Requests without an explicit session ID, including those with proxy-generated session IDs, are distributed across the pods using round robin.

The inference server must support and enable prompt or prefix caching for cache reuse. LiteLLM provides session affinity; it does not inspect the contents of each pod's cache or guarantee a cache hit.

<CacheAwareRoutingDiagram />

Pod selection happens after LiteLLM selects a deployment. Enable it with `kubernetes_pod_discovery` in the deployment's `litellm_params`; keep your existing [routing strategy](../routing.md). There is no additional `routing_strategy` value to set. Pass-through routes do not use pod discovery.

### Session affinity and retries

LiteLLM uses rendezvous hashing to rank pods for a session. Proxy workers that see the same pod IPs select the same pod for the same session, without a shared session-to-pod mapping. When pods are added or removed, some sessions move to a different pod and need to warm its cache again.

When LiteLLM retries a request, it selects the next pod in that session's stable ranking. After all pods have been tried, the ranking wraps around. A retry does not permanently move the session to the replacement pod. Configure retries through the existing [retry settings](./reliability.md#fallbacks--retries--timeouts--cooldowns).

Affinity applies within the selected deployment. If a model group contains multiple deployments, the routing strategy still chooses between those deployments first. Cooldowns and rate limits remain associated with the configured deployment, rather than individual discovered pods.

### Discovery settings

Set these environment variables on the LiteLLM proxy to control the DNS discovery cache:

| Environment variable | Default | Behavior |
| --- | --- | --- |
| `KUBERNETES_POD_DISCOVERY_REFRESH_INTERVAL_SECONDS` | `5` | Refresh the cached pod IPs when a request arrives after this interval. |
| `KUBERNETES_POD_DISCOVERY_IDLE_EVICTION_SECONDS` | `300` | Remove a service's cached pod set after it goes unused for this duration. |

These settings control LiteLLM's pod discovery cache. The inference server controls its own prompt cache lifetime.

A transient DNS failure preserves previously discovered pod IPs. An authoritative empty DNS answer clears the pod set. If no pod IP is available, LiteLLM keeps the configured service hostname for the request.

## Get started

### 1. Expose inference pods through a headless service

Run the LiteLLM instance that performs pod discovery in the same Kubernetes cluster as its inference pods. It must be able to resolve the service hostname and connect directly to each pod's serving port.

For an existing inference deployment in the `gpu` namespace, create a headless service. Match `selector` to your pods' labels and use the port on which the inference server listens:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: my-vllm-headless
  namespace: gpu
spec:
  clusterIP: None
  selector:
    app: vllm
  ports:
    - name: http
      port: 8000
      targetPort: 8000
```

The headless service's DNS answer provides the ready pod IPs. Use the pod's serving port in `api_base`: LiteLLM replaces the hostname with a pod IP and preserves the URL's port and path.

### 2. Enable pod discovery in LiteLLM

Add the model to your proxy configuration. Replace `your-served-model` with the model name exposed by your inference server and set `VLLM_API_KEY` in the proxy environment.

```yaml
model_list:
  - model_name: gpu-llama
    litellm_params:
      model: openai/your-served-model
      api_base: http://my-vllm-headless.gpu.svc.cluster.local:8000/v1
      api_key: os.environ/VLLM_API_KEY
      kubernetes_pod_discovery: true
```

You can also enable **Kubernetes pod discovery** in **Add Model > Advanced Settings** in the Admin UI.

### 3. Send a stable session ID

Coding-agent harnesses can supply this automatically. LiteLLM recognizes session headers from Claude Code, Codex, and OpenCode. When those stable session IDs reach the proxy, you do not need to add `litellm_session_id` manually.

**Example: Set a session ID manually.** Reuse `conversation-123` for subsequent requests in this conversation.

```bash
curl http://localhost:4000/v1/chat/completions \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpu-llama",
    "litellm_session_id": "conversation-123",
    "messages": [
      {"role": "system", "content": "You are a helpful assistant."},
      {"role": "user", "content": "Help me plan a trip to Tokyo."}
    ]
  }'
```

**Recognized session ID sources.** LiteLLM reads session IDs from these request-body fields and HTTP headers.

| Recognized source | Location and behavior |
| --- | --- |
| `litellm_session_id` | Top-level request-body field. Reuse the same value throughout a conversation; takes precedence over `metadata.session_id`. |
| `metadata.session_id` | Session ID in request-body metadata. |
| `x-litellm-session-id` | Explicit LiteLLM session header. |
| `x-<vendor>-session-id` | Vendor header, such as Claude Code's `x-claude-code-session-id`. Value must contain at least 8 characters using letters, digits, hyphens, or underscores. |
| `session-id`, `thread-id` | Codex headers; require a Codex `User-Agent`. Legacy `session_id` and `conversation_id` headers are also supported. Values use the same format as vendor session headers. |
| `x-session-id`, `x-parent-session-id` | OpenCode headers; the parent session ID takes precedence for subagents. Values use the same format as vendor session headers. |
| `x-litellm-trace-id` | Used for pod affinity only when no separate recognized session header or explicit body session ID is supplied. |

## Multiple clusters

When the entry proxy and GPU pods run in separate clusters, use two tiers. Run LiteLLM **A** inside GPU cluster A and LiteLLM **B** inside GPU cluster B, each with pod discovery and session affinity for its local inference pods. Run a top-level LiteLLM **C** that routes to A and B with deployment-level session affinity.

<CrossClusterRoutingDiagram />

Register A and B as two deployments in the same model group on C, and enable `session_affinity` in C's `router_settings.optional_pre_call_checks`. C reaches A and B through their proxy endpoints; pod DNS and direct pod connections stay inside each GPU cluster.

Send a stable `x-litellm-session-id` header to C and enable `general_settings.forward_client_headers_to_llm_api: true` on C to forward it to A or B. For this pattern, omit a separate `x-litellm-trace-id`: C's deployment affinity reads `metadata.session_id`, which that trace header overrides.

With an active cluster affinity pin and an unchanged local pod set, a session returns to the same cluster and pod, allowing the inference server to reuse its prefix cache. Failover, affinity expiration, retries, or pod changes can move a session and require a new cache warm-up. If C has multiple replicas, configure [shared Redis for deployment affinity](../routing.md#session-affinity-sticky-sessions) so they share cluster pins.
