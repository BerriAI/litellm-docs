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

GitHub Copilot uses the OAuth device flow. The LiteLLM Python SDK runs it the first time it needs a token, provided it is called from a synchronous script on the main thread: it prints a verification URL and a device code, you visit the URL and enter the code, and the GitHub token is stored in `~/.config/litellm/github_copilot/access-token` for future use. Async code, notebooks, worker threads, and the LiteLLM proxy cannot answer that prompt (older releases block on it, newer ones fail with `GitHub Copilot device-code login needs a human`), so for the proxy you sign in first and mount the token, as described in [Sign in before starting the proxy](#sign-in-before-starting-the-proxy).

## Usage - LiteLLM Python SDK

### Chat Completion

```python showLineNumbers title="GitHub Copilot Chat Completion"
from litellm import completion

response = completion(
    model="github_copilot/gpt-4o",
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
    model="github_copilot/gpt-4o",
    messages=[{"role": "user", "content": "Explain async/await in Python"}],
    stream=True
)

for chunk in stream:
    if chunk.choices[0].delta.content is not None:
        print(chunk.choices[0].delta.content, end="")
```

### Responses

For GPT Codex models, only responses API is supported. This example is async, so it cannot run the first login itself: on a machine with no token yet, sign in first with the one-liner in [Sign in before starting the proxy](#sign-in-before-starting-the-proxy).

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

### Sign in before starting the proxy

The proxy cannot complete the device flow: it runs in worker processes with no terminal to hand the code to. With no `access-token` on disk, older releases print the code from a worker and hold startup on each `github_copilot/` deployment while they wait for someone to enter it (from a foreground terminal you can, once per worker, with startup held meanwhile; from a service or container log nobody can), and newer releases refuse to initialize the deployment, logging `GitHub Copilot device-code login needs a human and cannot run inside a running event loop or a worker thread` once per deployment in every worker. Either way, every request to those models then returns HTTP 400 `There are no healthy deployments for this model`. Sign in once from a terminal instead:

```bash showLineNumbers title="Sign in once, outside the proxy"
python -c "from litellm.llms.github_copilot.authenticator import Authenticator; Authenticator().get_access_token()"
```

Visit the printed URL and enter the code: each code is good for about a minute (the SDK polls twelve times, five seconds apart) and after three codes it gives up with `Failed to get access token after 3 attempts`, so have GitHub open and signed in before you run it. The GitHub token lands in `~/.config/litellm/github_copilot/access-token` (`GITHUB_COPILOT_TOKEN_DIR` and `GITHUB_COPILOT_ACCESS_TOKEN_FILE` change the location). Put that file at the same path on the proxy host, or set `GITHUB_COPILOT_TOKEN_DIR` to the directory that holds it, and only then start the proxy: `model_list` deployments are created at startup, so a proxy started without the file needs a restart after it appears. The directory must be writable by the proxy's user (uid 65534 in the `litellm-non_root` image), because LiteLLM exchanges the GitHub token for a short-lived Copilot API key and caches it next to the token as `api-key.json`; when it cannot write that file, the deployment fails at startup the same way a missing token does, with `Failed to save API key` inside the `Error creating deployment` log line.

On Kubernetes, keep `access-token` in a Secret and copy it into a writable `emptyDir` that `GITHUB_COPILOT_TOKEN_DIR` points at, since Secret volumes are read-only. The GitHub token is long-lived and holds no per-process state, so every worker in every pod shares the same one and each derives its own `api-key.json`.

```bash showLineNumbers title="Create the Secret from your local login"
kubectl create secret generic litellm-copilot-auth --from-file=access-token=$HOME/.config/litellm/github_copilot/access-token
```

```yaml showLineNumbers title="Pod spec excerpt"
spec:
  initContainers:
    - name: copilot-token
      image: busybox:1.37
      command: ["cp", "/secrets/copilot/access-token", "/tokens/copilot/access-token"]
      volumeMounts:
        - name: copilot-secret
          mountPath: /secrets/copilot
          readOnly: true
        - name: copilot-tokens
          mountPath: /tokens/copilot
  containers:
    - name: litellm
      env:
        - name: GITHUB_COPILOT_TOKEN_DIR
          value: /tokens/copilot
      volumeMounts:
        - name: copilot-tokens
          mountPath: /tokens/copilot
  volumes:
    - name: copilot-secret
      secret:
        secretName: litellm-copilot-auth
    - name: copilot-tokens
      emptyDir: {}
```

### Configure and start the proxy

Add the following to your LiteLLM Proxy configuration file:

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: github_copilot/gpt-4o
    litellm_params:
      model: github_copilot/gpt-4o
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
    model="github_copilot/gpt-4o",
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
    model="litellm_proxy/github_copilot/gpt-4o",
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
    "model": "github_copilot/gpt-4o",
    "messages": [{"role": "user", "content": "Explain this error message"}]
  }'
```

</TabItem>
</Tabs>

## Getting Started

1. Ensure you have GitHub Copilot access (paid GitHub subscription required)
2. Sign in once: a first request from a synchronous script walks you through the device flow, while the proxy needs the one-liner from [Sign in before starting the proxy](#sign-in-before-starting-the-proxy) run beforehand
3. Start making requests to GitHub Copilot through LiteLLM

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
```

### Headers

LiteLLM automatically injects the required GitHub Copilot headers (simulating VSCode). You don't need to specify them manually.

If you want to override the defaults (e.g., to simulate a different editor), you can use `extra_headers`:

```python showLineNumbers title="Custom Headers (Optional)"
extra_headers = {
    "editor-version": "vscode/1.85.1",           # Editor version
    "editor-plugin-version": "copilot/1.155.0",  # Plugin version
    "Copilot-Integration-Id": "vscode-chat",     # Integration ID
    "user-agent": "GithubCopilot/1.155.0"        # User agent
}
```

