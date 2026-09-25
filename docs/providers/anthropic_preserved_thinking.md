# Preserved Thinking Prefix Stability

Claude models that preserve thinking across turns sign each thinking block and bind it to the request that produced it. When you replay the conversation with the `thinking-binding-controls-2026-08-01` beta, Anthropic checks that the part of the request ahead of the block still matches what the block was created under: the top-level `system` prompt, the `tools` list, and every message before it. A prefix that changed either drops the block (`prefix_mismatch_behavior: drop_block`, reported by Anthropic as a `thinking_dropped` entry in `input_transformations`) or rejects the request with a 400 that names the part that differs (`prefix_mismatch_behavior: error`). `cache_control` markers are left out of the comparison

Through LiteLLM the model sees the request LiteLLM builds, so a feature that rewrites the conversation has to rewrite the earlier turns the same way on every request. This page lists what LiteLLM does for each feature that touches the prefix, how it places mid-conversation `system` messages on each provider, and which changes break the prefix by design

## Turning the check on

Send the beta header and a `block_binding` setting inside `thinking`. Both pass through `/v1/chat/completions` unchanged

```bash
curl http://localhost:4000/v1/chat/completions \
  -H "Authorization: Bearer sk-1234" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "anthropic/{{anthropic_large}}",
    "max_tokens": 4096,
    "extra_headers": {"anthropic-beta": "thinking-binding-controls-2026-08-01"},
    "thinking": {"type": "adaptive", "block_binding": {"prefix_mismatch_behavior": "error"}},
    "messages": [
      {"role": "system", "content": "You are a terse assistant."},
      {"role": "user", "content": "Which box do I open first?"}
    ]
  }'
```

On the next turn replay the assistant message exactly as LiteLLM returned it, `thinking_blocks` included, and append the new user message. With `error`, a changed prefix comes back as a 400 whose message says which part differs, for example `The system prompt differs from the one this block was created with`. With `drop_block` the request succeeds, the model answers without its earlier reasoning, and Anthropic's response carries `input_transformations` with a `thinking_dropped` entry naming the block, which the proxy prints with `--detailed_debug`

## What LiteLLM does on each feature

| Feature | Effect on the prefix | Notes |
|---|---|---|
| Mid-conversation `system` message on `/v1/chat/completions` | Stable | Placed by its neighbours only, so appended turns never move it (details below) |
| Prompt management, same variables every turn | Stable | The template renders to the same leading messages each time |
| Prompt management, a variable or the prompt version changes | Breaks by design | The leading messages change, so every earlier block is dropped or the request fails |
| Presidio PII masking | Stable | Each message is masked on its own, and the replacement for a given text is deterministic |
| `modify_params` dummy tool result for a tool call with no result | Stable | The inserted result depends only on the tool call it answers |
| `modify_params` trailing whitespace trim on assistant prefill | Not reachable | Thinking rejects assistant prefill, so the trim never runs with thinking on |
| MCP tool injection | Breaks when the server's tool list changes | `tools` is rebuilt from the server on every request |
| `cache_control` markers | Excluded | Anthropic leaves them out of the comparison |

## Mid-conversation `system` messages

OpenAI-style clients put `system` messages anywhere in `messages`. Anthropic's Messages API accepts a `system` role inside `messages` on the models LiteLLM flags with `supports_mid_conversation_system` (Claude Opus 4.8 and the Claude 5 generation onward), but only in one shape: the message must directly follow a user turn and directly precede an assistant turn or end the array, and two `system` messages cannot sit next to each other. Bedrock Converse rejects a `system` role inside `messages` on every model

LiteLLM used to hoist every `system` message into the top-level `system` prompt. On turn N+1 that changed `system` for a block created on turn N, so the binding check tripped on the second turn of any conversation that added a reminder. LiteLLM now places each run of `system` messages by its neighbours alone. A run that directly follows a user turn stays right after it as `role: system`. A run that follows an assistant turn slides behind the user turn that comes next, so `[user, assistant, system, user]` goes out as `[user, assistant, user, system]`. When no user turn follows such a run (it ends the array, or an assistant turn comes next), it becomes a user turn in place, prefixed with an operator note. Runs that land on the same slot merge into one `system` message. Each decision looks only at the messages next to the run, never at the ones after, so replaying the conversation with more turns appended leaves every earlier run where it was and the prefix stays byte-identical

| Route | Model flagged `supports_mid_conversation_system` | Other Claude models |
|---|---|---|
| Anthropic, Vertex AI, Azure AI Foundry, and Bedrock Invoke on `/v1/chat/completions` | Kept as `role: system` inside `messages`, placed as above | Converted to a user turn in place, prefixed with the operator note |
| Bedrock Converse on `/v1/chat/completions` | Converted to a user turn in place, prefixed with the operator note | Same |
| `/v1/messages` | Sent as given | Sent as given |

The operator note is `Operator note (not from the user): the following was originally a mid-conversation system-role reminder.` followed by the original text, so the model still knows the instruction did not come from the user. `litellm.supports_mid_conversation_system("{{anthropic_large}}", "anthropic")` tells you whether a model keeps the `system` role

## Changes that break the prefix by design

Some rewrites cannot be made stable because the input itself changed. A prompt template rendered with a different variable value, or a new version of the prompt, produces different leading messages, and every thinking block created under the old ones loses its binding. Keep the variables and the prompt version fixed for the life of a conversation, and put a new instruction in a fresh message at the end instead of changing a variable. The same goes for MCP servers: LiteLLM fetches the server's tool list on every request, so a server that adds, removes, or renames a tool between turns changes `tools`. Keep the tool set stable while a conversation is open, or expect the blocks to be dropped on the turn after the change

If your application cannot guarantee that, prefer `prefix_mismatch_behavior: drop_block` over `error`: the request still succeeds, the model answers without its earlier reasoning, and the `thinking_dropped` entry tells you which block was affected

## Append-only conversations

The rule that keeps blocks bound is to never edit what was already sent. Replay each assistant message exactly as LiteLLM returned it, `thinking_blocks` included, add new user, tool result, and reminder messages at the end, and keep `system`, `tools`, and prompt variables fixed for the conversation. LiteLLM's placement of mid-conversation `system` messages, its PII masking, and its dummy tool results all follow the same rule, so a client that only appends sends a byte-identical prefix on every turn
