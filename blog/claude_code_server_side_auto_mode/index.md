---
slug: claude-code-server-side-auto-mode
title: "Claude Code server-side auto mode through LiteLLM"
date: 2026-09-21T12:00:00
authors:
  - mateo
description: "Anthropic is moving Claude Code auto mode's safety classifier to server side. LiteLLM's native /v1/messages route now passes the safety contract through to the Anthropic API, Bedrock InvokeModel, Bedrock Mantle and Vertex AI. Here's the contract, what's changed, which releases have it, and how to verify it."
tags: [announcement, claude-code, anthropic, ai-gateway]
hide_table_of_contents: true
---

*Last Updated: October 9, 2026*

Anthropic is moving the Claude Code auto mode safety classifier from the client to the Claude API. From v2.1.278 onwards (released 19 September), sessions on Enterprise plans and Claude API accounts will have the safety classifier run on the server as part of the model request. There is no cost to Anthropic for the classifier to run on the server. The rollout began on 18 September and is gradual, starting with the Claude Code CLI and VS Code extension, followed by the desktop app and Claude Code in the browser over the following week. On 25 September auto mode will become the default permission mode in Claude Code. Currently the default is auto on Pro, Max and Team plans and manual on Enterprise plans and Claude API keys (the accounts that are typically behind a gateway) as per Anthropic's [permission modes reference](https://code.claude.com/docs/en/permission-modes).

Server side auto mode is predicated on a contract between Claude Code and the API which some gateways (LiteLLM included) did not honour. The fix first appeared in the dev release cut on Tuesday 22nd September and is now in v1.104.0 stable as well as in the patch releases of the earlier lines. This post covers what Claude Code requires from an AI Gateway, what LiteLLM was doing wrong, what has changed, which release has it, and how you can verify your deployment is ready.

{/* truncate */}

## What server-side auto mode needs from an AI Gateway

Claude Code sends a `safeguards` field in the `/v1/messages` request body (an array containing a single `dangerous_tool_use` entry which contains the session's permission mode), sets `dangerous-tool-use-2026-09-03` in the `anthropic-beta` header, and the API responds with a `safeguard_results` field: one `dangerous_tool_use` entry whose `status.type` is `available` and whose `status.tool_uses` is keyed by tool use ID, each of which is marked as `evaluated` with an outcome such as `not_flagged`. In the streamed response, `safeguard_results` appears within the `delta` of the final `message_delta` event.

For server side auto mode to work a gateway has to pass the request headers and body fields through as-is (including any it doesn't recognise such as `safeguards`) and return the response and streaming events without dropping the keys (e.g. `safeguard_results`) or rewriting the tool use IDs. That's all spelled out in Anthropic's [gateway compatibility guide](https://code.claude.com/docs/en/llm-gateway-protocol#feature-pass-through).

If any of that is dropped or rewritten then the server's checks never get to the session and Claude Code just keeps using its own classifier requests as before. Prior to the first action it would have checked in that way and Claude Code would have the action and would have displayed that notice identifying the gateway:

```text
We're switching auto mode so that it no longer charges for classifier requests in Claude Code. That said this session isn't eligible as your requests go via <your gateway> and that gateway isn't compatible with the change. Nothing's broken really, auto mode continues to work as it always has and classifier requests are still charged as before. To fix it and get access to the new version of auto mode you'll need to get your gateway to implement: https://code.claude.com/docs/en/auto-mode-classifier-billing
```

Nothing breaks. Users continue with the auto mode they have today and continue to pay for the classifier calls. Anthropic have told us that new Claude Code releases will keep the client-side classifier in place until at least 23rd October 2026. Releases after that date will only support server-side auto mode and from that point on auto mode will not be available behind a gateway that doesn't support the server-side classifier (so gateways have a window to catch up). Anthropic's [notice reference](https://code.claude.com/docs/en/auto-mode-classifier-billing) covers who sees the notice and what it means.

## What LiteLLM was doing wrong

LiteLLM's native `/v1/messages` endpoint constructs the outbound request from an allowlist of known Anthropic Messages parameters, enabling the same endpoint to proxy Claude on Bedrock, Vertex AI, Azure AI and non-Anthropic models. `safeguards` wasn't on that allowlist so it was silently dropped prior to the request even leaving the proxy.

Anthropic got a request with no `safeguards`, returned no evaluated `safeguard_results`, and Claude Code fell back to the paid client side classifier. Running Claude Code v2.1.278 in auto mode against a LiteLLM release without the fix gives you the notice above (with your proxy's address in it) and the `/status` shows the Auto mode server row as `Disabled`.

The raw pass through route (`POST /anthropic/v1/messages`) was never in any way affected. It simply passes the body and headers through unchanged and it already had the appropriate `safeguards` and the full beta header in place prior to the fix. We verified this by running Anthropic's gateway check against a build pre-fix and the pass through route passes whilst the native route fails.

## What changed

[PR #42152](https://github.com/BerriAI/litellm/pull/42152) merged into `main` on 21 September 2026 makes the native `/v1/messages` route preserve the contract. `safeguards` is now a recognised request parameter and is passed through as sent. When the resolved provider is first-party `anthropic` the `anthropic-beta` header is passed through unaltered rather than being filtered against the known-betas list (requests to Claude on Bedrock, Vertex AI and Azure AI continue to have the existing filtering as those providers still reject unknown flags). `safeguard_results` is declared on both the response and the streaming chunk types and is returned unaltered in both the JSON response and the final `message_delta` event when streaming. LiteLLM does not rewrite the tool use IDs on this route so the `safeguard_results` entries still map to the tool uses they refer to.

When `/v1/messages` is used to hit a non-Anthropic model via the adapter path the `safeguards` are stripped prior to the request being translated so those backends don't return a 400.

Non-Claude models behind the proxy can also be covered from v1.107.0. With `safeguards_classifier_model` set in `general_settings` the proxy will itself generate the auto mode verdicts for every non-Claude model behind `/v1/messages` (i.e. an open model on Fireworks, a Gemini deployment, an `openai/deployment`, a DeepSeek on its own Anthropic compatible endpoint etc) and for `bedrock/converse/` models (Claude included). It will have the configured classifier deployment make the judgement on each tool call in the response and return the `safeguard_results` in the same way as the Anthropic API does. So auto mode remains on server review when Claude Code is pointed at an open model. Setup, cost and failure behaviour are all as per [Claude Code auto mode on non-Claude models](https://docs.litellm.ai/docs/claude_code_auto_mode).

This is the fix for LiteLLM's path to the Anthropic API. Claude Code also requests server side checks on Amazon Bedrock and Google Cloud's Vertex AI, and [PR #42288](https://github.com/BerriAI/litellm/pull/42288) (merged 21st September 2026) covers those as well. On `/v1/messages` Claude on Bedrock InvokeModel (e.g. `bedrock/us.anthropic.claude-sonnet-5`) and Claude on Vertex AI now have the `safeguards` and the `dangerous-tool-use-2026-09-03` beta is forwarded, and `safeguard_results` is returned as is. That change is in v1.99.3, v1.100.2, v1.101.1, v1.102.1, v1.103.2 and v1.104.0; v1.101.0 and v1.103.0 don't have it. Claude on Bedrock Mantle (`bedrock_mantle/anthropic.claude-sonnet-5`) is served via Mantle's native Anthropic Messages API from v1.104.0 and preserves the contract there too.

Bedrock itself doesn't answer on the Converse route (`bedrock/converse/<model>`). LiteLLM routes it via the chat completions adapter which strips the `safeguards` and the ConverseStream API from Bedrock doesn't return the `safeguard_results` even when they are sent. So Claude Code will keep its own paid classifier there unless `safeguards_classifier_model` is set in which case the proxy will answer for the Converse models (Claude included). On releases prior to the fix the verification request below will fail on this route with a 400 error: `safeguards: Extra inputs are not permitted`. Without the setting you need to point Claude Code at a `bedrock/<inference profile>` deployment or a `bedrock_mantle/` deployment on v1.104.0 or later. Microsoft Foundry is tracked separately and is not covered by this post.

It first shipped in the dev release cut from `main` on Tuesday 22nd September, prior to Anthropic's default change on the 25th September. The dev release is a pre-release build that gets published to PyPI, Docker Hub and GitHub releases as `-dev.N` tags so this one is `v1.104.0-dev.1` by the current numbering (`litellm==1.104.0.dev1` on PyPI). The fix for the Anthropic API route is now in the v1.104.0 stable release and has been backported to v1.99.3, v1.100.2, v1.101.1, v1.102.1 and v1.103.2. Claude Code sessions that are routed through the native `/v1/messages` endpoint on any of the earlier LiteLLM releases will see the notice and will continue to use the client side classifier until you upgrade. If you'd rather your users don't see the notice in the meantime then Anthropic have a document outlining the setting of `CLAUDE_CODE_AUTO_MODE_SERVER=0` in the environment that Claude Code starts from which will tell it not to query the gateway for server side checks. That just hides the notice, Claude Code will still be making the same paid classifier requests until you upgrade.

## How to verify your deployment

Send a request that's identical to what Claude Code would send, with a forced tool call so that the server has something to evaluate. Check the response for `safeguard_results`. The model must be a deployment that LiteLLM routes to the Anthropic API, Bedrock InvokeModel, Bedrock Mantle or Vertex AI. Replace `claude-sonnet-5` with the name of that deployment's model on your proxy.

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

On a proxy without the fix, `safeguard_results` comes back as empty (`[]`) or missing as the `safeguards` never make it to the provider.

Anthropic sent us a gateway check script which makes the same request both non-streaming and streaming and verifies that every tool use ID is actually evaluated. Both legs pass on a release with the fix. You can also check this from within Claude Code itself. Start a session via your proxy in auto mode, send a prompt and wait for the reply. Then run `/status` and look for the Auto mode server line which will be showing `Enabled`. Prior to the first model response it will be `Enabled` on any proxy so you want to check it after you get the reply. In non-interactive mode with `-p --output-format stream-json` the notice mentioned above comes in as a `system` message at `warning` level so it can be picked up by a script via a grep.

If you're using the `/anthropic/v1/messages` pass-through route today then no action is required.

---

### Frequently Asked Questions

### Does that in any way affect how LiteLLM deals with the beta headers for Bedrock, Vertex AI or Azure AI?

Beta header filtering still kicks in when the resolved provider is anything other than first party `anthropic` (as those providers will reject unknown beta flags) so the allowlist in `anthropic_beta_headers_config.json` remains the source of truth for them. `dangerous-tool-use-2026-09-03` is on that allowlist for Bedrock InvokeModel and Vertex AI in the releases above and for Bedrock Mantle from v1.104.0 (which is how server side auto mode runs on those routes). Bedrock Converse maps it to nothing so it doesn't get forwarded there at all. Only requests going to the Anthropic API have the full header passed through unchanged.

### Will my Claude Code users be broken before I upgrade?

No. Claude Code will detect that the server side checks aren't making it to the session and will continue to use its own classifier. Users will see the notice, they'll carry on with the current experience, and will continue to be charged for classifier calls until you upgrade. Anthropic have let us know that new Claude Code releases will continue to use the client side classifier until at least 23rd October 2026 and that any releases after that date will require the server side classifier for auto mode so you'll need to upgrade before then.

### Is this available in LiteLLM OSS?

Yes. The fix is in LiteLLM OSS (Apache 2.0) and requires no configuration at all. [LiteLLM Enterprise](https://litellm.ai/enterprise) builds on that by adding SSO/SCIM, air-gapped deployment, 24/7 SLA support and a range of advanced guardrails.

---

## Conclusion

An AI Gateway in front of Claude Code has to forward provider contracts it did not exist for when they were designed. The `safeguards` field is one of those, and LiteLLM's native `/v1/messages` route now passes it through unchanged on the way to the Anthropic API, Bedrock InvokeModel, Bedrock Mantle and Vertex AI. Upgrade to a release with the fix, keep Claude Code off `bedrock/converse/` deployments, run the check above, and your users get server-side auto mode at no cost.

## Recommended Reading

- [Claude Code with LiteLLM AI Gateway](https://docs.litellm.ai/docs/tutorials/claude_code_gateway)
- [Claude Code auto mode on non-Claude models](https://docs.litellm.ai/docs/claude_code_auto_mode)
- [Claude Code: managing Anthropic beta headers](https://docs.litellm.ai/docs/tutorials/claude_code_beta_headers)
- [Anthropic pass-through endpoints](https://docs.litellm.ai/docs/pass_through/anthropic_completion)
- [Anthropic: auto mode classifier request charges](https://code.claude.com/docs/en/auto-mode-classifier-billing)
- [Anthropic: LLM gateway compatibility guide](https://code.claude.com/docs/en/llm-gateway-protocol#feature-pass-through)
