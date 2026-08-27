---
title: Auto Router with Claude Code and Claude Desktop
sidebar_label: Auto Router
description: Route Claude Code and Claude Desktop through a LiteLLM auto router, including the model name and organization allowlist requirements that decide whether the router is selectable at all.
---

# Auto Router with Claude Code and Claude Desktop

A LiteLLM [auto router](../proxy/auto_routing.md) sends every Claude Code request to the smallest model that can handle it, which is where most of the savings on a Claude Code workload come from. Pointing Claude at one takes two things beyond the usual `ANTHROPIC_BASE_URL` setup: a router name Claude will accept, and that name on your organization's model allowlist.

Skip the allowlist step and the router is greyed out in the Claude Desktop model picker, missing from `/model` in the CLI, and any attempt to select it by name starts the session on a different model with the notice `Model "<name>" is restricted by your organization's settings. Using <model> instead.` Nothing reaches your proxy, so the LiteLLM logs stay empty and the problem looks like a routing bug rather than a client-side policy check.

## Name the router so Claude accepts it

Claude's model pickers and Claude Desktop's third-party inference dialog only offer model names that read as Anthropic models. The `model_name` has to contain `claude` or `anthropic`, or a family name such as `opus`, `sonnet`, `haiku`, or `fable`, so `claude-auto`, `claude-smart-router`, and `opus-auto` are all accepted while `smart-router`, `auto`, and a bare UUID are rejected in the client before any request is sent. Another vendor's name anywhere in the string fails the check regardless, so `claude-vs-gpt` is filtered out as non-Anthropic despite the `claude`.

Build the name on `claude` rather than on a family word. A family word changes how the allowlist in the next section treats the route: `opus-auto` counts as a specific Opus entry, which disables the `opus` family wildcard and leaves every Opus version you still want selectable to be listed by hand.

```yaml title="config.yaml"
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
| Claude Desktop rejects the name in the third-party inference dialog | Name is not Anthropic-shaped | Rename the route to something like `claude-auto` |
| Test connection fails naming a model you never selected | Key discovers models beyond the router and the probe picks one of them | Scope the virtual key to the router |
| Router missing from `/v1/models` and the Models page after an edit | Older builds did not relink the in-memory router registry when a deployment was replaced | Restart the proxy to reload it from the database, and upgrade to a release containing [PR #34564](https://github.com/BerriAI/litellm/pull/34564) |

## Related

- [Auto Routing](../proxy/auto_routing.md)
- [Claude Code - Cut Costs](./claude_code_cut_costs.md)
- [Claude Desktop integration](./claude_desktop_cowork.md)
- [Virtual Keys](../proxy/virtual_keys.md)
