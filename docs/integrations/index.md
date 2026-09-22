---
title: Integrations
sidebar_label: Overview
---

import NavigationCards from '@site/src/components/NavigationCards';

This section covers integrations with various tools and services that can be used with LiteLLM (either Proxy or SDK).

---

## Observability

Track, debug, and analyze LLM calls with observability platforms.

<NavigationCards
columns={3}
items={[
  {
    icon: "🪢",
    title: "Langfuse",
    description: "LLM observability and analytics.",
    to: "/docs/observability/langfuse_integration",
  },
  {
    icon: "🐶",
    title: "Datadog",
    description: "Metrics, traces, and dashboards.",
    to: "/docs/observability/datadog",
  },
  {
    icon: <img src="/img/observability/grafana_icon.svg" alt="" style={{ width: 24, height: 24, display: "block" }} />,
    title: "Grafana Cloud",
    description: "LLM traces, GenAI metrics, and dashboards.",
    to: "/docs/observability/grafana_cloud",
  },
  {
    icon: "📡",
    title: "OpenTelemetry",
    description: "Vendor-neutral tracing.",
    to: "/docs/observability/opentelemetry_integration",
  },
  {
    icon: "🔗",
    title: "LangSmith",
    description: "LLM debugging and evaluation.",
    to: "/docs/observability/langsmith_integration",
  },
  {
    icon: "🔥",
    title: "Arize / Phoenix",
    description: "ML observability and evaluation.",
    to: "/docs/observability/opentelemetry_v2",
  },
  {
    icon: "🌀",
    title: "Helicone",
    description: "LLM request logging and analytics.",
    to: "/docs/observability/helicone_integration",
  },
  {
    icon: "📊",
    title: "MLflow",
    description: "Experiment tracking.",
    to: "/docs/observability/mlflow",
  },
  {
    icon: "🏋️",
    title: "Weights & Biases",
    description: "ML experiment tracking.",
    to: "/docs/observability/wandb_integration",
  },
  {
    icon: "📉",
    title: "PostHog",
    description: "Product analytics.",
    to: "/docs/observability/posthog_integration",
  },
]}
/>

[View all observability integrations →](/docs/integrations/observability_integrations)

---

## Alerting & Monitoring

Set up alerts, metrics collection, and infrastructure monitoring.

<NavigationCards
columns={2}
items={[
  {
    icon: "📈",
    title: "Prometheus",
    description: "Metrics collection and monitoring.",
    to: "/docs/proxy/prometheus",
  },
  {
    icon: "🚨",
    title: "PagerDuty",
    description: "Incident response and alerting.",
    to: "/docs/proxy/pagerduty",
  },
  {
    icon: "🔔",
    title: "Alerting",
    description: "Slack, Teams, and webhook alerts.",
    to: "/docs/proxy/alerting",
  },
  {
    icon: "🔍",
    title: "Pyroscope",
    description: "Continuous profiling.",
    to: "/docs/proxy/pyroscope_profiling",
  },
]}
/>

---

## Guardrail Providers

Add safety and content filtering to LLM calls.

<NavigationCards
columns={3}
items={[
  {
    icon: "🛡️",
    title: "Lakera AI",
    description: "Prompt injection detection.",
    to: "/docs/proxy/guardrails/lakera_ai",
  },
  {
    icon: "☁️",
    title: "Azure Content Safety",
    description: "Content moderation.",
    to: "/docs/proxy/guardrails/azure_content_guardrail",
  },
  {
    icon: "🛏️",
    title: "Bedrock Guardrails",
    description: "AWS Bedrock safety.",
    to: "/docs/proxy/guardrails/bedrock",
  },
  {
    icon: "🤖",
    title: "OpenAI Moderation",
    description: "OpenAI content policy.",
    to: "/docs/proxy/guardrails/openai_moderation",
  },
  {
    icon: "🔐",
    title: "Secret Detection",
    description: "Prevent credential leaks.",
    to: "/docs/proxy/guardrails/secret_detection",
  },
  {
    icon: "🕵️",
    title: "PII Masking",
    description: "Mask sensitive data.",
    to: "/docs/proxy/guardrails/pii_masking_v2",
  },
]}
/>

[View all guardrail providers →](/docs/guardrail_providers)

---

## Policies

Define and enforce usage policies across your LLM deployment.

<NavigationCards
columns={3}
items={[
  {
    icon: "📋",
    title: "Guardrail Policies",
    description: "Policy-based guardrail rules.",
    to: "/docs/proxy/guardrails/guardrail_policies",
  },
  {
    icon: "🔀",
    title: "Policy Flow Builder",
    description: "Visual policy configuration.",
    to: "/docs/proxy/guardrails/policy_flow_builder",
  },
  {
    icon: "📄",
    title: "Policy Templates",
    description: "Pre-built policy templates.",
    to: "/docs/proxy/guardrails/policy_templates",
  },
]}
/>

---

## AI Tools

Connect LiteLLM to AI-powered coding and productivity tools.

<NavigationCards
columns={3}
items={[
  {
    icon: "💬",
    title: "OpenWebUI",
    description: "Self-hosted ChatGPT-style interface.",
    to: "/docs/tutorials/openweb_ui",
  },
  {
    icon: "🤖",
    title: "Claude Code",
    description: "Use LiteLLM with Claude Code.",
    to: "/docs/tutorials/claude_responses_api",
  },
  {
    icon: "🖱️",
    title: "Cursor",
    description: "AI code editor integration.",
    to: "/docs/tutorials/cursor_integration",
  },
  {
    icon: "🐙",
    title: "GitHub Copilot",
    description: "GitHub Copilot integration.",
    to: "/docs/tutorials/github_copilot_integration",
  },
  {
    icon: "💻",
    title: "OpenCode",
    description: "Open source coding assistant.",
    to: "/docs/tutorials/opencode_integration",
  },
  {
    icon: "🔧",
    title: "Retool Assist",
    description: "Retool AI assistant.",
    to: "/docs/tutorials/retool_assist",
  },
]}
/>

---

## Agent SDKs

Use LiteLLM with agent frameworks and SDKs.

<NavigationCards
columns={3}
items={[
  {
    icon: "🤖",
    title: "OpenAI Agents SDK",
    description: "Build agents with OpenAI's SDK.",
    to: "/docs/tutorials/openai_agents_sdk",
  },
  {
    icon: "🧠",
    title: "Claude Agent SDK",
    description: "Build agents with Anthropic's SDK.",
    to: "/docs/tutorials/claude_agent_sdk",
  },
  {
    icon: "🌐",
    title: "Google ADK",
    description: "Google Agent Development Kit.",
    to: "/docs/tutorials/google_adk",
  },
  {
    icon: "🚀",
    title: "CopilotKit",
    description: "In-app AI copilots.",
    to: "/docs/tutorials/copilotkit_sdk",
  },
  {
    icon: "🧬",
    title: "Letta",
    description: "Build stateful LLM agents with persistent memory.",
    to: "/docs/integrations/letta",
  },
  {
    icon: "🎙️",
    title: "LiveKit",
    description: "Real-time voice and video AI agents.",
    to: "/docs/tutorials/livekit_xai_realtime",
  },
]}
/>

---

## Prompt Management

Manage, version, and deploy prompts.

<NavigationCards
columns={3}
items={[
  {
    icon: "📝",
    title: "LiteLLM Prompt Management",
    description: "Built-in prompt management.",
    to: "/docs/proxy/litellm_prompt_management",
  },
  {
    icon: "🔌",
    title: "Custom Prompt Management",
    description: "Bring your own prompt store.",
    to: "/docs/proxy/custom_prompt_management",
  },
  {
    icon: "🔥",
    title: "Arize Phoenix Prompts",
    description: "Prompt management with Phoenix.",
    to: "/docs/proxy/arize_phoenix_prompts",
  },
]}
/>

---

## Manage with AI Agents

Use AI agents to manage your LiteLLM deployment: create users, teams, keys, models, and more via natural language.

<NavigationCards
columns={1}
items={[
  {
    icon: "🤖",
    title: "LiteLLM Skills",
    description: "Manage LiteLLM via Claude Code: create keys, teams, models, and more using natural language commands.",
    to: "/docs/tutorials/claude_code_skills",
  },
]}
/>
