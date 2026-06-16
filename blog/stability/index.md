---
slug: stability
title: "Stability"
date: 2026-06-15T10:00:00
authors:
  - ishaan-alt
description: ""
tags: []
hide_table_of_contents: false
---

As more teams depend on LiteLLM, stability matters more, not less. So we're treating stability as mission critical. For June we are comitting to two things: 

- **Close 20 reported bugs** in core functionality. Full list, in the open, [here](https://github.com/BerriAI/litellm/issues/30484)
- **Fix root causes, not symptoms.** A lot of our worst bugs come from code that needs to be reworked, not patched. Patching is cheaper this week and more expensive every week after. We are comitting to adressing root causes in 3 core areas: UI, MCP and AI Gateway Authentication.


Here's where we're investing, and what you get from each.

This blog post covers our planned stability work for the month of June. At LiteLLM we are doubling down our focus on stability and reliability of core features as our adoption grows it is doubly important to deliver a stable product for users. 

This month has 2 goals in terms of input:
- Close out 20 reported bugs on core functionality. You can reference the parent list of issues being worked on here https://github.com/BerriAI/litellm/issues/30484 
- Long term inestments, One of the symptoms of some of our stability bugs is that the underlying code itself is not amazing. Part of this is we're trying to refactor the code to address some of the root causes versus constantly patching on fixes.
Here's where we're investing, and what you get from each.

## MCP: auth that works the same way every time

**What you get:** you can view tools and authenticate against MCP servers reliably, no matter how you connect (Gateway or Claude Code).

**The problem today:** auth behavior changes depending on your entry point. Sometimes you get no tools back at all.

**Why:** we have too many credential paths and nothing deciding which one wins, so what you get depends on how you connect. Tokens were also cached without proper expiry or refresh.

**The bet:** one path that resolves credentials the same way every time, fails safe instead of silently downgrading, and refreshes tokens before they expire.

## AI Gateway auth: spend always lands on the right team

**What you get:** your team IDs show up in traces, and spend is always attributed to the right team.

**The problem today:** team IDs go missing from traces, and spend sometimes never gets attributed.

**Why:** figuring out who's making a request takes 5+ DB lookups spread across the codebase. When one fails quietly, your team ID drops out but the request still succeeds, so it fails silently instead of loud.

**The bet:** resolve caller identity once, into a single record every check and log reads from. Cuts identity lookups roughly in half. Target: fewer than 1 identity-attribution bug per release.

## UI: edits change only what you touched

**What you get:** you edit a field, hit save, and only that field changes. Nothing else moves.

**The problem today:** editing one field can silently break or remove another. You update one field, save, and a different field disappears.

**Why:** the data shapes our frontend and backend exchange have drifted apart, and a lot of older form code behaves inconsistently.

**The bet:** tighten the contract between frontend and backend, rework how forms handle data. Target: 0 inconsistency bugs across core flows. We'll prove it one page at a time, starting with the flows you use most.

## Want us to fix something?

This list came from your feedback and we want more of it. If something in LiteLLM is unreliable for you, comment here and we'll pick it up: https://github.com/BerriAI/litellm/issues/30484
