# Claude Code on a shared dev server

Developers who SSH into a shared Linux box and run Claude Code there can authenticate to LiteLLM with their own SSO identity, with no per-user key to issue and no long-lived credential sitting on a multi-user host. Claude Code talks to LiteLLM, LiteLLM talks to your identity provider and to Bedrock (or whatever providers you configured), and every request is attributed to the developer who signed in.

There are two ways to get there. The [`lite` CLI](../proxy/management_cli) does it out of the box. If installing a third-party binary on the dev server is a problem, the same flow is a short in-house script against two proxy endpoints, and this page shows both.

Both approaches assume the proxy has SSO configured and is started with `EXPERIMENTAL_UI_LOGIN="True"`, which turns on the CLI login endpoints. See [CLI Authentication](../proxy/cli_sso) for the proxy-side setup.

## How the login works

`POST /sso/cli/start` returns a login id, a polling secret, and a short verification code. The developer opens `<proxy>/sso/key/generate?source=litellm-cli&key=<login_id>` in a browser, which can be their laptop rather than the server they are SSH'd into, signs in through your normal proxy SSO flow, and confirms the verification code. Meanwhile the terminal polls `GET /sso/cli/poll/<login_id>` with the polling secret until the proxy hands back a token.

The proxy is the only party that talks to your identity provider, so nothing on the dev server needs an OIDC client id, a client secret, or a redirect URI.

The token that comes back is a short-lived, per-session credential scoped to the user and team that signed in, not a managed virtual key. It inherits that user's and team's model access and budgets, spend lands on those same budgets, it does not appear in the Keys UI, and it cannot be rotated mid-session. Default lifetime is 24 hours, set by `LITELLM_CLI_JWT_EXPIRATION_HOURS` on the proxy, so a developer signs in roughly once a day. If you need a long-lived, rotatable, revocable credential instead, issue a virtual key from the dashboard and skip all of this.

## Option 1: the `lite` CLI

Install it on the dev server:

```bash
curl -fsSL https://raw.githubusercontent.com/BerriAI/litellm/main/scripts/install-cli.sh | sh
```

Point it at the proxy, ideally from `/etc/profile.d` so every developer inherits it:

```bash
export LITELLM_PROXY_URL=https://litellm.yourcompany.com
```

Then sign in and start Claude Code through the proxy:

```bash
lite login
lite claude
```

`lite claude` resolves the stored token, checks it against the proxy so bad credentials fail immediately, sets `ANTHROPIC_BASE_URL` and `ANTHROPIC_AUTH_TOKEN`, clears any stray `ANTHROPIC_API_KEY`, and execs Claude Code. Anything after `claude` is passed through untouched, so `lite claude --resume` and friends keep working. `--base-url` belongs to `lite` rather than to the agent, so it goes before the subcommand: `lite --base-url https://litellm.yourcompany.com claude`.

### Keeping the plain `claude` command

Developers who don't want to change how they launch Claude Code don't have to. `lite up` patches `~/.claude/settings.json` to point Claude Code at the proxy and to fetch a fresh token through Claude Code's [`apiKeyHelper`](https://code.claude.com/docs/en/settings), so plain `claude` works from any terminal on the box:

```bash
lite up
```

It backs the file up first, holds the patch until you press Ctrl-C, then restores it. If the process is killed uncleanly, `lite down` restores the backup. The settings it writes look like this:

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "https://litellm.yourcompany.com"
  },
  "apiKeyHelper": "/usr/local/bin/lite --base-url https://litellm.yourcompany.com auth print-token"
}
```

You can also write those two lines yourself, as a permanent per-user `~/.claude/settings.json` or as [managed settings](https://code.claude.com/docs/en/settings) at `/etc/claude-code/managed-settings.json` that developers cannot override. That is the better fit for a shared server: it survives reboots, needs no long-running `lite up` process, and leaves `claude` as the only command anyone has to learn. An `alias claude="lite claude"` in `/etc/profile.d` works too, but it only applies to interactive shells and breaks any script or editor extension that invokes `claude` directly.

Either way the daily loop is `lite login` once every 24 hours, then `claude` as usual.

## Option 2: an in-house script

If procuring the CLI means a security review you'd rather skip, the login flow is two HTTP calls, so an in-house script can replace it. Save this as `/usr/local/bin/litellm-auth.sh`, `chmod 755`, and have developers run `litellm-auth.sh login` once a day:

```bash
#!/usr/bin/env bash
# In-house equivalent of the `lite` CLI's login + token commands, for coding agents
# on a shared dev box.
#
#   litellm-auth.sh login    sign in through the proxy's SSO, cache the token
#   litellm-auth.sh token    print the cached token (Claude Code apiKeyHelper)
#   litellm-auth.sh whoami   show who the cached token belongs to
#   litellm-auth.sh logout   drop the cached token
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

Then wire Claude Code to it once per machine, in `/etc/claude-code/managed-settings.json` so nobody has to touch their own config:

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "https://litellm.yourcompany.com"
  },
  "apiKeyHelper": "/usr/local/bin/litellm-auth.sh token"
}
```

Claude Code reads the helper's stdout as the API key, which is why the script keeps every prompt and diagnostic on stderr and prints nothing but the token. The command stays `claude`.

A few details worth keeping if you rewrite the script. The cache records which proxy issued the token and the script refuses to hand a token to a different proxy, so a developer who logs into staging can't silently send work code to it. The cache file is `0600` inside a `0700` directory, which matters on a host where other people have shell access. The local expiry is stamped five minutes short of the real lifetime, so a long Claude Code session fails with a clear "run login again" message rather than a 401 mid-request. And `whoami` exists mostly so developers can answer "am I still signed in?" without reading JSON.

Passing `LITELLM_TEAM_ID` matters when a developer belongs to several LiteLLM teams: the poll response comes back asking which team to bill, and the script re-polls with that team id. If your developers each belong to one team, that branch never fires.

## Verifying the setup

After signing in, before involving Claude Code at all:

```bash
export TOKEN=$(litellm-auth.sh token)   # or: lite --base-url "$LITELLM_PROXY_URL" auth print-token

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

- [Management CLI](../proxy/management_cli): everything `lite` can do, and the details of the login credential
- [CLI Authentication](../proxy/cli_sso): proxy-side setup for the CLI login flow, including token lifetime and OIDC claim mapping
- [Claude Code with Okta SSO (JWT Auth)](./claude_code_okta_sso): the alternative where Claude Code carries an Okta access token directly and LiteLLM validates it against Okta's JWKS
- [Bedrock](../providers/bedrock): configuring Bedrock models on the proxy
