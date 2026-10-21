---
title: Cookbook
sidebar_label: All Recipes
---

import NavigationCards from '@site/src/components/NavigationCards';

The **Cookbook** has step-by-step recipes. Each recipe connects LiteLLM to an external tool, framework, or service, or builds a complete workflow from start to end. To set up LiteLLM first, use the [Gateway Quickstart](/docs/learn/gateway_quickstart) or the [SDK Quickstart](/docs/learn/python_sdk_quickstart).

<NavigationCards
columns={2}
items={[
  {
    title: "Connect apps and providers",
    description: "Install the SDK, set provider keys, and call Azure OpenAI, HuggingFace, TogetherAI, and local models.",
    to: "/docs/learn/call-any-model",
  },
  {
    title: "Control access",
    description: "Manage users and teams, and connect SSO and SCIM.",
    to: "/docs/learn/run-the-gateway",
  },
  {
    title: "Control cost and capacity",
    description: "Add fallbacks and use prompt caching.",
    to: "/docs/learn/cost-and-reliability",
  },
  {
    title: "Control content",
    description: "Add guardrails and PII masking with Aporia and Presidio.",
    to: "/docs/learn/add-safety",
  },
  {
    title: "See what happened",
    description: "Send logs to Elasticsearch, compare models, and run evaluation suites.",
    to: "/docs/learn/observe-and-evaluate",
  },
  {
    title: "Connect tools and agents",
    description: "Use agent SDKs, coding tools, file search, vector stores, and realtime audio.",
    to: "/docs/learn/agents-and-tools",
  },
]}
/>
