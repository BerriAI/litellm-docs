---
title: "Fallback generalizations for new models"
description: "How LiteLLM infers providers and capabilities for unmapped model IDs, how exact entries take precedence, and how to customize cost map rules."
---

# Fallback generalizations for new models

<SinceVersion v="1.92.0" />

LiteLLM uses `fallback_generalizations` rules to recognize new model IDs before they have an entry in the model cost map. For example, an unmapped `claude-newfamily-5` can resolve to Anthropic and receive Claude capability defaults without waiting for a cost map update. This does not create a model at the provider or guarantee that a provider accepts it.

The rules live in the top-level `fallback_generalizations.rules` array in [model_prices_and_context_window.json](https://github.com/BerriAI/litellm/blob/main/model_prices_and_context_window.json). They describe model families rather than individual releases. Exact cost-map entries always win, including values such as `supports_reasoning: false`.

This feature does not retry failed requests on another model. For that, see [routing fallbacks](./proxy/reliability.md).

## See an unmapped model resolve

This example uses the bundled cost map and makes no inference request. Run it from a LiteLLM source checkout with its Python environment installed.

```bash
LITELLM_LOCAL_MODEL_COST_MAP=True uv run --no-sync python - <<'PY'
import litellm

model = "claude-newfamily-5"
print("Mapped entry:", model in litellm.model_cost)
print("Provider:", litellm.get_llm_provider(model=model)[1])
info = litellm.get_model_info(model=model)
for key in (
    "litellm_provider", "mode", "max_input_tokens", "max_output_tokens",
    "supports_reasoning", "supports_adaptive_thinking", "supports_tool_search",
    "input_cost_per_token", "output_cost_per_token",
):
    print(f"{key}: {info.get(key)}")
PY
```

Output from LiteLLM main with the bundled rules shown below.

```text
Mapped entry: False
Provider: anthropic
litellm_provider: anthropic
mode: chat
max_input_tokens: 200000
max_output_tokens: 64000
supports_reasoning: True
supports_adaptive_thinking: True
supports_tool_search: True
input_cost_per_token: 0
output_cost_per_token: 0
```

The shipped capability rules deliberately carry no pricing fields. A match supplies capabilities, not a price estimate. `get_model_info` returns zero for missing input and output token prices. That zero is not evidence that the provider offers the model for free. Add verified rates through [custom pricing](./proxy/custom_pricing.md) or an [exact cost-map entry](./provider_registration/add_model_pricing.md) when you need spend tracking.

## How matching works

### Routing rules

A routing rule has exactly one key in `model_info`, a string `litellm_provider`. The first matching routing rule wins. `get_llm_provider` uses these rules as a last resort when its existing provider inference has not recognized an otherwise unknown ID. Routing rules do not contribute capabilities to `get_model_info`.

Provider inference also matters for virtual-key access such as `anthropic/*`. The access check resolves a bare ID's provider before comparing it with the allowed provider wildcard. A routing rule can therefore let an unmapped bare Claude ID match `anthropic/*`. It does not bypass key permissions or configure a deployment. See [wildcard routing](./wildcard_routing.md).

### Capability rules

A capability rule has no `litellm_provider` key in `model_info`. It supplies fields such as `mode`, token limits and `supports_*` flags. All matching capability rules are merged in file order, and later rules win when they set the same field.

`get_model_info` tries exact and case-insensitive cost-map lookups before these rules. On a miss, it tries its candidate model names in lookup order and uses the first candidate with any capability matches. The caller backfills `litellm_provider` with the resolved or requested provider. A capability rule does not route a bare ID by itself. If no rule matches, the normal model-not-mapped behavior remains.

### Fill missing fields on mapped entries

A capability rule can also set `fill_missing_for_providers` to a list of provider strings. For a mapped entry whose provider is in that list, matching flagged rules fill only keys the entry does not contain. An existing value, including `false` or `null`, is preserved. Later flagged rules win among themselves, but never overwrite an existing entry value.

This fill applies to `chat` and `responses` entries, with an absent mode treated as `chat`. Routing rules never fill fields. Without this per-rule opt-in, capability rules apply only to unmapped IDs.

## Rule fields and validation

`pattern` is a required regex string and `model_info` is a required object. LiteLLM compiles patterns with `re.IGNORECASE` and matches with `re.search`. A match can occur anywhere in the candidate name. Use `^` and `$` when you intend to match the whole name.

`name` labels the rule in warnings and makes it easier to maintain. `description` explains the intended matches for readers and is ignored by the matching engine. `fill_missing_for_providers` is optional and must be a list of provider strings.

Keep routing and capability rules separate. A rule that mixes `litellm_provider` with capability fields, uses a non-string provider, has an invalid regex, or has malformed required fields is skipped with a warning. The old `extends` format is also skipped with a warning. Update an old custom cost map instead of relying on it to inherit from another rule or model.

## Customize the rules

Start with a copy of the complete current cost map. Edit its `fallback_generalizations.rules` array, keeping the existing model entries and any rules you still need. The loaded array replaces the active rules rather than appending to them.

For example, these two separate rules would route a hypothetical Anthropic-hosted `claude-example-5` and give it reasoning support. This is a JSON fragment to place inside the full map, not a complete replacement cost map.

```json
{
  "fallback_generalizations": {
    "rules": [
      {
        "name": "example-routing",
        "pattern": "^claude-example-5$",
        "description": "Route this bare ID to Anthropic.",
        "model_info": {"litellm_provider": "anthropic"}
      },
      {
        "name": "example-capabilities",
        "pattern": "claude-example-5",
        "description": "Enable reasoning for this model under any namespace.",
        "fill_missing_for_providers": ["anthropic"],
        "model_info": {"supports_reasoning": true}
      }
    ]
  }
}
```

Host the full JSON document and set `LITELLM_MODEL_COST_MAP_URL` before importing LiteLLM. For example, point it at `https://example.com/model_prices_and_context_window.json`. A failed startup fetch falls back to the bundled map, so check the startup warnings if your rules do not take effect.

`LITELLM_LOCAL_MODEL_COST_MAP=True` selects the installed package's `litellm/model_prices_and_context_window_backup.json` instead of fetching the remote map. To use custom rules in that mode, package your edited full map at that location. The flag is not a path setting, and the URL loader does not accept a local file path or `file://` URL. See [model cost map loading](./proxy/model_cost_map.md) for deployment-specific loading behavior.

`litellm.register_model` registers individual model entries, not the active generalization rules. Its URL-registration path explicitly removes the `fallback_generalizations` block. There is no dedicated proxy `config.yaml` rule setting. Proxy deployment `model_info` and custom pricing describe a deployment, not regex rules. Supply rules through the loaded cost-map document.

To propose defaults for everyone, edit the main cost map and add coverage in [test_fallback_generalizations.py](https://github.com/BerriAI/litellm/blob/main/tests/unit/litellm_core_utils/test_fallback_generalizations.py). Keep routing tests separate from capability tests and check that mapped entries retain their own values.

## Current rules

The following table follows the 15 rules in the source JSON, in file order. Names and fields come from that document. Matching follows the actual regex, not a comparison of version numbers. In particular, the Claude newer-major patterns cover single-digit majors 5 through 9.

| Rule | Kind | Effect |
| --- | --- | --- |
| `bedrock-claude-ids` | Routing | Routes Bedrock-style `anthropic.claude-` IDs, optionally with a dotted region prefix, to `bedrock` |
| `anthropic-claude-ids` | Routing | Routes bare Claude family and version IDs to `anthropic` |
| `typesafe-jev-ids` | Routing | Routes `jev-latest`, `jev-preview`, `jev-1.13.0` and `jev-1.14.0` to `typesafe` |
| `claude-family-baseline` | Capability | Supplies Claude chat mode, 200,000 input and 64,000 output tokens, tools, vision, reasoning, PDF input and other baseline flags |
| `claude-adaptive-thinking` | Capability | Sets adaptive thinking for Claude 4.6 through 4.99 and majors 5 through 9 |
| `claude-legacy-thinking` | Capability | Sets legacy thinking support for Claude 4.6, including dated IDs |
| `claude-always-on-thinking` | Capability | Marks Claude Fable and Mythos as always thinking |
| `claude-thinking-on-by-default` | Capability | Marks Claude majors 5 through 9 as thinking by default |
| `claude-mid-conversation-system` | Capability | Sets mid-conversation system support for Claude 4.8 through 4.99 and majors 5 through 9 |
| `claude-tool-search` | Capability | Sets tool search support for Claude 4.5 through 4.99 and majors 5 through 9 |
| `claude-per-turn-control` | Capability | Sets the per-turn-control flag for the same versions as tool search. Enables Bedrock beta forwarding, not a guarantee of per-turn output control |
| `wandb-reasoning-baseline` | Capability | Sets reasoning support for unmapped IDs under `wandb/` |
| `minimax-reasoning-baseline` | Capability | Sets reasoning support for unmapped IDs under `minimax/` |
| `openai-reasoning-family-baseline` | Capability | Sets reasoning for o-series, GPT majors 5 through 9, Codex, deep-research and chat-latest shapes. Excludes search-api IDs |
| `gemini-chat-baseline` | Capability | Supplies chat and capability flags for matching Gemini Pro and Flash IDs from 2.5 onward. Excludes specialized TTS, image, live, audio and other non-chat lines |

## Implementation

The [rule engine](https://github.com/BerriAI/litellm/blob/main/litellm/litellm_core_utils/fallback_generalizations.py) defines validation and merge order. [Provider inference](https://github.com/BerriAI/litellm/blob/main/litellm/litellm_core_utils/get_llm_provider_logic.py) consumes routing rules, [model info resolution](https://github.com/BerriAI/litellm/blob/main/litellm/utils.py) consumes capability rules, and the [cost-map loader](https://github.com/BerriAI/litellm/blob/main/litellm/litellm_core_utils/get_model_cost_map.py) installs the rule array.
