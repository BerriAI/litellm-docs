---
title: Learn LiteLLM
sidebar_label: Learn
slug: /learn
---

import NavigationCards from '@site/src/components/NavigationCards';
import {IconCourse, IconEnterprise, IconGateway, IconGuides, IconKey, IconLogs, IconProviders, IconRoute, IconSdk, IconSteps, IconStream, IconTools} from '@site/src/components/Conversion/icons';

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
    icon: <IconSdk />,
    title: "SDK Quickstart",
    description: "Use LiteLLM directly in application code.",
    listDescription: [
      "Install",
      "First request",
      "Next SDK features",
    ],
    to: "/docs/learn/sdk_quickstart",
  },
  {
    icon: <IconGateway />,
    title: "Gateway Quickstart",
    description: "Run LiteLLM as a shared gateway.",
    listDescription: [
      "Start proxy",
      "Add models and keys",
      "Connect clients",
    ],
    to: "/docs/learn/gateway_quickstart",
  },
  {
    icon: <IconEnterprise />,
    title: "Enterprise Quickstart",
    description: "Quickstart Guide for LiteLLM Enterprise: LLM, MCP, and Agent gateway.",
    listDescription: [
      "Deploy with license",
      "Validate three gateways",
      "Enable enterprise controls",
    ],
    to: "/docs/learn/enterprise_quickstart",
  },
]}
/>

---

## Common Tasks

Jump to a specific task.

<NavigationCards
columns={3}
items={[
  {
    icon: <IconStream />,
    title: "Stream Responses",
    description: "Return tokens as they are generated.",
    to: "/docs/guides/core_request_response_patterns",
  },
  {
    icon: <IconTools />,
    title: "Use Tools",
    description: "Add function calling to your app.",
    to: "/docs/guides/tools_integrations",
  },
  {
    icon: <IconRoute />,
    title: "Add Routing",
    description: "Retries, fallbacks, and load balancing.",
    to: "/docs/routing-load-balancing",
  },
  {
    icon: <IconKey />,
    title: "Set Up Keys",
    description: "Gateway auth, virtual keys, and access control.",
    to: "/docs/proxy/virtual_keys",
  },
  {
    icon: <IconLogs />,
    title: "Add Logging",
    description: "Capture request logs and spend data.",
    to: "/docs/proxy/logging",
  },
  {
    icon: <IconProviders />,
    title: "Choose A Provider",
    description: "Find provider-specific auth and params.",
    to: "/docs/providers",
  },
]}
/>

---

## Docs Map

Use these when you already know the type of doc you want.

<NavigationCards
columns={3}
items={[
  {
    icon: <IconCourse />,
    title: "LiteLLM Academy",
    description: "Guided course on how the gateway handles requests, routing, access, and costs.",
    to: "https://litellm.ai/course",
  },
  {
    icon: <IconGuides />,
    title: "Guides",
    description: "Feature reference.",
    to: "/docs/guides",
  },
  {
    icon: <IconSteps />,
    title: "Tutorials",
    description: "Step-by-step integrations.",
    to: "/docs/tutorials",
  },
]}
/>

Not sure where to start? Use [SDK Quickstart](/docs/learn/sdk_quickstart) for app code, [Gateway Quickstart](/docs/learn/gateway_quickstart) for shared infrastructure, or [Enterprise Quickstart](/docs/learn/enterprise_quickstart) for a trial or PoC evaluation.
