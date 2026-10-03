---
title: Trace coding agent sessions
description: Send your personal Claude Code and Codex sessions to LiteLLM Lens.
---

# Trace coding agent sessions

Send your personal Claude Code or Codex sessions to [LiteLLM Lens](../lens.md) to inspect their recorded activity. Choose your agent below.

You need a LiteLLM gateway with [tracing enabled](../lens.md#configure-an-existing-proxy) and a [virtual key](../virtual_keys.md). If you are starting from scratch, follow the [Lens deployment guide](../lens.md#quick-start). A Lens worker is only required for investigations; you can view traces without one.

## Claude Code

Claude Code has a built-in [OpenTelemetry tracing exporter](https://code.claude.com/docs/en/monitoring-usage#traces-beta), currently in beta. In the terminal where you run `claude`, replace the gateway URL and key, then run:

```bash
export CLAUDE_CODE_ENABLE_TELEMETRY=1
export CLAUDE_CODE_ENHANCED_TELEMETRY_BETA=1
export OTEL_TRACES_EXPORTER=otlp
export OTEL_EXPORTER_OTLP_TRACES_ENDPOINT="https://<your-litellm-proxy>/v1/traces"
export OTEL_EXPORTER_OTLP_TRACES_PROTOCOL="http/protobuf"
export OTEL_EXPORTER_OTLP_TRACES_HEADERS="Authorization=Bearer <your-litellm-key>"
export OTEL_METRICS_EXPORTER=none
export OTEL_LOGS_EXPORTER=none

export OTEL_LOG_USER_PROMPTS=1
export OTEL_LOG_TOOL_DETAILS=1
export OTEL_LOG_TOOL_CONTENT=1

claude
```

The content flags include prompts, tool arguments, and supported tool outputs, which can contain source code or secrets. Enable them only for a gateway where you intend to store that content.

Complete a prompt that uses a tool, then open **Lens > Traces** and select **claude-code**. Each user prompt produces a trace with its API requests and tool calls underneath. This setup records prompts and supported tool activity; it does not include a complete conversation transcript. See Claude Code's [span reference](https://code.claude.com/docs/en/monitoring-usage#span-attributes) for content coverage.

For persistent configuration, add these variables to the `env` object in your user-level `~/.claude/settings.json`, preserving existing settings. Repository-level settings cannot enable telemetry or choose its destination. Managed settings may override your local destination.

## Codex

Use the [BerriAI Codex integration on GitHub](https://github.com/BerriAI/litellm-lens-codex-integration). This public preview supports local Codex desktop and CLI sessions. Automatic setup currently supports macOS and requires Python 3.11 or later. {/* keep-python-version: Codex integration prerequisite */}

1. Follow **[From Terminal (recommended)](https://github.com/BerriAI/litellm-lens-codex-integration#from-terminal-recommended)** in the installation guide. The same installer works for desktop and CLI.
2. Enter your **gateway URL**, **LiteLLM virtual key**, and **agent name** in Terminal. Confirm to start recording. Enter the key at the hidden prompt, not in chat.
3. **Start a new Codex chat and complete a turn.** Open **Lens > Traces** and find the agent name you chose.

Each chat has one trace, updated after completed or interrupted turns. Reopening a chat continues its trace. Only activity after setup is recorded.

The plugin captures prompts, final replies, and supported local tool calls. See the [coverage and privacy details](https://github.com/BerriAI/litellm-lens-codex-integration#what-youll-see) for its limits. To pause recording, ask Codex: `Use lens-setup to pause recording.`
