# ChatGPT Subscription

Use a ChatGPT subscription that includes Codex (see OpenAI's [Codex pricing](https://developers.openai.com/codex/pricing) for the plans, from Plus and Pro to Business and Enterprise) through LiteLLM with OAuth device flow authentication.

| Property | Details |
|-------|-------|
| Description | ChatGPT subscription access via the ChatGPT backend API |
| Provider Route on LiteLLM | `chatgpt/` |
| Supported Endpoints | `/responses`, `/chat/completions` (bridged to Responses for supported models) |
| API Reference | https://chatgpt.com |

ChatGPT subscription access is native to the Responses API. Chat Completions requests are bridged to Responses for supported models (for example `chatgpt/{{chatgpt}}`).

Use a model that your ChatGPT plan and workspace can call. [OpenAI's Codex models page](https://learn.chatgpt.com/docs/models) lists the current and retired models. That list differs from the models the OpenAI API serves.

The examples use `{{chatgpt}}` and `{{chatgpt_small}}`. Check the models page for which plans can call them. As of October 2026, OpenAI rolls out GPT-6.1 Sol (`gpt-6.1-sol`) to Plus, Pro, Business, Enterprise, and Edu plans, and on Enterprise and Edu an admin has to enable GPT-6.1 Sol and GPT-6 Luna (`gpt-6-luna`) first. Free and Go plans do not get GPT-6.1 Sol at launch, and OpenAI tells them to choose GPT-6 Luna in the ChatGPT desktop app when available, so LiteLLM may not be able to call either model on those plans. A model the backend does not serve to your account, such as a retired one, fails with `The '<model>' model is not supported when using Codex with a ChatGPT account.`

Notes:
- The ChatGPT subscription backend rejects token limit fields (`max_tokens`, `max_output_tokens`, `max_completion_tokens`) and `metadata`. LiteLLM strips these fields for this provider.
- `/v1/chat/completions` honors `stream`. When `stream` is false (default), LiteLLM aggregates the Responses stream into a single JSON response.
- Send Responses `input` as a list of messages, as the examples below do. On LiteLLM 1.106.0, a plain string `input` fails with `{"detail":"Input must be a list"}` from both the SDK and the proxy.

## Authentication

ChatGPT subscription access uses an OAuth device code flow. The LiteLLM Python SDK runs it the first time it needs a token, provided it is called from a synchronous script on the main thread: it prints a verification URL and a device code, you open the URL, sign in, and enter the code, and the tokens are stored in `~/.config/litellm/chatgpt/auth.json` for reuse. Async code, notebooks, worker threads, and the LiteLLM proxy cannot answer that prompt (older releases block on it, newer ones fail with `ChatGPT device-code login needs a human`), so for the proxy you sign in first and mount the resulting file, as described in [Sign in before starting the proxy](#sign-in-before-starting-the-proxy).

Device code login has to be allowed for the account first: in ChatGPT's security settings for a personal plan, or by a workspace admin in the workspace permissions for Business and Enterprise ([OpenAI docs](https://learn.chatgpt.com/docs/auth)).

## Usage - LiteLLM Python SDK

On LiteLLM 1.106.0, the `chatgpt/` provider needs the `mcp` package, which a plain `pip install litellm` does not include. Install LiteLLM with the `mcp` extra:

```bash showLineNumbers title="Install"
pip install 'litellm[mcp]'
```

### Responses (recommended for Codex models)

```python showLineNumbers title="ChatGPT Responses"
import litellm

response = litellm.responses(
    model="chatgpt/{{chatgpt}}",
    input=[{"role": "user", "content": "Write a Python hello world"}]
)

print(response)
```

### Chat Completions (bridged to Responses)

```python showLineNumbers title="ChatGPT Chat Completions"
import litellm

response = litellm.completion(
    model="chatgpt/{{chatgpt}}",
    messages=[{"role": "user", "content": "Write a Python hello world"}]
)

print(response)
```

## Usage - LiteLLM Proxy

Install LiteLLM with the `proxy` extra, which also includes the `mcp` package:

```bash showLineNumbers title="Install the proxy"
pip install 'litellm[proxy]'
```

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
  - model_name: chatgpt/{{chatgpt}}
    model_info:
      mode: responses
    litellm_params:
      model: chatgpt/{{chatgpt}}
  - model_name: chatgpt/{{chatgpt_small}}
    model_info:
      mode: responses
    litellm_params:
      model: chatgpt/{{chatgpt_small}}
```

```bash showLineNumbers title="Start LiteLLM Proxy"
export LITELLM_MASTER_KEY="sk-$(openssl rand -hex 32)"
printf 'Local proxy key: %s\n' "$LITELLM_MASTER_KEY"
litellm --config config.yaml
```

In another terminal, set `LITELLM_API_KEY` to the key printed above, then call the proxy:

```bash showLineNumbers title="Call the proxy"
curl http://localhost:4000/v1/responses \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model": "chatgpt/{{chatgpt}}", "input": [{"role": "user", "content": "Write a Python hello world"}]}'
```

## Multiple accounts in one proxy

Assign a saved ChatGPT login to each model deployment with `chatgpt_auth_file`. For the complete installation and client setup, see [How to use multiple ChatGPT subscriptions with LiteLLM](/blog/multiple-chatgpt-subscriptions).

### Save each account's login

From the directory where you will run the proxy, run each command in a terminal and complete its browser sign-in. Use a private browser window for the second command and choose the second account. The authenticator creates the directories and files.

```bash title="Separate saved logins"
umask 077
python -c 'from litellm.llms.chatgpt.authenticator import Authenticator; Authenticator(auth_file="./auth/account-a/auth.json").get_access_token()'
python -c 'from litellm.llms.chatgpt.authenticator import Authenticator; Authenticator(auth_file="./auth/account-b/auth.json").get_access_token()'
```

Keep each auth file private and writable for token refresh. In Docker, mount the containing directory on persistent writable storage and use the path inside the container. Relative paths resolve from the proxy's working directory, not from the configuration file's directory.

### Assign a login to each deployment

Save the following as `config.yaml`. This example gives each account a separate alias so you can verify them before pooling requests. Select a model that each account can use; access can differ between plans.

```yaml keep-model-ids title="config.yaml"
model_list:
  - model_name: chatgpt-account-a
    litellm_params:
      model: chatgpt/gpt-6-luna
      chatgpt_auth_file: ./auth/account-a/auth.json
  - model_name: chatgpt-account-b
    litellm_params:
      model: chatgpt/gpt-6-luna
      chatgpt_auth_file: ./auth/account-b/auth.json

general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
```

Generate a gateway key in the same shell and start one proxy process. Keep the key in your local secret manager so you can load it in client shells.

```bash title="Start the local proxy"
export LITELLM_MASTER_KEY="sk-$(openssl rand -hex 32)"
litellm --config config.yaml --host 127.0.0.1 --port 4000 --num_workers 1
```

From a second terminal with the same `LITELLM_MASTER_KEY` loaded, call account-a, then replace the model alias with `chatgpt-account-b`:

```bash title="Check an account"
curl http://localhost:4000/v1/responses \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"model":"chatgpt-account-a","input":[{"role":"user","content":"Say hello."}]}'
```

Each successful response contains a greeting in its `output` messages. If one alias fails, check that account's model access and saved login before pooling it. Both aliases also work with `/v1/chat/completions`.

### Route across accounts

To distribute requests, change both entries' `model_name` to `chatgpt-coding` and add this top-level configuration:

```yaml title="Router settings"
router_settings:
  routing_strategy: simple-shuffle
  num_retries: 2
  allowed_fails: 1
  cooldown_time: 60
```

Restart the proxy and send requests with `model: chatgpt-coding`. The router selects an eligible deployment and uses its saved account. Keep separate aliases when you need explicit account selection. For SDK calls, the path belongs to the process running Python. Both `litellm.completion` and `litellm.responses` accept the selector:

```python keep-model-ids title="Select an account in the SDK"
import litellm

response = litellm.responses(
    model="chatgpt/gpt-6-luna",
    chatgpt_auth_file="./auth/account-b/auth.json",
    input=[{"role": "user", "content": "Say hello."}],
)
print(response.output)
```

LiteLLM does not read remaining subscription allowance or switch accounts before purchased credits start covering requests. Each account keeps its provider limits. Retries and cooldowns respond to eligible failures, while successful credit-backed requests continue. See [retry and fallback configuration](../proxy/reliability.md).

### Configure accounts through the dashboard

On a database-backed proxy, sign in as a proxy administrator and open **Models + Endpoints → Add Model**. Choose **ChatGPT Subscription**, select the model, and set its public alias. In **Advanced Settings → LiteLLM Params**, enter:

```json
{"chatgpt_auth_file":"/app/auth/account-a/auth.json"}
```

The file must already exist on the proxy host or inside its container. Repeat for the second account with its own file. Proxy administrators can set or replace this server-owned credential selector; delegated model-management access does not grant that permission. Inference callers cannot send `chatgpt_auth_file` at the top level or in `extra_body`, even with `allow_client_side_credentials` enabled.

If an account needs a new login, stop the local proxy, repeat that account's terminal sign-in command with the same file path, and restart the proxy.

Run one process for a local setup. Per-account file selection does not add cross-process refresh locking; the [refresh and storage limitations](#sign-in-before-starting-the-proxy) still apply to each account.

## Credential Scope and Attribution

Without `chatgpt_auth_file`, ChatGPT deployments use the process-wide login from `CHATGPT_TOKEN_DIR` and `CHATGPT_AUTH_FILE`. A proxy administrator can assign a different saved login to each deployment with `chatgpt_auth_file`.

The selected deployment supplies both the access token and `ChatGPT-Account-Id`. A caller's LiteLLM virtual key controls model access; it does not select a ChatGPT login or override that deployment's credentials.

LiteLLM attributes `chatgpt/` requests to the calling virtual key, user, and team like any other model and records their token counts. The models have no price in the cost map, so recorded spend is $0 and `max_budget` limits never trigger; cap usage with `rpm_limit` or `tpm_limit` on keys and teams instead. On the OpenAI side, all of the usage shows up under the account that signed in.

## Refresh Failures and Revocation

LiteLLM refreshes only when the stored access token is expired. A 401 from the ChatGPT backend for a token that has not expired yet, for example after the session was signed out on OpenAI's side, is returned to the caller and does not trigger a refresh. When the refresh token is rejected, the proxy logs `ChatGPT refresh token failed, re-login required` and requests fail with HTTP 400 `ChatGPT device-code login needs a human`; sign in again outside the proxy and replace `auth.json`.

LiteLLM has no logout or revoke call for this provider. To stop the proxy using the account, delete `auth.json` (and the Secret it was seeded from on Kubernetes) and restart the proxy. To invalidate the tokens themselves, sign the session out from the ChatGPT account's security settings.

## Configuration

### Per-deployment parameter

| Parameter | Behavior |
| --- | --- |
| `chatgpt_auth_file` | Path to the selected account's saved login. Expands `~`, resolves relative paths against the process working directory, and overrides the default auth-file location. Omit it to retain the process-wide login. Configure it on the server, not in an inference request. |

### Environment Variables

- `CHATGPT_TOKEN_DIR`: Custom token storage directory (default: `~/.config/litellm/chatgpt`)
- `CHATGPT_AUTH_FILE`: Auth file name (default: `auth.json`)
- `CHATGPT_API_BASE`: Override API base (default: `https://chatgpt.com/backend-api/codex`)
- `OPENAI_CHATGPT_API_BASE`: Alias for `CHATGPT_API_BASE`
- `CHATGPT_ORIGINATOR`: Override the `originator` header value
- `CHATGPT_USER_AGENT`: Override the `User-Agent` header value
- `CHATGPT_USER_AGENT_SUFFIX`: Optional suffix appended to the `User-Agent` header
