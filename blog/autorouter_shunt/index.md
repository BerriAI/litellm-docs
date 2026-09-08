---
slug: auto-router-shunt
title: "Auto-Router Shunt: Cut Agent Token Usage by 90% on Any Client"
date: 2026-09-08T16:00:00
authors:
  - moe
description: "Bound large file reads and delegate boilerplate codegen to a cheap worker model, the same technique behind Spotify's shunt plugin, now handled server-side on any Auto-Router. Works with any client, one config field to turn on."
keywords: [auto router, shunt, claude code, token savings, cost, bulk read, code generation, agentic coding, llm gateway, litellm]
tags: [routing, cost, claude-code, engineering]
hide_table_of_contents: false
---

**A new `auto_router_shunt_min_lines` field bounds large file reads and delegates boilerplate codegen to a cheap worker model, on any Auto-Router, for any client. Off by default.**

{/* truncate */}

:::info[🚀 Help shape the Auto-Router]

Get early access, work directly with the LiteLLM team, and influence the roadmap with your production traffic.

<a className="button button--primary button--lg" style={{background: '#2e8555', borderColor: '#2e8555', color: '#fff'}} href="https://calendar.app.google/i2e7qVEJphHi5S8UA">Apply to Become a Design Partner</a>

<br /><br />

Already testing it? Share your results in [discussion #32168](https://github.com/BerriAI/litellm/discussions/32168).

:::

## The problem

A coding agent that reads a 14,000-line file to answer "what does this do" pays for the whole file through whatever model is handling the turn, to get back three paragraphs. Generating a test or config stub that mirrors an existing one is nearly as wasteful: almost all of it is predictable from the reference file, but it still runs through the same model as the rest of the task.

Spotify measured this on their own Claude Code traffic and published [shunt](https://engineering.atspotify.com/2026/9/portal-by-spotify-cut-my-claude-code-token-usage-by-90), a plugin that intercepts both cases with `PreToolUse` hooks and reroutes them to a cheaper model, reporting close to 90% lower bulk-read cost. It is a Claude Code plugin though: hooks, bash scripts, and skill files installed per developer, and it only fires inside Claude Code.

## The solution

Three new fields on any complexity-router Auto-Router:

- `auto_router_shunt_min_lines`: line-count threshold that arms shunt for this router; unset, shunt stays off
- `auto_router_shunt_bulk_read_model`: worker model for bounded reads, defaults to the SIMPLE tier
- `auto_router_shunt_code_write_model`: worker model for delegated codegen, defaults to the SIMPLE tier

Same decision logic as the plugin, run by the proxy instead of a client-side hook, so it applies to Claude Code, Cursor, or any other client pointed at the proxy, and turning it on is a config change rather than an install on every developer's machine.

## How it works

1. The proxy injects `bulk_read` and `code_write` tool definitions on the pre-call side, so a model that wants to delegate can call them directly
2. On the response, a `Read` with no offset or limit, or a `cat`/`head`/`tail` on a bare path, gets rewritten into a `Bash` command that checks the file's line count first
3. Over the threshold, the command delegates to `/v1/bulk_read`, which runs the cheap worker model through the same pipeline as `/chat/completions`, so guardrails, budgets, and rate limits apply to it like any other request
4. Under the threshold, the command reads the file normally
5. Streaming requests get the same rewrite; it lands in the SSE stream as a normal `tool_use` block

```bash
L=$(wc -l < litellm/router.py 2>/dev/null || echo 0); if [ "$L" -gt 350 ]; then
  curl -sS -F 'question=Summarize this file'"'"'s exports and overall structure.' \
    -F paths=@litellm/router.py \
    -H 'Authorization: Bearer shunt_cap_v1:...' \
    'http://localhost:4000/v1/bulk_read?router=shunt-router';
else cat litellm/router.py; fi
```

On a 13,981-line file, that is 148,562 tokens replaced by 479.

## What is different from the plugin

The client-side version keeps the file's bytes off the developer's machine entirely, which also keeps them out of later turns of the agent's own context window. The server-side version saves the same tokens per call, but the client still holds whatever it already had in history, so it buys cost, not context headroom.

Delegated code generation also can't write to disk from the proxy, since it has no access to the client's filesystem. It comes back as a `Bash` command the client runs locally instead, so the generated code still never reaches the expensive model's context, just by a different mechanism than the plugin's direct write.

## Setting it up

```yaml title="config.yaml"
model_list:
  - model_name: worker-haiku
    litellm_params: {model: anthropic/{{anthropic}}, api_key: os.environ/ANTHROPIC_API_KEY}
  - model_name: big-sonnet
    litellm_params: {model: anthropic/{{anthropic_large}}, api_key: os.environ/ANTHROPIC_API_KEY}

  - model_name: shunt-router
    litellm_params:
      model: auto_router/complexity_router
      complexity_router_config:
        tiers:
          SIMPLE: worker-haiku
          MEDIUM: big-sonnet
          COMPLEX: big-sonnet

      # off by default: arm shunt for this router
      auto_router_shunt_min_lines: 350
      auto_router_shunt_bulk_read_model: worker-haiku
      auto_router_shunt_code_write_model: worker-haiku
```

Both worker models default to the SIMPLE tier, so in most setups the threshold is the only field you need to set. In the Admin UI, open an Auto-Router's Detailed Configuration and expand **Advanced: Shunt** for the threshold and, if you want them different from SIMPLE, the two worker models.

## Credit

The technique, the 350-line default, and the two-mode split are from Spotify's [Portal by Spotify cut my Claude Code token usage by 90%](https://engineering.atspotify.com/2026/9/portal-by-spotify-cut-my-claude-code-token-usage-by-90), by Dimitri Mazmanov.

:::info[Try it on your traffic]

Turn shunt on for one team's router, watch the spend log for a week, and tell us what you see in [discussion #32168](https://github.com/BerriAI/litellm/discussions/32168), or

<a className="button button--primary button--lg" style={{background: '#2e8555', borderColor: '#2e8555', color: '#fff'}} href="https://calendar.app.google/i2e7qVEJphHi5S8UA">Apply to Become a Design Partner</a>

:::
