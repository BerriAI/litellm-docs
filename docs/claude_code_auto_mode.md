---
title: Claude Code - Auto Mode on Non-Claude Models
sidebar_label: Claude Code - Auto Mode
---

# Claude Code - Auto Mode on Non-Claude Models

LiteLLM answers Claude Code's auto mode safety checks for models that cannot answer them on their own

Claude Code's auto mode runs tool calls without asking the user first. On every `POST /v1/messages` it sends `safeguards: [{"type": "dangerous_tool_use", ...}]` and expects `safeguard_results` back with a verdict for each tool call in the response. The Anthropic API answers that itself. When the proxy routes `/v1/messages` to a non-Claude model (Fireworks, OpenAI, Gemini, or any other chat completions backend) nothing answered, so Claude Code showed `Auto mode server: Disabled` in `/status` and fell back to its local classifier for the rest of the session. Per Anthropic's [auto mode classifier billing notice](https://code.claude.com/docs/en/auto-mode-classifier-billing), once that fallback is retired Claude Code stops the session after 10 responses in a row without a verdict

With `safeguards_classifier_model` set, the proxy asks a deployment from your `model_list` to judge each tool call and returns the verdicts the same way the Anthropic API does, so auto mode stays on when Claude Code is pointed at an open model

| Routing path | How `safeguards` is handled |
|---|---|
| **Claude backends** (Anthropic API, Bedrock, Vertex AI) | Passed through; the provider returns `safeguard_results` |
| **Any other provider** (Fireworks, OpenAI, Gemini, Azure, …) | **In-gateway classifier**; LiteLLM asks the configured `safeguards_classifier_model` for a verdict per tool call |

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

The classifier runs on every tool-calling turn, so pick a fast, cheap model. An open model on the same provider as the coding model works well. The example above uses one Fireworks deployment for coding and another for the verdicts

## How It Works

On each `/v1/messages` request that carries `safeguards` and is routed to a non-Claude backend, LiteLLM forwards the request to the backend as before, with `safeguards` stripped. Once the response is in, it sends one chat completions call to the classifier deployment with the tool calls of the response, the conversation so far, and the agent's environment from the request (permission mode, trusted directories, allow and deny rules, git branch). The classifier returns a verdict per tool call, and LiteLLM returns those as `safeguard_results`, on the response for non-streaming calls and inside the final `message_delta` event for streaming calls. Claude Code blocks a flagged call and runs an unflagged one

## Verify

Point Claude Code at the proxy with a virtual key and the open model, start the session in auto mode (see Anthropic's [permission modes reference](https://code.claude.com/docs/en/permission-modes)), send a prompt that needs a tool call, and wait for the reply:

```bash
ANTHROPIC_BASE_URL=http://localhost:4000 ANTHROPIC_AUTH_TOKEN=<virtual key> ANTHROPIC_MODEL=kimi-k3 claude
```

Then run `/status` inside the session. The Auto mode server row reads `Enabled`. Before the first reply the row reads `Enabled` on any proxy, so check it after a reply. The proof is that row together with a tool call being allowed or blocked. A routine call such as listing files runs, and a call the classifier flags, such as piping a URL into a shell, is blocked

## Responses

### Non-streaming

```json
{
  "id": "msg_01XFDUDYJgAACzvnptvVoYEL",
  "type": "message",
  "role": "assistant",
  "content": [
    {"type": "tool_use", "id": "toolu_01V9Z5KXn3SU71Fzr5cquHLi", "name": "Bash", "input": {"command": "ls"}}
  ],
  "model": "kimi-k3",
  "stop_reason": "tool_use",
  "usage": {"input_tokens": 620, "output_tokens": 45},
  "safeguard_results": [
    {
      "type": "dangerous_tool_use",
      "status": {
        "type": "available",
        "tool_uses": {
          "toolu_01V9Z5KXn3SU71Fzr5cquHLi": {"type": "evaluated", "outcome": "not_flagged"}
        }
      }
    }
  ]
}
```

### Streaming

`safeguard_results` arrives inside the `delta` of the final `message_delta` event, which is where the Anthropic API puts it:

```
event: message_delta
data: {"type":"message_delta","delta":{"stop_reason":"tool_use","stop_sequence":null,"safeguard_results":[{"type":"dangerous_tool_use","status":{"type":"available","tool_uses":{"toolu_01V9Z5KXn3SU71Fzr5cquHLi":{"type":"evaluated","outcome":"not_flagged"}}}}]},"usage":{"output_tokens":45}}

event: message_stop
data: {"type":"message_stop"}
```

## When the Classifier Fails

If the classifier call fails or does not answer within 30 seconds, the proxy marks every tool call of that response `unavailable` instead of guessing:

```json
{"type": "unavailable", "reason": "timeout"}
```

`reason` is `timeout` when the 30 second limit passed and `error` when the call raised or the model returned no parsable verdicts. Claude Code blocks those calls and asks again on the next turn, so a misconfigured or down classifier never silently allows a dangerous action and never flips the session into local fallback. When every tool call gets blocked, look for `safeguards classifier` warnings in the proxy logs

## Cost and Logs

The classifier call is a normal proxy call. It shows up as its own request on the Logs page and in spend logs, billed to the same virtual key, team, and end user as the Claude Code request that triggered it. Its cost adds to every tool-calling turn, which is why the choice of classifier model matters
