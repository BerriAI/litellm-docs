---
slug: claude-code-server-side-auto-mode
title: "Claude Code server-side auto mode through LiteLLM"
date: 2026-09-21T12:00:00
authors:
  - litellm
description: "Anthropic is moving Claude Code auto mode's safety classifier server-side. LiteLLM's native /v1/messages route now forwards the safeguards contract to the Anthropic API, Bedrock and Vertex AI. Here is the contract, what changed, which releases carry it, and how to verify it."
tags: [announcement, claude-code, anthropic, ai-gateway]
hide_table_of_contents: true
---

*Last Updated: October 6, 2026*

Anthropic is moving Claude Code auto mode's safety classifier from the client to the Claude API. Starting with Claude Code v2.1.278, released September 19, sessions on Enterprise plans and Claude API accounts ask the server to run those checks as part of their own model requests, and Anthropic does not charge for the checks when the server performs them. Anthropic told us the rollout started on September 18 and is gradual, beginning with the Claude Code CLI and VS Code extension and followed by the desktop app and Claude Code on the web over the following week, and that on September 25 auto mode becomes the default permission mode in Claude Code. Today the built-in default is auto on Pro, Max and Team plans and Manual on Enterprise plans and Claude API keys, the accounts that typically sit behind a gateway, per Anthropic's [permission modes reference](https://code.claude.com/docs/en/permission-modes).

Server-side auto mode depends on a contract between Claude Code and the API that some gateways did not preserve, LiteLLM included. The fix first shipped in the dev release cut on Tuesday, September 22, and is now in the v1.104.0 stable release and in patch releases of earlier lines. This post explains what Claude Code needs from an AI Gateway, what LiteLLM was doing wrong, what changed, which release carries it, and how to confirm your deployment is ready.

{/* truncate */}

## What server-side auto mode needs from an AI Gateway

Claude Code sends a `safeguards` field in the `/v1/messages` request body, an array with one `dangerous_tool_use` entry that carries the session's permission mode, and it sets `dangerous-tool-use-2026-09-03` in the `anthropic-beta` header. The API answers with a `safeguard_results` field: one `dangerous_tool_use` entry whose `status.type` is `available` and whose `status.tool_uses` is keyed by tool use ID, each marked `evaluated` with an outcome such as `not_flagged`. When the response is streamed, `safeguard_results` arrives inside the `delta` of the final `message_delta` event.

For server-side auto mode to run, a gateway has to forward request headers and body fields as they are, including ones it does not recognize such as `safeguards`, and return responses and streaming events without dropping keys such as `safeguard_results` or rewriting tool use IDs. Anthropic's [gateway compatibility guide](https://code.claude.com/docs/en/llm-gateway-protocol#feature-pass-through) spells this out.

If any of that is dropped or rewritten, the server's checks never reach the session, and Claude Code keeps using its own classifier requests, billed as before. Before the first action it would check that way, Claude Code holds the action and shows this notice, naming the gateway:

```text
We're changing auto mode to no longer charge for classifier requests in Claude Code. However, this session isn't eligible because your requests go through <your gateway>, which isn't compatible with this update. Nothing breaks: auto mode keeps working, and its classifier requests are billed as before. To fix it and access the new version of auto mode, ask your gateway to implement: https://code.claude.com/docs/en/auto-mode-classifier-billing
```

Nothing breaks when this happens. Users keep the auto mode they have today and keep paying for the classifier calls. Anthropic has told us that new Claude Code releases keep the client-side classifier until at least October 23, 2026, that releases after that date only support server-side auto mode, and that from then on auto mode is not available behind a gateway that does not support the server-side classifier, so gateways have a window to catch up. Anthropic's [notice reference](https://code.claude.com/docs/en/auto-mode-classifier-billing) covers who sees the notice and what it means.

## What LiteLLM was doing wrong

LiteLLM's native `/v1/messages` endpoint builds the outbound request from an allowlist of known Anthropic Messages parameters so that the same endpoint can front Claude on Bedrock, Vertex AI, Azure AI and non-Anthropic models. `safeguards` was not on that list, so it was silently dropped before the request left the proxy. Separately, LiteLLM filters `anthropic-beta` values it does not recognize to protect providers that reject unknown beta flags, and that filter ran even when the upstream was the Anthropic API, so where the beta was not yet on its allowlist, `dangerous-tool-use-2026-09-03` was stripped from the header too.

Anthropic therefore received a request with no `safeguards`, returned no evaluated `safeguard_results`, and Claude Code fell back to the paid client-side classifier. Running Claude Code v2.1.278 in auto mode against a LiteLLM release without the fix shows the notice above with your proxy's address in it, and `/status` reports the Auto mode server row as `Disabled`.

The raw pass-through route, `POST /anthropic/v1/messages`, was never affected. It forwards the body and headers verbatim, and it already carried `safeguards` and the full beta header before the fix. We confirmed this by running Anthropic's gateway check against a build from before the fix: the pass-through route passes and the native route fails.

## What changed

[PR #42152](https://github.com/BerriAI/litellm/pull/42152), merged into `main` on September 21, 2026, makes the native `/v1/messages` route preserve the contract. `safeguards` is now a recognized request parameter and is forwarded as sent. When the resolved provider is first-party `anthropic`, the `anthropic-beta` header is forwarded unchanged instead of being filtered against the known-betas list; requests to Claude on Bedrock, Vertex AI and Azure AI keep the existing filtering because those providers still reject unknown flags. `safeguard_results` is declared on the response and streaming chunk types, and it is returned unchanged in both the JSON response and the final `message_delta` event when streaming. LiteLLM does not rewrite tool use IDs on this route, so `safeguard_results` entries still match the tool uses they refer to.

When `/v1/messages` is used to reach a non-Anthropic model through the adapter path, `safeguards` is stripped before the request is translated so those backends do not return a 400.

This fix covers LiteLLM's route to the Anthropic API. Claude Code also asks for server-side checks on Amazon Bedrock and Google Cloud's Vertex AI, and [PR #42288](https://github.com/BerriAI/litellm/pull/42288), merged on September 21, 2026, covers those too. On `/v1/messages`, Claude on Bedrock InvokeModel (for example `bedrock/us.anthropic.claude-sonnet-5`) and Claude on Vertex AI now get `safeguards` and the `dangerous-tool-use-2026-09-03` beta forwarded, and `safeguard_results` comes back unchanged. That change is in v1.99.3, v1.100.2, v1.101.1, v1.102.1, v1.103.2 and v1.104.0; v1.101.0 and v1.103.0 do not have it. Claude on Bedrock Mantle (`bedrock_mantle/anthropic.claude-sonnet-5`) is served through Mantle's native Anthropic Messages API from v1.104.0 and preserves the contract there too.

The Bedrock Converse route, `bedrock/converse/<model>`, is not covered on any release. LiteLLM translates it through the chat completions adapter, which drops `safeguards`, and Bedrock's ConverseStream API does not return `safeguard_results` even when they are sent, so Claude Code keeps its paid classifier there. On releases without the fix the verification request below fails on this route with a 400, `safeguards: Extra inputs are not permitted`. Point Claude Code at a `bedrock/<inference profile>` deployment, or a `bedrock_mantle/` deployment on v1.104.0 or later, instead. Microsoft Foundry is tracked separately and not covered by this post.

It first shipped in the dev release cut from `main` on Tuesday, September 22, ahead of Anthropic's September 25 default change. Dev releases are pre-release builds published to PyPI, Docker Hub and GitHub releases as `-dev.N` tags, so this one is `v1.104.0-dev.1` by the current numbering (`litellm==1.104.0.dev1` on PyPI). The fix for the Anthropic API route is now in the v1.104.0 stable release and was backported to v1.99.3, v1.100.2, v1.101.1, v1.102.1 and v1.103.2. Claude Code sessions routed through the native `/v1/messages` endpoint on any earlier LiteLLM release see the notice and keep using the client-side classifier until you upgrade. If you would rather your users not see the notice in the meantime, Anthropic documents setting `CLAUDE_CODE_AUTO_MODE_SERVER=0` in the environment Claude Code starts from, which tells it not to ask the gateway for server-side checks. That only hides the notice: Claude Code keeps making the same paid classifier requests until you upgrade.

## How to verify your deployment

Send a request that mirrors what Claude Code sends, with a forced tool call so the server has something to evaluate, and check the response for `safeguard_results`. The model has to be a deployment that LiteLLM routes to the Anthropic API, Bedrock InvokeModel, Bedrock Mantle or Vertex AI; replace `claude-sonnet-5` with that deployment's model name on your proxy.

```bash
curl -s "$LITELLM_PROXY_URL/v1/messages" \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -H "content-type: application/json" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: dangerous-tool-use-2026-09-03" \
  -d '{
    "model": "claude-sonnet-5",
    "max_tokens": 256,
    "safeguards": [{"type": "dangerous_tool_use", "classifier_context": {"v": 1, "permission_mode": "auto"}}],
    "tools": [{"name": "Bash", "description": "Runs a shell command", "input_schema": {"type": "object", "properties": {"command": {"type": "string"}}, "required": ["command"]}}],
    "tool_choice": {"type": "tool", "name": "Bash"},
    "messages": [{"role": "user", "content": "Run: echo hello"}]
  }' | jq '{safeguard_results, tool_use_ids: [.content[] | select(.type == "tool_use") | .id]}'
```

On a release with the fix, the tool use ID in `safeguard_results` matches the one in the response content:

```json
{
  "safeguard_results": [
    {
      "type": "dangerous_tool_use",
      "status": {
        "type": "available",
        "tool_uses": {
          "toolu_01V9Z5KXn3SU71Fzr5cquHLi": {
            "type": "evaluated",
            "outcome": "not_flagged"
          }
        }
      }
    }
  ],
  "tool_use_ids": [
    "toolu_01V9Z5KXn3SU71Fzr5cquHLi"
  ]
}
```

On a proxy without the fix, `safeguard_results` comes back empty (`[]`) or missing, because `safeguards` never reached the provider.

Anthropic shared a gateway check script with us that sends the same request non-streaming and streaming and checks that every tool use ID comes back evaluated. Both legs pass against a release with the fix. You can also check from Claude Code itself: start a session through your proxy in auto mode, send a prompt and wait for the reply, then run `/status` and look for the Auto mode server row reading `Enabled`. Before the first model response the row reads `Enabled` on any proxy, so check it after a reply. In non-interactive mode with `-p --output-format stream-json`, the notice above arrives as a `system` message at `warning` level, so a scripted check can grep for it.

If you use the `/anthropic/v1/messages` pass-through route today, no action is needed.

---

### Frequently Asked Questions

### Does this change how LiteLLM handles beta headers for Bedrock, Vertex AI or Azure AI?

Beta header filtering still applies when the resolved provider is anything other than first-party `anthropic`, because those providers reject unknown beta flags, so the allowlist in `anthropic_beta_headers_config.json` remains the source of truth for them. `dangerous-tool-use-2026-09-03` is on that allowlist for Bedrock InvokeModel and Vertex AI in the releases listed above, and for Bedrock Mantle from v1.104.0, which is how server-side auto mode runs on those routes. Bedrock Converse maps it to nothing, so it is not forwarded there. Only requests bound for the Anthropic API forward the whole header unchanged.

### Will my Claude Code users be broken before I upgrade?

No. Claude Code detects that the server's checks are not reaching the session and keeps using its own classifier. Users see the notice, keep the current experience, and keep being billed for classifier calls until you upgrade. Anthropic has told us new Claude Code releases keep the client-side classifier until at least October 23, 2026, and that releases after that date need the server-side classifier for auto mode, so upgrade before then.

### Is this available in LiteLLM OSS?

Yes. The fix is in LiteLLM OSS (Apache 2.0) and requires no configuration. [LiteLLM Enterprise](https://litellm.ai/enterprise) adds SSO/SCIM, air-gapped deployment, 24/7 SLA support and advanced guardrails on top.

---

## Conclusion

An AI Gateway in front of Claude Code has to forward provider contracts it did not exist for when they were designed. The `safeguards` field is one of those, and LiteLLM's native `/v1/messages` route now passes it through unchanged on the way to the Anthropic API, Bedrock InvokeModel, Bedrock Mantle and Vertex AI. Upgrade to a release with the fix, keep Claude Code off `bedrock/converse/` deployments, run the check above, and your users get server-side auto mode at no cost.

## Recommended Reading

- [Claude Code with LiteLLM AI Gateway](https://docs.litellm.ai/docs/tutorials/claude_code_gateway)
- [Claude Code: managing Anthropic beta headers](https://docs.litellm.ai/docs/tutorials/claude_code_beta_headers)
- [Anthropic pass-through endpoints](https://docs.litellm.ai/docs/pass_through/anthropic_completion)
- [Anthropic: auto mode classifier request charges](https://code.claude.com/docs/en/auto-mode-classifier-billing)
- [Anthropic: LLM gateway compatibility guide](https://code.claude.com/docs/en/llm-gateway-protocol#feature-pass-through)
