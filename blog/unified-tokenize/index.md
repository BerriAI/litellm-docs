---
slug: unified-tokenize
title: "Tokenize text across vLLM and Watsonx"
date: 2026-10-23T13:00:00-07:00
authors:
  - ishaan
description: "Get token counts through /tokenize, plus IDs and text where supported. Switch vLLM and Watsonx in gateway config without changing your client."
tags: [engineering]
hide_table_of_contents: true
custom_hero: true
image: /img/unified-tokenize/launch.png
---

import TokenizeLaunch from './TokenizeLaunch';

<div data-blog-summary hidden>

Send text to vLLM or Watsonx through one LiteLLM tokenization interface. Your app calls `/tokenize` with a model alias and a prompt. Your gateway handles provider authentication, request translation and a common response format.

Switch the provider behind the alias and keep the same client request. Read the token count, numeric IDs and token strings where the provider supplies them. LiteLLM runs the provider integration in Rust and reuses shared HTTP clients.

This developer preview requires the implementation in [PR #48079](https://github.com/BerriAI/litellm/pull/48079) and its compiled Rust extension. The provider computes the tokens; token values and availability depend on the model.

</div>

<TokenizeLaunch />

<!-- truncate -->
