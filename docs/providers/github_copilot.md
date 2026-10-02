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
| Supported Endpoints | `/chat/completions`, `/responses`, `/embeddings`, `/v1/messages` |
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

GPT Codex models such as `gpt-5.3-codex` only support the Responses API. Models that support both endpoints, such as `gpt-5.2`, are sent to Copilot's `/chat/completions` unless their `model_info` sets `mode: responses`

```python showLineNumbers title="GitHub Copilot Responses"
import litellm

response = await litellm.aresponses(
    model="github_copilot/gpt-5.3-codex",
    input="Write a Python hello world",
    max_output_tokens=500
)

print(response)
```

### Anthropic Messages

Claude models can be called through Copilot's native Anthropic `/v1/messages` endpoint.

```python showLineNumbers title="GitHub Copilot Anthropic Messages"
import litellm

response = await litellm.anthropic.messages.acreate(
    model="github_copilot/claude-sonnet-4.5",
    messages=[{"role": "user", "content": "Write a Python hello world"}],
    max_tokens=500,
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
  - model_name: github_copilot/gpt-5.3-codex
    model_info:
      mode: responses
    litellm_params:
      model: github_copilot/gpt-5.3-codex
  - model_name: github_copilot/claude-sonnet-4.5
    litellm_params:
      model: github_copilot/claude-sonnet-4.5
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

Responses and Anthropic Messages requests go to the proxy's `/v1/responses` and `/v1/messages` routes:

```bash showLineNumbers title="GitHub Copilot via Proxy - Responses and Messages"
curl http://localhost:4000/v1/responses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-proxy-api-key" \
  -d '{
    "model": "github_copilot/gpt-5.3-codex",
    "input": "Write a Python hello world"
  }'

curl http://localhost:4000/v1/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-proxy-api-key" \
  -d '{
    "model": "github_copilot/claude-sonnet-4.5",
    "max_tokens": 500,
    "messages": [{"role": "user", "content": "Write a Python hello world"}]
  }'
```

## Getting Started

1. Ensure you have GitHub Copilot access (paid GitHub subscription required)
2. Run your first LiteLLM request - you'll be prompted to authenticate
3. Follow the device flow authentication process
4. Start making requests to GitHub Copilot through LiteLLM

## Configuration

### Environment Variables

You can customize token storage locations:

```bash showLineNumbers title="Environment Variables"
# Optional: Custom token directory
export GITHUB_COPILOT_TOKEN_DIR="~/.config/litellm/github_copilot"

# Optional: Custom access token file name
export GITHUB_COPILOT_ACCESS_TOKEN_FILE="access-token"

# Optional: Custom API key file name
export GITHUB_COPILOT_API_KEY_FILE="api-key.json"

# Optional: Custom Copilot endpoints for authentication and usage
# (needed when using GitHub Enterprise subscriptions with custom endpoints or self-hosted GitHub servers
export GITHUB_COPILOT_API_BASE="https://copilot-api.my-company.ghe.com"
export GITHUB_COPILOT_DEVICE_CODE_URL="https://my-company.ghe.com/login/device/code"
export GITHUB_COPILOT_ACCESS_TOKEN_URL="https://my-company.ghe.com/login/oauth/access_token"
export GITHUB_COPILOT_API_KEY_URL="https://my-company.ghe.com/api/v3/copilot_internal/v2/token"

# Optional: Custom OAuth client ID for the device flow
export GITHUB_COPILOT_CLIENT_ID="Iv1.b507a08c87ecfe98"
```

### Headers

LiteLLM automatically injects the required GitHub Copilot headers (simulating VS Code Copilot Chat). You don't need to specify them manually.

If you want to override the defaults (e.g., to simulate a different editor), you can use `extra_headers`. These are the defaults LiteLLM sends on chat, responses, and embedding requests:

```python showLineNumbers title="Custom Headers (Optional)"
extra_headers = {
    "editor-version": "vscode/1.95.0",                 # Editor version
    "editor-plugin-version": "copilot-chat/0.26.7",    # Plugin version
    "copilot-integration-id": "vscode-chat",           # Integration ID
    "user-agent": "GitHubCopilotChat/0.26.7"           # User agent
}
```

