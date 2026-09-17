---
title: lite autoroute
sidebar_label: lite autoroute
description: Try LiteLLM's complexity-based auto-routing locally against your real proxy with the lite CLI, and route Claude Code traffic through it.
---

`lite autoroute` is a subcommand of `lite`, the [LiteLLM proxy CLI](../proxy/management_cli.md) that also gives you `lite login`, `lite up`, `lite claude` and the model, key, and team management commands. It lets you try LiteLLM's complexity-based auto-routing locally, against models your key already has access to on your real, running proxy. It picks a cheaper or more expensive model depending on how complex a prompt looks, without editing your proxy's `config.yaml` and without any request bypassing it. It stands up a throwaway local proxy that forwards every request back to your real proxy, then points Claude Code at that local proxy for the session.

:::info Preview feature; we want your feedback

`lite autoroute` is early and evolving. Tell us what works, what breaks, and what you want next in the [Autorouter discussion on GitHub](https://github.com/BerriAI/litellm/discussions/32168). Your feedback directly shapes where this goes.

:::

For proxy setup and the full configuration reference, see [Auto Routing](../proxy/auto_routing.md).

## 1. Install the CLI

`lite autoroute start` runs a throwaway proxy on your machine, so it needs the full proxy runtime: the thin `install-cli.sh` one-liner from the [CLI quick start](../proxy/management_cli.md#quick-start) installs only `litellm[cli]`, which is not enough here, and the command below replaces that install. It installs `litellm[proxy]` from `main` with a single curl command; `uv` is bootstrapped automatically if it is missing.

```bash
curl -fsSL https://raw.githubusercontent.com/BerriAI/litellm/main/scripts/install.sh | \
  LITELLM_CLI_REF=main sh
```

## 2. Point the CLI at Your Proxy

Set your real proxy URL and key. The autorouter forwards every request through this proxy with this key.

```bash
export LITELLM_PROXY_URL=http://localhost:4000
export LITELLM_PROXY_API_KEY=sk-...
```

## 3. Configure the Autorouter

Run the interactive wizard. It discovers the model groups your key can reach and asks you to assign models to each complexity tier.

```bash
lite autoroute configure
```

## 4. Start the Autorouter

Start the ephemeral local proxy. It runs in the foreground and streams routing decisions live, so you can watch which tier and model gets picked for each request. Ctrl-C stops it and restores your Claude Code settings; if the process died any other way, `lite autoroute stop` does that cleanup.

```bash
lite autoroute start
```

## 5. Run Claude Code as Normal

In another tab, start Claude Code. The autorouter now automatically intercepts all Claude Code traffic.

```bash
claude
```

For the full reference, including recovery from an unclean shutdown and important caveats, see the [`lite autoroute` section of the CLI README](https://github.com/BerriAI/litellm/blob/main/litellm/proxy/client/cli/README.md#qa-complexity-based-auto-routing-against-your-real-proxy).
