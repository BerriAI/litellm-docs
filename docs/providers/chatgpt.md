# ChatGPT Subscription

Use ChatGPT Pro/Max subscription models through LiteLLM with OAuth device flow authentication.

| Property | Details |
|-------|-------|
| Description | ChatGPT subscription access (Codex + GPT-5.3/5.4 family) via ChatGPT backend API |
| Provider Route on LiteLLM | `chatgpt/` |
| Supported Endpoints | `/responses`, `/chat/completions` (bridged to Responses for supported models) |
| API Reference | https://chatgpt.com |

ChatGPT subscription access is native to the Responses API. Chat Completions requests are bridged to Responses for supported models (for example `chatgpt/gpt-5.4`).

Notes:
- The ChatGPT subscription backend rejects token limit fields (`max_tokens`, `max_output_tokens`, `max_completion_tokens`) and `metadata`. LiteLLM strips these fields for this provider.
- `/v1/chat/completions` honors `stream`. When `stream` is false (default), LiteLLM aggregates the Responses stream into a single JSON response.

## Authentication

ChatGPT subscription access uses an OAuth device code flow. The LiteLLM Python SDK runs it the first time it needs a token, provided it is called from a synchronous script on the main thread: it prints a verification URL and a device code, you open the URL, sign in, and enter the code, and the tokens are stored in `~/.config/litellm/chatgpt/auth.json` for reuse. Async code, notebooks, worker threads, and the LiteLLM proxy cannot answer that prompt and fail with `ChatGPT device-code login needs a human` instead, so for the proxy you sign in first and mount the resulting file, as described in [Sign in before starting the proxy](#sign-in-before-starting-the-proxy).

## Usage - LiteLLM Python SDK

### Responses (recommended for Codex models)

```python showLineNumbers title="ChatGPT Responses"
import litellm

response = litellm.responses(
    model="chatgpt/gpt-5.3-codex",
    input="Write a Python hello world"
)

print(response)
```

### Chat Completions (bridged to Responses)

```python showLineNumbers title="ChatGPT Chat Completions"
import litellm

response = litellm.completion(
    model="chatgpt/gpt-5.4",
    messages=[{"role": "user", "content": "Write a Python hello world"}]
)

print(response)
```

## Usage - LiteLLM Proxy

### Sign in before starting the proxy

The proxy never runs the device code flow. It looks for a token while it creates each `chatgpt/` deployment at startup, and with no `auth.json` on disk every one of them fails to initialize (the startup log shows `ChatGPT device-code login needs a human and cannot run inside a running event loop or a worker thread` for each, in every worker), after which every request to those models returns HTTP 400 `There are no healthy deployments for this model`. Sign in once from a terminal on the machine or in the image you build the proxy from:

```bash showLineNumbers title="Sign in once, outside the proxy"
python -c "from litellm.llms.chatgpt.authenticator import Authenticator; Authenticator().get_access_token()"
```

Open the printed URL, sign in, and enter the code. The tokens land in `~/.config/litellm/chatgpt/auth.json` (`CHATGPT_TOKEN_DIR` and `CHATGPT_AUTH_FILE` change the location). Put that file at the same path on the proxy host, or set `CHATGPT_TOKEN_DIR` to the directory that holds it, and only then start the proxy: a proxy started without the file needs a restart after it appears. The access token lasts about ten days and the proxy refreshes it on its own, writing the refreshed tokens back into `auth.json`, so the file must be writable; a read-only copy logs `Failed to write ChatGPT auth file` on every refresh.

On Kubernetes, keep `auth.json` in a Secret and copy it into a writable `emptyDir` that `CHATGPT_TOKEN_DIR` points at, since Secret volumes are read-only. Every worker in every pod reads the same login, so you sign in once for the whole deployment.

```bash showLineNumbers title="Create the Secret from your local login"
kubectl create secret generic litellm-chatgpt-auth --from-file=auth.json=$HOME/.config/litellm/chatgpt/auth.json
```

```yaml showLineNumbers title="Pod spec excerpt"
spec:
  initContainers:
    - name: chatgpt-token
      image: busybox
      command: ["cp", "/secrets/chatgpt/auth.json", "/tokens/chatgpt/auth.json"]
      volumeMounts:
        - name: chatgpt-secret
          mountPath: /secrets/chatgpt
          readOnly: true
        - name: chatgpt-tokens
          mountPath: /tokens/chatgpt
  containers:
    - name: litellm
      env:
        - name: CHATGPT_TOKEN_DIR
          value: /tokens/chatgpt
      volumeMounts:
        - name: chatgpt-tokens
          mountPath: /tokens/chatgpt
  volumes:
    - name: chatgpt-secret
      secret:
        secretName: litellm-chatgpt-auth
    - name: chatgpt-tokens
      emptyDir: {}
```

### Configure and start the proxy

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: chatgpt/gpt-5.4
    model_info:
      mode: responses
    litellm_params:
      model: chatgpt/gpt-5.4
  - model_name: chatgpt/gpt-5.4-pro
    model_info:
      mode: responses
    litellm_params:
      model: chatgpt/gpt-5.4-pro
  - model_name: chatgpt/gpt-5.3-codex
    model_info:
      mode: responses
    litellm_params:
      model: chatgpt/gpt-5.3-codex
  - model_name: chatgpt/gpt-5.3-codex-spark
    model_info:
      mode: responses
    litellm_params:
      model: chatgpt/gpt-5.3-codex-spark
  - model_name: chatgpt/gpt-5.3-instant
    model_info:
      mode: responses
    litellm_params:
      model: chatgpt/gpt-5.3-instant
  - model_name: chatgpt/gpt-5.3-chat-latest
    model_info:
      mode: responses
    litellm_params:
      model: chatgpt/gpt-5.3-chat-latest
```

```bash showLineNumbers title="Start LiteLLM Proxy"
litellm --config config.yaml
```

## Configuration

### Environment Variables

- `CHATGPT_TOKEN_DIR`: Custom token storage directory (default: `~/.config/litellm/chatgpt`)
- `CHATGPT_AUTH_FILE`: Auth file name (default: `auth.json`)
- `CHATGPT_API_BASE`: Override API base (default: `https://chatgpt.com/backend-api/codex`)
- `OPENAI_CHATGPT_API_BASE`: Alias for `CHATGPT_API_BASE`
- `CHATGPT_ORIGINATOR`: Override the `originator` header value
- `CHATGPT_USER_AGENT`: Override the `User-Agent` header value
- `CHATGPT_USER_AGENT_SUFFIX`: Optional suffix appended to the `User-Agent` header
