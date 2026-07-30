---
sidebar_label: "GitHub Copilot"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# GitHub Copilot

Route GitHub Copilot through LiteLLM using Copilot's bring your own key (BYOK) support. Copilot calls LiteLLM as an OpenAI-compatible provider, so chat and agent traffic gets cost tracking, per-developer attribution, guardrails, and PII masking before it reaches a model.

:::info Direction matters

Copilot's own hosted models are not exposed as an OpenAI-compatible API, so LiteLLM cannot sit in front of Copilot as a passthrough gateway. There is no supported way to insert a gateway between the Copilot client and GitHub's model service. BYOK inverts the relationship instead: Copilot becomes the client and LiteLLM is the provider it calls. GitHub's [Copilot SDK BYOK docs](https://docs.github.com/en/copilot/how-tos/copilot-sdk/auth/byok) name LiteLLM as a supported OpenAI-compatible endpoint.

:::

## What runs through LiteLLM

BYOK covers model calls from Copilot Chat (Ask, Edit, Plan, and Agent modes) in VS Code, JetBrains IDEs, Eclipse, and Xcode, Copilot Chat on github.com, [Copilot CLI](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/use-byok-models), the Copilot app, and the Copilot SDK. Editor utility calls such as chat titles and commit message generation go through the same path.

Inline code completions (the grey ghost text), semantic search, and anything backed by embeddings stay on GitHub's infrastructure. BYOK does not apply to them, so plan for chat and agent traffic to flow through LiteLLM while completions continue to hit GitHub directly.

## Requirements

Each model you expose to Copilot must support tool calling and streaming, otherwise Copilot rejects it; GitHub recommends a context window of 128k or more. `GET /v1/models` has to list the model, because the admin and editor flows fetch the model list from your endpoint. For enterprise-level BYOK, GitHub's Copilot API calls your endpoint server-side, so the proxy needs a publicly reachable URL and a valid TLS certificate; `localhost` only works for the per-developer setups.

## Step 1: Configure LiteLLM

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: claude-sonnet-5
    litellm_params:
      model: anthropic/claude-sonnet-5
      api_key: os.environ/ANTHROPIC_API_KEY

  - model_name: gpt-5
    litellm_params:
      model: openai/gpt-5
      api_key: os.environ/OPENAI_API_KEY

general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
```

Start the proxy:

```bash
litellm --config config.yaml --port 4000
```

## Step 2: Create a virtual key per developer

Give each developer their own key so usage lands against the right user and team:

```bash
curl -X POST "https://litellm.example.com/key/generate" \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "key_alias": "copilot-emilio",
    "user_id": "emilio@example.com",
    "team_id": "platform-team",
    "models": ["claude-sonnet-5", "gpt-5"]
  }'
```

## Step 3: Point Copilot at LiteLLM

<Tabs>
<TabItem value="vscode" label="VS Code">

1. Open the Chat view, click the model picker, and select **Manage Language Models** (or run `Chat: Manage Language Models`).
2. Choose **Add Models**, then **Custom Endpoint**, then the **Chat Completions** API type.
3. Enter a group name and paste the developer's LiteLLM virtual key as the API key.
4. VS Code opens `chatLanguageModels.json` for the model details:

```json title="chatLanguageModels.json"
[
  {
    "name": "LiteLLM",
    "vendor": "customendpoint",
    "apiKey": "${input:apiKey}",
    "apiType": "chat-completions",
    "models": [
      {
        "id": "claude-sonnet-5",
        "name": "Claude Sonnet 5 (LiteLLM)",
        "url": "https://litellm.example.com/v1/chat/completions",
        "toolCalling": true,
        "vision": true,
        "maxInputTokens": 200000,
        "maxOutputTokens": 64000
      }
    ]
  }
]
```

Give the full endpoint path. VS Code uses the URL as-is when it already ends in `/chat/completions`, `/responses`, or `/messages`, so an explicit path avoids ambiguity about what it appends.

On Copilot Business and Enterprise, the **Bring Your Own Language Model Key in VS Code** policy must stay enabled in Copilot policy settings on github.com. It is on by default.

</TabItem>
<TabItem value="jetbrains" label="JetBrains">

JetBrains IDEs accept OpenAI-compatible custom endpoints with an API key, so configure the base URL `https://litellm.example.com/v1` and the developer's virtual key in the Copilot plugin's model settings. See the [changelog entry](https://github.blog/changelog/2026-07-14-github-copilot-for-jetbrains-expands-byok-capabilities/) for the current state of the feature.

</TabItem>
<TabItem value="cli" label="Copilot CLI">

```bash
export COPILOT_PROVIDER_BASE_URL="https://litellm.example.com/v1"
export COPILOT_PROVIDER_API_KEY="sk-litellm-virtual-key"
export COPILOT_MODEL="claude-sonnet-5"
copilot
```

`COPILOT_PROVIDER_TYPE` defaults to `openai`, so you only need it if you are pointing the CLI at a non-OpenAI wire format.

</TabItem>
<TabItem value="sdk" label="Copilot SDK">

```ts
const provider = {
  type: "openai",
  baseUrl: "https://litellm.example.com/v1",
  bearerToken: process.env.LITELLM_VIRTUAL_KEY,
};
```

The `model` parameter is required once BYOK is configured. LiteLLM also serves `wireApi: "responses"` if you prefer the Responses API shape.

</TabItem>
<TabItem value="enterprise" label="Enterprise or organization">

Enterprise and organization owners can add the key centrally instead of asking each developer to configure their editor. In enterprise or organization settings, add a custom model key, choose the **OpenAI-compatible providers** option, supply a LiteLLM virtual key, and select the models to publish. Published models appear at the bottom of the model picker under the enterprise name, across Copilot Chat, Copilot CLI, and IDEs. See [Enabling custom models](https://docs.github.com/en/copilot/how-tos/administer-copilot/manage-for-enterprise/enable-custom-models).

GitHub's setup page spells out an explicit endpoint field only for Microsoft Foundry and fetches the model list from the provider for the other options, so confirm where your LiteLLM base URL goes in your own enterprise settings while the feature is in preview. If the form will not take an arbitrary base URL, fall back to the per-developer setups above, which document a base URL field on every surface.

Because this path is server-side, every developer's traffic arrives on the one key you configured, so LiteLLM attributes it to that key rather than to individual developers. Add a separate key per GitHub organization if you want usage split by org, and use the editor and CLI setups above when you need per-developer attribution.

Enterprise BYOK is in public preview.

</TabItem>
</Tabs>

## Tracking usage per developer and team

With a virtual key per developer, spend and token usage roll up by user and by team in the LiteLLM UI at **Usage** and through `/spend/report`, letting teams compare how they are using models. Set budgets and rate limits on the same keys, and use `team_id` to group developers so team-level reporting matches your org structure. See [Cost tracking for coding assistants](./cost_tracking_coding.md).

## Guardrails and PII masking

Guardrails attach to the proxy, so they apply to Copilot's calls the same way they apply to any other client. Configure PII masking and any other pre-call checks once and they cover every surface pointed at LiteLLM. See the [guardrails quick start](../proxy/guardrails/quick_start.md).

## Limitations

Inline completions never traverse BYOK, so LiteLLM cannot see or mask that traffic. Enterprise BYOK is a public preview feature, and GitHub bills BYOK calls according to your provider's terms rather than counting them against Copilot usage quotas. If you need coverage of every model call a developer makes, pair BYOK with a coding assistant that supports a custom base URL for all of its traffic, such as [Claude Code](./claude_code_byok.md) or [Cursor](./cursor_integration.md).

## Related

Looking for the opposite direction, calling Copilot's models from LiteLLM with your Copilot subscription? See the [GitHub Copilot provider docs](../providers/github_copilot.md).
