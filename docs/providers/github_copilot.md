import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# GitHub Copilot

https://docs.github.com/en/copilot

:::tip

**We support GitHub Copilot Chat API with automatic authentication handling**

:::

| Property | Details |
|-------|-------|
| Description | GitHub Copilot Chat API provides access to GitHub's AI-powered coding assistant. |
| Provider Route on LiteLLM | `github_copilot/` |
| Supported Endpoints | `/chat/completions`, `/embeddings` |
| API Reference | [GitHub Copilot docs](https://docs.github.com/en/copilot) |

## Authentication

GitHub Copilot uses OAuth device flow for authentication. On first use, you'll be prompted to authenticate via GitHub:

1. LiteLLM will display a device code and verification URL
2. Visit the URL and enter the code to authenticate
3. Your credentials will be stored locally for future use

## Usage - LiteLLM Python SDK

### Chat Completion

```python showLineNumbers title="GitHub Copilot Chat Completion"
from litellm import completion

response = completion(
    model="github_copilot/gpt-5.2",
    messages=[
        {"role": "system", "content": "You are a helpful coding assistant"},
        {"role": "user", "content": "Write a Python function to calculate fibonacci numbers"}
    ]
)
print(response)
```

```python showLineNumbers title="GitHub Copilot Chat Completion - Streaming"
from litellm import completion

stream = completion(
    model="github_copilot/gpt-5.2",
    messages=[{"role": "user", "content": "Explain async/await in Python"}],
    stream=True
)

for chunk in stream:
    if chunk.choices[0].delta.content is not None:
        print(chunk.choices[0].delta.content, end="")
```

### Responses

For GPT Codex models, only responses API is supported.

```python showLineNumbers title="GitHub Copilot Responses"
import litellm

response = await litellm.aresponses(
    model="github_copilot/gpt-5.1-codex",
    input="Write a Python hello world",
    max_output_tokens=500
)

print(response)
```

### Embedding

```python showLineNumbers title="GitHub Copilot Embedding"
import litellm

response = litellm.embedding(
    model="github_copilot/text-embedding-3-small",
    input=["good morning from litellm"]
)
print(response)
```

## Usage - LiteLLM Proxy

Add the following to your LiteLLM Proxy configuration file:

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: github_copilot/gpt-5.2
    litellm_params:
      model: github_copilot/gpt-5.2
  - model_name: github_copilot/gpt-5.1-codex
    model_info:
      mode: responses
    litellm_params:
      model: github_copilot/gpt-5.1-codex
  - model_name: github_copilot/text-embedding-ada-002
    model_info:
      mode: embedding
    litellm_params:
      model: github_copilot/text-embedding-ada-002
```

Start your LiteLLM Proxy server:

```bash showLineNumbers title="Start LiteLLM Proxy"
litellm --config config.yaml

# RUNNING on http://0.0.0.0:4000
```

<Tabs>
<TabItem value="openai-sdk" label="OpenAI SDK">

```python showLineNumbers title="GitHub Copilot via Proxy - Non-streaming"
from openai import OpenAI

# Initialize client with your proxy URL
client = OpenAI(
    base_url="http://localhost:4000",  # Your proxy URL
    api_key="your-proxy-api-key"       # Your proxy API key
)

# Non-streaming response
response = client.chat.completions.create(
    model="github_copilot/gpt-5.2",
    messages=[{"role": "user", "content": "How do I optimize this SQL query?"}]
)

print(response.choices[0].message.content)
```

</TabItem>

<TabItem value="litellm-sdk" label="LiteLLM SDK">

```python showLineNumbers title="GitHub Copilot via Proxy - LiteLLM SDK"
import litellm

# Configure LiteLLM to use your proxy
response = litellm.completion(
    model="litellm_proxy/github_copilot/gpt-5.2",
    messages=[{"role": "user", "content": "Review this code for bugs"}],
    api_base="http://localhost:4000",
    api_key="your-proxy-api-key"
)

print(response.choices[0].message.content)
```

</TabItem>

<TabItem value="curl" label="cURL">

```bash showLineNumbers title="GitHub Copilot via Proxy - cURL"
curl http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-proxy-api-key" \
  -d '{
    "model": "github_copilot/gpt-5.2",
    "messages": [{"role": "user", "content": "Explain this error message"}]
  }'
```

</TabItem>
</Tabs>

## Getting Started

1. Ensure you have GitHub Copilot access (paid GitHub subscription required)
2. Run your first LiteLLM request - you'll be prompted to authenticate
3. Follow the device flow authentication process
4. Start making requests to GitHub Copilot through LiteLLM

## Configuration

### Environment Variables

LiteLLM uses GitHub's OAuth device flow and sends the resulting access token directly to the trusted GitHub Copilot API base. Header and endpoint settings are read from the environment when each request is built

| Variable | Default | Purpose |
|---|---|---|
| `GITHUB_COPILOT_CLIENT_ID` | `Iv1.b507a08c87ecfe98` | OAuth application client ID |
| `GITHUB_COPILOT_INTEGRATION_ID` | `vscode-chat` | `copilot-integration-id` header |
| `GITHUB_COPILOT_EDITOR_VERSION` | `vscode/1.115.0` | `editor-version` header |
| `GITHUB_COPILOT_EDITOR_PLUGIN_VERSION` | `copilot-chat/0.44.0` | `editor-plugin-version` header |
| `GITHUB_COPILOT_USER_AGENT` | `GitHubCopilotChat/0.44.0` | `user-agent` header |
| `GITHUB_COPILOT_ACCEPT` | `application/json` | `accept` header |
| `GITHUB_COPILOT_CONTENT_TYPE` | `application/json` | `content-type` header |
| `GITHUB_COPILOT_API_VERSION` | Not set | Optional `x-github-api-version` header |
| `GITHUB_COPILOT_OPENAI_INTENT` | Not set | Optional `openai-intent` header |
| `GITHUB_COPILOT_USER_AGENT_LIBRARY_VERSION` | Not set | Optional `x-vscode-user-agent-library-version` header |

Set a header environment variable to an empty string to omit that header. Request-level `extra_headers` take precedence for model requests. OAuth requests use the configured accept, content type, integration, editor, plugin, and user-agent values. API version, intent, and user-agent library version apply only to model requests

The token storage and endpoint settings are also configurable

```bash showLineNumbers title="Environment Variables"
export GITHUB_COPILOT_TOKEN_DIR="~/.config/litellm/github_copilot"
export GITHUB_COPILOT_ACCESS_TOKEN_FILE="access-token"
export GITHUB_COPILOT_API_BASE="https://copilot-api.company.ghe.com"
export GITHUB_COPILOT_DEVICE_CODE_URL="https://company.ghe.com/login/device/code"
export GITHUB_COPILOT_ACCESS_TOKEN_URL="https://company.ghe.com/login/oauth/access_token"
```

Existing `access-token` files are reused without reauthentication. Legacy `api-key.json`, `GITHUB_COPILOT_API_KEY_FILE`, and `GITHUB_COPILOT_API_KEY_URL` are no longer used. `GITHUB_COPILOT_API_BASE` and deployment-level API bases remain explicit operator-controlled endpoint settings. They must use HTTPS without embedded credentials, query parameters, or fragments
For the proxy, put the same values in the `environment_variables` block

```yaml showLineNumbers title="config.yaml"
environment_variables:
  GITHUB_COPILOT_CLIENT_ID: "your-oauth-client-id"
  GITHUB_COPILOT_INTEGRATION_ID: "your-integration-id"
  GITHUB_COPILOT_EDITOR_VERSION: "your-editor/1.0.0"
  GITHUB_COPILOT_EDITOR_PLUGIN_VERSION: "your-plugin/1.0.0"
  GITHUB_COPILOT_USER_AGENT: "YourClient/1.0.0"
```

OAuth applications use the same direct OAuth access-token flow and can provide their own client identity. For example, these values match OpenCode's OAuth behavior

```yaml showLineNumbers title="Custom OAuth Application"
environment_variables:
  GITHUB_COPILOT_CLIENT_ID: "Ov23li8tweQw6odWQebz"
  GITHUB_COPILOT_USER_AGENT: "opencode/<installed-version>"
  GITHUB_COPILOT_INTEGRATION_ID: ""
  GITHUB_COPILOT_EDITOR_VERSION: ""
  GITHUB_COPILOT_EDITOR_PLUGIN_VERSION: ""
  GITHUB_COPILOT_API_VERSION: "2026-06-01"
  GITHUB_COPILOT_OPENAI_INTENT: "conversation-edits"
```

### Request Headers

Use `extra_headers` when a single model request needs additional headers or must override the environment defaults

```python showLineNumbers title="Custom Request Headers"
response = completion(
    model="github_copilot/gpt-4",
    messages=[{"role": "user", "content": "Hello"}],
    extra_headers={"editor-version": "custom-editor/2.0.0"},
)
```

