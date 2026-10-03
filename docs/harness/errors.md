---
title: Errors
---

# Errors

Setup problems raise an exception. Limits you set, like `timeout` and `max_turns`, end the turn and return a `Result` with a `stop_reason`, so partial work is kept.

All exceptions below except `TypeError` and `ValueError` subclass `litellm.harness.HarnessError`.

| Exception | Raised when | Raised at |
|---|---|---|
| `TypeError` | `harness` isn't a `Harness` member. The message names the member you probably meant. | call |
| `ValueError` | a `litellm_proxy/` model is used without a gateway base URL or key | call |
| `CapabilityUnsupported` | the harness can't do what you asked, for example `permissions="edit"` on Codex or `tools=` on Claude Code | before the runtime starts |
| `OptionsMismatch` | options for a different harness, or a native config key LiteLLM manages | call |
| `HarnessInstallFailed` | the runtime binary isn't on the sandbox's `PATH`, or Deep Agents' packages aren't installed | session start |
| `SandboxError` | the sandbox failed to start, run a command or reach the host | any time |
| `SessionClosed` | a turn on a session that is closed or detached | turn start |
| `StateIncompatible` | `agent_resume()` with a state from a different harness or an unreadable version | resume |
| `OutputInvalid` | the final answer didn't validate against `output=` | turn end |

## Stop reasons

| `stop_reason` | Meaning |
|---|---|
| `"done"` | the runtime finished its turn |
| `"max_turns"` | reached `max_turns` tool calls |
| `"timeout"` | the turn ran longer than `timeout` seconds |
| `"cancelled"` | the turn was cancelled |
| `"runtime_error"` | the runtime process exited on its own; `Result.text` has its last stderr lines |

## Model errors during a turn

Provider errors inside a turn, such as rate limits and 5xx responses, aren't raised. The runtime usually retries them itself, and on the gateway they show up as failed requests in the spend logs with the harness tag.

Error messages never include your virtual key, provider keys or the session token.
