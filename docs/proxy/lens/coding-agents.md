---
title: Trace coding agent sessions
description: Send your personal Claude Code and Codex sessions to LiteLLM Lens.
---

# Trace coding agent sessions

Send your personal Claude Code or Codex sessions to [LiteLLM Lens](./index.md) to inspect their recorded activity. Choose your agent below.

You need a LiteLLM gateway with [tracing enabled](./deployment.md#configure-an-existing-proxy) and a [virtual key](/docs/proxy/virtual_keys). If you are starting from scratch, follow the [Lens deployment guide](./deployment.md#quick-start). A Lens worker is only required for investigations; you can view traces without one.

## Claude Code

Claude Code needs no Lens plugin or helper. Its built-in [OpenTelemetry exporters](https://code.claude.com/docs/en/monitoring-usage) send trace spans and assistant response logs directly to Lens. Model calls can continue through your Claude subscription or your existing API provider; leave your Claude login and model endpoint unchanged.

This setup requires a gateway version that accepts Claude conversation logs at `/v1/logs`. Older gateways only accept trace spans and cannot reconstruct replies that were never recorded. Use a current Claude Code version with assistant response logging support.

In the terminal where you run `claude`, replace the gateway URL and key, then run:

```bash
export CLAUDE_CODE_ENABLE_TELEMETRY=1
export CLAUDE_CODE_ENHANCED_TELEMETRY_BETA=1
export OTEL_TRACES_EXPORTER=otlp
export OTEL_EXPORTER_OTLP_TRACES_ENDPOINT="https://<your-litellm-proxy>/v1/traces"
export OTEL_EXPORTER_OTLP_TRACES_PROTOCOL="http/protobuf"
export OTEL_EXPORTER_OTLP_TRACES_HEADERS="Authorization=Bearer <your-litellm-key>"
export OTEL_METRICS_EXPORTER=none
export OTEL_LOGS_EXPORTER=otlp
export OTEL_EXPORTER_OTLP_LOGS_ENDPOINT="https://<your-litellm-proxy>/v1/logs"
export OTEL_EXPORTER_OTLP_LOGS_PROTOCOL="http/protobuf"
export OTEL_EXPORTER_OTLP_LOGS_HEADERS="Authorization=Bearer <your-litellm-key>"
export OTEL_RESOURCE_ATTRIBUTES="lens.session.capture=true,gen_ai.agent.name=claude-code"

export OTEL_LOG_USER_PROMPTS=1
export OTEL_LOG_ASSISTANT_RESPONSES=1
export OTEL_LOG_TOOL_DETAILS=1
export OTEL_LOG_TOOL_CONTENT=1

claude
```

The content flags include prompts, assistant replies, tool arguments, and supported tool outputs, which can contain source code or secrets. Enable them only for a gateway where you intend to store that content.

Complete a prompt that uses a tool, then open **Lens > Traces**, select **claude-code**, and switch the trace to **Conversation**. You should see your prompt, commentary, tool activity, and final reply. Child agents appear in expandable branches. Background title generation and suggested prompts are excluded from the conversation.

`lens.session.capture=true` groups turns with the same Claude session ID into one trace, including resumed sessions and background-agent replies. Original trace IDs remain in span attributes. Omit this resource attribute to retain Claude's separate traces per interaction. If you already set `OTEL_RESOURCE_ATTRIBUTES`, append these values instead of replacing your existing attributes.

Assistant replies use a separate telemetry stream from trace spans. Keep both exporters enabled. The allowlisted detailed-tracing endpoint is not required. See Claude Code's [monitoring reference](https://code.claude.com/docs/en/monitoring-usage) for the beta exporter's coverage and content limits.

Claude's stable tool-output events omit failed executions and some tool kinds. To fill these gaps from the next model request, optionally enable native API-body export:

```bash
export OTEL_LOG_RAW_API_BODIES=1
export CLAUDE_CODE_OTEL_CONTENT_MAX_LENGTH=1048576
```

This sends full API bodies, including conversation history and source content, to the gateway. Lens extracts tool results for Conversation and discards the body attribute. The larger limit avoids Claude's default 60 KB truncation in typical short sessions, but long sessions can still exceed it. Lens warns when a body is incomplete. Results that are never sent to another model request remain unavailable. `file:<dir>` mode writes bodies only on your machine and cannot supply them to a remote gateway.

The conversation below includes a deliberately failed command. With the optional body export, Lens shows its stdout alongside the failure and the assistant's final reply.

![Claude Code conversation showing a failed command and its captured output](/img/lens-coding-agents/claude-after.jpg)

For persistent configuration, add these variables to the `env` object in your user-level `~/.claude/settings.json`, preserving existing settings. Repository-level settings cannot enable telemetry or choose its destination. Managed settings may override your local destination.

## Codex

Use the [BerriAI Codex integration on GitHub](https://github.com/BerriAI/litellm-lens-codex-integration). This public preview supports local Codex desktop and CLI sessions. Automatic setup currently supports macOS and requires Python 3.11 or later. {/* keep-python-version: Codex integration prerequisite */}

1. Follow **[From Terminal (recommended)](https://github.com/BerriAI/litellm-lens-codex-integration#from-terminal-recommended)** in the installation guide. The same installer works for desktop and CLI.
2. Enter your **gateway URL**, **LiteLLM virtual key**, and **agent name** in Terminal. Confirm to start recording. Enter the key at the hidden prompt, not in chat.
3. **Start a new Codex chat and complete a turn.** Open **Lens > Traces** and find the agent name you chose.

Each chat has one trace, updated after completed or interrupted turns. Reopening a chat continues its trace. Only activity after setup is recorded.

The plugin reads visible transcript items for newly recorded turns, including commentary, repeated messages, tool outcomes, model changes, and subagents. Completed transcript turns can be recovered when a completion hook is missing. See the [coverage and privacy details](https://github.com/BerriAI/litellm-lens-codex-integration#what-youll-see) for its limits. To pause recording, ask Codex: `Use lens-setup to pause recording.`

## Coverage and troubleshooting

Lens shows the content the coding agent exported. It cannot recover missing content from older traces. Claude's native telemetry does not export an exact terminal recording: images, hidden reasoning, local menus, permission dialogs, and some session events may be absent. Claude also limits exported content length; long tool results or replies can be truncated before Lens receives them. Codex replaces media with explicit omission markers and identifies unsupported transcript items. These limits prevent a promise of identical rendering for every session or future agent version.

If Claude shows tools but no replies, check `OTEL_LOGS_EXPORTER`, `OTEL_LOG_ASSISTANT_RESPONSES`, and the logs endpoint. A `404` for `/v1/logs` means the gateway needs an update. Allow the exporters to flush after a turn. Do not enable raw API-body export to compensate for missing reply logs.

To change the Claude agent name, set `gen_ai.agent.name` in `OTEL_RESOURCE_ATTRIBUTES`. For example, `gen_ai.agent.name=my-claude-code,developer=alice,lens.session.capture=true`. Use that exact name in the trace filter and in any investigation's agent filter. An investigation restricted to `claude-code` will not sample `my-claude-code` automatically.

For large traces, use **Load next steps** in Conversation to load later activity. If a step fails to load, retry it before loading the next page. Subagent branches preserve their own messages and tool results so concurrent agents do not appear to be one speaker.
