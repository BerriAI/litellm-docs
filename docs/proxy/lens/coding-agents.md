---
title: Trace coding agent sessions
description: Install the LiteLLM Lens plugin for Claude Code or Codex to send sessions to Lens, then open the recorded activity in Traces.
---

import AgentPrompt from '@site/src/components/Conversion/AgentPrompt';

# Trace coding agent sessions

Record your [Claude Code](#claude-code) and [Codex](#codex) sessions in Lens with the [LiteLLM Lens plugins](https://github.com/BerriAI/litellm-lens-plugins). Each plugin reads the transcript the agent already writes on your machine and sends it to Lens after each turn, so a session is one trace with its prompts, replies, tool calls and model calls. Your model login and model endpoint stay unchanged.

You need a running Lens installation. If you are starting from scratch, follow the [Lens deployment guide](./deployment/local.md).

A plugin takes an address and a key. Which ones depends on how the agent reaches Lens, and **Home** in Lens offers both under **Connect a new agent**:

| How the agent connects | Address the plugin uses | Key the plugin uses |
| --- | --- | --- |
| **Through the LiteLLM gateway**: the agent's model calls already go through a gateway [connected to Lens](./deployment/litellm.md) | Your gateway address, such as `http://localhost:4000` | The LiteLLM key the agent already uses for model calls |
| **Standalone Lens**: the agent does not use LiteLLM | Your Lens address, such as `http://localhost:4318` | A dedicated Lens tracing key |

The quickest setup is the prompt on Lens Home: choose the path, choose your coding agent, and select the copy button. Paste the copied instructions into that coding agent and it installs the plugin and runs one real task. On the standalone path, **Copy instructions with new key** creates the tracing key for you. To install a plugin by hand, follow the section for your agent.

Through a gateway, the gateway stamps each trace with the key's user and team and forwards it to Lens. A tracing key uploads telemetry. It does not call models or read traces. Keep it private. Replace the example addresses with your own and keep any `/lens-ingest` prefix.

## Claude Code

Use the [LiteLLM Lens plugin for Claude Code](https://github.com/BerriAI/litellm-lens-plugins/tree/main/claude-code). Every Claude Code session becomes one trace, and no telemetry variables are needed. The plugin needs Claude Code, Python 3.10 or later on the `PATH`, and macOS or Linux. {/* keep-python-version: Claude Code plugin prerequisite */}

Copy this prompt into Claude Code to have it install and configure the plugin, or run the commands below.

<AgentPrompt id="lens-claude-code" />

Install the plugin with your address and the environment variable that holds your key. When Claude Code already goes through your LiteLLM gateway, that is the gateway address and `ANTHROPIC_AUTH_TOKEN`:

```bash
claude plugin marketplace add BerriAI/litellm-lens-plugins
claude plugin install litellm-lens@berriai-lens \
  --config lens_url="$ANTHROPIC_BASE_URL" --config lens_key="$ANTHROPIC_AUTH_TOKEN"
```

With standalone Lens, pass your Lens address and a Lens tracing key:

```bash
export LITELLM_TRACING_KEY="<paste your Lens tracing key>"

claude plugin marketplace add BerriAI/litellm-lens-plugins
claude plugin install litellm-lens@berriai-lens \
  --config lens_url="http://localhost:4318" --config lens_key="$LITELLM_TRACING_KEY"
```

Leave out the two `--config` options and Claude Code asks for the address and key the next time it starts. Claude Code keeps the key in its secure storage. Installing again does not change a saved address or key, so run `claude plugin uninstall litellm-lens@berriai-lens` first to change them.

Run one task, then restart any Claude Code sessions you had open so they load the plugin:

```bash
claude -p "Reply with exactly: Lens plugin check."
```

Open **Lens > Traces** in LiteLLM or **Traces** in standalone Lens and filter by **claude-code**. A session is one trace. Each prompt is a turn with its reply, each tool call is a step with its arguments and output, including failed tools, and each model call is its own step with its model, tokens and reply. A subagent's steps nest under the turn that started it. When Claude Code's model calls go through the LiteLLM gateway, each model call also shows its cost.

The plugin sends in the background after each turn and prints nothing, so a trace updates when a turn completes. A model call step shows the messages added since the previous call, not the full request. Thinking, images and documents are not sent. If no trace arrives, read `last_error.txt` in `~/.claude/plugins/data/litellm-lens-berriai-lens`.

The plugin stores what you type, the replies, and the arguments and output of the tools Claude Code runs. That content can include source code or secrets, so use it only with a Lens deployment where you intend to keep it.

Verified with Claude Code **2.1.330** on Linux.

### Fallback: Claude Code telemetry {#claude-code-telemetry}

Use Claude Code's own [OpenTelemetry export](https://code.claude.com/docs/en/monitoring-usage) only where the plugin cannot run, such as on Windows or without Python. The plugin sends nothing while `CLAUDE_CODE_ENABLE_TELEMETRY` and `CLAUDE_CODE_ENHANCED_TELEMETRY_BETA` are both set, so a session is never recorded twice; remove those two settings to use the plugin.

Through a gateway, the export needs LiteLLM v1.112.0 or later. An earlier gateway answers `POST /v1/logs` with `410`. {/* keep-version-note: The first gateway release that forwards agent telemetry is the subject of this note. */}

```bash
export LENS_OTLP_ADDRESS="http://localhost:4000"   # your gateway address, or your Lens address
export LENS_OTLP_KEY="<your LiteLLM key, or your Lens tracing key>"

export CLAUDE_CODE_ENABLE_TELEMETRY=1
export CLAUDE_CODE_ENHANCED_TELEMETRY_BETA=1
export CLAUDE_CODE_PROPAGATE_TRACEPARENT=1
export OTEL_TRACES_EXPORTER=otlp
export OTEL_LOGS_EXPORTER=otlp
export OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
export OTEL_EXPORTER_OTLP_ENDPOINT="$LENS_OTLP_ADDRESS"
export OTEL_EXPORTER_OTLP_HEADERS="Authorization=Bearer $LENS_OTLP_KEY"
export OTEL_LOG_USER_PROMPTS=1
export OTEL_LOG_ASSISTANT_RESPONSES=1
export OTEL_LOG_TOOL_DETAILS=1
export OTEL_LOG_TOOL_CONTENT=1
export OTEL_LOG_RAW_API_BODIES=1
export CLAUDE_CODE_OTEL_CONTENT_MAX_LENGTH=16777216
```

The endpoint is the address with no path; Claude Code adds `/v1/traces` and `/v1/logs` itself. With telemetry, each turn is its own `claude_code.interaction` trace, grouped by session in Lens. The [Lens Claude Code guide](https://github.com/BerriAI/lens/blob/main/docs/claude-code.md#fallback-claude-code-telemetry) says what each variable does, what Lens shows without it, and how to keep the settings in `~/.claude/settings.json`.

## Codex

Use the [LiteLLM Lens plugin for Codex](https://github.com/BerriAI/litellm-lens-plugins/tree/main/codex) for local Codex desktop and CLI sessions. It is the recommended Codex setup: each chat is one trace, and each model call is a step with its tokens and, when Codex's model calls go through your LiteLLM gateway, its cost. Automatic setup supports **macOS and Linux** and requires Python 3.11 or later and a Codex version with plugin support. Run setup on the computer where Codex runs. {/* keep-python-version: Codex integration prerequisite */}

Copy this prompt into your coding agent to have it install and configure the integration, or follow the manual steps below.

<AgentPrompt id="lens-codex" />

In Terminal, install the plugin. The same plugin serves desktop and CLI:

```bash
codex plugin marketplace add BerriAI/litellm-lens-plugins
codex plugin add litellm-lens@berriai-lens
```

Start a **new Codex chat** and send:

```text
Use lens-setup to connect my Codex chats to LiteLLM Lens.
```

On macOS, Codex opens a private Terminal setup window. On Linux, Codex prints a `bash .../scripts/run.sh setup` command; run it in your own terminal. Enter these values:

| Setup field | Local Lens value |
| --- | --- |
| Lens ingestion URL | `http://localhost:4318`, or the address copied from Lens. A trailing `/v1/traces` is accepted |
| Lens tracing key | The dedicated tracing key, entered at the hidden prompt |
| Agent name | `codex` |

Confirm recording, then start **another new chat** so its hooks load. For a CLI check, run this from your project:

```bash
codex exec "Reply with exactly: Lens Codex telemetry check."
```

Open **Traces** in standalone Lens or **Lens > Traces** in LiteLLM, filter by **codex**, and open the chat trace in **Conversation**. Do not paste your tracing key into a Codex prompt or use it as your model key. The plugin handles telemetry; do not enable a second exporter for the same recording.

CLI capture was checked with Codex **0.171.0** and plugin **0.5.2**. If you installed the plugin from `BerriAI/litellm-lens-codex-integration`, run `codex plugin marketplace remove berriai-lens` first, then the two commands above and setup once more. Each chat has one trace, updated after completed or interrupted turns. Reopening a chat continues its trace. Only activity after setup is recorded.

The plugin reads visible transcript items for newly recorded turns, including commentary, repeated messages, tool outcomes, model changes, and subagents. Completed transcript turns can be recovered when a completion hook is missing. See the [coverage and privacy details](https://github.com/BerriAI/litellm-lens-plugins/tree/main/codex#what-youll-see) for its limits. To pause recording, ask Codex: `Use lens-setup to pause recording.`

When Codex's model calls already go through a LiteLLM gateway connected to Lens, enter the gateway address and the LiteLLM key Codex uses in place of the Lens endpoint and tracing key. The gateway stamps the trace with the key's user and team and forwards it to Lens. Codex's own OpenTelemetry export remains available as a fallback where the plugin cannot run; see the [Lens Codex guide](https://github.com/BerriAI/lens/blob/main/docs/codex-cli.md).

## Coverage and troubleshooting

Lens shows the content the plugin sent. It cannot recover missing content from older traces, and only activity after setup is recorded. The Claude Code plugin leaves out thinking, images and documents. Codex replaces media with explicit omission markers and identifies unsupported transcript items. Local menus, permission dialogs and some session events are absent, so a trace is not an exact terminal recording.

If no Claude Code trace arrives, check that `python3` is on the `PATH`, read `last_error.txt` in `~/.claude/plugins/data/litellm-lens-berriai-lens`, and confirm that `CLAUDE_CODE_ENABLE_TELEMETRY` and `CLAUDE_CODE_ENHANCED_TELEMETRY_BETA` are not both set in your shell or in `~/.claude/settings.json`, since the plugin stays off while they are. A `401` or `403` in that file means the key does not match the address: a gateway address takes a LiteLLM key, and a Lens address takes a Lens tracing key. If Lens shows only rows named `chat <model>`, the gateway recorded the model calls and no plugin trace arrived.

For large traces, use **Load more steps** to load later activity. If a step fails to load, retry it before loading the next page. Subagent branches preserve their own messages and tool results so concurrent agents do not appear to be one speaker.
