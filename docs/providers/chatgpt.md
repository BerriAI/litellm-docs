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

ChatGPT subscription access uses an OAuth device code flow. The LiteLLM Python SDK runs it the first time it needs a token, provided it is called from a synchronous script on the main thread: it prints a verification URL and a device code, you open the URL, sign in, and enter the code, and the tokens are stored in `~/.config/litellm/chatgpt/auth.json` for reuse. Async code, notebooks, worker threads, and the LiteLLM proxy cannot answer that prompt (older releases block on it, newer ones fail with `ChatGPT device-code login needs a human`), so for the proxy you sign in first and mount the resulting file, as described in [Sign in before starting the proxy](#sign-in-before-starting-the-proxy).

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

The proxy cannot complete the device code flow: it runs in worker processes with no terminal to hand the code to. With no `auth.json` on disk, older releases print the code from a worker and hold startup on each `chatgpt/` deployment while they wait for someone to enter it (from a foreground terminal you can, once per worker, with startup held meanwhile; from a service or container log nobody can), and newer releases refuse to initialize the deployment, logging `ChatGPT device-code login needs a human and cannot run inside a running event loop or a worker thread` once per deployment in every worker. Either way, every request to those models then returns HTTP 400 `There are no healthy deployments for this model`. Sign in once from a terminal instead:

```bash showLineNumbers title="Sign in once, outside the proxy"
python -c "from litellm.llms.chatgpt.authenticator import Authenticator; Authenticator().get_access_token()"
```

Open the printed URL, sign in, and enter the code. The tokens land in `~/.config/litellm/chatgpt/auth.json` (`CHATGPT_TOKEN_DIR` and `CHATGPT_AUTH_FILE` change the location); a second run within five minutes of an abandoned attempt waits out the rest of that window before it prints a new code. Put the file at the same path on the proxy host, or set `CHATGPT_TOKEN_DIR` to the directory that holds it (the `litellm-non_root` image runs as uid 65534, so a file you bind-mount into it must be owned or writable by that uid, `chown 65534 auth.json`, or the first refresh fails with the write error below), and only then start the proxy: `model_list` deployments are created at startup, so a proxy started without the file needs a restart after it appears.

The access token lasts about ten days. When it expires, the proxy trades the refresh token for a new pair and writes it back into `auth.json`, and each refresh token works only once, so the file must be writable: a read-only copy logs `Failed to write ChatGPT auth file` and stops working at the first refresh. For the same reason every proxy process has to share one copy of the file. The proxy re-reads it on every request, so whichever worker or pod refreshes first serves the rest, while separate copies diverge at the first refresh and all but one of them stop working until you sign in again. Two workers that hit the expiry at the same moment both try the same refresh token, and the loser logs `ChatGPT refresh token failed, re-login required`: newer releases fail that one request and pick up the new pair on the next one, older releases block that worker in the device-code poll for up to fifteen minutes first.

On Kubernetes, give the proxy one writable copy of the file that survives restarts and is shared by every replica: a PersistentVolumeClaim (`ReadWriteMany` for more than one replica) mounted at `CHATGPT_TOKEN_DIR`, seeded from a Secret by an init container the first time the volume is empty. `ReadWriteMany` needs a storage class that supports it (Filestore on GKE, EFS on EKS, Azure Files on AKS); the default disk classes are `ReadWriteOnce` only, and a claim on one of those stays Pending with every replica stuck in ContainerCreating. With only such a class, run one replica or pin all replicas to one node, where a `ReadWriteOnce` volume is still shared by every pod on it. A Secret volume is read-only, and a per-pod `emptyDir` is re-seeded from the original login on every restart, so both break at the first refresh. The proxy rewrites the file in place rather than atomically, so a replica that reads it in the middle of another replica's write logs `Invalid ChatGPT auth file` and behaves as if it had no login at all: at startup that drops the deployment and the replica needs a restart, on a request the next request re-reads the file. The `chown` hands the file to the user the official `litellm-non_root` image runs as (65534); the root image needs no chown, and a custom image uses its own uid. Under a restricted pod security policy, where the init container cannot run as root, set `fsGroup: 65534` on the pod so the volume is group-writable, run the init container as `runAsUser: 65534`, and drop the `chown`. The init container copies only into an empty volume, so after a re-login update the Secret and delete `auth.json` from the volume (`kubectl exec <pod> -c litellm -- rm /tokens/chatgpt/auth.json`) before restarting the pods, or they keep the stale file and log `ChatGPT refresh token failed, re-login required`.

```bash showLineNumbers title="Create the Secret from your local login"
kubectl create secret generic litellm-chatgpt-auth --from-file=auth.json=$HOME/.config/litellm/chatgpt/auth.json
```

```yaml showLineNumbers title="Shared token volume"
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: litellm-chatgpt-tokens
spec:
  accessModes: ["ReadWriteMany"]
  resources:
    requests:
      storage: 1Mi
```

```yaml showLineNumbers title="Pod spec excerpt"
spec:
  initContainers:
    - name: chatgpt-token
      image: busybox:1.37
      command:
        - sh
        - -c
        - "test -f /tokens/chatgpt/auth.json || cp /secrets/chatgpt/auth.json /tokens/chatgpt/auth.json && chown 65534 /tokens/chatgpt/auth.json"
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
      persistentVolumeClaim:
        claimName: litellm-chatgpt-tokens
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
