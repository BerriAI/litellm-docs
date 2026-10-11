# Llmman

LiteLLM supports all models served by [llmman](https://github.com/llmmanorg/llmman), an OpenAI compatible local runner with models stored as OCI images.

| Property                  | Details                                                          |
|---------------------------|------------------------------------------------------------------|
| Description               | Run any agent on any model, models stored as OCI images.         |
| Provider Route on LiteLLM | `llmman/` (for OpenAI compatible server)                         |
| Provider Doc              | [llmman ↗](https://github.com/llmmanorg/llmman)                  |
| Supported Endpoints       | `/chat/completions`, `/embeddings`                               |

## Usage - litellm.completion (calling OpenAI compatible endpoint)

Add the `llmman/` prefix to the model name. No API key is required, and `api_base` defaults to `http://127.0.0.1:17434/v1`.

```python
import litellm

response = litellm.completion(
    model="llmman/qwen3.8",  # llmman/<your-llmman-model-name>
    messages=[{"role": "user", "content": "Hello, how are you?"}],
)

print(response)
```

## Usage - LiteLLM Proxy Server (calling OpenAI compatible endpoint)

1. Modify the config.yaml

  ```yaml
  model_list:
    - model_name: my-model
      litellm_params:
        model: llmman/qwen3.8 # add llmman/ prefix to route as llmman provider
        api_base: http://127.0.0.1:17434/v1 # optional, this is the default
  ```

1. Start the proxy

  ```bash
  $ litellm --config /path/to/config.yaml
  ```

1. Send Request to LiteLLM Proxy Server

  ```shell
  curl --location 'http://0.0.0.0:4000/chat/completions' \
      --header "Authorization: Bearer $LITELLM_API_KEY" \
      --header 'Content-Type: application/json' \
      --data '{
      "model": "my-model",
      "messages": [{"role": "user", "content": "what llm are you"}]
  }'
  ```

## Environment Variables

| Variable          | Description                                                      |
|-------------------|------------------------------------------------------------------|
| `LLMMAN_API_BASE` | llmman server URL. Defaults to `http://127.0.0.1:17434/v1`.      |
| `LLMMAN_API_KEY`  | Optional. A placeholder key is sent if unset.                    |
