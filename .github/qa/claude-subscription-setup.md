# Claude subscription setup live verification

Verified on October 27, 2026 with LiteLLM 1.106.4, PostgreSQL 16, Claude Code 2.1.311, and an existing Claude Team subscription login.

## Procedure

Started a separate local proxy and database with the guide's `anthropic/*` deployment. The deployment used the caller's subscription credential. Created a virtual key scoped to `anthropic/*` through `/key/generate` and confirmed `/v1/models` accepted it.

Cleared the API-key, auth-token, and model environment overrides, then set `ANTHROPIC_BASE_URL` to the QA proxy root and `ANTHROPIC_CUSTOM_HEADERS` to the virtual-key header from the guide. Claude's auth status reported `loggedIn: true`, `authMethod: claude.ai`, `apiProvider: firstParty`, and `subscriptionType: team`.

Sent the guide's prompt using the actual Claude Code CLI:

```bash
claude -p 'Reply with exactly Hello.' \
  --output-format json \
  --no-session-persistence \
  --safe-mode \
  --tools ''
```

The QA flags suppress personal customizations, tools, and saved conversations while retaining Claude's normal authentication. The request reached the real Anthropic service through LiteLLM.

## Observed result

| Check | Result |
|---|---|
| Claude reply | `Hello.` |
| CLI exit code | `0` |
| CLI result subtype | `success` |
| Elapsed CLI time | 4.73 seconds |
| Spend-log status | `success` |
| Spend-log call type | `anthropic_messages` |
| Model | `anthropic/claude-fable-5-1` |
| Prompt / completion tokens | 3711 / 6 |
| `metadata.used_client_oauth_token` | `true` |
| Recorded API-equivalent cost | $0.00124725 |

Retrieved the matching subscription row through `/spend/logs/ui` with `used_client_oauth_token=true` and UTC `start_date` / `end_date` parameters. This confirms the upstream call used the subscription credential. The reported cost is LiteLLM's API-equivalent usage value.

## Scope

This verifies the existing-login route using a real Team subscription, virtual key, proxy, database, and upstream response. Key creation and log inspection used their HTTP APIs; the dashboard clicks and a fresh browser sign-in were not repeated. Other subscription plans and older proxy versions were not tested in this run.

An initial verification query omitted the API's required date window and returned an HTTP error after successful inference. The guide now includes those parameters. Greeting punctuation varies, so verification checks a successful greeting and its subscription-attributed spend row.

Temporary QA containers and their database were removed after the run. The daily-use proxy and its data were unchanged. Credentials and account identifiers are omitted from this evidence.
