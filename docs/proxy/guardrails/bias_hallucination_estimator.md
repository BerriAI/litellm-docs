import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# LiteLLM Bias & Hallucination Estimator

LiteLLM includes a native bias and hallucination risk estimator that runs inside the proxy process. It does not call an external guardrail provider, does not require an API key, and uses local regex and keyword matching to score text for bias and hallucination risk.

Use it as a low-cost first pass for auditing or blocking model outputs that contain overconfident, subjective, unsourced, or suspiciously specific claims.

## Overview

| Property | Details |
|----------|---------|
| Guardrail name | `bias_hallucination_estimator` |
| UI name | `LiteLLM Bias & Hallucination Estimator` |
| Provider logged by LiteLLM | `litellm_native` |
| External calls | None |
| Supported modes | `post_call`, `pre_call`, or `[pre_call, post_call]` |
| Default evaluated text | Model response only |
| Default action | Block high-risk text with an HTTP 400 guardrail error |

## Quick Start

### 1. Define the guardrail in `config.yaml`

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: gpt-4o-mini
    litellm_params:
      model: openai/gpt-4o-mini
      api_key: os.environ/OPENAI_API_KEY

guardrails:
  - guardrail_name: "bias-hallucination-check"
    litellm_params:
      guardrail: bias_hallucination_estimator
      mode: "post_call"
```

This checks model responses after the LLM call. By default, the guardrail:

- checks responses with `check_response: true`
- does not check user input with `check_request: false`
- blocks when the overall risk is at least `0.5`, or when either detector crosses its own threshold
- uses a `0.4` bias weight and `0.6` hallucination weight for the combined risk score

### 2. Start LiteLLM Gateway

```shell
litellm --config config.yaml --detailed_debug
```

### 3. Send a request with the guardrail

<Tabs>
<TabItem label="Blocked response" value="blocked">

```shell showLineNumbers
curl -i http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-1234" \
  -d '{
    "model": "gpt-4o-mini",
    "messages": [
      {
        "role": "user",
        "content": "Write a confident product claim using a statistic but no source."
      }
    ],
    "guardrails": ["bias-hallucination-check"]
  }'
```

If the response contains high-risk phrasing, LiteLLM raises a guardrail error. The default block message is:

```text
High bias/hallucination risk detected (68%).
```

</TabItem>
<TabItem label="Allowed response" value="allowed">

```shell showLineNumbers
curl -i http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-1234" \
  -d '{
    "model": "gpt-4o-mini",
    "messages": [
      {"role": "user", "content": "Explain how to configure a timeout setting."}
    ],
    "guardrails": ["bias-hallucination-check"]
  }'
```

Low-risk text passes through unchanged.

</TabItem>
</Tabs>

## Supported Modes

This guardrail supports `pre_call` and `post_call`.

| Mode | What LiteLLM sends to the estimator | Required check flag |
|------|-------------------------------------|---------------------|
| `post_call` | Model output text and model tool calls | `check_response: true` |
| `pre_call` | User input text and request tool calls | `check_request: true` |
| `[pre_call, post_call]` | Both request and response text | `check_request: true` and `check_response: true` |

`post_call` is the default mode used by the guardrail class. `during_call` is not supported by this guardrail.

:::info
`mode` decides when the hook runs. `check_request` and `check_response` decide whether the estimator should actually evaluate that input type. For example, a `pre_call` guardrail with the default `check_request: false` will run but skip request evaluation.
:::

## Check Requests and Responses

### Response-only check

Use this for the common case where you want to evaluate model output.

```yaml showLineNumbers title="config.yaml"
guardrails:
  - guardrail_name: "bias-hallucination-output"
    litellm_params:
      guardrail: bias_hallucination_estimator
      mode: "post_call"
      check_response: true
```

### Request and response check

Use this when you want to evaluate both user input and model output.

```yaml showLineNumbers title="config.yaml"
guardrails:
  - guardrail_name: "bias-hallucination-all"
    litellm_params:
      guardrail: bias_hallucination_estimator
      mode: ["pre_call", "post_call"]
      check_request: true
      check_response: true
```

### Always-on check

Set `default_on: true` if every request should use the guardrail without the client passing `"guardrails": ["..."]`.

```yaml showLineNumbers title="config.yaml"
guardrails:
  - guardrail_name: "bias-hallucination-check"
    litellm_params:
      guardrail: bias_hallucination_estimator
      mode: "post_call"
      default_on: true
```

## Configuration

All fields below are configured under `litellm_params`.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `guardrail` | string | Required | Use `bias_hallucination_estimator`. |
| `mode` | string or array | `post_call` | Supported values are `pre_call`, `post_call`, or both as a list. |
| `default_on` | boolean | `false` | Run this guardrail on every request without requiring the request `guardrails` parameter. |
| `check_request` | boolean | `false` | Evaluate request/input text when the hook runs in `pre_call`. |
| `check_response` | boolean | `true` | Evaluate response/output text when the hook runs in `post_call`. |
| `bias_weight` | float | `0.4` | Weight for the bias score in the combined risk score. Must be `>= 0`. |
| `hallucination_weight` | float | `0.6` | Weight for the hallucination score in the combined risk score. Must be `>= 0`. |
| `bias_threshold` | float | `0.5` | Block when the bias score is greater than or equal to this value. |
| `hallucination_threshold` | float | `0.5` | Block when the hallucination score is greater than or equal to this value. |
| `risk_flag_threshold` | float | `0.25` | Return a `flag` recommendation when combined risk is greater than or equal to this value. |
| `risk_block_threshold` | float | `0.5` | Return a `block` recommendation when combined risk is greater than or equal to this value. |
| `block_on_high_risk` | boolean | `true` | When `false`, high-risk text is flagged and allowed through instead of blocked. |
| `log_only` | boolean | `false` | Log the analysis but never block. High-risk text is flagged and allowed through. |
| `violation_message` | string | `null` | Static message returned when the guardrail blocks. |
| `violation_message_template` | string | `null` | Templated block message. Supports `{default_message}`, `{risk_score}`, and `{detected_issues}`. |

Example with tuned thresholds:

```yaml showLineNumbers title="config.yaml"
guardrails:
  - guardrail_name: "bias-hallucination-strict"
    litellm_params:
      guardrail: bias_hallucination_estimator
      mode: "post_call"
      bias_threshold: 0.4
      hallucination_threshold: 0.45
      risk_flag_threshold: 0.2
      risk_block_threshold: 0.45
      bias_weight: 0.35
      hallucination_weight: 0.65
      violation_message_template: "Response blocked. Risk={risk_score}%. Issues={detected_issues}"
```

## Scoring and Blocking

For each text input, LiteLLM computes:

- `bias_score`: 0.0 to 1.0
- `hallucination_score`: 0.0 to 1.0
- `overall_risk_percentage`: weighted average of the two scores, rounded to 0-100
- `recommendation`: `pass`, `flag`, or `block`

The combined risk uses this formula:

```text
(bias_score * bias_weight + hallucination_score * hallucination_weight)
/ (bias_weight + hallucination_weight)
```

If both weights are `0`, the combined score is `0` and the recommendation is `pass`.

The recommendation is `block` when any condition is true:

- combined risk is greater than or equal to `risk_block_threshold`
- `bias_score` is greater than or equal to `bias_threshold`
- `hallucination_score` is greater than or equal to `hallucination_threshold`

The recommendation is `flag` when the combined risk is greater than or equal to `risk_flag_threshold` but no block condition is met.

If a request contains multiple text inputs or tool calls, LiteLLM analyzes each one and uses the highest-risk analysis for the block decision. The logging payload includes every analysis.

## What It Detects

### Bias patterns

| Pattern | Examples of matched language |
|---------|------------------------------|
| `dogmatic_language` | `always`, `never`, `obviously`, `clearly`, `everyone knows`, `the fact is` |
| `opinion_as_fact` | `I believe`, `I think`, `in my opinion`, `should be`, `must be`, `has to be` |
| `overconfidence` | `100%`, `guaranteed`, `certainly`, `definitely`, `there is no doubt` |
| `sweeping_generalization` | Constructions like `all developers are`, `no system can`, `every user will` |

### Hallucination risk patterns

| Pattern | Examples of matched language |
|---------|------------------------------|
| `unsourced_statistics` | Bare percentages, ratios like `3 out of 4`, and comma-formatted large numbers without a source signal in the same sentence |
| `missing_citations` | `research shows`, `studies found`, `scientists found`, `experts say`, `it has been proven`, `data proves` |
| `fabricated_specificity` | `exactly 1,234`, numbers with 3 or more decimal places, and specific date claims like `on March 14, 2022` |

The unsourced-statistics check is skipped for a sentence when it includes a source signal such as `according to`, `source:`, `doi:`, `https://`, `published in`, `journal`, `report`, `survey by`, `study by`, `dataset`, `citation`, or `reference`.

## Logging and Observability

When the guardrail evaluates text, it writes a standard LiteLLM guardrail logging entry under `standard_logging_guardrail_information`. Logging integrations such as Langfuse, OpenTelemetry, and spend logs can consume this metadata.

The entry includes:

- `guardrail_name`
- `guardrail_provider`: `litellm_native`
- `guardrail_mode`
- `guardrail_status`: `success` or `guardrail_intervened`
- `guardrail_response`
- tracing fields such as `risk_score`, `detection_method`, `violation_categories`, and `guardrail_action`

Example `guardrail_response`:

```json showLineNumbers
{
  "decision": "blocked",
  "input_type": "response",
  "risk_scores": [
    {
      "overall_risk_percentage": 68,
      "bias_score": 0.4,
      "hallucination_score": 0.82,
      "uncertainty_score": 0.0,
      "detected_issues": [
        "hallucination:missing_citations",
        "hallucination:unsourced_statistics"
      ],
      "recommendation": "block"
    }
  ],
  "bias": [
    {
      "bias_detected": false,
      "score": 0.4,
      "patterns_found": [],
      "reasoning": "No bias indicators found."
    }
  ],
  "hallucination": [
    {
      "hallucination_detected": true,
      "score": 0.82,
      "patterns_found": ["missing_citations", "unsourced_statistics"],
      "reasoning": "Detected hallucination risk indicators: missing_citations, unsourced_statistics."
    }
  ]
}
```

The proxy logging payload intentionally excludes text snippets. Fields that can contain excerpts, such as `examples`, `unsourced_claims`, `missing_citations`, and `fabricated_specificity`, are removed before the payload is sent to logging sinks.

## Audit Without Blocking

Use `log_only: true` to collect scores before enforcing a policy.

```yaml showLineNumbers title="config.yaml"
guardrails:
  - guardrail_name: "bias-hallucination-audit"
    litellm_params:
      guardrail: bias_hallucination_estimator
      mode: "post_call"
      log_only: true
```

`block_on_high_risk: false` also prevents blocking, but it still lets you distinguish high-risk text as `flagged` in the guardrail response. `log_only: true` is the safest first rollout mode because it makes the guardrail audit-only.

## Programmatic Use

You can also call the estimator directly from Python:

```python showLineNumbers
from litellm.proxy.guardrails.guardrail_hooks.bias_hallucination_estimator import (
    BiasHallucinationEstimatorGuardrail,
)

guardrail = BiasHallucinationEstimatorGuardrail(
    bias_threshold=0.4,
    hallucination_threshold=0.6,
)

result = guardrail.estimate_bias_hallucination(
    "Research shows 73% of users prefer this product. It will definitely work for everyone."
)

print(result["risk"])
```

`estimate_bias_hallucination()` returns the full detector output, including snippet fields. Those snippet fields are only returned through direct programmatic use and are not included in the proxy logging payload.

## Tuning Guidance

For technical documentation, precise numbers and confident phrasing can create false positives. Raise `bias_threshold`, `hallucination_threshold`, or `risk_block_threshold` toward `0.7` if the guardrail is too strict.

If you only care about hallucination risk, set `bias_weight: 0.0` and `hallucination_weight: 1.0`. The bias detector still runs and appears in logs, but it does not affect the combined score.

If you want to check user input, use `mode: "pre_call"` or `mode: ["pre_call", "post_call"]` and set `check_request: true`. User prompts can be informal or intentionally quote problematic claims, so audit with `log_only: true` before blocking request-side checks.

## Limitations

This guardrail is a heuristic estimator, not a fact checker or LLM judge. It does not retrieve sources, verify claims against a knowledge base, or prove whether a claim is true. It detects surface-level risk signals and can produce false positives or false negatives. For higher-stakes factuality checks, combine it with a retrieval-backed or LLM-based evaluation workflow.
