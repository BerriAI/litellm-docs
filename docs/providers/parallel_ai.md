import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Parallel AI
https://parallel.ai

Parallel AI provides a web-research model through an OpenAI Responses-compatible endpoint: it answers questions using live multi-step web research and returns fully cited answers. API reference: [docs.parallel.ai](https://docs.parallel.ai/responses-api/responses-quickstart)

| Property | Details |
|-------|-------|
| Description | Web-research model grounded in Parallel's index of the web |
| Provider Route on LiteLLM | `parallel_ai/` |
| Supported Endpoints | `/v1/responses` (native), `/chat/completions` and `/v1/messages` (via LiteLLM's responses bridge), `/v1/search` |
| API Reference | [Parallel Responses API docs](https://docs.parallel.ai/responses-api/responses-quickstart) |

## API Key

```python
# env variable; PARALLEL_API_KEY is read as a fallback
os.environ['PARALLEL_AI_API_KEY']
```

`PARALLEL_AI_API_BASE` overrides the default base URL (`https://api.parallel.ai`). When a request supplies its own `api_base` that is neither the default nor `PARALLEL_AI_API_BASE`, it must also supply an explicit `api_key`; the server-managed key is never sent to other hosts.

## Responses API

The single `parallel_ai/parallel` model runs live web research per request. `reasoning.effort` selects the research tier: `low` (~5-10s), `medium` (~15-20s, default), or `high` (~30-60s). Web grounding is automatic, so `tools` is not supported; structured output via `text.format`, `instructions`, `stream`, and `previous_response_id` are.

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

## Chat Completions and Messages

The same model also serves `/v1/chat/completions` and `/v1/messages` through LiteLLM's responses bridge, so OpenAI- and Anthropic-format clients work without changes:

```python
from litellm import completion
import os

os.environ['PARALLEL_AI_API_KEY'] = ""
response = completion(
    model="parallel_ai/parallel",
    messages=[{"role": "user", "content": "What did Parallel Web Systems announce this year?"}]
)
print(response.choices[0].message.content)
```

## Search

Parallel AI is also a search provider; see [Parallel AI Search](../search/parallel_ai).
