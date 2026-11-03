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
- Bedrock
- OpenRouter

### Usage

**1. Setup config.yaml**

```yaml
model_list:
    - model_name: xai/*
      litellm_params:
        model: xai/*
        api_key: os.environ/XAI_API_KEY

litellm_settings:
    check_provider_endpoint: true # Enable checking provider endpoint for wildcard models
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

## Which key discovery uses

Discovery calls the provider with the wildcard deployment's own credentials: its `api_base`, and its `api_key` or, when that is unset, the provider's environment variable on the proxy host. For a deployment pointed at a custom Anthropic-compatible gateway, LiteLLM requests `<api_base>/v1/models` with `x-api-key` set to that key and lists each returned id under the wildcard prefix, for example `my-gateway/claude-sonnet-4-5`

```yaml
model_list:
  - model_name: "my-gateway/*"
    litellm_params:
      model: "anthropic/*"
      api_base: "https://gateway.example.com/anthropic"
      api_key: os.environ/GATEWAY_SERVICE_TOKEN # used for discovery, and as the fallback when a request has no key

general_settings:
  forward_llm_provider_auth_headers: true

litellm_settings:
  check_provider_endpoint: true
```

The listing reflects that one key's access. A provider key that a caller forwards on the `/v1/models` request (see [Forward LLM Provider Authentication Headers](./forward_client_headers.md#forward-llm-provider-authentication-headers)) is not used for discovery, so users whose own keys can see different models all get the same list, and a listed model can still fail with a given user's key. When neither the deployment key nor the environment variable is set, the wildcard route adds nothing to `/v1/models`

## Bedrock

A `bedrock/*` deployment lists the ids its credentials can invoke on demand in its region: the active system-defined inference profiles (`us.`, `global.` and the other regional prefixes) plus the foundation models that support on-demand throughput. Models that only run through a profile, application inference profiles and provisioned throughput are not listed, so every id in the list answers a request

```yaml
model_list:
  - model_name: bedrock/*
    litellm_params:
      model: bedrock/*
      aws_region_name: us-east-1
      aws_access_key_id: os.environ/AWS_ACCESS_KEY_ID
      aws_secret_access_key: os.environ/AWS_SECRET_ACCESS_KEY

litellm_settings:
  check_provider_endpoint: true
```

The listing signs with the deployment's AWS credentials (keys, `aws_role_name`, `aws_profile_name`, web identity, or the default chain), or with a Bedrock API key (`api_key` or `AWS_BEARER_TOKEN_BEDROCK`), and needs two IAM permissions the invoke path does not: `bedrock:ListInferenceProfiles` and `bedrock:ListFoundationModels`. It calls the Bedrock control plane (`bedrock.<region>.amazonaws.com`), not the runtime endpoint, so a VPC that only exposes `bedrock-runtime` needs a `bedrock` interface endpoint too. When the permissions are missing or the control plane does not answer, the deployment adds nothing to `/v1/models` and the proxy logs `Error getting valid models` on each listing call

## OpenRouter

<SinceVersion v="1.110.0" />

An `openrouter/*` deployment lists the chat models that OpenRouter's [list models for user](https://openrouter.ai/docs/api/api-reference/models/list-models-filtered-by-user-provider-preferences-privacy-settings-and-guardrails) endpoint returns for the deployment's key, as `openrouter/<vendor>/<model>` ids that route back through the same deployment. That endpoint leaves out the models the account's provider preferences, privacy settings, or guardrails block, so the list holds only models the key can call.

```yaml
model_list:
  - model_name: openrouter/*
    litellm_params:
      model: openrouter/*
      api_key: os.environ/OPENROUTER_API_KEY

litellm_settings:
  check_provider_endpoint: true
```

A custom prefix keeps the vendor in each id, so `model_name: or-team/*` over `model: openrouter/*` lists `or-team/openai/gpt-5.4-mini`, and a catch-all `model_name: "*"` over `openrouter/*` lists bare ids like `openai/gpt-5.4-mini`. Embedding models and ids ending in `:batch` are not listed, and embedding models still answer on `/v1/embeddings` through the wildcard. A key or team granted `openrouter/*` lists no OpenRouter models unless an `openrouter/*` deployment exists, since the catalog depends on the key that asks for it.

The listing uses the deployment's `api_key` and `api_base`, then `OPENROUTER_API_KEY` or `OR_API_KEY` and `OPENROUTER_API_BASE`, in the same order as a chat request. When the catalog call fails or takes longer than 10 seconds, the deployment adds nothing to `/v1/models`, and after a timeout the next 30 seconds of listings skip the call.

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
