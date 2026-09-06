# API Route

[API Route](https://www.api-route.com/) is an OpenAI-compatible multi-model AI API gateway. See the [API Route documentation](https://www.api-route.com/docs/overview) for setup details.

## API Key and Base URL

Get your API key and base URL from API Access in the API Route dashboard, then set these environment variables:

```python
import os

os.environ["API_ROUTE_API_KEY"] = "your-api-key"
os.environ["API_ROUTE_BASE_URL"] = "your-api-base-url"
```

You can also pass `api_key` and `api_base` directly to `litellm.completion`.

## Usage

```python
import litellm

response = litellm.completion(
    model="api_route/your-model-name",
    messages=[{"role": "user", "content": "Hello"}],
)

print(response.choices[0].message.content)
```

API Route supports chat completions, streaming, and tool calling through LiteLLM's OpenAI-compatible implementation.
