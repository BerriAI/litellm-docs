---
title: Auto Router with Codex and your ChatGPT subscription
sidebar_label: Auto Router
description: Route Codex through a LiteLLM auto router while each developer keeps their own ChatGPT login, with a virtual key or an SSO sign-in as the gateway credential.
---

# Auto Router with Codex and your ChatGPT subscription

A LiteLLM [auto router](../proxy/auto_routing.md) can pick between ChatGPT models for every Codex turn while each developer keeps using their own ChatGPT subscription. Every request then carries two credentials. The ChatGPT login goes in `Authorization`; Codex owns it and refreshes it, and LiteLLM forwards it to ChatGPT for that request without storing it. The gateway credential goes in `x-litellm-api-key` and decides who can use the proxy and whose usage is logged. It is a virtual key or a short-lived token from an SSO sign-in.

The two credentials are checked separately, so they can come from different identity providers, for example ChatGPT through Google and LiteLLM through Okta.

## Prerequisites

Complete [Use your ChatGPT subscription with Codex](./openai_codex_byok.md) first, so that a single `chatgpt/` model already works from Codex. This page assumes a LiteLLM proxy <SinceVersion v="1.109.0" />.

## Step 1: Add the router

Give each ChatGPT model its own `model_list` entry and put the complexity router in front of them. Merge this into your proxy's `config.yaml` and restart the proxy:

```yaml title="config.yaml" keep-model-ids
model_list:
  - model_name: gpt-6-astra-autorouter
    litellm_params:
      model: auto_router/complexity_router
      complexity_router_config:
        classifier_type: heuristic
        classification_mode: user_turn
        context_compaction: false
        tiers:
          SIMPLE: gpt-6-luna
          MEDIUM: gpt-6-luna
          COMPLEX: gpt-6-astra
          REASONING: gpt-6-astra

  - model_name: gpt-6-luna
    litellm_params:
      model: chatgpt/gpt-6-luna
    model_info:
      mode: responses

  - model_name: gpt-6-astra
    litellm_params:
      model: chatgpt/gpt-6-astra
    model_info:
      mode: responses
```

The `heuristic` classifier scores each request locally, so classification makes no model calls and the ChatGPT login only goes to `chatgpt.com/backend-api/codex`. Allow the router name on every virtual key that uses it.

:::warning Keep context compaction off

Set `context_compaction: false` on the router. With compaction on, every routed request fails with `ChatGPT device-code login needs a human and cannot run inside a running event loop`, because the compaction step looks up model details in a way that ignores the forwarded login. Turn compaction back on once a fix ships.

:::

## Step 2: Add the router to Codex's model catalog

Codex looks up each model name in its catalog. For a name it knows, it sends a short request. For an unknown name, such as a router alias, it sends every tool definition with each request; in testing that raised prompts from about 13.5k to about 155k tokens per request and time to first token from about 0.8s to about 5s, which uses up the subscription much faster.

Create a catalog file with one entry per model the proxy serves. The router entry is a copy of Codex's own `gpt-6-astra` entry with a new `slug`, `display_name` and `description`; copy the Astra and Luna entries unchanged. Each entry has about 40 fields, mostly Codex's built-in prompt text, and `codex debug models --bundled` prints the full entries to copy from. The example below shows only the fields that matter:

```json title="~/.codex/litellm_model_catalog.json" keep-model-ids
{
  "models": [
    {
      "slug": "gpt-6-astra-autorouter",
      "display_name": "GPT-6-Astra Auto Router",
      "description": "LiteLLM picks Luna or Astra for each turn.",
      "visibility": "list",
      "context_window": 272000,
      "use_responses_lite": true,
      "...": "every other field copied unchanged from the gpt-6-astra entry"
    },
    {
      "slug": "gpt-6-astra",
      "display_name": "GPT-6-Astra",
      "...": "copied unchanged"
    },
    {
      "slug": "gpt-6-luna",
      "display_name": "GPT-6-Luna",
      "...": "copied unchanged"
    }
  ]
}
```

The `slug` must match the router's `model_name` on the proxy. The `/model` picker lists only the entries in this file, so leave out models the proxy does not serve. Because the entries are copies of Codex's own, refresh them when you update Codex.

Then point Codex at the file and select the router. Both are top-level keys, so put them above the first `[table]` heading in `~/.codex/config.toml`, and edit the existing `model` line instead of adding a second one:

```toml title="~/.codex/config.toml"
model = "gpt-6-astra-autorouter"
model_catalog_json = "/Users/<you>/.codex/litellm_model_catalog.json"
```

Use the full path; a `~` path stops resolving when Codex starts with a different `HOME`.

If you prefer not to maintain a catalog, name the router after a model Codex already knows, such as `gpt-6-astra`, and move the real models to internal names such as `astra-upstream` and `luna-upstream`. A request for `gpt-6-astra` can then run on Luna, so the model column in **Logs**, not the model group, shows what ran.

## Step 3: Choose a gateway credential

A virtual key works as described in the [ChatGPT subscription tutorial](./openai_codex_byok.md#step-2-create-and-save-a-virtual-key); save it in `~/.codex/.env` and start `codex`.

For an SSO sign-in, set up [SSO for the Admin UI](../proxy/admin_ui_sso.md) on the proxy, then have each developer sign in with the [`lite` CLI](../proxy/cli_sso.md). Both sign-in modes issue the same kind of token, which lasts 24 hours by default:

```bash
export LITELLM_PROXY_URL=https://litellm.example.com
lite login --pkce      # approve in the browser; print-token renews the token
lite login --no-pkce   # enter a code in the browser; sign in again each day
```

With `--pkce`, check that the **Authorize CLI access** page names you before you approve it. `lite whoami` shows who you are signed in as. Start Codex with `lite codex --subscription`, which keeps your ChatGPT login and sends the SSO token in `x-litellm-api-key`.

If your `lite` release does not have `--subscription`, export the token yourself and start Codex without its background server:

```bash
export LITELLM_API_KEY="$(lite auth print-token)" && [ -n "$LITELLM_API_KEY" ] && codex --no-daemon
```

The `[ -n ... ]` check stops Codex from starting with an empty key. Do not use plain `lite codex` or `lite configure codex` for this setup; both send the gateway credential in `Authorization`, which replaces the ChatGPT login.

## Step 4: Verify routing

Send one short prompt and one prompt that asks for step-by-step reasoning. In the LiteLLM dashboard, open **Logs**. Each request shows the router name as the model group, the ChatGPT model that ran as the model, and the routing decision (tier and cause) in its metadata. With SSO, the user is your SSO identity and the key is a `cli-session` key.

## Codex's background server

The interactive Codex runs its sessions on a shared background server, and `/status` shows `Local background server` when it does. That server sends the model requests and keeps the environment and config it started with, so a key you export later does not reach it, and neither does a later change to `config.toml` or the catalog.

Start Codex with `codex --no-daemon` to skip the server, or restart it from a shell that already has the key, and again whenever the key or config changes:

```bash
export LITELLM_API_KEY="$(lite auth print-token)" && [ -n "$LITELLM_API_KEY" ] && codex app-server daemon restart
```

A restart interrupts sessions that run on the server. For an SSO token that changes daily, `--no-daemon` is simpler. `codex exec` does not use the server, and the desktop app runs its own.

## Limits

The gateway credential controls access and attribution, and the ChatGPT login decides whose subscription is used. LiteLLM does not check that the two belong to the same person.

With `store_prompts_in_spend_logs: true`, each stored request includes its incoming headers. The ChatGPT `authorization` header is stored as `REDACTED`, but `chatgpt-account-id` is stored as is. It identifies the ChatGPT workspace and cannot call ChatGPT, but it is saved next to the prompts.

## Troubleshooting

| Problem | Fix |
|---|---|
| `LiteLLM Virtual Key expected ... This key has the structure of a JWT` | Codex sent no gateway key, so the proxy read the ChatGPT login in `Authorization`. Check that `LITELLM_API_KEY` is set in the process that sends requests, and see [Codex's background server](#codexs-background-server). |
| `ChatGPT device-code login needs a human` on routed requests | Set `context_compaction: false` on the router and restart the proxy. |
| Prompts above 100k tokens | Codex does not know the model name. Check the catalog entry and `model_catalog_json`, then restart the background server or use `--no-daemon`. |
| `lite auth print-token` says `Not authenticated for this server` | Your login is for a different proxy than `lite`'s default. Pass `--base-url` or run `lite config set base_url <proxy-url>`. |
| The **Authorize CLI access** page names `default_user_id` | The browser is signed in to the dashboard as the proxy admin. Deny, sign out of the dashboard, and sign in again, or use `lite login --no-pkce`. |
| macOS asks for your password on every `lite login` | Delete the old keychain item with `security delete-generic-password -s litellm-cli -a credential`, or set `LITELLM_CLI_DISABLE_KEYRING=1`. |

## Related

- [Use your ChatGPT subscription with Codex](./openai_codex_byok.md)
- [Auto routing](../proxy/auto_routing.md)
- [CLI authentication](../proxy/cli_sso.md)
- [Auto Router with Claude Code and Claude Desktop](./claude_code_autorouter.md)
