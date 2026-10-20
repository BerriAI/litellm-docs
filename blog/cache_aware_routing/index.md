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

## Get started

[Read the cache-aware routing setup guide](https://docs.litellm.ai/docs/proxy/cache_aware_routing).
