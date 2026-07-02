# Separate ITPM / OTPM Rate Limits

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
2. **Resolve an effective output cap** — the stand-in for `max_tokens` when checking quotas:

| Priority | Source | Example (`openai.gpt-oss-120b`) |
| --- | --- | --- |
| 1 | Request `max_tokens` or `max_completion_tokens` | Client sends `max_tokens: 1024` → use `1024` |
| 2 | Model map `max_output_tokens` (fallback `max_tokens`) | No client cap → use `32768` from the model card |
| 3 | Hard default | Unknown model → `4096` |

3. **ITPM check:** reserve `estimated_input + effective_output_cap` against the deployment ITPM limit. Block with `429` if admission would exceed the limit.
4. **OTPM check:** ensure `current_otpm + effective_output_cap` fits the OTPM limit. If OTPM would be exceeded, roll back the ITPM reservation and return `429`.

This mirrors Mantle: when the client omits `max_tokens`, LiteLLM assumes the model's **maximum output capacity**, not its input context window. That is why a missing `max_tokens` on a large model can reserve a lot of ITPM/OTPM headroom.

:::tip
Set `max_tokens` (or `max_output_tokens` on Responses) close to your expected completion size. Mantle and LiteLLM both reconcile down after the response, but a high default cap still blocks concurrent requests until the call finishes.
:::

### Post-call (reconciliation)

After a successful response:

| Counter | What gets recorded |
| --- | --- |
| **ITPM** | Replace the pre-call reservation with `billable_input + completion_tokens`, where `billable_input = prompt_tokens - cached_tokens` |
| **OTPM** | Add actual `completion_tokens` |

If the request **fails** before completion, the ITPM reservation is refunded; OTPM is not charged.

### Worked example

Request with no `max_tokens` against `bedrock_mantle/openai.gpt-oss-120b` (`max_output_tokens: 32768`), `itpm: 500000`:

| Step | Calculation | ITPM usage |
| --- | --- | --- |
| Pre-call reserve | `12` input est. + `32768` output cap | `32780` reserved |
| Response | `prompt_tokens=10`, `completion_tokens=150`, no cache | — |
| Post-call reconcile | `10 + 150` | `160` final |

Without an explicit `max_tokens`, the pre-call hold is much larger than the final charge — same behavior Mantle documents for quota reservation.

## How It Works

| Phase | ITPM | OTPM |
| --- | --- | --- |
| **Pre-call** | Reserves `estimated_input + effective_output_cap` | Checks `current_otpm + effective_output_cap` |
| **Post-call** | Reconciles to `billable_input + completion_tokens` | Adds actual `completion_tokens` |
| **Failure** | Refunds the ITPM reservation | No OTPM charge |

**Cached prompt tokens** (`prompt_tokens_details.cached_tokens`) are excluded from ITPM billing after the response.

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

The response includes a `retry-after` header (seconds until the current minute window resets).

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
