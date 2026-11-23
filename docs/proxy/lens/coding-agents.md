---
title: Trace coding agent sessions
description: Configure Claude Code, Codex or OpenCode to send sessions to Lens, then open the recorded activity in Traces.
---

import AgentPrompt from '@site/src/components/Conversion/AgentPrompt';

# Trace coding agent sessions

Send your [Claude Code](#claude-code), [Codex](#codex) or [OpenCode](#opencode) activity to Lens. Your model login and model endpoint stay unchanged.

You need a running Lens installation. If you are starting from scratch, follow the [Lens deployment guide](./deployment/local.md).

A coding agent reaches Lens in one of two ways, and **Home** in Lens offers both under **Connect a new agent**:

| How the agent connects | Where telemetry goes | Key it uses |
| --- | --- | --- |
| **Through the LiteLLM gateway**: the agent's model calls already go through a gateway [connected to Lens](./deployment/litellm.md) | Your gateway address | The LiteLLM key the agent already uses for model calls |
| **Standalone Lens**: the agent does not use LiteLLM | Your Lens address | A dedicated Lens tracing key |

On Lens Home, choose the path, choose your coding agent, and select the copy button. Paste the copied instructions into that coding agent and it applies the settings below and runs one real task. On the standalone path, **Copy instructions with new key** creates the tracing key for you. To set things up by hand, follow the section for your agent.

A tracing key uploads telemetry. It does not call models or read traces. Keep it private. The standalone examples use local Lens at `http://localhost:4318`; replace it with your Lens address and keep any `/lens-ingest` prefix.

## Claude Code

Claude Code needs no Lens plugin or helper. Its built-in [OpenTelemetry exporters](https://code.claude.com/docs/en/monitoring-usage) do the work.

:::warning Telemetry is required

Claude Code's telemetry is off by default, and Lens records Claude Code turns only when you turn it on. Without the settings below, Lens lists the gateway's model calls one by one, with no turn, tool, or subagent steps.

:::

### Through the LiteLLM gateway

If Claude Code already sends its model calls through your LiteLLM gateway, send its telemetry to the same gateway with the same key. The gateway forwards the trace spans and log events to Lens, so the machine that runs `claude` needs no Lens address and no Lens tracing key.

The gateway forwards agent telemetry from LiteLLM v1.112.0. An earlier gateway answers `POST /v1/logs` with `410`. {/* keep-version-note: The first gateway release that forwards agent telemetry is the subject of this note. */}

```bash
export ANTHROPIC_BASE_URL="http://localhost:4000"
export ANTHROPIC_AUTH_TOKEN="<your LiteLLM key>"

export CLAUDE_CODE_ENABLE_TELEMETRY=1
export CLAUDE_CODE_ENHANCED_TELEMETRY_BETA=1
export CLAUDE_CODE_PROPAGATE_TRACEPARENT=1
export OTEL_TRACES_EXPORTER=otlp
export OTEL_LOGS_EXPORTER=otlp
export OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
export OTEL_EXPORTER_OTLP_ENDPOINT="$ANTHROPIC_BASE_URL"
export OTEL_EXPORTER_OTLP_HEADERS="Authorization=Bearer $ANTHROPIC_AUTH_TOKEN"
export OTEL_LOG_USER_PROMPTS=1
export OTEL_LOG_ASSISTANT_RESPONSES=1
export OTEL_LOG_TOOL_DETAILS=1
export OTEL_LOG_TOOL_CONTENT=1
export OTEL_LOG_RAW_API_BODIES=1
export CLAUDE_CODE_OTEL_CONTENT_MAX_LENGTH=16777216

claude -p "Reply with exactly: Lens telemetry check."
```

`OTEL_EXPORTER_OTLP_ENDPOINT` is your gateway address with no path. Claude Code adds `/v1/traces` and `/v1/logs` itself. The [settings reference](#claude-code-settings) below says what each variable does and what Lens shows without it.

Open **Lens > Traces** in LiteLLM and filter by **claude-code**. Each turn is one `claude_code.interaction` trace with its model and tool calls nested under it, your prompt, the reply, and the gateway's cost. Select a model call to see the conversation it received and what the model returned.

### Directly to Lens

Use this path when Claude Code does not go through a LiteLLM gateway. Model calls continue through your Claude subscription or your existing API provider, so leave your Claude login and model endpoint unchanged. Claude Code sends the same telemetry straight to Lens with a Lens tracing key.

Copy this prompt into your coding agent to have it configure this machine, or follow the manual steps below.

<AgentPrompt id="lens-claude-code" />

In the terminal where you run `claude`, paste your Lens address and tracing key in the first two lines, then run the block:

```bash
export LENS_URL="http://localhost:4318"
export LENS_TRACING_KEY="<paste your Lens tracing key>"

export CLAUDE_CODE_ENABLE_TELEMETRY=1
export CLAUDE_CODE_ENHANCED_TELEMETRY_BETA=1
export CLAUDE_CODE_PROPAGATE_TRACEPARENT=1
export OTEL_TRACES_EXPORTER=otlp
export OTEL_LOGS_EXPORTER=otlp
export OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
export OTEL_EXPORTER_OTLP_ENDPOINT="$LENS_URL"
export OTEL_EXPORTER_OTLP_HEADERS="Authorization=Bearer $LENS_TRACING_KEY"
export OTEL_LOG_USER_PROMPTS=1
export OTEL_LOG_ASSISTANT_RESPONSES=1
export OTEL_LOG_TOOL_DETAILS=1
export OTEL_LOG_TOOL_CONTENT=1
export OTEL_LOG_RAW_API_BODIES=1
export CLAUDE_CODE_OTEL_CONTENT_MAX_LENGTH=16777216

claude -p "Reply with exactly: Lens telemetry check."
```

Open **Traces** in Lens and filter by **claude-code**. The trace shows the turn with its prompt, reply, tool calls, and model calls. Cost is filled only when the model calls go through a LiteLLM gateway, which is where the price is known. Run `claude` without `-p` for interactive sessions.

Lens groups Claude Code turns by session without any resource attribute. Do not set `OTEL_METRICS_INCLUDE_SESSION_ID=false`. Despite its name, this removes `session.id` from Claude's traces too.

### Settings reference {#claude-code-settings}

Both paths use the same telemetry variables. Only the endpoint and the key differ.

| Variable | What it does | Without it |
| --- | --- | --- |
| `CLAUDE_CODE_ENABLE_TELEMETRY=1` | Turns Claude Code telemetry on | No turn. Lens lists the gateway's model calls one by one |
| `CLAUDE_CODE_ENHANCED_TELEMETRY_BETA=1` | Turns on the trace exporter that sends turn, tool, and subagent spans. The enable flag alone does not | No turn |
| `OTEL_TRACES_EXPORTER=otlp` | Sends those spans over OTLP | No turn |
| `OTEL_LOGS_EXPORTER=otlp` | Sends Claude Code's events over OTLP: assistant replies, tool results, and model call bodies | Steps have no replies, tool output, or model call content |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | Where the spans and events go: your gateway address, or your Lens address on the direct path | The exporter targets `localhost:4318` |
| `OTEL_EXPORTER_OTLP_HEADERS` | Authenticates the upload with your LiteLLM key, or your Lens tracing key on the direct path | The upload is rejected |
| `OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf` | Uses the OTLP/HTTP format the gateway and Lens accept | Claude Code's default export protocol is not guaranteed to match |
| `CLAUDE_CODE_PROPAGATE_TRACEPARENT=1` | Puts the turn's trace ID on each model call | Through a gateway, the turn and its gateway calls show up as two unrelated traces |
| `OTEL_LOG_USER_PROMPTS=1` | Includes the text you typed | The turn's input reads `<REDACTED>` |
| `OTEL_LOG_ASSISTANT_RESPONSES=1` | Includes the text Claude Code replied with | The turn has no reply |
| `OTEL_LOG_TOOL_DETAILS=1` and `OTEL_LOG_TOOL_CONTENT=1` | Include each tool call's arguments and output | Tool steps show a name and a duration only |
| `OTEL_LOG_RAW_API_BODIES=1` | Includes the request and response of every model call | A model call step reads "No content recorded for this span" |
| `CLAUDE_CODE_OTEL_CONTENT_MAX_LENGTH=16777216` | Raises Claude Code's 60 KB limit on exported content to 16 MiB | Requests longer than 60 KB arrive cut off, and their model call step has no input |

These settings store what you type, what Claude Code replies, the files it reads, and the output of the commands it runs. That content can include source code or secrets, so use them only with a Lens deployment where you intend to keep it. With `OTEL_LOG_RAW_API_BODIES=1`, Lens keeps the system prompt, the messages, and the reply of each model call. It does not keep tool definitions or thinking blocks. Each request repeats the conversation so far, so a long session stores it once per model call. To leave model call bodies out, set `OTEL_LOG_RAW_API_BODIES=0`.

To keep the settings across terminals, add the same variables as string entries to the `env` object in your user-level `~/.claude/settings.json`, preserving existing settings. `settings.json` does not expand variables, so write the address and the key's actual value there. Repository-level settings cannot enable telemetry or choose its destination. Managed settings may override your local destination.

Verified with Claude Code **2.1.330**.

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

In the private Terminal setup window, enter these values:

| Setup field | Local Lens value |
| --- | --- |
| Lens ingestion URL | `http://localhost:4318/v1/traces`, or the full endpoint copied from Lens |
| Lens tracing key | The dedicated tracing key, entered at the hidden prompt |
| Agent name | `codex` |

Confirm recording, then start **another new chat** so its hooks load. For a CLI check, run this from your project:

```bash
codex exec "Reply with exactly: Lens Codex telemetry check."
```

Open **Traces** in standalone Lens or **Lens > Traces** in LiteLLM, filter by **codex**, and open the chat trace in **Conversation**. Do not paste your tracing key into a Codex prompt or use it as your model key. The plugin handles telemetry; do not copy the Claude Code environment variables into Codex or enable a second exporter for the same recording.

CLI capture was checked with Codex **0.171.0** and plugin **0.5.2**. If you installed the plugin from `BerriAI/litellm-lens-codex-integration`, run `codex plugin marketplace remove berriai-lens` first, then the two commands above and setup once more. Each chat has one trace, updated after completed or interrupted turns. Reopening a chat continues its trace. The plugin supplies the chat-level trace ID, so this grouping works on both Lens **0.1.0** and **main**, without `lens.session.capture` or `lens.session.attribute`. Only activity after setup is recorded.

The plugin reads visible transcript items for newly recorded turns, including commentary, repeated messages, tool outcomes, model changes, and subagents. Completed transcript turns can be recovered when a completion hook is missing. See the [coverage and privacy details](https://github.com/BerriAI/litellm-lens-plugins/tree/main/codex#what-youll-see) for its limits. To pause recording, ask Codex: `Use lens-setup to pause recording.`

When Codex's model calls already go through a LiteLLM gateway connected to Lens, enter the gateway address and the LiteLLM key Codex uses in place of the Lens endpoint and tracing key. The gateway stamps the trace with the key's user and team and forwards it to Lens. Codex's own OpenTelemetry export remains available as a fallback where the plugin cannot run; see the [Lens Codex guide](https://github.com/BerriAI/lens/blob/main/docs/codex-cli.md).

## OpenCode

OpenCode 2.3.2 and later use the [Lens OpenCode plugin](https://github.com/BerriAI/litellm-lens-plugins/tree/main/opencode). OpenCode 2 exports no prompts, replies or tool content in its own telemetry, so the plugin records them instead. OpenCode 1.x keeps using its telemetry; follow the [OpenCode 1.x steps](https://github.com/BerriAI/lens/blob/main/docs/opencode.md#opencode-1x-telemetry) for it. Run `opencode --version` to see which applies.

The plugin is off until you give it an address and a key, because it uploads your prompts, the model's replies, the files OpenCode reads and the output of the commands it runs. If OpenCode already sends its model calls through your LiteLLM gateway, use that gateway address and the same LiteLLM key. The gateway must be [connected to Lens](./deployment/litellm.md).

```bash
opencode plugin add github:BerriAI/litellm-lens-plugins
export LITELLM_LENS_OPENCODE_URL="http://localhost:4000"
export LITELLM_LENS_OPENCODE_API_KEY="<your LiteLLM key>"
opencode service stop

opencode run "Run the date command, then tell me what it printed."
```

`opencode service stop` restarts OpenCode's background service so it loads the two variables; add them to your shell profile to keep them. With standalone Lens, set the address to your Lens address, such as `http://localhost:4318`, and the key to a Lens tracing key. Leave `experimental.openTelemetry` and the `OTEL_EXPORTER_OTLP_*` variables unset on OpenCode 2, since the plugin replaces them.

Open **Lens > Traces** in LiteLLM or **Traces** in standalone Lens and filter by **opencode**. A session is one trace, and each prompt you send is a turn in it with your prompt and the final reply. Inside a turn, each model call is a `chat <model>` step with the messages added since the previous reply, the reply and tokens, and each tool call is an `execute_tool <name>` step with its input and output. A subagent's steps sit under the tool call that started it. Through the gateway, each model call shows the cost the gateway billed and the trace belongs to the key, user and team of your LiteLLM key. With standalone Lens, model calls show tokens and no cost.

Capture through the gateway was checked with OpenCode **2.3.2** and plugin **0.1.2**. To stop recording, unset the two variables or run `opencode plugin remove github:BerriAI/litellm-lens-plugins`.

## Coverage and troubleshooting

Lens shows the content the coding agent exported. It cannot recover missing content from older traces. Claude's native telemetry does not export an exact terminal recording: images, hidden reasoning, local menus, permission dialogs, and some session events may be absent. Codex replaces media with explicit omission markers and identifies unsupported transcript items. These limits prevent a promise of identical rendering for every session or future agent version.

If Claude Code shows only rows named `chat <model>` with no `claude_code.interaction` row, the telemetry settings did not reach the process that ran `claude`. Check the three variables that produce the turn and restart Claude Code. If Claude shows tools but no replies, check `OTEL_LOGS_EXPORTER`, `OTEL_LOG_ASSISTANT_RESPONSES`, and that the endpoint accepts `POST /v1/logs`. A `404` or `410` for `/v1/logs` means the Lens service or the gateway needs an update. Allow the exporters to flush after a turn.

To change the Claude agent name, set `gen_ai.agent.name` in `OTEL_RESOURCE_ATTRIBUTES`. For example, `OTEL_RESOURCE_ATTRIBUTES="gen_ai.agent.name=my-claude-code,developer=alice"`. Use that exact name in the trace filter and in any investigation's agent filter. An investigation restricted to `claude-code` will not sample `my-claude-code` automatically. If you already set `OTEL_RESOURCE_ATTRIBUTES`, append to it instead of replacing your existing attributes.

For large traces, use **Load more steps** to load later activity. If a step fails to load, retry it before loading the next page. Subagent branches preserve their own messages and tool results so concurrent agents do not appear to be one speaker.
