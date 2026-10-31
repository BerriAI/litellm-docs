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
   - **truncated**: `finish_reason == "length"` on the model's own limit, when `escalate_on_truncation` is on. A request that set its own `max_tokens` is never escalated for truncation: the strong model would be cut at the same point.
3. If the heuristics pass and `verifier_model` is set, the verifier is asked one question about the answer.
4. If everything passes, the cheap answer is returned. Otherwise the router calls `strong_model` (again through normal routing) and returns that answer.

Every inner call (cheap, verifier, strong) is a normal Router call on its model group, so load balancing, cooldowns, retries and fallbacks apply to each. The strong call is sent the caller's own parameters (`temperature`, `response_format`, `tools`, `n`, `reasoning_effort`, `extra_body`, …) so it answers the same request.

The caller always sees **one** request on the cascade's model group:

- `usage` and `response_cost` cover the **answers taken**: the cheap call on a pass, cheap + strong on an escalation. The request is billed **once**, on its own spend-log row, the way LiteLLM bills a fallback hop or a multi-round request: the strong call continues the request on the same logging object and is not logged as a row of its own; the row's `cost_breakdown` is the two legs' breakdowns summed, each leg as it was priced (a fixed per-request margin is charged once). This is also the auto-router convention for the verifier: it is the decision's `classifier_cost`, billed on its own internal-call row (`internal_call_origin: cascade_verifier`, carrying the caller's key, team and trace ids, like the complexity router's classifier) and not added to the request's cost, so [savings accounting](./auto_routing.md#reported-savings) and budgets stay consistent
- the request's spend-log row names the deployment that answered (`cheap_model`'s on a pass, `strong_model`'s on an escalation), with that deployment's `model_id` and `api_base`; `model_group` stays the cascade's alias and `deployment_model_name` says which group answered
- if the strong call fails after a cheap answer was paid for: with `on_strong_error: raise` the request's failure log bills the cheap leg (its usage and cost), and a fallback attempt that answers next logs its own answer and cost, the cheap leg being carried as the failed attempt's usage exactly as any failed attempt's is (billed on the request's failure log if the fallback fails too; not billed on the proxy's success row if it succeeds); with `on_strong_error: cheap` the request is served and logged as the cheap call again (the cheap deployment, its cost)
- the response's hidden params carry a `cascade` record (path, reason, served_by, per-call cost and tokens, `billed_cost`, `total_cost` including the verifier), and the proxy returns the path as headers: `x-litellm-cascade-path` (`cheap` / `strong`), `x-litellm-cascade-reason` (`pass`, `empty`, `refusal`, `short`, `truncated`, `verifier_no`, `verifier_error`, `strong_error`), `x-litellm-cascade-served-by` (the model group)
- if the strong call itself fails, `on_strong_error` decides: `raise` (default) fails the request with the strong model's error, and the cheap deployment is not blamed or cooled down for it; `cheap` serves the cheap answer that was judged inadequate, with cause `cascade_strong_error`, so an outage of the strong tier degrades the alias instead of failing it

## The verifier

`verifier_model` is a model group on the same proxy, like `cheap_model` and `strong_model`.

| `verifier_kind` | How it is asked | Use it when |
| --- | --- | --- |
| `decision` (default) | one `choice` question through the Router's `adecisions`: *"Does the answer actually answer the request?"* → `yes` / `no`, with a confidence | the group is a decision model (Laya, LM Studio, Azure / Databricks decisions). Cheap and fast. |
| `chat` | a one-word YES / NO prompt (`max_tokens: 2`, `temperature: 0`, unsupported params dropped) to a chat model group | you have no decision model. Any small chat model works. |

Only an answer that starts with **yes** passes. `verifier_min_confidence` (decision kind) escalates a low-confidence yes. If the verifier call fails or returns nothing usable, `on_verifier_error` decides: `escalate` (default) or `accept`; the failure is recorded as `classifier_failure_reason: classifier_error` with the error text in `classifier_error_type`.

The verifier reads the caller's prompt and the cheap answer, so a caller can steer it ("reply NO") and reach the strong group through the cascade alias. The cost stays on that caller's key; if that matters, put the strong group behind the same access controls as the alias.

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
  escalate_on_truncation: true  # finish_reason == length on the model's limit; a caller-set max_tokens never escalates
  on_verifier_error: escalate   # escalate | accept
  on_strong_error: raise        # raise | cheap (serve the cheap answer when the strong call fails)
```

## Decision log

Every request routed by a cascade carries a [`routing_decision`](./auto_routing.md#decision-log) in the spend log and in callbacks (Langfuse, OTel, …):

| Field | Value |
| --- | --- |
| `router_type` | `cascade` |
| `routed_model` | `cheap_model` or `strong_model`, whichever answered |
| `tier` | `cheap` or `strong` |
| `cause` | `cascade_pass`, `cascade_heuristic_escalation`, `cascade_verifier_escalation`, `cascade_verifier_error`, `cascade_strong_error`. Before the cheap answer is judged (streaming requests, failures) the decision reads `cascade_cheap_first` |
| `escalation_reason` | the check that asked for the strong model: `empty`, `refusal`, `short`, `truncated`, `verifier_no`, `verifier_error` |
| `escalated` | `true` on the strong path |
| `savings_baseline_model`, `savings_baseline_deployment_id` | `strong_model`'s most expensive deployment, as its provider model name (what the [savings accounting](./auto_routing.md#reported-savings) prices) and its deployment id |
| `classifier_model`, `classifier_cost`, `classifier_failure_reason`, `classifier_error_type` | the verifier, when one ran; the last two only when it failed |

The **escalation rate** (share of requests with `escalated: true`) is the number to watch. If it is high, the cheap tier is not cheap for this traffic.

## Limitations

- **Non-streaming only.** A streamed cheap answer has already reached the caller before it can be judged, so streaming requests are served by the cheap group without verification. Set `stream: false` for traffic you want cascaded.
- **Chat completions, async.** The cascade runs on `/v1/chat/completions` (and the SDK `acompletion`). The sync SDK `completion`, the Responses API and embeddings are not cascaded.
- **Tool calls pass unjudged.** A cheap answer that is a tool call has no text to check; it is returned as is (only a truncated tool call escalates), and the caller's agent loop decides what to do with it.
- **A caller-set `max_tokens` disables the truncation check** for that request, including a proxy key's `max_tokens` setting and a `max_tokens` on the cascade's own marker deployment.
- **One cascade per model name.** Several cascade markers under one `model_name` with different `tags` route by tag like other strategies, but the answer is judged by the first registered one.
- **Latency on escalation** is cheap + verifier + strong. Keep `min_chars` and the heuristics doing most of the work; they cost nothing.
- **The verifier can be wrong.** A verifier that says yes to a wrong answer lets it through. Measure on your own traffic before trusting a cascade for user-facing text.
- **Do not point `strong_model` (or `cheap_model`) at another cascade alias.** A cascade inside a cascade bills and logs as one request only on success; on a failure the inner cheap leg's spend is lost from the failure log.
- **Per-deployment token tracking on an escalation.** The request is one spend row naming the deployment that answered, so the rate-limit tracker that reads rows (`tpm`/`tpd` per `model_id`) attributes the summed tokens of an escalated request to the strong deployment. The Router's own usage counters, which usage-based routing and `tpm`/`rpm` limits read, count each leg against its own deployment.
