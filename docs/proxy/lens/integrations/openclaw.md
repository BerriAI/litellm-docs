---
title: "OpenClaw"
description: "Send OpenClaw agent activity to LiteLLM Lens."
slug: "/proxy/lens/integrations/openclaw"
---

# OpenClaw

Configure the [trace destination](../first-trace.md#send-your-first-trace) and set your LiteLLM key before following these steps.

Enable the [diagnostics-otel plugin](https://docs.openclaw.ai/plugins/reference/diagnostics-otel). Set your agent ID once in `~/.openclaw/openclaw.json`. Keep your existing model and workspace settings when adding the tracing configuration:

```json title="openclaw.json"
{
  "agents": {
    "list": [{ "id": "research_agent" }]
  },
  "plugins": {
    "entries": { "diagnostics-otel": { "enabled": true } }
  },
  "diagnostics": {
    "enabled": true,
    "otel": {
      "enabled": true,
      "tracesEndpoint": "${OTEL_EXPORTER_OTLP_TRACES_ENDPOINT}",
      "headers": { "Authorization": "Bearer ${LITELLM_API_KEY}" },
      "captureContent": true,
      "traces": true,
      "metrics": false,
      "logs": false,
      "sampleRate": 1
    }
  }
}
```

Set `LITELLM_API_KEY` to your LiteLLM key, then run `openclaw agent --local --session-id first-trace --message "What is an agent trace?"`. Select **research_agent** in Lens. Restart an existing gateway after changing the config.
