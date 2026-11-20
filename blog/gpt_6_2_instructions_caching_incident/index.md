---
slug: gpt-6-2-instructions-caching-incident
title: "Incident Report: GPT-6.2 Stopped Caching System Prompts Sent Through LiteLLM"
date: 2026-11-19T10:00:00
authors:
  - ryan
  - ishaan-alt
  - krrish
tags: [incident-report, openai, caching, cost]
hide_table_of_contents: false
---

## TLDR

On November 17, OpenAI changed GPT-6.2 so it stopped caching system prompts sent the way LiteLLM sends them. Requests still worked, but GPT-6.2 users paid full price for their system prompt on every call. We are proactively shipping a fix and backporting it to 5 release lines.

## Action items

- Upgrade to the version for your release line, or any later version. No config changes are needed.

| Release line | Upgrade to |
|---|---|
| 1.111 RC | `v1.111.0-rc.2` or later |
| 1.110 stable | `v1.110.1` or later |
| 1.109 stable | `v1.109.2` or later |
| 1.108 LTS | `v1.108.12` or later |
| 1.106 stable | `v1.106.11` or later |

{/* truncate */}

## Summary

You were affected if you sent GPT-6.2 traffic through LiteLLM in one of these ways.

- `/v1/chat/completions` to a GPT-6.2 deployment that uses the Responses API, such as the `openai/responses/` prefix, `chatgpt/` or Bedrock Mantle GPT-6.2
- `/v1/messages` to GPT-6.2, for example from Claude Code or another Anthropic-format client

You were not affected if you called `/v1/responses` directly, used GPT-6.2 through OpenAI's Chat Completions API, used GPT-6.1 or earlier, or used a non-OpenAI provider.

## Root cause

The Responses API accepts a system prompt in two places, the top-level `instructions` field or a message at the start of `input`. Up to GPT-6.1 both were cached the same way, so LiteLLM used `instructions`.

On November 17, OpenAI updated its docs to say that starting with GPT-6.2, `instructions` are billed at the uncached rate on every request, even when they are identical, and that reusable prompts should go in a `developer` message at the start of `input` instead. Nothing failed on our side, so none of our error alerts fired, and a customer reported the missing cache hits on November 18.

## Our fixes

- LiteLLM now sends the system prompt as a `developer` message at the start of `input` on GPT-6.2, where OpenAI caches it. See [PR #52599](https://github.com/BerriAI/litellm/pull/52599), backported to every release line in the table above.
- Our bot that watches provider changelogs now flags changes to what gets cached, so we catch the next change like this before you do.
