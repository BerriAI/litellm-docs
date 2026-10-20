---
slug: cache-aware-routing
title: "Cache-Aware Routing for Self-Hosted Models"
date: 2026-10-20
authors:
  - yassin
image: ./cover.gif
description: "Keep agent sessions on the same Kubernetes inference pod so vLLM can reuse cached prompt prefixes, with automatic discovery and session affinity."
tags: [routing, kubernetes, vllm, ai-gateway]
hide_table_of_contents: true
---

![Claude Code and Codex requests pass through the LiteLLM gateway and return to the same vLLM pod for each session, allowing cached prompt prefixes to be reused.](./cover.gif)

LiteLLM now supports **cache-aware routing for self-hosted inference on Kubernetes**. Within a deployment, requests from the same session return to the same GPU pod so the inference server can reuse cached prompt prefixes across turns.

Agent sessions repeatedly send a shared prefix: system instructions, tool definitions, and earlier conversation turns. If those requests land on different vLLM pods, each pod may need to process that prefix again. Keeping a session on one pod lets later requests reuse the work already done there.

{/* truncate */}

## Keep a session on one GPU pod

LiteLLM discovers inference pod IPs through a Kubernetes headless service and routes directly to them. It uses the request's session ID to rank the pods with rendezvous hashing. Proxy workers that see the same pod set agree on the same destination, without storing a shared session-to-pod mapping.

Requests without a caller-supplied session ID use round robin. Retries select the next-ranked pod, and changes to the pod set can move some sessions to a new pod that needs to warm its cache.

Enable prefix caching on your inference server. LiteLLM provides session affinity; actual cache reuse depends on the matching prefix still being cached on that pod.

## Get started

Create a headless Kubernetes Service that selects your inference pods. Run LiteLLM in the same cluster, where it can resolve that service and reach the pods directly. Then enable pod discovery on the model deployment:

```yaml
model_list:
  - model_name: gpu-llama
    litellm_params:
      model: openai/your-served-model
      api_base: http://my-vllm-headless.gpu.svc.cluster.local:8000/v1
      api_key: os.environ/VLLM_API_KEY
      kubernetes_pod_discovery: true
```

Replace `your-served-model` with your server's model name and set `VLLM_API_KEY` in the proxy environment. Reuse a stable `litellm_session_id` in the request body, or send the `x-litellm-session-id` header, for every turn in a conversation. LiteLLM also recognizes session headers from Claude Code, Codex, and OpenCode, so harnesses that send these IDs can supply affinity automatically.

The [setup guide](https://docs.litellm.ai/docs/proxy/cache_aware_routing) includes the headless Service manifest, request examples, and a two-tier pattern for multiple GPU clusters: a top-level LiteLLM pins each session to a cluster, and a local LiteLLM pins it to an inference pod.

See the implementation: [session-aware Kubernetes pod routing](https://github.com/BerriAI/litellm/pull/44393).
