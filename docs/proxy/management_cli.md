# LiteLLM Proxy CLI

The `lite` CLI is a command-line tool for managing your LiteLLM proxy
server and for running coding agents through it. It manages models, credentials,
API keys, teams, and users, runs chat and HTTP requests against the proxy,
migrates at-rest credential encryption, and launches coding agents (Claude Code,
Codex, OpenCode) with their LLM traffic routed through the proxy.

| Feature                | What you can do                                            |
|------------------------|-----------------------------------------------------------|
| Coding Agents          | Run Claude Code, Codex, or OpenCode through the proxy      |
| Models Management      | List, add, update, and delete models                      |
| Credentials Management | Manage provider credentials                               |
| Keys Management        | Generate, list, delete, and import API keys               |
| Teams Management       | List teams, list joinable teams, assign your key to a team |
| User Management        | Create, list, and delete users                            |
| Chat Completions       | Run chat completions                                      |
| HTTP Requests          | Make custom HTTP requests to the proxy server             |
| Encryption Migration   | Re-encrypt at-rest credentials to AES-256-GCM             |

## Quick Start

1. **Install the CLI**

   The `lite` client is a thin laptop install: it points at a LiteLLM proxy and runs your coding agents through it, with none of the proxy server runtime pulled in. The one-line installer needs only `curl`; it bootstraps [uv](https://github.com/astral-sh/uv) when it's missing and lets uv provision a compatible Python for you:

   ```shell
   curl -fsSL https://raw.githubusercontent.com/BerriAI/litellm/main/scripts/install-cli.sh | sh
   ```

   On macOS you can install it with Homebrew instead:

   ```shell
   brew install BerriAI/litellm/lite
   ```

   Already have uv and prefer to drive it yourself? Install the package directly:

   ```shell
   uv tool install 'litellm[cli]'
   ```

   Any of these gives you the `lite` command; if you already run a proxy server from `litellm[proxy]`, it ships there too. Start by typing it in your terminal:

   ```shell
   lite
   ```

2. **Set up environment variables**

   ```bash
   export LITELLM_PROXY_URL=http://localhost:4000
   export LITELLM_PROXY_API_KEY=sk-your-key
   ```

   *(Replace with your actual proxy URL and API key)*

3. **Make your first request (list models)**

   ```bash
   lite models list
   ```

   If the CLI is set up correctly, you should see a list of available models or a table output.

4. **Troubleshooting**

   - If you see an error, check your environment variables and proxy server status.

## Authentication using CLI

You can use the CLI to authenticate to the LiteLLM Gateway. This is great if you're trying to give a large number of developers self-serve access to the LiteLLM Gateway.

:::info

For an indepth guide, see [CLI Authentication](./cli_sso).

:::

### Prerequisites

:::warning[Beta Feature - Required Environment Variable]

CLI SSO Authentication is currently in beta. You must set this environment variable **when starting up your LiteLLM Proxy**:

```bash
export EXPERIMENTAL_UI_LOGIN="True"
litellm --config config.yaml
```

Or add it to your proxy startup command:

```bash
EXPERIMENTAL_UI_LOGIN="True" litellm --config config.yaml
```

:::

### Steps

1. **Set up the proxy URL**

   ```bash
   export LITELLM_PROXY_URL=http://localhost:4000
   ```

   *(Replace with your actual proxy URL)*

2. **Login**

   ```bash
   lite login
   ```

   This will open a browser window to authenticate. If you have connected LiteLLM Proxy to your SSO provider, you can login with your SSO credentials. Once logged in, you can use the CLI to make requests to the LiteLLM Gateway.

3. **Test your authentication**

   ```bash
   lite models list
   ```

   This will list all the models available to you.

## Run coding agents through the proxy

Launch a coding agent with all of its LLM traffic routed through your LiteLLM proxy. Each supported agent is its own command, so there is nothing to remember beyond the agent's name:

```bash
lite claude
lite codex
lite opencode
```

Anything after the agent name is forwarded to the agent untouched, so its own flags keep working:

```bash
lite claude --resume
lite codex exec "summarize the repo"
```

Each command resolves your LiteLLM key (logging in via SSO when none is stored and you are at a terminal; otherwise it reads `LITELLM_PROXY_API_KEY` or `--api-key`), checks the key against the proxy so bad credentials fail right away instead of deep inside the agent, exports the environment variables the agent reads, then replaces itself with the agent process.

The variables are chosen per agent. Claude Code gets `ANTHROPIC_BASE_URL` (the proxy root, so it appends `/v1/messages`) and `ANTHROPIC_AUTH_TOKEN`, with any stray `ANTHROPIC_API_KEY` cleared so the proxy token wins. Codex and OpenCode get `OPENAI_BASE_URL` (the proxy plus `/v1`) and `OPENAI_API_KEY`. Codex ignores `OPENAI_BASE_URL`, so it is additionally pointed at the proxy through a custom provider passed as `-c` config overrides (HTTP/SSE Responses transport, since the proxy does not speak the Responses WebSocket protocol).

`--skip-verify` skips the pre-launch key check, which helps offline or with non-standard auth. It belongs to the wrapper, so put it before the agent's own flags:

```bash
lite claude --skip-verify --resume
```

To pin the model, pass the agent's own model flag (`lite claude --model my-proxy-model` or `lite codex -m my-proxy-model`) or export the variable the agent reads (`ANTHROPIC_MODEL` / `ANTHROPIC_SMALL_FAST_MODEL` for Claude Code); the wrapper preserves anything you already set. Whatever model the agent requests must exist on the proxy, since requests land on the proxy's `/v1/messages` (Anthropic) or `/v1/chat/completions` and `/v1/responses` (OpenAI) endpoints.

### The `lite login` credential

The token minted by `lite login` is a short-lived, per-session agent credential, not a managed virtual key. It is scoped to the user and team you authenticated as, inherits that user's and team's models and budgets, and is enforced on the proxy exactly like a virtual key on the same team (guardrails, routing, logging, spend). Spend is tracked against the shared team and user budgets, so running several agents (or logging in more than once) does not give each session its own budget; they all draw down the same team and user allowance, and there is no separate per-session cap.

The credential is short-lived by design (default 24h, configurable via `LITELLM_CLI_JWT_EXPIRATION_HOURS`); run `lite login` again to refresh it, which also re-reads your latest team and user settings. It does not appear in the Keys UI and cannot be rotated or revoked mid-session, and `lite claude`, `lite codex`, and `lite opencode` work with it on a default deployment. If you need a long-lived, rotatable key that shows up in the Keys UI, create a dedicated virtual key in the dashboard and pass it via `--api-key` or `LITELLM_PROXY_API_KEY` instead.

When you authenticate to a team during login, or want to move your stored key onto a different team afterward, use `lite teams assign-key` (see [Teams Management](#teams-management)). Inspect or clear the stored credential with:

```bash
lite whoami   # show the authenticated user and the token age
lite logout   # clear the stored token
```

## Main Commands

### Models Management

- List, add, update, get, and delete models on the proxy.
- Example:

  ```bash
  lite models list
  lite models add gpt-4 \
    --param api_key=sk-123 \
    --param max_tokens=2048
  lite models update <model-id> -p temperature=0.7
  lite models delete <model-id>
  ```

  [API used (OpenAPI)](https://litellm-api.up.railway.app/#/model%20management)

### Credentials Management

- List, create, get, and delete credentials for LLM providers.
- Example:

  ```bash
  lite credentials list
  lite credentials create azure-prod \
    --info='{"custom_llm_provider": "azure"}' \
    --values='{"api_key": "sk-123", "api_base": "https://prod.azure.openai.com"}'
  lite credentials get azure-cred
  lite credentials delete azure-cred
  ```

  [API used (OpenAPI)](https://litellm-api.up.railway.app/#/credential%20management)

### Keys Management

- List, generate, get info, delete, and import API keys.
- Example:

  ```bash
  lite keys list
  lite keys generate \
    --models=gpt-4 \
    --spend=100 \
    --duration=24h \
    --key-alias=my-key
  lite keys info --key sk-key1
  lite keys delete --keys sk-key1,sk-key2 --key-aliases alias1,alias2
  ```

  `lite keys import` copies keys from another LiteLLM instance into this one. Add `--dry-run` to preview without writing, and `--created-since` (`YYYY-MM-DD` or `YYYY-MM-DD_HH:MM`) to limit the import by creation date:

  ```bash
  lite keys import \
    --source-base-url https://old-proxy.example.com \
    --source-api-key sk-source-admin \
    --created-since 2026-01-01
  ```

  [API used (OpenAPI)](https://litellm-api.up.railway.app/#/key%20management)

### User Management

- List, create, get info, and delete users.
- Example:

  ```bash
  lite users list
  lite users create \
    --email=user@example.com \
    --role=internal_user \
    --alias="Alice" \
    --team=team1 \
    --max-budget=100.0
  lite users get --id <user-id>
  lite users delete <user-id>
  ```

  [API used (OpenAPI)](https://litellm-api.up.railway.app/#/Internal%20User%20management)

### Teams Management

- List the teams you belong to, list teams available to join, and assign your current CLI key to a team.
- Example:

  ```bash
  lite teams list
  lite teams available
  lite teams assign-key --team-id team123
  ```

  Running `lite teams assign-key` without `--team-id` prompts you to pick a team interactively.

  [API used (OpenAPI)](https://litellm-api.up.railway.app/#/team%20management)

### Chat Completions

- Ask for chat completions from the proxy server.
- Example:

  ```bash
  lite chat completions gpt-4 -m "user:Hello, how are you?"
  ```

  [API used (OpenAPI)](https://litellm-api.up.railway.app/#/chat%2Fcompletions)

### General HTTP Requests

- Make direct HTTP requests to the proxy server.
- Example:

  ```bash
  lite http request \
    POST /chat/completions \
    --json '{"model": "gpt-4", "messages": [{"role": "user", "content": "Hello"}]}'
  ```

  [All APIs (OpenAPI)](https://litellm-api.up.railway.app/#/)

### Encryption Migration

- Re-encrypt at-rest credentials into the AES-256-GCM (`v2:gcm:`) format. This is an admin operation; start the proxy with `general_settings.encryption_algorithm: aes-256-gcm` first. The migration is idempotent and resumable, so it is safe to re-run after an interruption.
- Example:

  ```bash
  lite encryption migrate --check    # read-only residual scan, no writes
  lite encryption migrate --dry-run  # run the walkers without writing changes
  lite encryption migrate            # perform the migration
  ```

  `--check` reports how many legacy values remain; a residual of `0` means everything is on the new format.

## Environment Variables

- `LITELLM_PROXY_URL`: Base URL of the proxy server
- `LITELLM_PROXY_API_KEY`: API key for authentication

## Examples

1. **List all models:**

   ```bash
   lite models list
   ```

2. **Add a new model:**

   ```bash
   lite models add gpt-4 \
     --param api_key=sk-123 \
     --param max_tokens=2048
   ```

3. **Create a credential:**

   ```bash
   lite credentials create azure-prod \
     --info='{"custom_llm_provider": "azure"}' \
     --values='{"api_key": "sk-123", "api_base": "https://prod.azure.openai.com"}'
   ```

4. **Generate an API key:**

   ```bash
   lite keys generate \
     --models=gpt-4 \
     --spend=100 \
     --duration=24h \
     --key-alias=my-key
   ```

5. **Chat completion:**

   ```bash
   lite chat completions gpt-4 \
     -m "user:Write a story"
   ```

6. **Custom HTTP request:**

   ```bash
   lite http request \
     POST /chat/completions \
     --json '{"model": "gpt-4", "messages": [{"role": "user", "content": "Hello"}]}'
   ```

## Error Handling

The CLI will display error messages for:

- Server not accessible
- Authentication failures
- Invalid parameters or JSON
- Nonexistent models/credentials
- Any other operation failures

Use the `--debug` flag for detailed debugging output.

For full command reference and advanced usage, see the [CLI README](https://github.com/BerriAI/litellm/blob/main/litellm/proxy/client/cli/README.md).
