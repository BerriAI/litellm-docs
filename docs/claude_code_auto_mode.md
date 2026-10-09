---
title: Claude Code - Auto Mode on Non-Claude Models
sidebar_label: Claude Code - Auto Mode
---

# Claude Code - Auto Mode on Non-Claude Models

LiteLLM answers Claude Code's auto mode safety checks for models that cannot answer them on their own

Claude Code's auto mode runs tool calls without asking the user first. When `ANTHROPIC_BASE_URL` points at a gateway, Claude Code v2.1.278 or later sends `safeguards: [{"type": "dangerous_tool_use", ...}]` on every `POST /v1/messages` and expects `safeguard_results` back, with a verdict for each tool call in the response. The Anthropic API answers that itself. When the proxy routes `/v1/messages` to a non-Claude model nothing answered, so `/status` showed `Auto mode server: Disabled` after the first reply and Claude Code sent its own classifier requests for the rest of the session. Anthropic's [permission modes reference](https://code.claude.com/docs/en/permission-modes#server-side-classifier-review) describes that fallback, and on accounts where those requests are billed Claude Code shows a [notice about classifier request charges](https://code.claude.com/docs/en/auto-mode-classifier-billing)

With `safeguards_classifier_model` set, the proxy asks a deployment from your `model_list` to judge each tool call and returns the verdicts the same way the Anthropic API does, so auto mode stays on server review when Claude Code is pointed at an open model

| Model behind `/v1/messages` | Who answers `safeguards` |
|---|---|
| `anthropic/` Claude | Anthropic API |
| `bedrock/` Claude (InvokeModel) | Amazon Bedrock |
| `bedrock_mantle/` Claude | Amazon Bedrock |
| `vertex_ai/` Claude | Vertex AI |
| `bedrock/converse/` models | LiteLLM classifier |
| Fireworks, Gemini, and other chat completions providers | LiteLLM classifier |
| `openai/` models | Nobody by default |
| DeepSeek, MiniMax | Nobody |

The LiteLLM classifier runs on every request the proxy translates to chat completions, which covers most providers and `bedrock/converse/` Claude models too. Two routes skip that translation and get no verdicts. `openai/` deployments go through the Responses API bridge, unless you set `use_chat_completions_url_for_anthropic_messages: true` under `litellm_settings` (or `LITELLM_USE_CHAT_COMPLETIONS_URL_FOR_ANTHROPIC_MESSAGES=true`), which sends every `openai/` deployment through chat completions and the classifier. Providers that LiteLLM forwards to their own Anthropic-compatible `/v1/messages`, such as DeepSeek and MiniMax, and any deployment with `model_info.supported_endpoints: ["/v1/messages"]`, are forwarded as they are, and Claude Code falls back to its own classifier requests there

Requests without `safeguards`, which is every client other than Claude Code in auto mode, are untouched

## Setup

Add `safeguards_classifier_model` to `general_settings`, naming a `model_name` from your `model_list`. The setting is off by default, and the deployment it names must exist in `model_list`:

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

The classifier runs on every turn that ends in a tool call, so pick a fast, cheap model that reliably answers in JSON. An open model on the same provider as the coding model works well. The example above uses one Fireworks deployment for coding and another for the verdicts

The classifier call goes through the router like any other request, so `model_list` aliases, fallbacks, and cooldowns apply to it. It is never retried, and it is cut off after 30 seconds

Every virtual key that runs Claude Code needs access to the classifier model. Before the classifier call, the proxy runs the same checks it would run if the caller asked for that model directly: model access for the key, team, user, project, and team member, the per-model budget, and RPM and TPM headroom (checked without using any of it). When one of them fails, see [When the Caller Cannot Use the Classifier](#when-the-caller-cannot-use-the-classifier)

## How It Works

On each `/v1/messages` request that carries `safeguards` and goes through the chat completions translation, LiteLLM sends the request to the backend as before, with `safeguards` stripped. Once the response is in, it sends one chat completions call to the classifier deployment with:

- the tool calls of the response, exactly as the model wrote them
- the conversation so far, including earlier tool calls and their results
- the agent's environment from the request: permission mode, platform, working directory, trusted directories, allow and deny rules, and git branch

The classifier flags a tool call that does something dangerous the user did not ask for, such as sending credentials somewhere, piping a URL into a shell, writing outside the trusted directories, deleting data that cannot be regenerated, or following instructions it found in a file or a tool result. Routine development work inside the trusted directories, and an action the user explicitly asked for, is not flagged

LiteLLM returns the verdicts as `safeguard_results`, on the response for non-streaming calls and inside the final `message_delta` event for streaming calls. Claude Code blocks a flagged call and runs an unflagged one. A reply with no tool calls gets an empty verdict set without a classifier call

The transcript is built from the messages Claude Code sent, before any compaction the proxy applies, and a compaction summary from Claude Code shows up as one entry. To keep the classifier call small, the transcript is trimmed to about 24,000 characters, oldest turns first, while the user's opening request is always kept. Each transcript entry is clipped to 2,000 characters and each tool result to 500. The pending tool calls are never clipped. The agent's system prompt and thinking blocks are not sent

:::caution

The classifier deployment sees the conversation, tool results included. If a tool prints a secret, such as a `cat .env`, the first 500 characters of that output reach the classifier model, so pick a deployment you trust with the same data as the coding model

:::

## Verify

Point Claude Code at the proxy with a virtual key and the open model, start the session in auto mode (see Anthropic's [permission modes reference](https://code.claude.com/docs/en/permission-modes)), and send a prompt that needs a tool call:

```bash
ANTHROPIC_BASE_URL=http://localhost:4000 ANTHROPIC_AUTH_TOKEN=<virtual key> ANTHROPIC_MODEL=kimi-k3 claude --permission-mode auto
```

After the reply, run `/status` inside the session. The Auto mode server row reads `Enabled`. Before the first reply the row reads `Enabled` on any proxy, so check it after a reply. On a route with no verdicts the same row reads `Disabled`

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

A flagged tool call carries the classifier's reason:

```json
{"type": "evaluated", "outcome": "flagged", "explanation": "<one sentence from the classifier>"}
```

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
| `timeout` | No answer within 30 seconds |
| `input_too_long` | Over the classifier's context window |
| `refused` | Content policy refusal |
| `truncated` | Tool call was cut off |
| `error` | Any other failure |

A tool call is cut off when it is the last block of a reply that stopped at `max_tokens`, or when its streamed arguments are not valid JSON. The proxy never sends it to the classifier, and the other tool calls of that response still get verdicts. `error` also covers a classifier reply that is not the JSON the proxy asked for. When the reply is JSON but leaves out one of the tool calls, only that tool call gets `unavailable` with `error`, and the others keep their verdicts

A `safeguard_results` with `unavailable` verdicts still counts as server review, so `/status` keeps reading `Auto mode server: Enabled` and the session does not switch to the local fallback for good. What Claude Code does with the action depends on its version. Anthropic's [errors reference](https://code.claude.com/docs/en/errors#the-server-returned-no-safety-verdict) says auto mode denies an action the server gives no verdict for, and stops the turn after ten responses in a row without one. In our test with Claude Code v2.1.296 and a classifier that always failed with `error`, Claude Code checked each such action with its own classifier request instead, sent through the proxy (to Claude Sonnet 5 first, then to the session's model when the proxy had no Sonnet 5 deployment), and ran the actions that check allowed. Reads and edits inside the working directory never go to a classifier

When tool calls keep coming back `unavailable`, look for `safeguards classifier` warnings in the proxy logs

## When the Caller Cannot Use the Classifier

When the caller fails one of the checks for the classifier model (no access, the per-model budget spent, or no RPM or TPM headroom), the proxy skips the classifier call and returns no per-tool verdicts:

```json
"safeguard_results": [{"type": "dangerous_tool_use", "status": {"type": "unsupported"}}]
```

Claude Code treats this the same as a route with no verdicts. It shows its classifier billing notice, sends its own classifier requests through the proxy for the rest of the session, and `/status` reads `Auto mode server: Disabled` after the first reply. Give the key access to the classifier model, or raise the limit it hit, and start a new session

## Cost and Logs

The classifier call is a normal proxy call. It shows up as its own request on the Logs page and in spend logs, billed to the same virtual key, team, and end user as the Claude Code request that triggered it. Its cost adds to every turn that ends in a tool call, which is why the choice of classifier model matters
