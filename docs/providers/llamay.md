# llamay

https://llamay.com

:::tip

**We support ALL llamay models, just set `model=llamay/<any-model-on-llamay>` as a prefix when sending litellm requests**

:::

| Property | Details |
|-------|-------|
| Description | A local model runtime for macOS, Windows and Linux with an OpenAI-compatible server. |
| Provider Route on LiteLLM | `llamay/` |
| Provider Doc | [llamay ↗](https://llamay.com/docs/developers/) |
| Supported OpenAI Endpoints | `/chat/completions`, `/responses` |

## Quick start

Install llamay, pull a model and start the server. It listens on `http://localhost:11435`.

```bash
curl -fsSL https://llamay.com/install.sh | sh
llamay pull qwen2.5:0.5b
llamay serve
```

## Usage - litellm.completion

Add the `llamay/` prefix to the model name. No API key is needed, and `api_base` defaults to `http://localhost:11435/v1`.

```python
import litellm

response = litellm.completion(
    model="llamay/qwen2.5:0.5b",  # llamay/<your-llamay-model-name>
    messages=[{"role": "user", "content": "Hello, how are you?"}],
)

print(response)
```

### Streaming

```python
import litellm

response = litellm.completion(
    model="llamay/qwen2.5:0.5b",
    messages=[{"role": "user", "content": "Write a haiku about local models."}],
    stream=True,
)

for chunk in response:
    print(chunk.choices[0].delta.content or "", end="")
```

## Usage - LiteLLM Proxy Server

1. Modify the config.yaml

  ```yaml
  model_list:
    - model_name: my-model
      litellm_params:
        model: llamay/qwen2.5:0.5b # add llamay/ prefix to route as llamay provider
        api_base: http://localhost:11435/v1 # optional, this is the default
  ```

2. Start the proxy

  ```bash
  $ litellm --config /path/to/config.yaml
  ```

3. Send Request to LiteLLM Proxy Server

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

| Variable | Description |
|-------|-------|
| `LLAMAY_API_BASE` | llamay server URL. Defaults to `http://localhost:11435/v1`. |
| `LLAMAY_API_KEY` | Optional. Set it when the server was started with API keys; otherwise a placeholder key is sent. |
