---
slug: claude-code-server-side-auto-mode
title: "Claude Code server-side auto mode now works through LiteLLM"
date: 2026-09-21T12:00:00
authors:
  - litellm
description: "Anthropic is moving Claude Code auto mode's safety classifier server-side. LiteLLM's AI Gateway now forwards the safeguards contract unchanged, so sessions behind LiteLLM get the free classifier. Here is what changed and how to verify it."
tags: [announcement, claude-code, anthropic, ai-gateway]
hide_table_of_contents: true
---

*Last Updated: September 21, 2026*

On September 18, Anthropic started moving Claude Code auto mode's safety classifier from the client to the Claude API. With server-side auto mode, users are no longer billed for classifier calls. The rollout is gradual, beginning with the Claude Code CLI and VS Code extension, followed by the desktop app and Claude Code on the web over the following week. On September 25, auto mode becomes the default permission mode in Claude Code.

Server-side auto mode depends on a new contract between Claude Code and the API that some gateways did not preserve, LiteLLM included. We have shipped the fix. This post explains what Claude Code needs from an AI Gateway, what LiteLLM was doing wrong, what changed, and how to confirm your deployment is ready.

{/* truncate */}

## What server-side auto mode needs from an AI Gateway

Claude Code sends a `safeguards` field in the `/v1/messages` request body and expects a `safeguard_results` field back in the response. It matches each entry in `safeguard_results` to a tool use ID. The request also carries a `safeguards-2026-09-01` value in the `anthropic-beta` header. For server-side auto mode to run, a gateway has to pass `safeguards` through unchanged, return `safeguard_results` unchanged, keep tool use IDs unchanged, and forward the beta header intact.

If any of that is dropped or rewritten, Claude Code concludes that server-side review is unavailable and offers to fall back to the client-side classifier. Users keep the experience they have today and keep paying for the classifier calls, and they see a notice telling them to contact their gateway provider.

New Claude Code releases keep the client-side fallback until at least October 23, 2026. After that date, new releases only support server-side auto mode, so users behind a gateway that does not preserve the contract will not be able to use auto mode at all.

## What LiteLLM was doing wrong

LiteLLM's native `/v1/messages` endpoint builds the outbound request from an allowlist of known Anthropic Messages parameters so that the same endpoint can front Claude on Bedrock, Vertex AI, Azure AI and non-Anthropic models. `safeguards` was not on that list, so it was silently dropped before the request left the proxy. Separately, LiteLLM filters `anthropic-beta` values it does not recognize to protect providers that reject unknown beta flags, and that filter ran even when the upstream was api.anthropic.com, so `safeguards-2026-09-01` was stripped from the header too.

Anthropic therefore received a request with no `safeguards`, returned no `safeguard_results`, and Claude Code fell back to the paid client-side classifier.

The raw pass-through route, `POST /anthropic/v1/messages`, was never affected. It forwards the body and headers verbatim, and it already carried `safeguards` and the full beta header before the fix.

## What changed

[PR #42152](https://github.com/BerriAI/litellm/pull/42152), merged into `main` on September 21, 2026, makes the native `/v1/messages` route preserve the contract. `safeguards` is now a recognized request parameter and is forwarded as sent. When the resolved provider is first-party `anthropic`, the `anthropic-beta` header is forwarded unchanged instead of being filtered against the known-betas list; requests to Claude on Bedrock, Vertex AI and Azure AI keep the existing filtering because those providers still reject unknown flags. `safeguard_results` is declared on the response and streaming chunk types, and it is returned unchanged in both the JSON response and the `message_start` and `message_delta` events when streaming. LiteLLM does not rewrite tool use IDs on this route, so `safeguard_results` entries still match the tool uses they refer to.

When `/v1/messages` is used to reach a non-Anthropic model through the adapter path, `safeguards` is stripped before the request is translated so those backends do not return a 400. Server-side auto mode is an Anthropic API feature, so it only applies when the request reaches api.anthropic.com.

The fix ships in the next LiteLLM release after `v1.102.0`. Until you upgrade, Claude Code sessions routed through the native `/v1/messages` endpoint fall back to the client-side classifier and keep working.

## How to verify your deployment

Send a request that mirrors what Claude Code sends and check the response for `safeguard_results`.

```bash
curl -s "$LITELLM_PROXY_URL/v1/messages" \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -H "content-type: application/json" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: safeguards-2026-09-01" \
  -d '{
    "model": "claude-sonnet-4-5",
    "max_tokens": 64,
    "safeguards": {"auto_mode": {"enabled": true, "version": "2026-09-01"}},
    "messages": [{"role": "user", "content": "hi"}]
  }'
```

On a fixed proxy pointed at api.anthropic.com, the response body includes a `safeguard_results` field. On an unfixed proxy the field is absent, because Anthropic never received `safeguards`. You can also open the request in the LiteLLM logs UI and switch the Request & Response view to JSON; the logged request should show `safeguards.auto_mode` and the full `anthropic-beta` header. Anthropic has offered a test script with expected input and output for gateway providers; contact your Anthropic account team if you want to run it against your own deployment.

If you use the `/anthropic/v1/messages` pass-through route today, no action is needed.

---

### Frequently Asked Questions

### Does this change how LiteLLM handles beta headers for Bedrock, Vertex AI or Azure AI?

No. Beta header filtering still applies when the resolved provider is anything other than first-party `anthropic`. Those providers reject unknown beta flags, so the allowlist in `anthropic_beta_headers_config.json` remains the source of truth for them. Only requests bound for api.anthropic.com now forward the header unchanged.

### Will my Claude Code users be broken before I upgrade?

No. Claude Code detects that server-side review is unavailable and offers the client-side classifier. Users keep the current experience and keep being billed for classifier calls until you upgrade. After October 23, 2026, new Claude Code releases drop the client-side fallback, so upgrade before then.

### Is this available in LiteLLM OSS?

Yes. The fix is in LiteLLM OSS (Apache 2.0) and requires no configuration. [LiteLLM Enterprise](https://litellm.ai/enterprise) adds SSO/SCIM, air-gapped deployment, 24/7 SLA support and advanced guardrails on top.

---

## Conclusion

An AI Gateway in front of Claude Code has to forward provider contracts it did not exist for when they were designed. The `safeguards` field is one of those, and LiteLLM now passes it through unchanged on every route to api.anthropic.com. Upgrade to the next release, run the check above, and your users get server-side auto mode at no cost.

## Recommended Reading

- [Claude Code with LiteLLM AI Gateway](https://docs.litellm.ai/docs/tutorials/claude_code_gateway)
- [Claude Code: managing Anthropic beta headers](https://docs.litellm.ai/docs/tutorials/claude_code_beta_headers)
- [Anthropic pass-through endpoints](https://docs.litellm.ai/docs/pass_through/anthropic_completion)
