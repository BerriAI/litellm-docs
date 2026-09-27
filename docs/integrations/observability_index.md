---
title: Observability
sidebar_label: Overview
slug: observability_integrations
---

Track, debug, and analyze LLM calls with observability platforms.

import NavigationCards from '@site/src/components/NavigationCards';

export const Logo = ({ src }) => (
  <img src={src} alt="" />
);

## Observability Integrations

<NavigationCards
columns={3}
items={[
  { icon: <Logo src="/img/integrations/langfuse.png" />, title: "Langfuse", description: "LLM observability and analytics.", to: "/docs/observability/langfuse_integration" },
  { icon: <Logo src="/img/integrations/datadog.png" />, title: "Datadog", description: "Metrics, traces, and dashboards.", to: "/docs/observability/datadog" },
  { icon: <Logo src="/img/integrations/grafana.png" />, title: "Grafana Cloud", description: "LLM traces, GenAI metrics, and dashboards.", to: "/docs/observability/grafana_cloud" },
  { icon: <Logo src="/img/integrations/opentelemetry.png" />, title: "OpenTelemetry", description: "Vendor-neutral tracing.", to: "/docs/observability/opentelemetry_integration" },
  { icon: <Logo src="/img/integrations/langsmith.png" />, title: "LangSmith", description: "LLM debugging and evaluation.", to: "/docs/observability/langsmith_integration" },
  { icon: <Logo src="/img/integrations/arize.png" />, title: "Arize AX", description: "Hosted LLM observability and evaluation.", to: "/docs/observability/arize_integration" },
  { icon: <Logo src="/img/integrations/arize.png" />, title: "Arize Phoenix", description: "Open-source tracing and evaluation.", to: "/docs/observability/phoenix_integration" },
  { icon: <Logo src="/img/integrations/helicone.png" />, title: "Helicone", description: "LLM request logging and analytics.", to: "/docs/observability/helicone_integration" },
  { icon: <Logo src="/img/integrations/mlflow.png" />, title: "MLflow", description: "Experiment tracking.", to: "/docs/observability/mlflow" },
  { icon: <Logo src="/img/integrations/wandb.png" />, title: "Weights & Biases", description: "ML experiment tracking.", to: "/docs/observability/wandb_integration" },
  { icon: <Logo src="/img/integrations/posthog.png" />, title: "PostHog", description: "Product analytics.", to: "/docs/observability/posthog_integration" },
  { icon: <Logo src="/img/integrations/splunk.png" />, title: "Splunk Observability Cloud", description: "OTLP traces to Splunk.", to: "/docs/observability/splunk_observability_cloud" },
]}
/>

[View all observability integrations →](/docs/observability/callbacks)
