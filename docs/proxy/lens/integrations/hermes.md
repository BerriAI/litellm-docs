---
title: "Hermes"
description: "Send Hermes agent activity to LiteLLM Lens."
slug: "/proxy/lens/integrations/hermes"
---

# Hermes

Configure the [trace destination](../first-trace.md#send-your-first-trace) and set your LiteLLM key before following these steps.

Install and enable the community [hermes-otel plugin](https://github.com/briancaffey/hermes-otel#install). Set `LITELLM_API_KEY` to your LiteLLM key, then add this to `~/.hermes/hermes_otel.yaml`:

```yaml title="hermes_otel.yaml"
resource_attributes:
  gen_ai.agent.name: research_agent
content_capture: full
backends:
  - type: otlp
    endpoint: ${OTEL_EXPORTER_OTLP_TRACES_ENDPOINT}
    headers:
      Authorization: "Bearer ${LITELLM_API_KEY}"
    metrics: false
    logs: false
```

Start a new Hermes session and ask a question. The configured name **research_agent** appears in Lens. Hermes' built-in diagnostic telemetry alone does not include the conversation content needed for investigations.
