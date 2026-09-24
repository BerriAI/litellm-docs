# Model Discovery

Use this to give users an accurate list of models available behind provider endpoint, when calling `/v1/models` for wildcard models.

## Supported Models

- Fireworks AI
- OpenAI
- Gemini
- LiteLLM Proxy
- Topaz
- Anthropic
- XAI
- VLLM
- Vertex AI
- Eden AI

### Usage

**1. Setup config.yaml**

```yaml
model_list:
    - model_name: xai/*
      litellm_params:
        model: xai/*
        api_key: os.environ/XAI_API_KEY

litellm_settings:
    check_provider_endpoint: true # 👈 Enable checking provider endpoint for wildcard models
```

**2. Start proxy**

```bash
litellm --config /path/to/config.yaml

# RUNNING on http://0.0.0.0:4000
```

**3. Call `/v1/models`**

```bash
curl -X GET "http://localhost:4000/v1/models" -H "Authorization: Bearer $LITELLM_KEY"
```

Expected response

```json
{
    "data": [
        {
            "id": "xai/grok-2-1212",
            "object": "model",
            "created": 1677610602,
            "owned_by": "openai"
        },
        {
            "id": "xai/grok-2-vision-1212",
            "object": "model",
            "created": 1677610602,
            "owned_by": "openai"
        },
        {
            "id": "xai/grok-3-beta",
            "object": "model",
            "created": 1677610602,
            "owned_by": "openai"
        },
        {
            "id": "xai/grok-3-fast-beta",
            "object": "model",
            "created": 1677610602,
            "owned_by": "openai"
        },
        {
            "id": "xai/grok-3-mini-beta",
            "object": "model",
            "created": 1677610602,
            "owned_by": "openai"
        },
        {
            "id": "xai/grok-3-mini-fast-beta",
            "object": "model",
            "created": 1677610602,
            "owned_by": "openai"
        },
        {
            "id": "xai/grok-beta",
            "object": "model",
            "created": 1677610602,
            "owned_by": "openai"
        },
        {
            "id": "xai/grok-vision-beta",
            "object": "model",
            "created": 1677610602,
            "owned_by": "openai"
        },
        {
            "id": "xai/grok-2-image-1212",
            "object": "model",
            "created": 1677610602,
            "owned_by": "openai"
        }
    ],
    "object": "list"
}
```

## Hide a model from `/v1/models`

Set `model_info.discoverable: false` on a `model_list` entry to leave it out of the listing endpoints while keeping it callable by anyone whose key allows it. This is for models a chat client's model picker should not offer, such as embedding, classifier, or evaluator models that only your own services call. Clients like Claude Code (`CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY=1`) and Open WebUI fill their pickers from `GET /v1/models`, and most do not filter by capability

```yaml
model_list:
  - model_name: {{anthropic}}
    litellm_params:
      model: anthropic/{{anthropic}}
      api_key: os.environ/ANTHROPIC_API_KEY
  - model_name: text-embedding-3-small
    litellm_params:
      model: openai/text-embedding-3-small
      api_key: os.environ/OPENAI_API_KEY
    model_info:
      mode: embedding
      discoverable: false   # callable by name, absent from /v1/models
```

With that config a regular virtual key gets only `{{anthropic}}` back from `GET /v1/models` (and `/models`, in both the OpenAI and the Anthropic response shape), from `GET /v1/model/info` (and `/model/info`), and from `GET /model_group/info`, while `POST /v1/embeddings` with `"model": "text-embedding-3-small"` works exactly as before

```bash
curl -s http://localhost:4000/v1/models -H "Authorization: Bearer $LITELLM_KEY" | jq '.data[].id'
# "{{anthropic}}"

curl -s http://localhost:4000/v1/embeddings -H "Authorization: Bearer $LITELLM_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"model": "text-embedding-3-small", "input": "still callable"}' | jq '.data[0].embedding | length'
# 1536
```

The flag only changes what the listing endpoints advertise. Every request that names the model, on any endpoint, is still subject to the same key and team `models` allowlists as today, and `GET /v1/models/{model}` still returns the model so a client that validates a model it was given by name keeps working. Proxy admins (`proxy_admin` and `proxy_admin_viewer` roles, including the master key) still see the model on every listing endpoint, so the Admin UI and `GET /v1/models?scope=expand` keep showing the full inventory

A model group stays listed while at least one of its deployments is discoverable. Setting the flag on a wildcard entry such as `claude-*` hides every model that entry expands to. Leaving the field out means discoverable, so existing configs are unchanged

To stop a key from calling a model instead of just hiding it, use the key's or team's `models` list ([Restrict Model Access](./model_access)). To hide a `model_group_alias` rather than a `model_list` entry, use the alias's `hidden` flag ([Hide Alias Models](./load_balancing#hide-alias-models))
