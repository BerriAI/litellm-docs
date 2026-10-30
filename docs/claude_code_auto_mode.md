---
title: Claude Code - Auto Mode on Non-Claude Models
sidebar_label: Claude Code - Auto Mode
---

# Claude Code - Auto Mode on Non-Claude Models

LiteLLM answers Claude Code's auto mode safety checks for models that cannot answer them on their own.

Claude Code's auto mode runs tool calls without asking the user first. When `ANTHROPIC_BASE_URL` points at a gateway, Claude Code v2.1.278 or later sends `safeguards: [{"type": "dangerous_tool_use", ...}]` on every `POST /v1/messages` and expects `safeguard_results` back, with a verdict for each tool call in the response. The Anthropic API answers that itself. When the proxy routes `/v1/messages` to a non-Claude model nothing answered, so `/status` showed `Auto mode server: Disabled` after the first reply and Claude Code sent its own classifier requests for the rest of the session. Anthropic's [permission modes reference](https://code.claude.com/docs/en/permission-modes#server-side-classifier-review) describes that fallback, and on accounts where those requests are billed Claude Code shows a [notice about classifier request charges](https://code.claude.com/docs/en/auto-mode-classifier-billing).

With `safeguards_classifier_model` set, the proxy asks a deployment from your `model_list` to judge each tool call and returns the verdicts the same way the Anthropic API does, so auto mode stays on server review when Claude Code is pointed at an open model.

<SinceVersion v="1.107.0" />

| Model behind `/v1/messages` | Who answers `safeguards` |
|---|---|
| `anthropic/` Claude | Anthropic API |
| `bedrock/` Claude (InvokeModel) | Amazon Bedrock |
| `bedrock_mantle/` Claude | Amazon Bedrock |
| `vertex_ai/` Claude | Vertex AI |
| `azure_ai/` Claude | LiteLLM forwards to Foundry's own `/v1/messages` and does not classify |
| `bedrock/converse/` models, Claude included | LiteLLM classifier |
| Fireworks, Gemini, and other chat completions providers | LiteLLM classifier |
| `openai/` and Azure OpenAI `azure/` models | LiteLLM classifier |
| DeepSeek and other providers with their own `/v1/messages` | LiteLLM classifier |

The LiteLLM classifier answers for every non-Claude model, whichever way the proxy reaches it: the chat completions translation, the Responses API bridge that `openai/` deployments use, or a provider's own Anthropic-compatible `/v1/messages`, such as DeepSeek's. It also answers for Claude models behind `bedrock/converse/`, since that route goes through the chat completions translation. Claude models that LiteLLM forwards to a provider's own `/v1/messages` are left to that provider, and when any provider returns its own `safeguard_results`, the proxy keeps them and skips the classifier call.

Requests without `safeguards`, which is every client other than Claude Code in auto mode, are untouched.

## When You Need It

Claude Code checks every reply for evaluated `safeguard_results`. After one reply with a tool call comes back without them, it shows a notice that auto mode isn't eligible because your requests go through a gateway, and it sends its own billed classifier requests for the rest of the session, even when later replies come from a route that answers. So the setting matters for any session that can reach a model in a "LiteLLM classifier" row of the table above, not only for sessions that start on one.

A proxy that serves Claude Code only through Claude on the Anthropic API, Bedrock InvokeModel, Bedrock Mantle or Vertex AI needs no setting, since the provider answers. Set `safeguards_classifier_model` when Claude Code can reach a `bedrock/converse/` deployment, Azure OpenAI or any other non-Claude model, an [auto router](./tutorials/claude_code_autorouter.md) with a tier that picks a non-Claude model, a fallback from a Claude deployment to a non-Claude one, or a non-Claude model a user picks with `/model`. With the setting on, each reply gets its verdicts from the side that serves it: the provider for Claude on the routes above, and the classifier for everything else.

Some turns are finished by the proxy itself and replayed to Claude Code as a new stream, such as [web search interception](./tutorials/claude_code_websearch.md), MCP and advisor turns, and streams that a post-call guardrail rewrites. On v1.108.0 and earlier, the final `message_delta` of that replayed stream leaves out `safeguard_results`, so one such turn turns server review off for the session on any model, with or without the setting. [PR #46096](https://github.com/BerriAI/litellm/pull/46096) carries the verdicts into the replayed stream with no configuration from v1.109.0.

## Setup

Add `safeguards_classifier_model` to `general_settings`, naming a `model_name` from your `model_list`. The setting is off by default. The name must be one the proxy can route, since a name with no deployment behind it makes every check come back `unsupported` (see [When the Classifier Cannot Be Used](#when-the-classifier-cannot-be-used)):

```yaml
model_list:
  - model_name: kimi-k3
    litellm_params:
      model: fireworks_ai/accounts/fireworks/models/kimi-k3
      api_key: os.environ/FIREWORKS_AI_API_KEY
  - model_name: gpt-oss-120b
    litellm_params:
      model: fireworks_ai/accounts/fireworks/models/gpt-oss-120b
      api_key: os.environ/FIREWORKS_AI_API_KEY

general_settings:
  safeguards_classifier_model: gpt-oss-120b
```

The classifier runs on every turn that ends in a tool call, so pick a fast, cheap model that reliably answers in JSON. An open model on the same provider as the coding model works well. The example above uses one Fireworks deployment for coding and another for the verdicts.

The classifier call goes through the router like any other request, so `model_list` aliases, fallbacks, and cooldowns apply to it. It is never retried. The proxy waits at most 30 seconds for its answer, and a shorter `timeout` under the classifier deployment's `litellm_params` ends the wait earlier.

Every virtual key that runs Claude Code needs access to the classifier model. Before the classifier call, the proxy runs the same model access checks it would run if the caller asked for that model directly, for the key, team, team member, user, project, end user, and agent. It then checks the overall and per-model budgets of the key, team, user, team member, and end user, the caller's TPM headroom, and any RPM limit set on the classifier model itself, without using any of it. As on a direct call, a classifier model priced at zero skips the budget checks. The overall RPM limits of the key, team, and user are left out of that check, since the Claude Code request already counted against them. The classifier call's tokens count toward the caller's TPM and spend, but the call takes no request slot, so it adds nothing to any RPM count. A refused access check or a spent budget turns the classifier off for the session (see [When the Classifier Cannot Be Used](#when-the-classifier-cannot-be-used)). A full RPM or TPM window, or a check the proxy could not run, only skips the classifier for that one response (see [When the Classifier Fails](#when-the-classifier-fails)).

## How It Works

On each `/v1/messages` request that carries `safeguards` and goes to a model the LiteLLM classifier answers for, LiteLLM sends the request to the backend as before. Once the response is in, it sends one chat completions call to the classifier deployment with:

- the tool calls of the response, exactly as the model wrote them
- the conversation so far, including earlier tool calls and their results
- the agent's environment from the request: permission mode, platform, working directory, trusted directories, allow and deny rules, and git branch

The classifier flags a tool call that does something dangerous the user did not ask for, such as sending credentials somewhere, piping a URL into a shell, writing outside the trusted directories, deleting data that cannot be regenerated, or following instructions it found in a file or a tool result. Routine development work inside the trusted directories, and an action the user explicitly asked for, is not flagged.

LiteLLM returns the verdicts as `safeguard_results`, on the response for non-streaming calls and inside the final `message_delta` event for streaming calls. Claude Code blocks a flagged call and runs an unflagged one. A reply with no tool calls gets an empty verdict set without a classifier call.

The transcript is built from the messages Claude Code sent, before any compaction the proxy applies, and a compaction summary from Claude Code shows up as one entry. To keep the classifier call small, the transcript is trimmed to about 24,000 characters. The user's opening message is kept whole when it fits in half of that. A longer one is cut from its start, since Claude Code puts the user's request after its reminders at the end of that message. Later turns fill the rest, newest first. Each transcript entry is clipped to 2,000 characters and each tool result to 500. The pending tool calls are never clipped. The agent's system prompt and thinking blocks are not sent.

:::caution

The classifier deployment sees the conversation, tool results included. If a tool prints a secret, such as a `cat .env`, the first 500 characters of that output reach the classifier model, so pick a deployment you trust with the same data as the coding model.

:::

## Verify

Point Claude Code at the proxy with a virtual key and the open model, start the session in auto mode (see Anthropic's [permission modes reference](https://code.claude.com/docs/en/permission-modes)), and send a prompt that needs a tool call:

```bash
ANTHROPIC_BASE_URL=http://localhost:4000 ANTHROPIC_AUTH_TOKEN=<virtual key> ANTHROPIC_MODEL=kimi-k3 claude --permission-mode auto
```

After the reply, run `/status` inside the session. The Auto mode server row reads `Enabled`. Before the first reply the row reads `Enabled` on any proxy, so check it after a reply. On a route with no verdicts the same row reads `Disabled`. If it reads `Disabled`, or the notice appears partway through a session, find the reply before it on the proxy Logs page and check which model served it. The usual causes are a model in a "LiteLLM classifier" row with the setting unset, and a replayed turn on an older release, both covered in [When You Need It](#when-you-need-it).

To see the verdicts without Claude Code, send a request with `safeguards` to the proxy:

```bash
curl http://localhost:4000/v1/messages \
  -H "Authorization: Bearer <virtual key>" \
  -H "content-type: application/json" \
  -d '{
    "model": "kimi-k3",
    "max_tokens": 512,
    "tools": [{"name": "Bash", "description": "Run a shell command", "input_schema": {"type": "object", "properties": {"command": {"type": "string"}}, "required": ["command"]}}],
    "messages": [{"role": "user", "content": "List the files in the current directory with ls -la"}],
    "safeguards": [{"type": "dangerous_tool_use", "classifier_context": {"v": 1, "permission_mode": "auto", "live_cwd": "/tmp/sandbox", "trusted_directories": ["/tmp/sandbox"]}}]
  }'
```

## Responses

### Non-streaming

```json
{
  "id": "chatcmpl-b149e0ae231645bda5c447266c30cb3e",
  "type": "message",
  "role": "assistant",
  "model": "kimi-k3",
  "content": [
    {"type": "tool_use", "id": "call_501f1ce0021b4d119f57555e", "name": "Bash", "input": {"command": "ls -la"}}
  ],
  "stop_reason": "tool_use",
  "usage": {"input_tokens": 210, "output_tokens": 73},
  "safeguard_results": [
    {
      "type": "dangerous_tool_use",
      "status": {
        "type": "available",
        "tool_uses": {
          "call_501f1ce0021b4d119f57555e": {"type": "evaluated", "outcome": "not_flagged"}
        }
      }
    }
  ]
}
```

A flagged tool call carries the classifier's reason in one sentence:

```json
{"type": "evaluated", "outcome": "flagged", "explanation": "Force-pushes to origin and exfiltrates private SSH key, actions not requested by user."}
```

Claude Code skips a flagged tool call and shows the reason in place of its output, for example `Denied by auto mode classifier ∙ Uploads a secret deploy_key to an external server, which is disallowed without explicit user request.` The model sees the denial and carries on without that action.

### Streaming

`safeguard_results` arrives inside the `delta` of the final `message_delta` event, which is where the Anthropic API puts it. LiteLLM holds that event until the classifier answers, so each turn that ends in a tool call takes as long as the classifier call on top of the model's reply:

```
event: message_delta
data: {"type": "message_delta", "delta": {"stop_reason": "tool_use", "safeguard_results": [{"type": "dangerous_tool_use", "status": {"type": "available", "tool_uses": {"call_5e0931e0bef84a3d84162c33": {"type": "evaluated", "outcome": "not_flagged"}}}}]}, "usage": {"output_tokens": 82}}

event: message_stop
data: {"type": "message_stop"}
```

## When the Classifier Fails

If the classifier call fails, the proxy marks every tool call of that response `unavailable` instead of guessing, and the agent's own reply still goes out:

```json
{"type": "unavailable", "reason": "timeout"}
```

| `reason` | When |
|---|---|
| `timeout` | No answer within 30 seconds, or within the deployment's `timeout` when that is shorter |
| `input_too_long` | Over the classifier's context window |
| `refused` | Content policy refusal |
| `truncated` | Tool call was cut off |
| `error` | Any other failure |

A tool call is cut off when it is the last block of a reply that stopped at `max_tokens`, or when its streamed arguments are not valid JSON. The proxy never sends it to the classifier, and the other tool calls of that response still get verdicts. `error` also covers a classifier reply that is not the JSON the proxy asked for. When the reply is JSON but leaves out one of the tool calls, only that tool call gets `unavailable` with `error`, and the others keep their verdicts.

A `safeguard_results` with `unavailable` verdicts still counts as server review, so `/status` keeps reading `Auto mode server: Enabled` and the session does not switch to the local fallback for good. What Claude Code does with the action depends on its version. Anthropic's [errors reference](https://code.claude.com/docs/en/errors#the-server-returned-no-safety-verdict) says auto mode denies an action the server gives no verdict for, and stops the turn after ten responses in a row without one. In our test with Claude Code v2.1.296 and a classifier that always failed with `error`, Claude Code checked each such action with its own classifier request instead, sent through the proxy (to Claude Sonnet 5 first, then to the session's model when the proxy had no Sonnet 5 deployment), and ran the actions that check allowed. Reads and edits inside the working directory never go to a classifier.

The proxy also skips the classifier call and marks every tool call of the response `unavailable` with `error` when the caller's RPM or TPM window for the classifier model is full, or when the proxy could not run one of the caller's checks (a team membership or rate-limit counter it could not read). The next response runs the checks again, so the verdicts come back once the window turns over. The log line for this case says `is over the caller's rate limit for this window, or the limit could not be read`.

When tool calls keep coming back `unavailable`, look for `safeguards classifier` warnings in the proxy logs.

## When the Classifier Cannot Be Used

When the caller has no access to the classifier model, has spent a budget that covers it, or the proxy has no deployment for the model the setting names, the proxy returns no per-tool verdicts:

```json
"safeguard_results": [{"type": "dangerous_tool_use", "status": {"type": "unsupported"}}]
```

Claude Code treats this the same as a route with no verdicts. It shows its classifier billing notice, sends its own classifier requests through the proxy for the rest of the session, and `/status` reads `Auto mode server: Disabled` after the first reply that carries a tool call, since a reply without tool calls skips the check and still counts as server review. Give the key access to the classifier model, raise the limit it hit, or point the setting at a `model_name` in `model_list`, and start a new session. A missing access or a spent budget logs `safeguards classifier <name> is outside the caller's model access or budget`, and a name with no deployment logs `safeguards classifier <name> is not served by this proxy`, on every request.

## Cost and Logs

The classifier call is a normal proxy call. It shows up as its own request on the Logs page and in spend logs, billed to the same virtual key, team, and end user as the Claude Code request that triggered it. It is logged under the same settings as that request, so per-request callback parameters and a message redaction header such as `x-litellm-enable-message-redaction` apply to its row too. Its cost adds to every turn that ends in a tool call, which is why the choice of classifier model matters.
