---
slug: claude-code-server-side-auto-mode
title: "Claude Code server-side auto mode through LiteLLM"
date: 2026-09-21T12:00:00
authors:
  - litellm
description: "Anthropic is moving Claude Code auto mode's safety classifier server-side. LiteLLM's native /v1/messages route now forwards the safeguards contract on main, and the fix ships in the next release. Here is the contract, what changed, when it ships, and how to verify it."
tags: [announcement, claude-code, anthropic, ai-gateway]
hide_table_of_contents: true
---

*Last Updated: September 21, 2026*

Anthropic is moving Claude Code auto mode's safety classifier from the client to the Claude API. Starting with Claude Code v2.1.278, released September 19, sessions on Enterprise plans and Claude API accounts ask the server to run those checks as part of their own model requests, and Anthropic does not charge for the checks when the server performs them. Anthropic told us the rollout started on September 18 and is gradual, beginning with the Claude Code CLI and VS Code extension and followed by the desktop app and Claude Code on the web over the following week, and that on September 25 auto mode becomes the default permission mode in Claude Code. Today the built-in default is auto on Pro, Max and Team plans and Manual on Enterprise plans and Claude API keys, the accounts that typically sit behind a gateway, per Anthropic's [permission modes reference](https://code.claude.com/docs/en/permission-modes).

Server-side auto mode depends on a contract between Claude Code and the API that some gateways did not preserve, LiteLLM included. The fix is merged on `main` and ships in the next release. This post explains what Claude Code needs from an AI Gateway, what LiteLLM was doing wrong, what changed, which release carries it, and how to confirm your deployment is ready.

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

LiteLLM's native `/v1/messages` endpoint builds the outbound request from an allowlist of known Anthropic Messages parameters so that the same endpoint can front Claude on Bedrock, Vertex AI, Azure AI and non-Anthropic models. `safeguards` was not on that list, so it was silently dropped before the request left the proxy. Separately, LiteLLM filters `anthropic-beta` values it does not recognize to protect providers that reject unknown beta flags, and that filter ran even when the upstream was the Anthropic API, so `dangerous-tool-use-2026-09-03` was stripped from the header too.

Anthropic therefore received a request with no `safeguards` and no beta flag, returned no `safeguard_results`, and Claude Code fell back to the paid client-side classifier. Running Claude Code v2.1.278 in auto mode against a LiteLLM release without the fix shows the notice above with your proxy's address in it, and `/status` reports the Auto mode server row as `Disabled`.

The raw pass-through route, `POST /anthropic/v1/messages`, was never affected. It forwards the body and headers verbatim, and it already carried `safeguards` and the full beta header before the fix. We confirmed this by running Anthropic's gateway check against a build from before the fix: the pass-through route passes and the native route fails.

## What changed

[PR #42152](https://github.com/BerriAI/litellm/pull/42152), merged into `main` on September 21, 2026, makes the native `/v1/messages` route preserve the contract. `safeguards` is now a recognized request parameter and is forwarded as sent. When the resolved provider is first-party `anthropic`, the `anthropic-beta` header is forwarded unchanged instead of being filtered against the known-betas list; requests to Claude on Bedrock, Vertex AI and Azure AI keep the existing filtering because those providers still reject unknown flags. `safeguard_results` is declared on the response and streaming chunk types, and it is returned unchanged in both the JSON response and the final `message_delta` event when streaming. LiteLLM does not rewrite tool use IDs on this route, so `safeguard_results` entries still match the tool uses they refer to.

When `/v1/messages` is used to reach a non-Anthropic model through the adapter path, `safeguards` is stripped before the request is translated so those backends do not return a 400.

This fix covers LiteLLM's route to the Anthropic API. Claude Code also asks for server-side checks on Amazon Bedrock, Google Cloud's Agent Platform and Microsoft Foundry, subject to each platform's own rollout, and LiteLLM's routes to those platforms still filter the beta header, so sessions reaching Claude on them through LiteLLM are not covered by this change yet. We are tracking that as follow-up work.

The merge is not in any tagged build up to `v1.103.0-rc.1`. It first ships in the release candidate cut on Saturday, September 26 (`v1.104.0-rc.1` by the current numbering), with the stable release the following week, planned for Saturday, October 3. Anthropic's September 25 default change lands one day before that release candidate, so Claude Code sessions routed through the native `/v1/messages` endpoint on any current LiteLLM release see the notice and keep using the client-side classifier until you upgrade. If you would rather your users not see the notice in the meantime, Anthropic documents setting `CLAUDE_CODE_AUTO_MODE_SERVER=0` in the environment Claude Code starts from, which tells it not to ask the gateway for server-side checks.

## How to verify your deployment

Send a request that mirrors what Claude Code sends, with a forced tool call so the server has something to evaluate, and check the response for `safeguard_results`. The model has to be a deployment that LiteLLM routes to the Anthropic API.

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

On a proxy built from `main` (or the release candidate above) pointed at the Anthropic API, the tool use ID in `safeguard_results` matches the one in the response content:

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

On a proxy without the fix, `safeguard_results` is `null`, because Anthropic never received `safeguards` or the beta flag.

Anthropic shared a gateway check script with us that sends the same request non-streaming and streaming and checks that every tool use ID comes back evaluated. Both legs pass against a proxy built from `main`. You can also check from Claude Code itself: start a session through your proxy in auto mode, run `/status`, and look for the Auto mode server row reading `Enabled`. In non-interactive mode with `-p --output-format stream-json`, the notice above arrives as a `system` message at `warning` level, so a scripted check can grep for it.

If you use the `/anthropic/v1/messages` pass-through route today, no action is needed.

---

### Frequently Asked Questions

### Does this change how LiteLLM handles beta headers for Bedrock, Vertex AI or Azure AI?

No. Beta header filtering still applies when the resolved provider is anything other than first-party `anthropic`. Those providers reject unknown beta flags, so the allowlist in `anthropic_beta_headers_config.json` remains the source of truth for them, and server-side auto mode does not run through LiteLLM on those routes yet. Only requests bound for the Anthropic API now forward the header unchanged.

### Will my Claude Code users be broken before I upgrade?

No. Claude Code detects that the server's checks are not reaching the session and keeps using its own classifier. Users see the notice, keep the current experience, and keep being billed for classifier calls until you upgrade. Anthropic has told us new Claude Code releases keep the client-side classifier until at least October 23, 2026, and that releases after that date need the server-side classifier for auto mode, so upgrade before then.

### Is this available in LiteLLM OSS?

Yes. The fix is in LiteLLM OSS (Apache 2.0) and requires no configuration. [LiteLLM Enterprise](https://litellm.ai/enterprise) adds SSO/SCIM, air-gapped deployment, 24/7 SLA support and advanced guardrails on top.

---

## Conclusion

An AI Gateway in front of Claude Code has to forward provider contracts it did not exist for when they were designed. The `safeguards` field is one of those, and LiteLLM's native `/v1/messages` route now passes it through unchanged on the way to the Anthropic API. Upgrade to the September 26 release candidate or the October 3 stable release, run the check above, and your users get server-side auto mode at no cost.

## Recommended Reading

- [Claude Code with LiteLLM AI Gateway](https://docs.litellm.ai/docs/tutorials/claude_code_gateway)
- [Claude Code: managing Anthropic beta headers](https://docs.litellm.ai/docs/tutorials/claude_code_beta_headers)
- [Anthropic pass-through endpoints](https://docs.litellm.ai/docs/pass_through/anthropic_completion)
- [Anthropic: auto mode classifier request charges](https://code.claude.com/docs/en/auto-mode-classifier-billing)
- [Anthropic: LLM gateway compatibility guide](https://code.claude.com/docs/en/llm-gateway-protocol#feature-pass-through)
