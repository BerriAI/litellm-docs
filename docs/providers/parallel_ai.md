import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Parallel AI
https://parallel.ai

Parallel AI provides web-research models. The chat models answer with built-in web grounding, and the `parallel` Responses API model runs multi-step web research with citations. API reference: [docs.parallel.ai](https://docs.parallel.ai/getting-started/overview)

| Property | Details |
|-------|-------|
| Description | Web-research models grounded in Parallel's index of the web |
| Provider Route on LiteLLM | `parallel_ai/` |
| Supported Endpoints | `/chat/completions`, `/v1/responses`, `/v1/messages`, `/v1/search` |
| API Reference | [Parallel AI docs](https://docs.parallel.ai/chat-api/chat-quickstart) |

## API Key

```python
# env variable; PARALLEL_API_KEY is read as a fallback
os.environ['PARALLEL_AI_API_KEY']
```

`PARALLEL_AI_API_BASE` overrides the default base URL (`https://api.parallel.ai`). When a request supplies its own `api_base` that is neither the default nor `PARALLEL_AI_API_BASE`, it must also supply an explicit `api_key`; the server-managed key is never sent to other hosts.

## Chat Models

| Model | Latency | Research basis |
|-------|---------|----------------|
| `parallel_ai/speed` | ~3s TTFT | No |
| `parallel_ai/lite` | 10-60s | Yes |
| `parallel_ai/base` | 15-100s | Yes |
| `parallel_ai/core` | 60s-5min | Yes |

The chat API supports `stream` and `response_format` (json_schema). Sampling parameters (temperature, top_p, penalties) and tool calling are not supported. Research models return a `basis` field with per-field citations, reasoning, and confidence, preserved on the LiteLLM response.

<Tabs>
<TabItem value="sdk" label="SDK">

```python
from litellm import completion
import os

os.environ['PARALLEL_AI_API_KEY'] = ""
response = completion(
    model="parallel_ai/core",
    messages=[{"role": "user", "content": "What did Parallel Web Systems announce this year?"}]
)
print(response.choices[0].message.content)
print(response.basis)  # citations, reasoning, confidence (research models)
```

</TabItem>
<TabItem value="proxy" label="PROXY">

```yaml
model_list:
  - model_name: parallel-core
    litellm_params:
      model: parallel_ai/core
      api_key: os.environ/PARALLEL_AI_API_KEY
```

```bash
curl http://0.0.0.0:4000/v1/chat/completions \
  -H "Authorization: Bearer sk-1234" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "parallel-core",
    "messages": [{"role": "user", "content": "What did Parallel Web Systems announce this year?"}]
  }'
```

</TabItem>
</Tabs>

## Responses API

The `parallel_ai/parallel` model is served through Parallel's OpenAI Responses-compatible endpoint. `reasoning.effort` selects the research tier: `low` (~5-10s), `medium` (~15-20s, default), or `high` (~30-60s). Web grounding is automatic, so `tools` is not supported; structured output via `text.format`, `instructions`, `stream`, and `previous_response_id` are.

<Tabs>
<TabItem value="sdk" label="SDK">

```python
from litellm import responses
import os

os.environ['PARALLEL_AI_API_KEY'] = ""
response = responses(
    model="parallel_ai/parallel",
    input="What company acquired Windsurf in 2025?",
    reasoning={"effort": "low"}
)
print(response.output_text)
```

</TabItem>
<TabItem value="proxy" label="PROXY">

```yaml
model_list:
  - model_name: parallel-research
    litellm_params:
      model: parallel_ai/parallel
      api_key: os.environ/PARALLEL_AI_API_KEY
```

```bash
curl http://0.0.0.0:4000/v1/responses \
  -H "Authorization: Bearer sk-1234" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "parallel-research",
    "input": "What company acquired Windsurf in 2025?",
    "reasoning": {"effort": "low"}
  }'
```

</TabItem>
</Tabs>

## Search

Parallel AI is also a search provider; see [Parallel AI Search](../search/parallel_ai).
