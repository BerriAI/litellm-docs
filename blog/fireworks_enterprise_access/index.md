---
slug: fireworks-enterprise-access
title: "LiteLLM × Fireworks AI: Making Model Access Easier for Enterprise Teams"
date: 2026-09-21T11:00:00
authors:
  - misbah
description: "How to reach every Fireworks deployment shape through one gateway config, use the native Responses API, and get correct billing and warm caches on the way."
keywords: [fireworks ai, ai gateway, enterprise llm, responses api, open models, litellm integration, model access]
tags: [partnership, providers, fireworks, enterprise]
hide_table_of_contents: false
---

Enterprise AI teams converge on the same two decisions. Put one gateway in front of every model so access, spend, and policy live in one place. Then run open models wherever they are served fastest and cheapest.

For a growing number of teams that second half is Fireworks AI, which puts LiteLLM and Fireworks in the same request path for the same customers. A gateway that is approximately right about a provider is worse than no gateway: the failure surfaces as a wrong bill, a cold cache, or a tool call that 400s in production. Most of the work between our teams has gone into making the indirection invisible.

{/* truncate */}

## Set up the connection

One key, one config block, and your existing OpenAI-compatible code keeps working.

```yaml title="config.yaml"
model_list:
  # Serverless
  - model_name: deepseek-flash
    litellm_params:
      model: fireworks_ai/deepseek-v4p1-flash
      api_key: os.environ/FIREWORKS_AI_API_KEY

  # A model in your own Fireworks account
  - model_name: house-model
    litellm_params:
      model: fireworks_ai/accounts/fireworks/models/YOUR_MODEL_ID
      api_key: os.environ/FIREWORKS_AI_API_KEY

  # A Fireworks router
  - model_name: glm-latest
    litellm_params:
      model: fireworks_ai/routers/glm-latest
      api_key: os.environ/FIREWORKS_AI_API_KEY

  # A direct-route deployment
  - model_name: dedicated-coder
    litellm_params:
      model: fireworks_ai/accounts/fireworks/models/deepseek-v4p1-flash#accounts/YOUR_ORG/deployments/YOUR_DEPLOYMENT
      api_base: https://YOUR_ORG-YOUR_DEPLOYMENT.direct.fireworks.ai/v1
      api_key: os.environ/FIREWORKS_AI_API_KEY
```

Four deployment shapes, one configuration surface. Serverless models work from the bare slug. Account-hosted models resolve through their full `accounts/` path. Direct-route deployments take the deployment suffix and an `api_base`. Routers live on a different path than models, so the `routers/` prefix targets them, and slugs ending in `-fast` are recognized as routers without it.

Because all four resolve the same way, moving between them is a config change. An application calling a serverless model today can point at a dedicated deployment tomorrow without touching application code, a security review, or a procurement cycle.

## Use the native Responses API

Send `fireworks_ai/` models to `/v1/responses` and the request goes to Fireworks' own `https://api.fireworks.ai/inference/v1/responses` endpoint rather than being reassembled from chat completions. Server-side MCP tools, `previous_response_id` chaining, and reasoning output items behave exactly as they do calling Fireworks directly ([PR #39826](https://github.com/BerriAI/litellm/pull/39826)).

Once a provider ships server-side agent features, a gateway that only speaks chat completions quietly removes them, and the team ends up unable to use the platform they chose.

## What we fixed along the way

Most of the joint work has been correctness, and it is invisible when it is right.

Prompt caching was going cold between turns because the Fireworks session affinity header was sent from a per-request trace id. It now comes from a caller-supplied session id ([PR #35754](https://github.com/BerriAI/litellm/pull/35754)). Traffic inside the off-peak discount window was billing at the standard rate; the cost calculator honors the window ([PR #39592](https://github.com/BerriAI/litellm/pull/39592)). Streams served by a Fireworks router logged zero cost, and now bill as the model that actually served them ([PR #38656](https://github.com/BerriAI/litellm/pull/38656)).

Two more worth knowing if you hit them. Short model slugs now resolve `tool_choice` and reasoning support against the real cost-map key, which is what stopped opencode tool calls returning 400 ([PR #39763](https://github.com/BerriAI/litellm/pull/39763)). Parameters written for NIM or vLLM translate to their Fireworks-native equivalents, so a migration does not mean rewriting request bodies ([PR #35969](https://github.com/BerriAI/litellm/pull/35969)).

We re-sync the model registry and pricing map against the live Fireworks catalog on an ongoing basis. A gateway that reports the wrong cost is one finance teams stop trusting.

## Beyond chat completions

Document inlining lets non-vision models parse documents and images. LiteLLM adds the inline transform automatically when the target model has no vision support, so you do not have to branch on model capability in your own code. Embeddings, reranking, and audio transcription route through the same keys and the same spend tracking as chat traffic.

## Next steps

The [Fireworks AI provider docs](/docs/providers/fireworks_ai) cover all four deployment shapes, the Responses API, document inlining, rerank, and transcription.

If you are still deciding which work belongs on an open model, our [subtask routing benchmark](/blog/subtask-type-routing) measured DeepSeek V4 Flash on Fireworks handling 73% of a coding agent's turns for fourteen cents.
