---
title: Auto Router with Claude Code and Claude Desktop
sidebar_label: Auto Router
description: Route Claude Code and Claude Desktop through a LiteLLM auto router, including gateway discovery's model-name filter and the organization allowlist requirements that decide whether the router is selectable at all.
---

# Auto Router with Claude Code and Claude Desktop

A LiteLLM [auto router](../proxy/auto_routing.md) sends every Claude Code request to the smallest model that can handle it, which is where most of the savings on a Claude Code workload come from. Pointing Claude at one takes little beyond the usual `ANTHROPIC_BASE_URL` setup: the router's name on your organization's model allowlist if your organization restricts models, and a name containing `claude` or `anthropic` if you want the picker to discover the router on its own rather than naming it explicitly.

Skip the allowlist step and the router is greyed out in the Claude Desktop model picker, missing from `/model` in the CLI, and any attempt to select it by name starts the session on a different model with the notice `Model "<name>" is restricted by your organization's settings. Using <model> instead.` Nothing reaches your proxy, so the LiteLLM logs stay empty and the problem looks like a routing bug rather than a client-side policy check.

## Name the router so Claude accepts it

Only one thing about the router's name matters to Claude Code by itself, and it is narrower than it sounds: gateway model discovery (`CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY=1`, see below) populates the `/model` picker from your proxy's `/v1/models` response and keeps only the entries whose `id` contains `claude` or `anthropic` anywhere in the string, case-insensitively; everything else in that response gets dropped. That is the entire filter. There is no separate allowance for a family word like `opus`, `sonnet`, `haiku`, or `fable`, and no check for a rival vendor's name, so `claude-auto` and `claude-smart-router` pass discovery while `smart-router` and a bare UUID do not, and `claude-vs-gpt` also passes despite naming a competitor.

Discovery is a convenience for populating the picker automatically, not a gate on whether the router works. Point `ANTHROPIC_MODEL` at any `model_name`, or set `ANTHROPIC_CUSTOM_MODEL_OPTION` to it on the CLI or in Claude Desktop, and Claude Code sends that string through with no client-side validation on its shape, so a router named `smart-router` works the same as `claude-auto`. Use this for a name discovery would skip, instead of renaming the router to satisfy a filter that only affects the picker.

The one place a family word still costs you something is the allowlist in the next section, not the client: `opus-auto` counts there as a specific Opus entry, which disables the `opus` family wildcard and leaves every other Opus version you still want selectable to be listed by hand. Building the name on `claude` avoids that.

```yaml title="config.yaml" keep-model-ids
model_list:
  - model_name: claude-auto
    litellm_params:
      model: auto_router/complexity_router
      complexity_router_config:
        tiers:
          SIMPLE:    claude-haiku-4-5
          MEDIUM:    claude-sonnet-5
          COMPLEX:   claude-sonnet-5
          REASONING: claude-opus-4-8
      complexity_router_default_model: claude-sonnet-5
```

To have an agent write that entry against the models your proxy already serves, tell it `run curl -fsSL https://docs.litellm.ai/skills/auto-router and follow the instructions`, and say the router is for Claude Code so it picks an accepted name.

If API callers already use a non-Anthropic name, keep both by declaring a second `model_list` entry with the same `complexity_router_config` under the Claude-facing name. `router_settings.model_group_alias` does not work here, because alias resolution runs after auto-router dispatch and the aliased call fails with `Unmapped LLM provider`.

## Add the router to your organization's allowlist

Organizations on Claude for Teams or Claude for Enterprise restrict model selection with [`availableModels`](https://code.claude.com/docs/en/model-config#restrict-model-selection) in Claude Code managed settings. The list is an allowlist, and it is matched against a model family such as `sonnet`, a version prefix, or a full model ID, so a gateway-hosted router has to be listed by its exact `model_name`.

```json
{
  "availableModels": ["claude-auto", "sonnet", "haiku"]
}
```

Owners set this in the claude.ai console at **Admin Settings > Claude Code > Managed settings**, which covers Claude Desktop and claude.ai sessions. Terminal sessions pointed at LiteLLM need the same list delivered through MDM or a managed settings file, because Claude Code skips the server-managed settings fetch whenever `ANTHROPIC_BASE_URL` points somewhere other than Anthropic. That file lives at `/Library/Application Support/ClaudeCode/managed-settings.json` on macOS, `/etc/claude-code/managed-settings.json` on Linux and WSL, and `C:\Program Files\ClaudeCode\managed-settings.json` on Windows.

This allowlist is a separate control from the Enterprise admin console's per-model restrictions, which govern Anthropic's own models rather than custom gateway IDs. Both apply, so a router is selectable only when it is on `availableModels` and the models it routes to are not restricted for the organization.

## Point Claude at the router

For the CLI, export the proxy URL, a virtual key, and the router name. `ANTHROPIC_MODEL` is read at startup, so set it before launching `claude`.

```bash
export ANTHROPIC_BASE_URL=https://your-litellm-proxy.com
export ANTHROPIC_AUTH_TOKEN=sk-...
export ANTHROPIC_MODEL=claude-auto
```

To get the router into the `/model` picker rather than only into the startup model, set `CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY=1` and Claude Code populates the picker from the proxy's `/v1/models`. Where discovery is turned off, `ANTHROPIC_CUSTOM_MODEL_OPTION=claude-auto` adds the single entry instead.

For Claude Desktop, enter the proxy URL and virtual key under **Developer > Configure Third-Party Inference**, then pick the router in the model list. The [Claude Desktop integration guide](./claude_desktop_cowork.md) walks the dialog screen by screen.

## Context window shown in the client

The window LiteLLM advertises for the router and the window Claude Code works to are separate numbers, and the proxy cannot push its value into the client. Claude Code applies its own default for a model name it does not recognize as one of Anthropic's, which a gateway-served router name never is. Setting `max_input_tokens` in the router's `model_info` changes what `/v1/models` and the LiteLLM UI report without moving what the client displays or when it compacts, so a mismatch between the two is expected rather than a sign the router is misconfigured.

Configure the client separately. `CLAUDE_CODE_AUTO_COMPACT_WINDOW`, or `autoCompactWindow` in `.claude/settings.json`, sets the context window Claude Code targets before auto-compaction, and `autoCompactEnabled` turns compaction off. See Claude Code's [model configuration](https://code.claude.com/docs/en/model-config) reference.

The same split applies to any harness pointed at a router: the number it shows comes from its own defaults for a name it does not know, so it has to be set in the harness. What the proxy enforces is unaffected either way, because [context-window checks and escalation](../proxy/auto_routing.md#context-window) run against the tier model the router actually picked rather than against the router name.

## Scope the virtual key to the router

Give Claude clients a key scoped to the router alone.

```bash
curl -X POST $LITELLM_PROXY_URL/key/generate \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{"models": ["claude-auto"]}'
```

Model discovery lists whatever the key can reach, and Claude Desktop's **Test connection** then probes `/v1/messages` with one of the discovered models rather than with the one you selected. A broadly scoped key turns that into a connection failure on some unrelated deployment, which reads as a broken router. Scoping the key to `claude-auto` makes discovery return exactly one model and the probe hit the router itself. Wildcard route names are worth checking here too, since a literal `claude-*` entry in `model_list` is published verbatim in `/v1/models` and 404s when a client probes it.

## Troubleshooting

| Symptom | Cause | Fix |
| ------- | ----- | --- |
| Router greyed out in the Claude Desktop or claude.ai model picker | Router name is missing from `availableModels` | Add the exact `model_name` to the allowlist and restart the client |
| `Model "<name>" is restricted by your organization's settings` at CLI startup | Same allowlist, delivered to the terminal | Deploy the list through MDM or `managed-settings.json`; the admin console channel does not reach sessions on `ANTHROPIC_BASE_URL` |
| Router never shows up in the picker even though `availableModels` lists it | Relying on discovery with a name that lacks `claude`/`anthropic`, so it never gets discovered in the first place | Rename it, or add it directly with `ANTHROPIC_CUSTOM_MODEL_OPTION` instead of depending on discovery |
| Test connection fails naming a model you never selected | Key discovers models beyond the router and the probe picks one of them | Scope the virtual key to the router |
| Router missing from `/v1/models` and the Models page after an edit | Older builds did not relink the in-memory router registry when a deployment was replaced | Restart the proxy to reload it from the database, and upgrade to a release containing [PR #34564](https://github.com/BerriAI/litellm/pull/34564) |
| Context window in the client looks wrong for the router | Claude Code applies its own default for a model name it does not recognize; the proxy value is advisory | Set `CLAUDE_CODE_AUTO_COMPACT_WINDOW` or `autoCompactWindow` on the client. `model_info.max_input_tokens` on the router changes only what `/v1/models` and the UI report |

## Related

- [Auto Routing](../proxy/auto_routing.md)
- [Claude Code - Cut Costs](./claude_code_cut_costs.md)
- [Claude Desktop integration](./claude_desktop_cowork.md)
- [Virtual Keys](../proxy/virtual_keys.md)
