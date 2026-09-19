---
slug: auto-router-encrypted-content-routing
title: "Auto-Router: Switching Tiers Without Encrypted Content Failures"
date: 2026-09-18T10:00:00
authors:
  - tin
description: "How LiteLLM safely removes undecryptable encrypted reasoning from cross-tier follow-ups so Auto-Router can keep routing requests"
keywords: [auto router, encrypted content, Responses API, reasoning, routing, LiteLLM]
tags: [routing, complexity-router, responses-api, engineering]
hide_table_of_contents: false
---

Auto-Router can move a conversation between tiers as the request changes from simple work to a harder task. Responses API clients can make that switch difficult because a previous response may include encrypted reasoning content that only the deployment that created it can decrypt

LiteLLM now keeps the readable history and removes encrypted reasoning that the newly selected tier cannot verify. The request can continue to the selected model instead of failing with `invalid_encrypted_content`

This fix is included in the LiteLLM `v1.102.x` release line and landed in [PR #40280](https://github.com/BerriAI/litellm/pull/40280)

{/* truncate */}

## Why encrypted reasoning blocks fail after a tier change

A Responses API reasoning item can contain an `encrypted_content` field and an item ID such as `rs_...`. The provider binds that payload to the organization, API key, or encryption boundary that created it. A later request that carries the item to a different boundary can reach the provider, but the provider cannot verify it

Auto-Router makes this situation more common than a fixed model route. One turn may go to a fast model in the SIMPLE tier. The next turn may classify as COMPLEX and select a different model group. If the follow-up includes reasoning from the first turn, forwarding the encrypted payload to the second group produces the upstream error

Broad session or deployment affinity avoids the error by pinning more traffic than the conversation requires. It also prevents Auto-Router from switching tiers when the request needs a different model

## The routing decision

Enable the `encrypted_content_affinity` pre-call check alongside your Auto-Router configuration

```yaml
router_settings:
  optional_pre_call_checks:
    - encrypted_content_affinity

model_list:
  - model_name: sonnet-standard
    litellm_params:
      model: anthropic/claude-sonnet-5
      api_key: os.environ/ANTHROPIC_API_KEY

  - model_name: opus
    litellm_params:
      model: anthropic/claude-opus-5
      api_key: os.environ/ANTHROPIC_API_KEY

  - model_name: production-auto-router
    litellm_params:
      model: auto_router/complexity_router
      complexity_router_config:
        classifier_type: heuristic
        tiers:
          SIMPLE:
            - model_name: sonnet-standard
          COMPLEX:
            - model_name: opus
```

When LiteLLM sees a tracked encrypted item, it first looks for the deployment that created it. If that deployment is available, LiteLLM pins this request to it. If another healthy deployment shares the same encryption boundary, LiteLLM can use that peer

If the originating deployment belongs to a different routed group, LiteLLM removes the undecryptable encrypted reasoning and returns the healthy deployments for the selected group. Auto-Router keeps its tier decision

A same-group deployment that is temporarily unavailable follows the existing fail-fast behavior. LiteLLM does not send the encrypted item to a same-group deployment that cannot serve it and does not hide a cooldown behind a cross-tier rewrite

## What LiteLLM removes

LiteLLM mutates the request before dispatch and removes `encrypted_content` and `id` from a reasoning item when the selected deployment cannot decrypt them. It keeps a readable `summary` or `content` field so the selected model still sees the response history

If a reasoning item has no readable summary or content, LiteLLM removes that item. Other input items, including user messages and ordinary assistant messages, remain in the request

For example, a cross-tier follow-up changes from this:

```json
{
  "type": "reasoning",
  "id": "rs_previous_deployment_item",
  "encrypted_content": "opaque-provider-payload",
  "summary": [
    {"type": "summary_text", "text": "The request needs a larger model"}
  ]
}
```

to this before dispatch:

```json
{
  "type": "reasoning",
  "summary": [
    {"type": "summary_text", "text": "The request needs a larger model"}
  ]
}
```

LiteLLM applies the same boundary check to bridged Anthropic thinking blocks. When the bridge identifies encrypted reasoning from another route, it drops that thinking block instead of forwarding a foreign or unsigned signature that the provider would reject

## Why this keeps Auto-Router useful

The check pins only requests that need the original encryption boundary. Ordinary requests continue through the configured routing strategy, and a cross-tier follow-up can reach the tier selected for the current request

This gives Auto-Router two safe paths. It preserves encrypted reasoning when the selected deployment can verify it. For cross-tier Responses requests, it preserves the readable summary and removes the provider-bound payload. For bridged Anthropic thinking, it drops the foreign encrypted block before dispatch

The behavior lives in the encrypted-content pre-call check and the Responses request utilities. The relevant implementation and regression coverage are available in [the affinity check](https://github.com/BerriAI/litellm/blob/main/litellm/router_utils/pre_call_checks/encrypted_content_affinity_check.py), [the Responses request utility](https://github.com/BerriAI/litellm/blob/main/litellm/responses/utils.py), and [the routing tests](https://github.com/BerriAI/litellm/blob/main/tests/test_litellm/router_utils/pre_call_checks/test_encrypted_content_affinity_check.py)

For the complete setup and deployment-affinity behavior, see the [Responses API encrypted content affinity guide](https://docs.litellm.ai/docs/response_api#encrypted-content-affinity-multi-region-load-balancing)
