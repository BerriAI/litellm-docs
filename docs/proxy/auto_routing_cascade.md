---
title: "[Beta] Cascade Routing"
sidebar_label: "Cascade Routing (Beta)"
---

# [Beta] Cascade Routing

Call a cheap model group first, check the answer, and escalate to a strong model group only when the cheap answer falls short.

The other auto-routers pick a deployment **before** the call (complexity, quality, adaptive, semantic), and fallbacks react to **errors**. The cascade router is the only one that looks at the **answer**: when a small model is right most of the time, you pay for the strong model only on the requests where it was not.

:::info[Availability]

Cascade routing is in **beta**: config keys and defaults can change between releases. Non-streaming requests only in this version (see [Limitations](#limitations)).

:::

## When to use

| | Complexity / quality router | Fallbacks | Cascade router |
| --- | --- | --- | --- |
| Decides | before the call, from the prompt | after an **error** | after the **answer** |
| Extra calls on the happy path | 0 or 1 classifier call | 0 | 0 or 1 verifier call |
| Extra calls on escalation | 0 | 1 retry | 1 strong call (+ verifier) |
| Best for | traffic you can classify up front | reliability | a cheap tier that is usually right, with a measurable escalation rate |

A cascade pays off when the cheap tier is a small fraction of the strong tier's price **and** fast enough that an escalated request (cheap + verifier + strong) is still acceptable. Measure the escalation rate before relying on it: every escalation costs more than calling the strong model directly.

## Quick start (Proxy)

```yaml
model_list:
  - model_name: small
    litellm_params: { model: openai/gpt-4o-mini, api_key: os.environ/OPENAI_API_KEY }
  - model_name: large
    litellm_params: { model: openai/gpt-4o, api_key: os.environ/OPENAI_API_KEY }

  - model_name: support-cascade
    litellm_params:
      model: auto_router/cascade_router/support
      cascade_router_config:
        cheap_model: small
        strong_model: large
        verifier_model: small      # optional
        verifier_kind: chat        # chat | decision
        min_chars: 20
```

Call `support-cascade` like any other model. The response is the cheap answer when it passed, or the strong answer when it did not.

```bash
curl http://localhost:4000/v1/chat/completions \
  -H "Authorization: Bearer sk-1234" -H "Content-Type: application/json" \
  -d '{"model": "support-cascade", "messages": [{"role": "user", "content": "What is the capital of France?"}]}'
```

## How a request flows

1. The pre-routing hook sends the request to `cheap_model` (normal routing inside that group: load balancing, cooldowns, fallbacks).
2. The cheap answer is checked, cheapest checks first:
   - **empty** answer
   - **refusal** ("I'm sorry, I can't…"), when `escalate_on_refusal` is on
   - **short**: fewer than `min_chars` characters
   - **truncated**: `finish_reason == "length"`, when `escalate_on_truncation` is on
3. If the heuristics pass and `verifier_model` is set, the verifier is asked one question about the answer.
4. If everything passes, the cheap answer is returned. Otherwise the router calls `strong_model` (again through normal routing) and returns that answer.

The caller always sees **one** request on the cascade's model group:

- `usage` is the **sum** over every inner call (cheap, verifier, strong)
- `response_cost` is the sum too, so the spend log and budgets are right
- the response's hidden params carry a `cascade` record (path, reason, served_by, per-call cost)

## The verifier

| `verifier_kind` | How it is asked | Use it when |
| --- | --- | --- |
| `decision` (default) | one `choice` question through `litellm.adecisions`: *"Does the answer actually answer the request?"* → `yes` / `no`, with a confidence | you run a decision model (Laya, LM Studio, Azure / Databricks decisions). Cheap and fast. |
| `chat` | a one-word YES / NO prompt to a chat model group | you have no decision model. Any small chat model works. |

Only an answer that starts with **yes** passes. `verifier_min_confidence` (decision kind) escalates a low-confidence yes. If the verifier call fails, `on_verifier_error` decides: `escalate` (default) or `accept`.

Without a verifier the cascade runs on heuristics alone, which is enough to catch empty, refused and truncated answers at zero extra cost.

## Full config

```yaml
cascade_router_config:
  cheap_model: small            # model group answered first (required)
  strong_model: large           # model group on escalation (required, must differ)
  verifier_model: small         # optional model group that judges the cheap answer
  verifier_kind: decision       # decision | chat
  verifier_question: "Does the answer actually answer the user's request: correct, complete enough, on topic, and not a refusal?"
  verifier_min_confidence: 0.0  # decision kind: a yes below this escalates
  min_chars: 20                 # shorter cheap answers escalate without a verifier call
  escalate_on_refusal: true
  escalate_on_truncation: true  # finish_reason == length
  on_verifier_error: escalate   # escalate | accept
```

## Decision log

Every request routed by a cascade carries a [`routing_decision`](./auto_routing.md#decision-log) in the spend log and in callbacks (Langfuse, OTel, …):

| Field | Value |
| --- | --- |
| `router_type` | `cascade` |
| `routed_model` | `cheap_model` or `strong_model`, whichever answered |
| `tier` | `cheap` or `strong` |
| `cause` | `cascade_pass`, `cascade_heuristic_escalation`, `cascade_verifier_escalation`, `cascade_verifier_error` |
| `escalation_reason` | `empty`, `refusal`, `short`, `truncated`, `verifier_no`, `verifier_error` |
| `escalated` | `true` on the strong path |
| `savings_baseline_model` | `strong_model`, so the [savings accounting](./auto_routing.md#reported-savings) applies |
| `classifier_model`, `classifier_cost` | the verifier, when one ran |

The **escalation rate** (share of requests with `escalated: true`) is the number to watch. If it is high, the cheap tier is not cheap for this traffic.

## Limitations

- **Non-streaming only.** A streamed cheap answer has already reached the caller before it can be judged, so streaming requests are served by the cheap group without verification. Set `stream: false` for traffic you want cascaded.
- **Chat completions.** The cascade runs on `/v1/chat/completions` (and the SDK `acompletion`). Responses API and embeddings are not cascaded.
- **Latency on escalation** is cheap + verifier + strong. Keep `min_chars` and the heuristics doing most of the work; they cost nothing.
- **The verifier can be wrong.** A verifier that says yes to a wrong answer lets it through. Measure on your own traffic before trusting a cascade for user-facing text.
