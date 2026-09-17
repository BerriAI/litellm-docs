---
title: Autorouter CLI
sidebar_label: Autorouter CLI
description: Try LiteLLM's complexity-based auto-routing locally against your real proxy, and route Claude Code traffic through it.
---

The autorouter CLI lets you try LiteLLM's complexity-based auto-routing locally, against models your key already has access to on your real, running proxy. It picks a cheaper or more expensive model depending on how complex a prompt looks, without editing your proxy's `config.yaml` and without any request bypassing it. It stands up a throwaway local proxy that forwards every request back to your real proxy, then points Claude Code at that local proxy for the session.

:::info Preview feature; we want your feedback

The autorouter CLI is early and evolving. Tell us what works, what breaks, and what you want next in the [Autorouter discussion on GitHub](https://github.com/BerriAI/litellm/discussions/32168). Your feedback directly shapes where this goes.

:::

For proxy setup and the full configuration reference, see [Auto Routing](../proxy/auto_routing.md).

## 1. Install the CLI

Install `lite` from the internal staging branch with a single curl command; `uv` is bootstrapped automatically if it is missing.

```bash
curl -fsSL https://raw.githubusercontent.com/BerriAI/litellm/litellm_internal_staging/scripts/install-cli.sh | \
  LITELLM_CLI_REF=litellm_internal_staging sh
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

## 4. Run the Autorouter

Start the ephemeral local proxy. It runs in the foreground and streams routing decisions live, so you can watch which tier and model gets picked for each request.

```bash
lite autoroute up
```

## 5. Run Claude Code as Normal

In another tab, start Claude Code. The autorouter now automatically intercepts all Claude Code traffic.

```bash
claude
```

For the full reference, including recovery from an unclean shutdown and important caveats, see the [autorouter CLI README](https://github.com/BerriAI/litellm/blob/litellm_internal_staging/litellm/proxy/client/cli/README.md#qa-complexity-based-auto-routing-against-your-real-proxy).
