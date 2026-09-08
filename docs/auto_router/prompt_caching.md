---
title: Prompt Caching
sidebar_label: Prompt Caching
description: Switching models between turns does not throw away your prompt cache. What was measured, why the cache survives, and the settings that keep it warm on agent workloads.
---

import NavigationCards from '@site/src/components/NavigationCards';

**The objection:** a router that switches models mid-conversation must be throwing away the prompt cache.

**The measurement:** it does not. Router plus caching beat caching alone on one fixed model on every dataset.

| Evaluation | Sample | Router + caching vs caching alone |
| --- | --- | --- |
| WildChat-1M simulation, general chat | 30,769 multi-turn conversations | **68.7% cheaper** |
| DevGPT simulation, developer chat | 1,011 conversations | **46% cheaper** |
| Real agent traces, provider cache accounting | 95 sessions, 8,174 API calls | **37.4% cheaper** |
| TwinRouterBench static track | 81 multi-step instances | **44 to 50% cheaper** |

- **A switch is not an eviction.** When a session returns to a model it used earlier, the cache is still there.
- **4,684 real switch-backs** on live gateway traffic: **97.4%** found the cache warm at a 5-minute TTL, **99.3%** at a 1-hour TTL.
- **The expensive mistake is the opposite one.** A router with caching switched off costs about **4x** caching one fixed model.
- **Savings accounting is honest about it.** The all-frontier baseline is priced with a warm cache on continuing turns, and a fresh cache write after a switch counts against the saving. See [Reported savings](/docs/proxy/auto_routing#reported-savings).

<NavigationCards
columns={2}
items={[
  {
    title: "Prompt Caching Works with Auto Router",
    description: "The five datasets, per-dataset cost with and without caching, the switch-back measurement, and the config.",
    to: "/blog/auto-router-prompt-caching-benchmark",
  },
  {
    title: "Session affinity and deployment affinity",
    description: "The two pins that hold a conversation on one model and one deployment when you want them.",
    to: "/docs/proxy/auto_routing#session-affinity",
  },
]}
/>

## When to pin anyway

- `session_affinity` is **off by default**, and that is the right setting for most routers. The numbers above show it is not needed for the cache, and pinning forfeits the savings from routing later turns down a tier.
- **Turn it on when a tier switch would change behavior the client depends on.** Two kinds of case:
  - **Provider state in the history.** History produced by one model can fail on another: an Anthropic `thinking` block or `cache_control` marker replayed to a non-Anthropic tier, or tool-call formats that differ between providers. Pinning keeps the session on the model that produced the history.
  - **Consistency the user can see.** Each model has its own style. A design workflow that generates layouts, shapes, or components over many turns keeps one look only if every turn comes from the same model; a writing assistant that should keep one voice is the same case.
- **Single-family ladders rarely need it.** When every tier is the same provider (all Claude, all GPT), history replays cleanly and the cache measurements above apply. Leave it off and let follow-ups route down.
- A tier with several deployments behind it also needs `deployment_affinity` and the `prompt_caching` pre-call check in `router_settings`, so continuing turns return to the deployment holding the cache.
- Both together: [Coding agents with load balancing](/docs/auto_router/recommended_configurations#coding-agents-with-load-balancing).

## Caching across load-balanced deployments

Separate from the router: the `prompt_caching` pre-call check keeps Anthropic caching working when the same model is load balanced across deployments or AWS accounts.

<NavigationCards
columns={2}
items={[
  {
    title: "Claude Code: prompt cache routing",
    description: "Enable the prompt_caching pre-call check across duplicate deployments and confirm cache reads in the request logs.",
    to: "/docs/tutorials/claude_code_prompt_cache_routing",
  },
]}
/>
