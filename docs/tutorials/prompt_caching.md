import Image from '@theme/IdealImage';
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Auto-Inject Prompt Caching Checkpoints

Reduce costs by up to 90% by using LiteLLM to auto-inject prompt caching checkpoints.

<Image img={require('../../img/auto_prompt_caching.png')}  style={{ width: '800px', height: 'auto' }} />

Supported Providers (`cache_control` marker):
- Anthropic API (`anthropic/`)
- AWS Bedrock - Claude (`bedrock/`)
- Vertex AI - Claude and Gemini (`vertex_ai/`)
- Google AI Studio - Gemini (`gemini/`)
- Azure AI - Claude (`azure_ai/`)
- OpenRouter - Claude, Gemini, MiniMax, GLM, z-ai routes (`openrouter/`)
- Databricks - Claude (`databricks/`)
- DashScope / Qwen (`dashscope/`)
- MiniMax (`minimax/`)
- Z.ai / GLM (`zai/`)

Provider Managed (automatic, no marker needed):
- OpenAI (`openai/`)
- DeepSeek (`deepseek/`)
- xAI (`xai/`)

## How it works

LiteLLM can automatically inject prompt caching checkpoints into your requests to LLM providers. This allows:

- **Cost Reduction**: Long, static parts of your prompts can be cached to avoid repeated processing
- **No need to modify your application code**: You can configure the auto-caching behavior in the LiteLLM UI or in the `litellm config.yaml` file.

## Who the cache is shared with

This is provider-side prompt caching, which is a different feature from [LiteLLM response caching](../proxy/caching) and needs no Redis. The provider caches a prefix against the upstream credentials that sent it, not against the LiteLLM key, team or end user, and a cached prefix is reused by anyone whose request repeats it exactly.

That sharing is usually the point: a long system prompt cached by one user is reused by everyone else on the same credentials, and an agent benefits from a prefix a user already cached. It has a consequence worth knowing before you inject checkpoints for everyone. Because a response reports `cache_read_input_tokens`, and a cache hit is also faster, a caller who repeats a prefix exactly can tell that someone else on those credentials sent it recently. The prefix has to be reproduced exactly and providers do not cache prefixes below a minimum size (1024 tokens for Anthropic), so this reveals whether a prompt the caller already holds was recently sent, rather than revealing its contents.

If callers sharing one set of upstream credentials must not learn that about each other, give them separate credentials, since the isolation boundary is the provider account rather than anything LiteLLM can enforce.

## Automatic checkpoints for Claude models

:::info

Requires LiteLLM v1.94.0

:::

Everything below asks you to decide *where* the checkpoints go. If all you want is the common case for Claude, one flag does it for you.

```yaml title="config.yaml"
litellm_settings:
  enable_anthropic_prompt_caching: true
```

Or, without a config file:

```bash
export LITELLM_ENABLE_ANTHROPIC_PROMPT_CACHING=true
```

It is also a switch on the Admin UI, on the General tab under Router Settings.

### What it actually does

When it is on, LiteLLM adds the same `cache_control_injection_points` you would have written by hand: one checkpoint on the system prompt and one on the trailing turn. The stable prefix (system prompt, tools and history) stays cached while the checkpoint advances with the conversation, which is what a client like Claude Code needs, since it never sets `cache_control` itself and you cannot ask every user to configure one.

The specifics are worth knowing before you turn it on:

- It is off by default, so upgrading changes nothing until you enable it.
- It only applies to `anthropic/` and `bedrock/` Claude models that the cost map marks as supporting prompt caching. Other providers are left alone, including Claude on `vertex_ai/` and `azure_ai/`; use `cache_control_injection_points` for those.
- If the request already carries its own `cache_control`, LiteLLM stands down and the client's checkpoints win, so nothing is ever double-injected.
- Explicit `cache_control_injection_points` also win. The flag only fills in when nothing is configured.
- The provider limit of 4 `cache_control` blocks per request still applies, and client-supplied blocks count toward it.
- It works on both `/v1/messages` and `/chat/completions`.

### Cache lifetime

The default is Anthropic's 5 minute ephemeral cache, which is their API default and what Claude Code uses. For long agentic sessions you can ask for the 1 hour cache instead:

```yaml title="config.yaml"
litellm_settings:
  enable_anthropic_prompt_caching: true
  anthropic_prompt_caching_ttl: "1h"
```

The equivalent environment variable is `LITELLM_ANTHROPIC_PROMPT_CACHING_TTL`, and the Admin UI exposes it as a dropdown. Note that a 1 hour cache write costs more than a 5 minute one, so it pays off only when the prefix is reused over a longer session.

`litellm_settings` wins over the environment variable when both are set, since the config is applied after startup.

### When to use injection points instead

Reach for `cache_control_injection_points`, described below, when you need a provider the flag does not cover, a checkpoint somewhere other than the system prompt and the trailing turn, per-model rather than gateway-wide behavior, or `location: tool_config` to cache tool definitions.

## Configuration

You need to specify `cache_control_injection_points` in your model configuration. This tells LiteLLM:
1. Where to add the caching directive (`location`)
2. Which message to target (`role`)

LiteLLM will then automatically add a `cache_control` directive to the specified messages in your requests:

```json showLineNumbers title="cache_control_directive.json"
"cache_control": {
    "type": "ephemeral"
}
```

## LiteLLM Python SDK Usage

Use the `cache_control_injection_points` parameter in your completion calls to automatically inject caching directives.

#### Basic Example - Cache System Messages

```python showLineNumbers title="cache_system_messages.py"
from litellm import completion
import os

os.environ["ANTHROPIC_API_KEY"] = ""

response = completion(
    model="anthropic/claude-3-5-sonnet-20240620",
    messages=[
        {
            "role": "system",
            "content": [
                {
                    "type": "text",
                    "text": "You are an AI assistant tasked with analyzing legal documents.",
                },
                {
                    "type": "text",
                    "text": "Here is the full text of a complex legal agreement" * 400,
                },
            ],
        },
        {
            "role": "user",
            "content": "what are the key terms and conditions in this agreement?",
        },
    ],
    # Auto-inject cache control to system messages
    cache_control_injection_points=[
        {
            "location": "message",
            "role": "system",
        }
    ],
)

print(response.usage)
```

**Key Points:**
- Use `cache_control_injection_points` parameter to specify where to inject caching
- `location: "message"` targets messages in the conversation
- `role: "system"` targets all system messages
- LiteLLM automatically adds `cache_control` to the **last content block** of matching messages (per Anthropic's API specification)

**LiteLLM's Modified Request:**

LiteLLM automatically transforms your request by adding `cache_control` to the last content block of the system message:

```json showLineNumbers title="modified_request_system.json"
{
    "messages": [
        {
            "role": "system",
            "content": [
                {
                    "type": "text",
                    "text": "You are an AI assistant tasked with analyzing legal documents."
                },
                {
                    "type": "text",
                    "text": "Here is the full text of a complex legal agreement...",
                    "cache_control": {"type": "ephemeral"}  // Added by LiteLLM
                }
            ]
        },
        {
            "role": "user",
            "content": "what are the key terms and conditions in this agreement?"
        }
    ]
}
```

#### Target Specific Messages by Index

You can target specific messages by their index in the messages array. Use negative indices to target from the end.

```python showLineNumbers title="cache_by_index.py"
from litellm import completion
import os

os.environ["ANTHROPIC_API_KEY"] = ""

response = completion(
    model="anthropic/claude-3-5-sonnet-20240620",
    messages=[
        {
            "role": "user",
            "content": "First message",
        },
        {
            "role": "assistant",
            "content": "Response to first",
        },
        {
            "role": "user",
            "content": [
                {"type": "text", "text": "Here is a long document to analyze:"},
                {"type": "text", "text": "Document content..." * 500},
            ],
        },
    ],
    # Target the last message (index -1)
    cache_control_injection_points=[
        {
            "location": "message",
            "index": -1,  # -1 targets the last message, -2 would target second-to-last, etc.
        }
    ],
)

print(response.usage)
```

**Important Notes:**
- When a message has multiple content blocks (like images or multiple text blocks), `cache_control` is only added to the **last content block**
- This follows [Anthropic's API specification](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching#continuing-a-multi-turn-conversation) which requires: "When using multiple content blocks, only the last content block can have cache_control"
- Anthropic has a maximum of 4 blocks with `cache_control` per request

**LiteLLM's Modified Request:**

LiteLLM adds `cache_control` to the last content block of the targeted message (index -1 = last message):

```json showLineNumbers title="modified_request_index.json"
{
    "messages": [
        {
            "role": "user",
            "content": "First message"
        },
        {
            "role": "assistant",
            "content": "Response to first"
        },
        {
            "role": "user",
            "content": [
                {
                    "type": "text",
                    "text": "Here is a long document to analyze:"
                },
                {
                    "type": "text",
                    "text": "Document content...",
                    "cache_control": {"type": "ephemeral"}  // Added by LiteLLM to last content block only
                }
            ]
        }
    ]
}
```

## LiteLLM Proxy Usage

You can configure cache control injection in the proxy configuration file.

<Tabs>
<TabItem value="litellm config.yaml" label="litellm config.yaml">

```yaml showLineNumbers title="litellm config.yaml"
model_list:
  - model_name: anthropic-auto-inject-cache-system-message
    litellm_params:
      model: anthropic/claude-3-5-sonnet-20240620
      api_key: os.environ/ANTHROPIC_API_KEY
      cache_control_injection_points:
        - location: message
          role: system
```
</TabItem>

<TabItem value="UI" label="LiteLLM UI">

On the LiteLLM UI, you can specify the `cache_control_injection_points` in the `Advanced Settings` tab when adding a model.
<Image img={require('../../img/ui_auto_prompt_caching.png')}/>

</TabItem>
</Tabs>


## Detailed Example

### 1. Original Request to LiteLLM 

In this example, we have a very long, static system message and a varying user message. It's efficient to cache the system message since it rarely changes.

```json showLineNumbers title="original_request.json"
{
    "messages": [
        {
            "role": "system",
            "content": [
                {
                    "type": "text",
                    "text": "You are a helpful assistant. This is a set of very long instructions that you will follow. Here is a legal document that you will use to answer the user's question."
                }
            ]
        },
        {
            "role": "user",
            "content": [
                {
                    "type": "text",
                    "text": "What is the main topic of this legal document?"
                }
            ]
        }
    ]
}
```

### 2. LiteLLM's Modified Request

LiteLLM auto-injects the caching directive into the system message based on our configuration:

```json showLineNumbers title="modified_request.json"
{
    "messages": [
        {
            "role": "system",
            "content": [
                {
                    "type": "text",
                    "text": "You are a helpful assistant. This is a set of very long instructions that you will follow. Here is a legal document that you will use to answer the user's question.",
                    "cache_control": {"type": "ephemeral"}
                }
            ]
        },
        {
            "role": "user",
            "content": [
                {
                    "type": "text",
                    "text": "What is the main topic of this legal document?"
                }
            ]
        }
    ]
}
```

When the model provider processes this request, it will recognize the caching directive and only process the system message once, caching it for subsequent requests.

## Related Documentation

- [Manual Prompt Caching](../completion/prompt_caching.md) - Learn how to manually add `cache_control` directives to your messages



