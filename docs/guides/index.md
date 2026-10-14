---
title: Features
sidebar_label: Overview
---

import NavigationCards from '@site/src/components/NavigationCards';

**Features** are the request options that LiteLLM supports across providers: streaming, tool calling, media input, prompt caching, and more. Most pages show the code for the Python SDK and the setup for the AI Gateway. A feature that applies to one product only is in the section for that product.

> New to LiteLLM? Start with the [AI Gateway Quickstart](/docs/proxy/docker_quick_start) or the [Python SDK Quickstart](/docs/learn/sdk_quickstart).

<NavigationCards
columns={3}
items={[
  {
    title: "Requests & Responses",
    description: "Streaming, batching, structured outputs, and reasoning.",
    to: "/docs/guides/core_request_response_patterns",
  },
  {
    title: "Tool Calling",
    description: "Function calling, web search and fetch, computer use, code interpreter, and knowledge bases.",
    to: "/docs/guides/tools_integrations",
  },
  {
    title: "Multimodal",
    description: "Vision, audio, PDF input, and image generation in chat.",
    to: "/docs/guides/multimodal_io",
  },
  {
    title: "Prompts & Context",
    description: "Prompt caching, assistant prefill, and predicted outputs.",
    to: "/docs/guides/prompts_context",
  },
  {
    title: "Compatibility",
    description: "Provider-specific params, unsupported params, and message sanitization.",
    to: "/docs/guides/compatibility_extensibility",
  },
]}
/>

## Other pages that were here

[Retries and fallbacks](/docs/completion/reliable_completions), [mock responses](/docs/completion/mock_requests), [message trimming](/docs/completion/message_trimming), [model aliases](/docs/completion/model_alias), and [prompt formatting](/docs/completion/prompt_formatting) are in the [Python SDK](/docs/python_sdk) section. [SSL and HTTP proxy settings](/docs/guides/security_settings) are in the AI Gateway configuration pages, and [custom formats](/docs/extras/creating_adapters) are with the custom plugins. [Fine-tuned models](/docs/guides/finetuned_models) are with the providers, and [Veo video generation](/docs/proxy/veo_video_generation) is with the video endpoints.
