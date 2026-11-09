# [Beta] Separate ITPM / OTPM Rate Limits

Enforce **input tokens per minute (ITPM)** and **output tokens per minute (OTPM)** separately on router deployments.

Use this when a provider publishes separate input/output throughput limits (for example Bedrock Mantle model cards), instead of a single combined TPM.

:::info
This uses the same `enforce_model_rate_limits` pre-call check as [combined TPM/RPM enforcement](./load_balancing#enforce-model-rate-limits). Set `itpm` / `otpm` on a deployment instead of `tpm` / `rpm`.
:::

## Quick Start

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: gpt-oss-120b
    litellm_params:
      model: bedrock_mantle/openai.gpt-oss-120b
      aws_region_name: us-east-1
      itpm: 500000   # 500K input tokens per minute
      otpm: 100000   # 100K output tokens per minute

router_settings:
  optional_pre_call_checks:
    - enforce_model_rate_limits
```

Start the proxy:

```bash
litellm --config /path/to/config.yaml
```

Set `itpm` / `otpm` to the values from your provider quota or model card (Service Quotas console for Bedrock Mantle, or your internal capacity plan).

## Mantle-style reservation

LiteLLM follows the same reservation model as the [Bedrock Mantle endpoint](https://docs.aws.amazon.com/bedrock/latest/userguide/quotas-mantle.html): token limits are enforced **before** the upstream call, then reconciled after the response.

### Pre-call (admission)

Before the request is sent to the provider:

1. **Estimate input tokens** from the request body (`messages`, `prompt`, or Responses `input`).
2. **Resolve the output reservation**, the number of output tokens held against `otpm` until the response comes back:

| Priority | Source | Example (`openai.gpt-oss-120b`, `otpm: 100000`) |
| --- | --- | --- |
| 1 | Request `max_tokens`, `max_completion_tokens`, or `max_output_tokens` | The client sends `max_tokens: 1024`, so `1024` is reserved |
| 2 | Deployment `litellm_params.max_tokens` or `max_completion_tokens`, or `max_output_tokens` for a Responses request, when it is below the default | The deployment sets `max_tokens: 2000`, so `2000` is reserved |
| 3 | The default, the smaller of the model's `max_output_tokens` (`4096` for an unmapped model) and a quarter of `otpm` | No cap is set, so `25000` is reserved, since a quarter of `otpm` is below the model card's `32768` |

3. **ITPM check:** reserve `estimated_input` against the deployment ITPM limit. Block with `429` if the reservation would exceed the limit.
4. **OTPM check:** reserve the output reservation against the deployment OTPM limit. If OTPM would be exceeded, roll back the ITPM reservation and return `429`.

A request cap is reserved in full, even when it is above the default. A deployment cap only lowers the reservation, since the router sends it on every call that has no cap of its own. <SinceVersion v="1.109.0" />

The default lets four requests without an output cap run at once on a deployment whose model max is above a quarter of `otpm`. Long answers from those requests can push a minute's real output above `otpm`, because the counters are corrected only when each response comes back. Set `NO_MAX_TOKENS_TPM_RESERVATION_FRACTION` to change the quarter, from `0.01` to `1`. A value of `1` reserves up to the whole `otpm`, which admits about one such request a minute when the model max is above `otpm`. <SinceVersion v="1.109.0" />

:::tip
Set `max_tokens` (or `max_output_tokens` on Responses) close to your expected completion size. LiteLLM corrects the counters after the response, but a large cap still holds OTPM capacity from concurrent requests until the call finishes.
:::

### Post-call (reconciliation)

After a successful response:

| Counter | What gets recorded |
| --- | --- |
| **ITPM** | Replace the pre-call reservation with the billable input, `prompt_tokens - cached_tokens`. Anthropic `/v1/messages` usage counts `input_tokens` plus cache writes, and leaves out cache reads |
| **OTPM** | Replace the pre-call reservation with the actual `completion_tokens` |

A refund goes back to the minute that held the reservation. Usage above the reservation is charged to the minute the response finished in, so a call that starts at 12:00:59 and finishes at 12:01:20 counts its extra tokens against 12:01. <SinceVersion v="1.109.0" />

If a request **fails**, both reservations are refunded, once for each retry or fallback attempt that failed. A response that reports no usage keeps its reservation until the minute ends.

### Worked example

Request with no `max_tokens` against `bedrock_mantle/openai.gpt-oss-120b` (`max_output_tokens: 32768`), `itpm: 500000`, `otpm: 100000`:

| Step | ITPM usage | OTPM usage |
| --- | --- | --- |
| Pre-call reserve | `12` input estimate | `25000`, a quarter of `otpm` |
| Response | `prompt_tokens=10`, no cache | `completion_tokens=150` |
| Post-call reconcile | `10` final | `150` final |

Without an explicit `max_tokens`, the pre-call hold is much larger than the final charge. Up to four such requests fit in `otpm` at once, and each one that finishes frees the rest of its reservation for the next request in the same minute.

## How It Works

| Phase | ITPM | OTPM |
| --- | --- | --- |
| **Pre-call** | Reserves `estimated_input` | Reserves the output reservation |
| **Post-call** | Reconciles to the billable input | Reconciles to actual `completion_tokens` |
| **Failure** | Refunds the ITPM reservation | Refunds the OTPM reservation |

**Cached prompt tokens** (`prompt_tokens_details.cached_tokens`, or `cache_read_input_tokens` on Anthropic usage) are excluded from ITPM billing after the response.

## Response Headers

When a model group has `itpm` or `otpm` configured, LiteLLM returns:

| Header | Description |
| --- | --- |
| `x-ratelimit-limit-input-tokens` | ITPM limit for the model group |
| `x-ratelimit-remaining-input-tokens` | Remaining ITPM capacity this minute |
| `x-ratelimit-reset-input-tokens` | Seconds until the minute window resets |
| `x-ratelimit-limit-output-tokens` | OTPM limit for the model group |
| `x-ratelimit-remaining-output-tokens` | Remaining OTPM capacity this minute |
| `x-ratelimit-reset-output-tokens` | Seconds until the minute window resets |

## Error Response

When a limit is exceeded before the upstream call:

```json
{
  "error": {
    "message": "Model rate limit exceeded. ITPM limit=500000, current usage=500120",
    "type": "rate_limit_error",
    "code": 429
  }
}
```

The `current usage` in the message includes the reservation of the request that was rejected. The response includes a `retry-after` header (seconds until the current minute window resets).

## Project-Level Limits

Enforce per-model ITPM / OTPM quotas for a [project](./project_management) on the proxy. Set `model_itpm_limit` and `model_otpm_limit` when creating or updating a project: each maps a model name (the `model_name` clients request) to a token-per-minute limit.

```bash showLineNumbers
curl -X POST 'http://localhost:4000/project/new' \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
    "project_alias": "my-project",
    "team_id": "<team-id>",
    "models": ["claude-fable-5"],
    "model_itpm_limit": {"claude-fable-5": 300000},
    "model_otpm_limit": {"claude-fable-5": 100000}
  }'
```

Requests made with the project's keys count against these limits. Enforcement follows the same reservation model as deployment limits: LiteLLM reserves the input estimate plus the effective output cap before the upstream call, then reconciles to actual usage after the response. No router settings are needed. The proxy's rate limiter enforces the project metadata automatically. This requires a database, since projects live in the proxy DB.

### Project response headers

Successful responses on models with a project limit include:

| Header | Description |
| --- | --- |
| `x-ratelimit-model_per_project_itpm-limit-tokens` | Project ITPM limit for the model |
| `x-ratelimit-model_per_project_itpm-remaining-tokens` | Remaining project ITPM this minute |
| `x-ratelimit-model_per_project_otpm-limit-tokens` | Project OTPM limit for the model |
| `x-ratelimit-model_per_project_otpm-remaining-tokens` | Remaining project OTPM this minute |

### Project error response

A request that would exceed a project limit is blocked with `429` before the upstream call:

```json
{
  "error": {
    "message": "Rate limit exceeded for model_per_project_itpm: <project-id>:claude-fable-5. Limit type: tokens. Current limit: 300000, Remaining: 300000. Limit resets at: 2026-08-18 14:48:49 UTC",
    "type": "throttling_error",
    "code": "429"
  }
}
```

## ITPM vs TPM

| Setting | What it limits | When to use |
| --- | --- | --- |
| `tpm` | Total tokens per minute (single counter) | Legacy combined throughput limits |
| `itpm` + `otpm` | Input and output separately | Provider docs with distinct input/output TPM (Bedrock Mantle) |

Do **not** set both modes on the same deployment. If `itpm` or `otpm` is present, LiteLLM uses the ITPM/OTPM path and ignores combined TPM tracking for that deployment.

## Multi-Instance Deployment

Share counters across proxy replicas with Redis:

```yaml showLineNumbers title="config.yaml"
router_settings:
  optional_pre_call_checks:
    - enforce_model_rate_limits
  redis_host: redis.example.com
  redis_port: 6379
  redis_password: your-password
```

## SDK Usage

```python showLineNumbers title="example.py"
from litellm import Router

router = Router(
    model_list=[
        {
            "model_name": "gpt-oss-120b",
            "litellm_params": {
                "model": "bedrock_mantle/openai.gpt-oss-120b",
                "itpm": 500_000,
                "otpm": 100_000,
            },
        }
    ],
    optional_pre_call_checks=["enforce_model_rate_limits"],
)

response = await router.acompletion(
    model="gpt-oss-120b",
    messages=[{"role": "user", "content": "Hello"}],
    max_tokens=1024,  # explicit cap avoids over-reserving model max_output_tokens
)
```

## Related

- [Load Balancing + combined TPM/RPM enforcement](./load_balancing#enforce-model-rate-limits)
- [Dynamic TPM/RPM allocation](./dynamic_rate_limit)
- [Bedrock Mantle quotas (AWS)](https://docs.aws.amazon.com/bedrock/latest/userguide/quotas-mantle.html)
