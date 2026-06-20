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

*Starting Monday, June 29, 2026, LiteLLM will only actively support the four most recent stable minor lines. Here's what's changing and what it means for you.*

## Why we're doing this

Maintaining older lines means carrying every fix back to keep them all in parity. That overhead grows with the number of lines we keep alive, not the number of fixes we make. Our focus is ensuring the most up-to-date product offerings are stable and working for you. Because of this, LiteLLM is focusing on the four most recent stable minor lines going forward.

## How the rolling window works

This shift in focus takes effect Monday, June 29, 2026.

A minor line is a release series written as 1.89.x, covering every patch in it: 1.89.0, 1.89.1, 1.89.2, and any later ones. We support the four most recent lines and every patch inside each of them.

Today the four supported lines are **1.89.x, 1.88.x, 1.87.x, and 1.86.x**. Everything **1.85.x and earlier** has reached end of life and will no longer actively receive updates. The window rolls forward: when 1.90.x ships, 1.86.x rolls out and the supported set becomes 1.90.x, 1.89.x, 1.88.x, and 1.87.x. With a new line about every week, that works out to roughly a month of coverage per line.

## What this means for you

To stay supported, pin to a line and take its patches, then move up before it ages out. Patching within a line is a drop-in; moving up a line is where you'd check the release notes for changes. Enterprise customers who need longer coverage can reach out, and for rare high-severity issues we'll use our judgment and may patch outside the window.

## How to stay current

The best way to stay up to date on these changes is to bookmark our [release notes](https://docs.litellm.ai/release_notes). We update it as new versions ship, so you can see the latest stable line and the three behind it that are still supported.
