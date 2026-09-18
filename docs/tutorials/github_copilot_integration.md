---
sidebar_label: "GitHub Copilot / VS Code"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# GitHub Copilot / VS Code

This tutorial shows two ways to use LiteLLM Proxy from VS Code's chat. The [LiteLLM extension](#option-1-litellm-extension-for-vs-code) adds your gateway as a language model provider, so the chat model picker lists the models your key can reach, with each model's price and a reasoning effort control. The [Copilot proxy override](#option-2-route-github-copilot-through-litellm) instead points GitHub Copilot's own traffic at the proxy.

:::info

The proxy override section is based on [Sergio Pino's guide](https://dev.to/spino327/calling-github-copilot-models-from-openhands-using-litellm-proxy-1hl4) for calling GitHub Copilot models through LiteLLM Proxy.

:::

## Benefits of using VS Code chat with LiteLLM

When you use VS Code chat with LiteLLM you get the following benefits:

**Developer Benefits:**
- Universal Model Access: Use any LiteLLM supported model (Anthropic, OpenAI, Vertex AI, Bedrock, etc.) from the VS Code chat model picker.
- Higher Rate Limits & Reliability: Load balance across multiple models and providers to avoid hitting individual provider limits, with fallbacks to ensure you get responses even if one provider fails.

**Proxy Admin Benefits:**
- Centralized Management: Control access to all models through a single LiteLLM proxy instance without giving your developers API Keys to each provider.
- Budget Controls: Set spending limits and track costs across all VS Code usage.

## Prerequisites

Before you begin, ensure you have:
- A running LiteLLM Proxy instance
- A valid LiteLLM Proxy API key
- VS Code 1.115 or newer with the GitHub Copilot Chat extension (the chat view and model picker come from it)

## Option 1: LiteLLM extension for VS Code

The extension lives in the LiteLLM repository under [`vscode-extension/`](https://github.com/BerriAI/litellm/tree/main/vscode-extension). It reads the gateway's `GET /model_group/info` for the key you configure, so the picker shows exactly the chat models that key can use, each with its input and output price per 1M tokens. Models whose gateway entry lists `supported_reasoning_efforts` get a Reasoning Effort menu in the chat toolbar, and the effort you pick is sent as `reasoning_effort` on every request to that model. Requests go to `POST /v1/chat/completions` as streaming chat completions with tools and images passed through, so routing, fallbacks, guardrails, and spend tracking all apply as usual.

### Step 1: Build and install the extension

```bash
git clone https://github.com/BerriAI/litellm.git
cd litellm/vscode-extension
npm ci
npm run package
code --install-extension litellm-vscode-0.1.0.vsix
```

Every push to `main` that touches the extension also builds a `litellm-vscode` artifact on the [VS Code Extension workflow](https://github.com/BerriAI/litellm/actions/workflows/test-vscode-extension.yml), which you can download and install the same way.

### Step 2: Connect to your gateway

1. Run `Chat: Manage Language Models` from the Command Palette and pick `LiteLLM`
2. Enter a name for the connection, the gateway URL (for example `https://litellm.example.com`), and a LiteLLM virtual key. The key is stored in VS Code's secret storage

The Language Models editor now lists the chat models that key can reach under the name you chose. Add `LiteLLM` again with another name to reach a second gateway or a second key.

### Step 3: Pick a model and its reasoning effort

Open the chat view and click the model name in the toolbar. The gateway's models are listed with their price per 1M tokens, and hovering a model shows its context limits and the reasoning efforts it supports. After picking a model that supports reasoning efforts, the toolbar shows a Reasoning Effort control whose choices are the efforts the gateway reports for that model plus `Gateway default`, which sends no `reasoning_effort` and lets the proxy's own default apply.

### Keeping the list current

Run `LiteLLM: Refresh Models` after the gateway's model list or pricing changes. To rotate the key of a connection, use the gear on its row in the Language Models editor and pick `Update API Key`; `Delete` removes the connection, and `Open in Language Models (JSON)` opens the entry to change its URL. If the stored key is ever lost, the editor shows a `missing its API key` row for that connection until you update the key.

## Option 2: Route GitHub Copilot through LiteLLM

This route keeps GitHub Copilot's own model picker and sends Copilot's traffic through the proxy instead. It needs a GitHub Copilot subscription (Individual, Business, or Enterprise) on top of the prerequisites above.

### Step 1: Install LiteLLM

Install LiteLLM with proxy support:

```bash
uv tool install litellm[proxy]
```

### Step 2: Configure LiteLLM Proxy

Create a `config.yaml` file with your model configurations:

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: {{openai_large}}
    litellm_params:
      model: {{openai_large}}
      api_key: os.environ/OPENAI_API_KEY
  
  - model_name: {{anthropic}}
    litellm_params:
      model: anthropic/{{anthropic}}
      api_key: os.environ/ANTHROPIC_API_KEY

general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
```

### Step 3: Start LiteLLM Proxy

Start the proxy server:

```bash
litellm --config config.yaml --port 4000
```

### Step 4: Configure GitHub Copilot

Configure GitHub Copilot to use your LiteLLM proxy. Add the following to your VS Code `settings.json`:

```json
{
  "github.copilot.advanced": {
    "debug.overrideProxyUrl": "http://localhost:4000",
    "debug.testOverrideProxyUrl": "http://localhost:4000"
  }
}
```

### Step 5: Test the Integration

Restart VS Code and test GitHub Copilot. Your requests will now be routed through LiteLLM Proxy, giving you access to LiteLLM's features like:
- Request/response logging
- Rate limiting
- Cost tracking
- Model routing and fallbacks

## Advanced

### Use Anthropic, OpenAI, Bedrock, etc. models from VS Code

Both options route to whatever the proxy config lists, so you can reach any provider by configuring different models in your LiteLLM Proxy config:

<Tabs>
<TabItem value="anthropic" label="Anthropic">

Route requests to Claude Sonnet:

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: {{anthropic}}
    litellm_params:
      model: anthropic/{{anthropic}}
      api_key: os.environ/ANTHROPIC_API_KEY

general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
```

</TabItem>
<TabItem value="openai" label="OpenAI">

Route requests to `{{openai_large}}`:

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: {{openai_large}}
    litellm_params:
      model: {{openai_large}}
      api_key: os.environ/OPENAI_API_KEY

general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
```

</TabItem>
<TabItem value="bedrock" label="Bedrock">

Route requests to Claude on Bedrock:

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: bedrock-claude
    litellm_params:
      model: bedrock/us.anthropic.{{anthropic}}
      aws_access_key_id: os.environ/AWS_ACCESS_KEY_ID
      aws_secret_access_key: os.environ/AWS_SECRET_ACCESS_KEY
      aws_region_name: us-east-1

general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
```

</TabItem>
<TabItem value="multi-provider" label="Multi-Provider Load Balancing">

All deployments with the same model_name will be load balanced. In this example we load balance between OpenAI and Anthropic:

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: {{openai_large}}
    litellm_params:
      model: {{openai_large}}
      api_key: os.environ/OPENAI_API_KEY
  - model_name: {{openai_large}}  # Same model name for load balancing
    litellm_params:
      model: anthropic/{{anthropic}}
      api_key: os.environ/ANTHROPIC_API_KEY

router_settings:
  routing_strategy: simple-shuffle

general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
```

</TabItem>
</Tabs>

With this configuration, VS Code chat requests are routed through LiteLLM to your configured provider(s) with load balancing and fallbacks.

## Troubleshooting

If you encounter issues:

1. **No LiteLLM models in the picker**: the picker only lists model groups whose mode is `chat` and that the configured key can access; check `GET /model_group/info` with that key, then run `LiteLLM: Refresh Models`. A window in Restricted Mode shows "Models unavailable" until you trust the workspace
2. **`missing its API key` row in the Language Models editor**: the stored key was lost; use the gear on the connection's row and pick `Update API Key`
3. **GitHub Copilot not using proxy**: Verify the proxy URL is correctly configured in VS Code settings and that LiteLLM proxy is running
4. **Authentication errors**: Ensure your master key is valid and API keys for providers are correctly set
5. **Connection errors**: Check that your LiteLLM Proxy is accessible at `http://localhost:4000`

## Credits

The proxy override route is based on the work by [Sergio Pino](https://dev.to/spino327) from his original article: [Calling GitHub Copilot models from OpenHands using LiteLLM Proxy](https://dev.to/spino327/calling-github-copilot-models-from-openhands-using-litellm-proxy-1hl4). Thank you for the foundational work! 
