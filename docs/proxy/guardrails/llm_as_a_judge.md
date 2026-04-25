import Image from '@theme/IdealImage';
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# LLM as a Judge

Use an LLM to score every response against weighted criteria before it's returned to the user. If the overall score falls below your threshold, the request is blocked with a 422 or logged for review — your choice.

**Supported endpoints:** `/v1/chat/completions`

**How it works:**
1. Your model generates a response
2. A judge LLM scores it against criteria you define (e.g. Honesty, Helpfulness)
3. If `overall_score < threshold` and `on_failure: block` → the request is rejected with HTTP 422 and full verdict details
4. If `on_failure: log` → the response passes through and the verdicts are recorded in spend logs

## Quick Start

### 1. Define the guardrail in your config

```yaml showLineNumbers title="litellm config.yaml"
model_list:
  - model_name: gpt-4o-mini
    litellm_params:
      model: openai/gpt-4o-mini
      api_key: os.environ/OPENAI_API_KEY

guardrails:
  - guardrail_name: honesty-judge
    litellm_params:
      guardrail: llm_as_a_judge
      mode: post_call
      judge_model: gpt-4o-mini
      overall_threshold: 70        # block if score < 70
      on_failure: block            # or "log" to allow through
      criteria:
        - name: Honesty
          weight: 60
          description: Is the response factually honest? Flag any false or misleading statements.
        - name: Helpfulness
          weight: 40
          description: Does the response actually help the user with their question?
```

:::info
**Criterion weights must sum to 100.** The overall score is the weighted average of all criterion scores.
:::

### 2. Start the proxy

```bash
litellm --config config.yaml
```

### 3. Make a request with the guardrail enabled

```bash
curl -X POST http://localhost:4000/v1/chat/completions \
  -H "Authorization: Bearer $LITELLM_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o-mini",
    "messages": [{"role": "user", "content": "What is machine learning?"}],
    "guardrails": ["honesty-judge"]
  }'
```

## Create via Admin UI

<Image img={require('/img/llm-judge/guardrails-list.png')} alt="Guardrails list showing LLM as a Judge entries" />

Click **+ Add New Guardrail → Add Provider Guardrail** and select **LiteLLM LLM as a Judge** as the provider.

**Step 1 — Basic Info:** Enter a name and confirm the provider and mode.

**Step 2 — Provider Configuration:** Set the judge model, minimum score, on-failure behavior, and define your criteria:

<Image img={require('/img/llm-judge/create-guardrail-form.png')} alt="Create guardrail form with criteria builder" />

After saving, the guardrail appears in the list:

<Image img={require('/img/llm-judge/guardrail-created.png')} alt="Guardrails list showing the new honesty-judge entry" />

## Blocked vs. Passed Responses

### Blocked response (score below threshold)

When a response fails the quality check, the API returns HTTP 422 with the full judge verdict:

<Image img={require('/img/llm-judge/guardrail-blocked.png')} alt="Example of a blocked response with judge scores" />

```json
{
  "error": {
    "message": "LLM judge rejected response: score below threshold",
    "code": "422",
    "provider_specific_fields": {
      "overall_score": 6.0,
      "threshold": 70.0,
      "guardrail_name": "honesty-judge",
      "verdicts": [
        {
          "criterion_name": "Honesty",
          "score": 0,
          "passed": false,
          "reasoning": "The response promotes flat Earth theory, which is scientifically disproven."
        },
        {
          "criterion_name": "Helpfulness",
          "score": 10,
          "passed": false,
          "reasoning": "Provides misleading information rather than factual assistance."
        }
      ]
    }
  }
}
```

### Passed response (score above threshold)

Honest, helpful responses pass through normally:

<Image img={require('/img/llm-judge/guardrail-passed.png')} alt="Example of a passing response with judge scores" />

## Configuration Reference

| Parameter | Required | Default | Description |
|---|---|---|---|
| `guardrail` | ✓ | — | Must be `llm_as_a_judge` |
| `mode` | ✓ | — | Must be `post_call` |
| `judge_model` | ✓ | — | Any model supported by LiteLLM (e.g. `gpt-4o-mini`, `claude-3-5-haiku`) |
| `overall_threshold` | | `80.0` | Score 0–100. Requests scoring below this are treated as failures |
| `on_failure` | | `block` | `block` → HTTP 422, `log` → pass through and record |
| `criteria` | ✓ | — | List of criteria. Weights must sum to 100 |
| `criteria[].name` | ✓ | — | Criterion name shown in verdict |
| `criteria[].weight` | ✓ | — | Percentage weight (0–100). All weights must total 100 |
| `criteria[].description` | ✓ | — | What the judge should check for this criterion |

## Examples

### Quality gate with multiple criteria

```yaml
guardrails:
  - guardrail_name: response-quality
    litellm_params:
      guardrail: llm_as_a_judge
      mode: post_call
      judge_model: gpt-4o-mini
      overall_threshold: 75
      on_failure: block
      criteria:
        - name: Accuracy
          weight: 40
          description: Is the information factually correct?
        - name: Clarity
          weight: 30
          description: Is the response clear and well-structured?
        - name: Safety
          weight: 30
          description: Does the response avoid harmful or offensive content?
```

### Log-only mode for monitoring

Use `on_failure: log` to monitor quality without blocking users. The judge runs on every response and records scores in spend logs — useful for baselining before enforcing a threshold.

```yaml
guardrails:
  - guardrail_name: quality-monitor
    litellm_params:
      guardrail: llm_as_a_judge
      mode: post_call
      judge_model: gpt-4o-mini
      overall_threshold: 70
      on_failure: log   # never blocks, just records
      criteria:
        - name: Relevance
          weight: 50
          description: Does the response address the user's actual question?
        - name: Conciseness
          weight: 50
          description: Is the response appropriately concise without omitting key information?
```

### Apply per-request via header

You can enable specific guardrails on individual requests without making them default-on:

<Tabs>
<TabItem value="python" label="Python">

```python
import openai

client = openai.OpenAI(
    api_key="your-litellm-key",
    base_url="http://localhost:4000"
)

response = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[{"role": "user", "content": "What is machine learning?"}],
    extra_body={"guardrails": ["honesty-judge"]}
)
print(response.choices[0].message.content)
```

</TabItem>
<TabItem value="curl" label="cURL">

```bash
curl -X POST http://localhost:4000/v1/chat/completions \
  -H "Authorization: Bearer $LITELLM_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o-mini",
    "messages": [{"role": "user", "content": "What is machine learning?"}],
    "guardrails": ["honesty-judge"]
  }'
```

</TabItem>
</Tabs>

## Viewing Logs

<Image img={require('/img/llm-judge/logs-with-guardrail.png')} alt="Spend logs showing requests with guardrail applied" />

All requests with guardrails applied appear in **Logs** with their status. Blocked requests show as `Failure`; passed requests show as `Success`.

## Notes

- The judge call adds latency (~300–800ms depending on judge model). Use a fast model like `gpt-4o-mini` for low overhead.
- The guardrail fails open: if the judge call errors, the original response is returned and a warning is logged.
- Float weights are supported (e.g. `33.34`, `33.33`, `33.33`) as long as they sum to 100 ± 0.5.
- The judge sees the full conversation history plus the assistant response, so it can evaluate contextual appropriateness, not just isolated content.
