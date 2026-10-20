---
title: Learn LiteLLM
sidebar_label: Overview
slug: /learn
---

import NavigationCards from '@site/src/components/NavigationCards';
import {IconEnterprise, IconGateway, IconGuardrails, IconKey, IconLogs, IconProviders, IconRoute, IconSdk, IconTools} from '@site/src/components/Conversion/icons';

LiteLLM gives you one OpenAI-compatible interface for 100+ LLM providers. Start with the path that matches your setup.

<NavigationCards
columns={1}
items={[
  {
    title: "LiteLLM Academy",
    description: "Get started with our interactive course. Learn the fundamentals every platform admin needs, from gateway setup and access control to routing and observability.",
    ctaLabel: "Get started",
    to: "https://litellm.ai/course",
  },
]}
/>

---

## Start Here

Pick one path first.

<NavigationCards
columns={3}
items={[
  {
    icon: <IconGateway />,
    title: "Gateway Quickstart",
    description: "Run LiteLLM as a shared gateway.",
    listDescription: [
      "Start the gateway",
      "Add models and keys",
      "Connect clients",
    ],
    to: "/docs/learn/gateway_quickstart",
  },
  {
    icon: <IconSdk />,
    title: "SDK Quickstart",
    description: "Use LiteLLM directly in application code.",
    listDescription: [
      "Install",
      "First request",
      "Next SDK features",
    ],
    to: "/docs/learn/python_sdk_quickstart",
  },
  {
    icon: <IconEnterprise />,
    title: "Enterprise Quickstart",
    description: "Roll out LiteLLM Enterprise for all the teams in your company.",
    listDescription: [
      "Deploy and give access",
      "Connect clients and secure auth",
      "Set up chargeback",
    ],
    to: "/docs/learn/enterprise_quickstart_learn",
  },
]}
/>

---

## Cookbook

Step-by-step recipes that combine features into a complete workflow.

<NavigationCards
columns={3}
items={[
  {
    icon: <IconProviders />,
    title: "Connect apps and providers",
    description: "Set provider keys and call models from different providers.",
    to: "/docs/learn/call-any-model",
  },
  {
    icon: <IconKey />,
    title: "Control access",
    description: "Give access to teams and users, and connect your identity provider.",
    to: "/docs/learn/run-the-gateway",
  },
  {
    icon: <IconRoute />,
    title: "Control cost and capacity",
    description: "Add fallbacks and use prompt caching.",
    to: "/docs/learn/cost-and-reliability",
  },
  {
    icon: <IconGuardrails />,
    title: "Control content",
    description: "Add guardrails and mask personal data.",
    to: "/docs/learn/add-safety",
  },
  {
    icon: <IconTools />,
    title: "Connect tools and agents",
    description: "Use file search, vector stores, and realtime audio.",
    to: "/docs/learn/agents-and-tools",
  },
  {
    icon: <IconLogs />,
    title: "See what happened",
    description: "Send logs to observability tools and compare models.",
    to: "/docs/learn/observe-and-evaluate",
  },
]}
/>

To see every recipe on one page, go to [All Recipes](/docs/tutorials).
