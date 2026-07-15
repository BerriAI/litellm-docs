import Image from '@theme/IdealImage';
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# OpenAI Codex

This guide walks you through connecting OpenAI Codex to LiteLLM. Using LiteLLM with Codex allows teams to:
- Access 100+ LLMs through the Codex interface
- Use powerful models like Gemini through a familiar interface
- Track spend and usage with LiteLLM's built-in analytics
- Control model access with virtual keys

<Image img={require('../../img/litellm_codex.gif')} />

## Quickstart

:::info

Requires LiteLLM v1.66.3.dev5 and higher

:::


Make sure to set up LiteLLM with the [LiteLLM Getting Started Guide](../proxy/docker_quick_start.md).

## 1. Install OpenAI Codex

Install the OpenAI Codex CLI tool globally using npm:

<Tabs>
<TabItem value="npm" label="npm">

```bash showLineNumbers
npm i -g @openai/codex
```

</TabItem>
<TabItem value="yarn" label="yarn">

```bash showLineNumbers
yarn global add @openai/codex
```

</TabItem>
</Tabs>

## 2. Start LiteLLM Proxy

<Tabs>
<TabItem value="docker" label="Docker">

```bash showLineNumbers
docker run \
    -v $(pwd)/litellm_config.yaml:/app/config.yaml \
    -p 4000:4000 \
    docker.litellm.ai/berriai/litellm:latest \
    --config /app/config.yaml
```

</TabItem>
<TabItem value="pip" label="LiteLLM CLI">

```bash showLineNumbers
litellm --config /path/to/config.yaml
```

</TabItem>
</Tabs>

LiteLLM should now be running on [http://localhost:4000](http://localhost:4000)

## 3. Configure LiteLLM for Model Routing

Ensure your LiteLLM Proxy is properly configured to route to your desired models. Create a `litellm_config.yaml` file with the following content:

```yaml showLineNumbers
model_list:
  - model_name: o3-mini
    litellm_params:
      model: openai/o3-mini
      api_key: os.environ/OPENAI_API_KEY
  - model_name: claude-3-7-sonnet-latest
    litellm_params:
      model: anthropic/claude-3-7-sonnet-latest
      api_key: os.environ/ANTHROPIC_API_KEY
  - model_name: gemini-2.0-flash
    litellm_params:
      model: gemini/gemini-2.0-flash
      api_key: os.environ/GEMINI_API_KEY

litellm_settings:
  drop_params: true
```

This configuration enables routing to specific OpenAI, Anthropic, and Gemini models with explicit names.

## 4. Configure Codex to Use LiteLLM Proxy

Codex reads its configuration from `~/.codex/config.toml`. Register your LiteLLM proxy as a custom model provider and point Codex at it by adding a `[model_providers.<name>]` block. Replace the placeholder base URL and bearer token with your own proxy URL and virtual key.

```toml showLineNumbers title="~/.codex/config.toml"
model_provider = "litellm"
model = "openai/gpt-4o"

[model_providers.litellm]
name = "LiteLLM Proxy"
base_url = "https://your-litellm-proxy.com/v1"
wire_api = "responses"
experimental_bearer_token = "your-litellm-api-key"
http_headers = { "x-litellm-tags" = "codex-cli" }
```

Here `model_provider` selects the provider block Codex should use, `model` is the model name as configured in your LiteLLM `model_list`, and `base_url` is the `/v1` endpoint of your proxy. The `experimental_bearer_token` is sent as the `Authorization: Bearer` header, so set it to your LiteLLM virtual key. The optional `http_headers` table lets you attach extra headers on every request; the example above tags traffic with `x-litellm-tags` so you can filter Codex usage in LiteLLM analytics.

:::warning Two common gotchas

`wire_api` must be set to `responses`. Codex removed support for the `chat` value in a recent release, so a provider block using `wire_api = "chat"` will fail.

`openai` is a reserved built-in provider ID and cannot be used as the key in `[model_providers.<name>]`. Use a distinct name such as `litellm` or `openai-litellm` instead, and set `model_provider` to match.

:::

## 5. Run Codex

With the provider configured as the default, start Codex and it routes through your LiteLLM proxy automatically:

```bash showLineNumbers
codex --full-auto
```

<Image img={require('../../img/litellm_codex.gif')} />

The `--full-auto` flag allows Codex to automatically generate code without additional prompting.

## 6. Advanced Options

### Using Different Models

Any model in your LiteLLM `model_list` can be used with Codex. Switch models per run with the `--model` flag, or change the `model` value in `config.toml` to set a new default:

```bash
# Use a Claude model routed through LiteLLM
codex --model claude-3-7-sonnet-latest

# Use a Gemini model routed through LiteLLM
codex --model gemini-2.0-flash
```

### Codex Mac App

The Codex Mac app reads the same `~/.codex/config.toml` file as the CLI, so the provider block above works unchanged. Configure the file once and both the CLI and the Mac app route through your LiteLLM proxy.

## Troubleshooting

- If you encounter connection issues, ensure your LiteLLM Proxy is running and accessible at the specified URL
- Verify your LiteLLM API key is valid if you're using authentication
- Check that your model routing configuration is correct
- For model-specific errors, ensure the model is properly configured in your LiteLLM setup

## Additional Resources

- [LiteLLM Docker Quick Start Guide](../proxy/docker_quick_start.md)
- [OpenAI Codex GitHub Repository](https://github.com/openai/codex)
- [LiteLLM Virtual Keys and Authentication](../proxy/virtual_keys.md)
