---
slug: version-support
title: "LiteLLM version support: focusing on the four most recent stable lines"
date: 2026-06-20
authors:
  - yuneng
description: "Starting Monday, June 29, 2026, LiteLLM actively supports the four most recent stable minor lines. Older lines reach end of life, and the window rolls forward as new stable lines ship."
tags: [release, support]
hide_table_of_contents: false
---

*Starting Monday, June 29, 2026, LiteLLM actively supports the four most recent stable minor lines. Here's what's changing and what it means for you.*

## Why we're doing this

LiteLLM ships fast, a new stable line about every week. Maintaining older lines means carrying every fix back to keep them all in parity. That overhead grows with the number of lines we keep alive, not the number of fixes we make. Our focus is ensuring the most up-to-date product offerings are stable and working for you. Because of this, LiteLLM is focusing on the four most recent stable minor lines going forward.

## How the rolling window works

This shift in focus takes effect Monday, June 29, 2026. The window rolls forward: when a new line ships, the oldest drops. For example, if 1.89 is the latest stable line, then 1.86 will be the oldest still supported, and with a new line about every week that works out to roughly a month of coverage per line.

## What this means for you

To stay supported, pin to a line and take its patches, then move up before it ages out. Patching within a line is a drop-in; moving up a line is where you'd check the release notes for changes. Enterprise customers who need longer coverage can reach out, and for rare high-severity issues we'll use our judgment and may patch outside the window.

## How to stay current

The best way to stay up to date on these changes is to bookmark our [release notes](https://docs.litellm.ai/release_notes). We update it every time a new version ships, so you can always see the latest stable line and the three behind it that are still supported.
