# Claude Code on a shared dev server

Developers who SSH into a shared Linux box and run Claude Code there can authenticate to LiteLLM with their own SSO identity, with no per-user key to issue and no long-lived credential sitting on a multi-user host. Claude Code talks to LiteLLM, LiteLLM routes to Bedrock (or whatever providers you configured), and every request is attributed to the developer who signed in.

Nothing below changes the command developers type. They keep running `claude`, and the credential and base URL are supplied to it in the background.

## The mechanism: managed settings plus a credential helper

Claude Code reads two things from [managed settings](https://code.claude.com/docs/en/settings), which on Linux live at `/etc/claude-code/managed-settings.json` and take precedence over anything a developer puts in their own `~/.claude/settings.json`:

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "https://litellm.yourcompany.com"
  },
  "apiKeyHelper": "/usr/local/bin/claude-litellm-auth.sh"
}
```

`env` sets the environment variables Claude Code runs with, which is how it gets pointed at the proxy instead of api.anthropic.com. [`apiKeyHelper`](https://code.claude.com/docs/en/settings) is a command Claude Code runs to fetch a credential, re-running it whenever its cached value goes stale (`CLAUDE_CODE_API_KEY_HELPER_TTL_MS`, default 5 minutes). Claude Code reads the helper's stdout as the credential, so the helper must print the token and nothing else, with any prompts or diagnostics on stderr.

Push those two files, the settings and the helper script, through whatever configuration management already owns the box, and the setup is done. The Claude Code commands developers already run keep working unchanged.

Since managed settings cannot be overridden locally, this also pins traffic to the proxy: a developer cannot point Claude Code back at api.anthropic.com with their own `ANTHROPIC_BASE_URL` or `ANTHROPIC_API_KEY`.

## Where the credential comes from

The only real decision is what the helper script does to get a token, and there are two answers.

### Option 1: the developer's Okta token, validated by LiteLLM

The helper runs Okta's device authorization grant, caches the access token with its refresh token, and hands the access token to Claude Code. LiteLLM validates it against Okta's JWKS and creates the user on first request, so no LiteLLM-issued credential exists at all. Because Okta refresh tokens are long-lived, sign-in happens once and refreshes are silent from then on, which is the closest thing to zero interaction.

This is the path with a full walkthrough, including the complete helper script, in [Claude Code with Okta SSO](./claude_code_okta_sso). It needs an Okta native app with the device grant enabled, and LiteLLM JWT auth, which is an enterprise feature.

### Option 2: a token from the proxy's own SSO flow

If you would rather not create an Okta app or enable JWT auth, the proxy can mint the token itself off the SSO connection it already has. The helper calls two endpoints, and Okta is only ever talked to by the proxy, so nothing on the dev server needs a client id, a client secret, or a redirect URI.

`POST /sso/cli/start` returns a login id, a polling secret, and a short verification code. The developer opens `<proxy>/sso/key/generate?source=litellm-cli&key=<login_id>` in a browser, which can be their laptop rather than the server they are SSH'd into, signs in through your normal proxy SSO flow, and confirms the verification code. Meanwhile the script polls `GET /sso/cli/poll/<login_id>` with the polling secret until the proxy hands back a token. This requires starting the proxy with `EXPERIMENTAL_UI_LOGIN="True"`, which enables those endpoints; see [CLI Authentication](../proxy/cli_sso).

The token is a short-lived, per-session credential scoped to the user and team that signed in, not a managed virtual key. It inherits that user's and team's model access and budgets, spend lands on those same budgets, it does not appear in the Keys UI, and it cannot be rotated mid-session. Default lifetime is 24 hours, set by `LITELLM_CLI_JWT_EXPIRATION_HOURS` on the proxy, so unlike option 1 the developer signs in again roughly once a day. There is no browser on the dev server and Claude Code gives a helper no way to prompt, so that sign-in is a separate command rather than something Claude Code can trigger: developers run `claude-litellm-auth.sh login` when the day's token has expired, and `claude` itself stays untouched.

Save this as `/usr/local/bin/claude-litellm-auth.sh` and `chmod 755` it. Called with no arguments it prints the cached token, which is what `apiKeyHelper` needs:

```bash
#!/usr/bin/env bash
# Fetches a LiteLLM token through the proxy's SSO flow and caches it for Claude Code.
#
#   claude-litellm-auth.sh          print the cached token (this is what apiKeyHelper runs)
#   claude-litellm-auth.sh login    sign in through the proxy's SSO, cache the token
#   claude-litellm-auth.sh whoami   show who the cached token belongs to
#   claude-litellm-auth.sh logout   drop the cached token
#
# Requires curl and jq. LITELLM_PROXY_URL must point at the proxy.
set -euo pipefail

BASE_URL="${LITELLM_PROXY_URL:-}"
CACHE="${LITELLM_TOKEN_CACHE:-$HOME/.litellm/agent-token.json}"
TTL_HOURS="${LITELLM_TOKEN_TTL_HOURS:-24}"
TEAM_ID="${LITELLM_TEAM_ID:-}"
POLL_INTERVAL=2
POLL_TIMEOUT=300

die() { echo "$*" >&2; exit 1; }

require_base_url() {
  [ -n "$BASE_URL" ] || die "Set LITELLM_PROXY_URL to your LiteLLM proxy, e.g. https://litellm.internal"
  BASE_URL="${BASE_URL%/}"
}

read_cache() {
  [ -f "$CACHE" ] || return 1
  jq -e --arg now "$(date +%s)" --arg base_url "${BASE_URL:-}" '
    select(.expires_at > ($now | tonumber))
    | select($base_url == "" or .base_url == $base_url)
  ' "$CACHE"
}

save_token() {
  mkdir -p "$(dirname "$CACHE")"
  chmod 700 "$(dirname "$CACHE")"
  local tmp
  tmp="$(mktemp "$CACHE.XXXXXX")"
  chmod 600 "$tmp"
  jq -n --arg key "$1" --arg user_id "$2" --arg base_url "$BASE_URL" \
    --argjson expires_at "$3" \
    '{key: $key, user_id: $user_id, base_url: $base_url, expires_at: $expires_at}' > "$tmp"
  mv "$tmp" "$CACHE"
}

# Polls /sso/cli/poll until the proxy has something for this login, echoes the payload.
poll() {
  local login_id="$1" poll_secret="$2" query="$3" deadline body
  deadline=$(( $(date +%s) + POLL_TIMEOUT ))
  while [ "$(date +%s)" -lt "$deadline" ]; do
    body=$(curl -fsS -H "x-litellm-cli-poll-secret: $poll_secret" \
      "$BASE_URL/sso/cli/poll/$login_id$query" 2>/dev/null) || { sleep "$POLL_INTERVAL"; continue; }
    if [ "$(jq -r '.status // empty' <<<"$body")" = "ready" ]; then
      echo "$body"
      return 0
    fi
    sleep "$POLL_INTERVAL"
  done
  return 1
}

login() {
  require_base_url
  local start login_id poll_secret user_code ready key user_id team expires_at

  start=$(curl -fsS -X POST "$BASE_URL/sso/cli/start") \
    || die "Could not start a login session at $BASE_URL/sso/cli/start"
  login_id=$(jq -er '.login_id' <<<"$start")
  poll_secret=$(jq -er '.poll_secret' <<<"$start")
  user_code=$(jq -er '.user_code' <<<"$start")

  echo "Open this URL in a browser (your laptop is fine, it does not have to be this host):" >&2
  echo "  $BASE_URL/sso/key/generate?source=litellm-cli&key=$login_id" >&2
  echo "Sign in with SSO, then confirm the verification code: $user_code" >&2

  ready=$(poll "$login_id" "$poll_secret" "") || die "Login timed out after ${POLL_TIMEOUT}s."

  if [ "$(jq -r '.requires_team_selection // false' <<<"$ready")" = "true" ]; then
    if [ -z "$TEAM_ID" ]; then
      echo "Your user belongs to multiple teams. Re-run with LITELLM_TEAM_ID set to one of:" >&2
      jq -r '(.team_details // [] | map("  \(.team_id)\t\(.team_alias // "")") | join("\n"))
             // (.teams | map("  " + .) | join("\n"))' <<<"$ready" >&2
      exit 1
    fi
    team=$(jq -rn --arg t "$TEAM_ID" '$t | @uri')
    ready=$(poll "$login_id" "$poll_secret" "?team_id=$team") \
      || die "The proxy never issued a token for team $TEAM_ID."
  fi

  key=$(jq -er '.key' <<<"$ready")
  user_id=$(jq -r '.user_id // "unknown"' <<<"$ready")
  expires_at=$(( $(date +%s) + TTL_HOURS * 3600 - 300 ))
  save_token "$key" "$user_id" "$expires_at"
  echo "Signed in as $user_id. Token cached in $CACHE for ${TTL_HOURS}h." >&2
}

# stdout stays token-only: Claude Code reads apiKeyHelper's stdout as the key.
token() {
  BASE_URL="${BASE_URL%/}"
  read_cache | jq -er '.key' 2>/dev/null || die "No valid LiteLLM token. Run: $0 login"
}

whoami() {
  BASE_URL="${BASE_URL%/}"
  read_cache | jq -r '"user: \(.user_id)\nproxy: \(.base_url)\nexpires: \(.expires_at | todate)"' \
    || die "Not signed in. Run: $0 login"
}

case "${1:-token}" in
  login) login ;;
  token) token ;;
  whoami) whoami ;;
  logout) rm -f "$CACHE"; echo "Cached token removed." >&2 ;;
  *) die "Usage: $0 [login|token|whoami|logout]" ;;
esac
```

The script reads `LITELLM_PROXY_URL`, so set it alongside the base URL in the managed settings `env` block, or export it from `/etc/profile.d`.

A few details worth keeping if you rewrite it. The cache records which proxy issued the token and the script refuses to hand a token to a different one, so a developer who logs into staging cannot silently send work code there. The cache file is `0600` inside a `0700` directory, which matters on a host where other people have shell access. The local expiry is stamped five minutes short of the real lifetime, so a long Claude Code session fails with a clear "run login again" message rather than a 401 mid-request. Passing `LITELLM_TEAM_ID` matters when a developer belongs to several LiteLLM teams: the poll response comes back asking which team to bill, and the script re-polls with that team id.

## If installing the LiteLLM CLI is an option

The [`lite` CLI](../proxy/management_cli) does all of the above with nothing to write. Install it on the box:

```bash
curl -fsSL https://raw.githubusercontent.com/BerriAI/litellm/main/scripts/install-cli.sh | sh
```

Then `export LITELLM_PROXY_URL=https://litellm.yourcompany.com` from `/etc/profile.d`, and developers run `lite login` once a day. `lite claude` launches Claude Code with the proxy variables set, forwarding its own flags untouched, and `lite up` patches Claude Code's settings so plain `claude` routes through the proxy from any terminal. To keep `claude` as the only command without a long-running `lite up` process, write the same managed settings as above with `apiKeyHelper` set to `lite --base-url https://litellm.yourcompany.com auth print-token`, which prints the token from the last `lite login` and nothing else. `--base-url` belongs to `lite` rather than to the subcommand, so it goes first.

## Verifying the setup

After a sign-in, before involving Claude Code at all:

```bash
export TOKEN=$(/usr/local/bin/claude-litellm-auth.sh)

curl -X POST "$LITELLM_PROXY_URL/v1/messages" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "bedrock-claude-sonnet-4-5",
    "max_tokens": 64,
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

A successful response means the whole chain works, and the request shows up under the developer's own user in the Admin UI logs. Then `claude -p "say hi"` should answer, and land in the logs the same way.

## Related docs

- [Claude Code with Okta SSO](./claude_code_okta_sso): the option 1 helper script and the JWT auth config it needs
- [CLI Authentication](../proxy/cli_sso): proxy-side setup for the login endpoints option 2 uses, including token lifetime and OIDC claim mapping
- [Management CLI](../proxy/management_cli): everything `lite` can do, and the details of the login credential
- [Bedrock](../providers/bedrock): configuring Bedrock models on the proxy
