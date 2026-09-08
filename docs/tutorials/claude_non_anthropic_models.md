import Image from '@theme/IdealImage';
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Use Claude Code with Non-Anthropic Models

This tutorial shows how to use Claude Code with non-Anthropic models like OpenAI, Gemini, and other LLM providers through LiteLLM proxy.

:::info 

LiteLLM automatically translates between different provider formats, allowing you to use any supported LLM provider with Claude Code while maintaining the Anthropic Messages API format.

:::

## Prerequisites

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code/overview) installed
- API keys for your chosen providers (OpenAI, Vertex AI, etc.)

## Installation

First, install LiteLLM with proxy support:

```bash
uv tool install 'litellm[proxy]'
```

## Configuration

### 1. Setup config.yaml

Create a configuration file with your preferred non-Anthropic models:

<Tabs>
<TabItem value="openai" label="OpenAI">

```yaml
model_list:
  # OpenAI {{openai_large}}
  - model_name: {{openai_large}}
    litellm_params:
      model: openai/{{openai_large}}
      api_key: os.environ/OPENAI_API_KEY
  
  # OpenAI {{openai_small}}
  - model_name: {{openai_small}}
    litellm_params:
      model: openai/{{openai_small}}
      api_key: os.environ/OPENAI_API_KEY
```

Set your environment variables:

```bash
export OPENAI_API_KEY="your-openai-api-key"
export LITELLM_MASTER_KEY="sk-1234567890"  # Generate a secure key
```

</TabItem>
<TabItem value="gemini" label="Google AI Studio">

```yaml
model_list:
  # Google Gemini
  - model_name: {{gemini_flash}}
    litellm_params:
      model: gemini/{{gemini_flash}}
      api_key: os.environ/GEMINI_API_KEY
```

Set your environment variables:

```bash
export GEMINI_API_KEY="your-gemini-api-key"
export LITELLM_MASTER_KEY="sk-1234567890"  # Generate a secure key
```

</TabItem>
<TabItem value="vertex_ai" label="Vertex AI">

```yaml
model_list:
  # Google Gemini
  - model_name: vertex-gemini-3.8-flash
    litellm_params:
      model: vertex_ai/{{gemini_flash}}
      vertex_credentials: os.environ/VERTEX_FILE_PATH_ENV_VAR # os.environ["VERTEX_FILE_PATH_ENV_VAR"] = "/path/to/service_account.json" 
      vertex_project: "my-test-project"
      vertex_location: "us-east-1"

  # Anthropic Claude
  - model_name: anthropic-vertex
    litellm_params:
      model: vertex_ai/{{anthropic}}
      vertex_ai_project: "my-test-project"
      vertex_ai_location: "us-east-1"
      vertex_credentials: os.environ/VERTEX_FILE_PATH_ENV_VAR # os.environ["VERTEX_FILE_PATH_ENV_VAR"] = "/path/to/service_account.json" 
```

Set your environment variables:

```bash
export VERTEX_FILE_PATH_ENV_VAR="/path/to/service_account.json"
export LITELLM_MASTER_KEY="sk-1234567890"  
```

</TabItem>
<TabItem value="multi" label="Azure OpenAI">

```yaml
model_list:
  # Azure OpenAI
  - model_name: azure-gpt-5.6-terra
    litellm_params:
      model: azure/{{openai_large}}
      api_key: os.environ/AZURE_API_KEY
      api_base: os.environ/AZURE_API_BASE
      api_version: "2024-02-01"
```

Set your environment variables:

```bash
export AZURE_API_KEY="your-azure-api-key"
export AZURE_API_BASE="https://your-resource.openai.azure.com"
export LITELLM_MASTER_KEY="sk-1234567890"
```

</TabItem>
</Tabs>

### 2. Start LiteLLM Proxy

```bash
litellm --config /path/to/config.yaml

# RUNNING on http://0.0.0.0:4000
```

### 3. Verify Setup

Test that your proxy is working correctly:

<Tabs>
<TabItem value="openai-test" label="OpenAI">

```bash
curl -X POST http://0.0.0.0:4000/v1/messages \
-H "Authorization: Bearer $LITELLM_MASTER_KEY" \
-H "Content-Type: application/json" \
-d '{
    "model": "{{openai_large}}",
    "max_tokens": 1000,
    "messages": [{"role": "user", "content": "What is the capital of France?"}]
}'
```

</TabItem>
<TabItem value="gemini-test" label="Google AI Studio">

```bash
curl -X POST http://0.0.0.0:4000/v1/messages \
-H "Authorization: Bearer $LITELLM_MASTER_KEY" \
-H "Content-Type: application/json" \
-d '{
    "model": "{{gemini_flash}}",
    "max_tokens": 1000,
    "messages": [{"role": "user", "content": "What is the capital of France?"}]
}'
```

</TabItem>
<TabItem value="vertex-test" label="Vertex AI">

```bash
curl -X POST http://0.0.0.0:4000/v1/messages \
-H "Authorization: Bearer $LITELLM_MASTER_KEY" \
-H "Content-Type: application/json" \
-d '{
    "model": "{{gemini_flash}}",
    "max_tokens": 1000,
    "messages": [{"role": "user", "content": "What is the capital of France?"}]
}'
```

</TabItem>
<TabItem value="azure-test" label="Azure OpenAI">

```bash
curl -X POST http://0.0.0.0:4000/v1/messages \
-H "Authorization: Bearer $LITELLM_MASTER_KEY" \
-H "Content-Type: application/json" \
-d '{
    "model": "azure-gpt-5.6-terra",
    "max_tokens": 1000,
    "messages": [{"role": "user", "content": "What is the capital of France?"}]
}'
```

</TabItem>
</Tabs>

### 4. Configure Claude Code

Configure Claude Code to use your LiteLLM proxy:

```bash
export ANTHROPIC_BASE_URL="http://0.0.0.0:4000"
export ANTHROPIC_AUTH_TOKEN="$LITELLM_MASTER_KEY"
```

:::tip
The `LITELLM_MASTER_KEY` gives Claude Code access to all proxy models. You can also create virtual keys in the LiteLLM UI to limit access to specific models.
:::

### 5. Use Claude Code with Non-Anthropic Models

Start Claude Code and specify which model to use:

```bash
# Use OpenAI {{openai_large}}
claude --model {{openai_large}}

# Use OpenAI {{openai_small}} for faster responses
claude --model {{openai_small}}

# Use Google Gemini
claude --model {{gemini_flash}}

# Use Vertex AI Gemini
claude --model vertex-gemini-3.8-flash

# Use Vertex AI Anthropic Claude
claude --model anthropic-vertex

# Use Azure OpenAI
claude --model azure-gpt-5.6-terra
```

### 6. Switch Models at Runtime with `/model`

Once Claude Code is running, you can switch between any of the models exposed by your LiteLLM proxy using the built-in `/model` command. By default the picker only shows Anthropic's hardcoded models, so to populate it with the models from your LiteLLM proxy you must opt in to **gateway model discovery**.

Set the following environment variable before launching Claude Code:

```bash
export CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY=1
```

On startup, Claude Code will call `GET /v1/models` against your `ANTHROPIC_BASE_URL` (your LiteLLM proxy) and add each returned model to the `/model` picker, labeled **From gateway**. Inside Claude Code, run:

```
/model
```

and select any LiteLLM-managed model (`{{openai_large}}`, `{{gemini_flash}}`, `anthropic-vertex`, etc.) to switch without restarting the session.

:::info Requirements

- Claude Code **v2.1.129** or later.
- `ANTHROPIC_BASE_URL` must point at a gateway that serves the Anthropic Messages API format. LiteLLM does this on `/v1/messages`.
- Discovery is opt-in. Without `CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY=1`, Claude Code will not query your proxy's `/v1/models` and the `/model` picker only shows the built-in Anthropic models. Verified against Claude Code v2.1.247: the picker only labels models **From gateway** once the variable is set. Like `ENABLE_TOOL_SEARCH`, you can persist it in the `env` block of `.claude/settings.json`.

:::

:::tip Surface only specific models

If you only want a subset of your LiteLLM models to show up in the `/model` picker, issue a [virtual key](../proxy/virtual_keys) scoped to those models and use that key as `ANTHROPIC_AUTH_TOKEN`. `/v1/models` will only return models the key can access.

You can also add individual model entries manually via `ANTHROPIC_CUSTOM_MODEL_OPTION` instead of (or in addition to) enabling discovery.

:::

### 7. Show a Clean Name in the Picker with `display_name`

The `/model` picker only keeps gateway models whose id contains `claude` or `anthropic`, so a non-Anthropic model needs a claude-flavored name like `kimi-k3-claude-compatible` to appear at all; the picker then shows that raw id as the label. To keep the id for routing but show a friendlier label, set `display_name` under the model's `model_info`:

```yaml
model_list:
  - model_name: kimi-k3-claude-compatible
    litellm_params:
      model: moonshot/kimi-k3
      api_key: os.environ/MOONSHOT_API_KEY
    model_info:
      display_name: Kimi K3
```

The Anthropic-shaped `GET /v1/models` response now returns `"display_name": "Kimi K3"` for that entry, so the picker lists **Kimi K3** (labeled From gateway) while every request keeps using the `kimi-k3-claude-compatible` id. Models without a `display_name` keep showing their id, and the OpenAI-shaped listing is unaffected; nothing gets duplicated in other harnesses.

### 8. Context Window Reported for a Gateway Model

Claude Code applies its own default context window to a model name it does not recognize as one of Anthropic's, and every gateway-served name falls into that category. Declaring `max_input_tokens` under a model's `model_info` changes what `GET /v1/models`, `/model/info`, and the LiteLLM UI report, and it drives the proxy's own [context-window pre-call checks](../proxy/reliability.md#context-window-fallbacks-pre-call-checks--fallbacks), but it does not change the figure the client shows or when the client compacts.

Set that side in Claude Code with `CLAUDE_CODE_AUTO_COMPACT_WINDOW`, or `autoCompactWindow` in `.claude/settings.json`; see [model configuration](https://code.claude.com/docs/en/model-config). A model whose real window is smaller than what the client assumes is the case worth checking, since the client will keep filling context the provider will then reject. Routers have the same split, covered in [Auto Router with Claude Code and Claude Desktop](./claude_code_autorouter.md#context-window-shown-in-the-client).

## How It Works

LiteLLM acts as a unified interface that:

1. **Receives requests** from Claude Code in Anthropic Messages API format
2. **Translates** the request to the target provider's format (OpenAI, Gemini, etc.)
3. **Forwards** the request to the actual provider
4. **Translates** the response back to Anthropic Messages API format
5. **Returns** the response to Claude Code

This allows you to use Claude Code's interface with any LLM provider supported by LiteLLM.

## Advanced Features

### Load Balancing and Fallbacks

Configure multiple deployments with automatic fallback:

```yaml
model_list:
  - model_name: {{openai_large}}  # virtual model name
    litellm_params:
      model: openai/{{openai_large}}
      api_key: os.environ/OPENAI_API_KEY
  
  - model_name: {{openai_large}}  # same virtual name
    litellm_params:
      model: azure/{{openai_large}}
      api_key: os.environ/AZURE_API_KEY
      api_base: os.environ/AZURE_API_BASE

router_settings:
  routing_strategy: simple-shuffle  # Load balance between deployments
  num_retries: 2
  timeout: 30
```

### Usage Tracking and Budgets

Track usage and set budgets through the LiteLLM UI:

```yaml
general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
  database_url: "postgresql://..."  # Enable database for tracking
  store_model_in_db: true
```

Start the proxy with the UI:

```bash
litellm --config /path/to/config.yaml --detailed_debug
```

Access the UI at `http://0.0.0.0:4000/ui` to:
- View usage analytics
- Set budget limits per user/key
- Monitor costs across different providers
- Create virtual keys with specific permissions


## Supported Providers

LiteLLM supports 100+ providers. Here are some popular ones for use with Claude Code:

- **OpenAI**: gpt-5.6-terra, gpt-5.6-luna, o1, o3-mini
- **Google**: Gemini 3.8 Flash, Gemini 3.1 Pro
- **Azure OpenAI**: All OpenAI models via Azure
- **AWS Bedrock**: Llama, Mistral, and other models
- **Vertex AI**: Gemini, Claude, and other models on Google Cloud
- **Groq**: Fast inference for Llama and Mixtral
- **Together AI**: Llama, Mixtral, and other open source models
- **Deepseek**: Deepseek-chat, Deepseek-coder

[View full list of supported providers →](https://docs.litellm.ai/docs/providers)
