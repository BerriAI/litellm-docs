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


Make sure to set up LiteLLM with the [LiteLLM Quickstart](../proxy/docker_quick_start.md).

## 1. Install OpenAI Codex

Install the OpenAI Codex CLI tool globally using npm:

<Tabs>
<TabItem value="curl" label="curl">

```bash showLineNumbers
curl -fsSL https://chatgpt.com/codex/install.sh | sh
```

</TabItem>
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
  - model_name: gpt-5.3-codex
    litellm_params:
      model: openai/gpt-5.3-codex
      api_key: os.environ/OPENAI_API_KEY
  - model_name: {{anthropic}}
    litellm_params:
      model: anthropic/{{anthropic}}
      api_key: os.environ/ANTHROPIC_API_KEY
  - model_name: {{gemini_flash}}
    litellm_params:
      model: gemini/{{gemini_flash}}
      api_key: os.environ/GEMINI_API_KEY
  - model_name: {{openai_small}}
    litellm_params:
      model: openai/{{openai_small}}
      api_key: os.environ/OPENAI_API_KEY
  - model_name: gpt-5.6-sol
    litellm_params:
      model: openai/gpt-5.6-sol
      api_key: os.environ/OPENAI_API_KEY
  - model_name: {{openai_large}}
    litellm_params:
      model: openai/{{openai_large}}
      api_key: os.environ/OPENAI_API_KEY

litellm_settings:
  drop_params: true
```

This configuration enables routing to specific OpenAI, Anthropic, and Gemini models with explicit names.

## 4. Configure Codex to Use LiteLLM Proxy

Set the required environment variables to point Codex to your LiteLLM Proxy:

```bash
# Use your LiteLLM API key (if you've set up authentication)
export LITELLM_API_KEY="sk-1234"
```

You can also configure Codex directly via `~/.codex/config.toml`:

```toml showLineNumbers
model = "{{openai_large}}"
model_provider = "litellm"
model_reasoning_effort = "medium"
approvals_reviewer = "user"

[model_providers.litellm]
name = "litellm"
base_url = "http://localhost:4000/v1"
env_key = "LITELLM_API_KEY"
wire_api = "responses"
stream_idle_timeout_ms = 7200000
stream_max_retries = 5
request_max_retries = 4

[projects."/path/to/your/project"]
trust_level = "trusted"

[tui.model_availability_nux]
"{{openai_large}}" = 1
```

## 5. Run Codex

With everything configured, you can now run Codex:

```bash showLineNumbers
codex
```

<Image img={require('../../img/litellm_codex.gif')} />

## 6. Using the Codex Desktop App

The Codex desktop app reads the same `~/.codex/config.toml` as the CLI, so the configuration from step 4 works for the app with no extra LiteLLM setup. Set `model` and `model_provider` as shown above, then start the app and open a new session; requests are routed through your LiteLLM proxy.

Two caveats specific to the app:

**API key visibility.** The app resolves `env_key` from its own environment. On macOS, apps launched from Finder or the Dock do not inherit variables exported in your shell profile, so `LITELLM_API_KEY` can be missing even though `codex` works fine in your terminal. Either launch the app from a terminal or set the variable at the login session level and restart the app:

```bash showLineNumbers
launchctl setenv LITELLM_API_KEY sk-1234
```

**Model selection.** With a custom provider there is no UI for changing the model of a session in the app (see [openai/codex#15364](https://github.com/openai/codex/issues/15364)). A session uses whatever `model` was set in `config.toml` when the session was created. To use a different LiteLLM model, update `model` in `config.toml` and start a new session.

## 7. Advanced Options

### Using Different Models

You can use any model configured in your LiteLLM proxy:

```bash
# Use Claude models
codex --model {{anthropic}}

# Use Google AI Studio Gemini models
codex --model gemini/{{gemini_flash}}
```

## Troubleshooting

- If you encounter connection issues, ensure your LiteLLM Proxy is running and accessible at the specified URL
- Verify your LiteLLM API key is valid if you're using authentication
- Check that your model routing configuration is correct
- For model-specific errors, ensure the model is properly configured in your LiteLLM setup

## Additional Resources

- [LiteLLM Quickstart](../proxy/docker_quick_start.md)
- [OpenAI Codex GitHub Repository](https://github.com/openai/codex)
- [LiteLLM Virtual Keys and Authentication](../proxy/virtual_keys.md)
