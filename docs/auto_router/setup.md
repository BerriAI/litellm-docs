---
title: Setup
sidebar_label: Setup
description: Every way to stand up an Auto Router, from a one-click preset in the dashboard to a hand-written config.yaml, and how to point Claude Code at it.
---

import NavigationCards from '@site/src/components/NavigationCards';

Four ways in. All of them create the same `auto_router/complexity_router` deployment.

<NavigationCards
columns={4}
items={[
  { title: "Dashboard presets", description: "Pick a template, Test Routing, save.", to: "#dashboard-presets" },
  { title: "Agent skill", description: "One line to your coding agent.", to: "#agent-skill" },
  { title: "config.yaml", description: "One router entry in model_list.", to: "#configyaml" },
  { title: "Autorouter CLI", description: "Try it locally without touching the proxy.", to: "#autorouter-cli" },
]}
/>

## Dashboard presets

![Auto Router templates in the Add Model form](../../blog/autorouter_setup_and_testing/presets.png)

- Models + Endpoints, Add Model, Auto Router tab.
- Templates: Anthropic Family, OpenAI Family, Gemini Family, Lite. Each fills all four tiers from models your proxy already serves.
- A template whose models are not deployed is greyed out with the missing names listed.
- **Test Routing** sends one prompt through the classifier and shows the model it would pick. Nothing is created and the picked model is not called.
- **Test Connection** runs a minimal request per tier model group. Green means reachable with your credentials.
- Detailed Configuration holds the rest: keyword rules, LLM classifier and prompt, escalation keywords, adaptive pools.

The templates as config.yaml: [Recommended Configurations](/docs/auto_router/recommended_configurations). Release post: [AutoRouter: 1 Click Deploy](/blog/auto-router-setup-and-testing).

## Agent skill

```
run curl -fsSL https://docs.litellm.ai/skills/auto-router and follow the instructions
```

- Reads the models your proxy already serves.
- Asks for the router name and a model per tier.
- States the defaults it is assuming before it writes anything.

## config.yaml

```yaml title="config.yaml"
model_list:
  - model_name: gpt-4o-mini
    litellm_params: {model: openai/gpt-4o-mini, api_key: os.environ/OPENAI_API_KEY}
  - model_name: gpt-4o
    litellm_params: {model: openai/gpt-4o, api_key: os.environ/OPENAI_API_KEY}
  - model_name: claude-sonnet-5
    litellm_params: {model: anthropic/claude-sonnet-5, api_key: os.environ/ANTHROPIC_API_KEY}
  - model_name: gpt-5.5
    litellm_params: {model: openai/gpt-5.5, api_key: os.environ/OPENAI_API_KEY}

  - model_name: smart-router
    litellm_params:
      model: auto_router/complexity_router
      complexity_router_config:
        tiers:
          SIMPLE:    gpt-4o-mini
          MEDIUM:    gpt-4o
          COMPLEX:   claude-sonnet-5
          REASONING: gpt-5.5
      complexity_router_default_model: gpt-4o
```

- Tiers name other `model_name` entries in the same file, so every tier is a deployment the proxy already knows.
- `complexity_router_default_model` serves whenever the router cannot decide.
- No `classifier_type` means the heuristic scorer: free, no added latency.
- `classifier_type: llm` with a small model raises accuracy on agent traffic for a fraction of a cent per request. See [benchmarks](/docs/auto_router/benchmarks).
- Everything else (keyword rules, tier pools, session affinity, scorer tuning): [configuration reference](/docs/proxy/auto_routing).

## Autorouter CLI

- Stands up a throwaway local proxy that forwards every request to your real proxy.
- Routes Claude Code traffic through it for the session. Nothing bypasses the real proxy and its config is untouched.
- Guide: [Autorouter CLI](/docs/learn/autorouter_cli).

## Claude Code and Claude Desktop

- Claude Code populates its model picker from `/v1/models` and keeps only names containing `claude` or `anthropic`. Name the router accordingly, or set `ANTHROPIC_MODEL` directly.
- On Claude for Teams or Enterprise, the exact router name must be on the organization allowlist. The check runs client-side, so a rejected router leaves nothing in gateway logs.
- Tutorial: [Auto Router with Claude Code and Claude Desktop](/docs/tutorials/claude_code_autorouter).
