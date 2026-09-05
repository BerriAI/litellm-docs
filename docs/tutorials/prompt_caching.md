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

Supported Providers (`prompt_cache_breakpoint` marker):
- OpenAI GPT-5.6 and newer (`openai/`), see [OpenAI GPT-5.6 and newer](#openai-gpt-56-and-newer)

Provider Managed (automatic, no marker needed):
- OpenAI, models before GPT-5.6 (`openai/`)
- DeepSeek (`deepseek/`)
- xAI (`xai/`)

## How it works

LiteLLM can automatically inject prompt caching checkpoints into your requests to LLM providers. This allows:

- **Cost Reduction**: Long, static parts of your prompts can be cached to avoid repeated processing
- **No need to modify your application code**: You can configure the auto-caching behavior in the LiteLLM UI or in the `litellm config.yaml` file.

## Who the cache is shared with

This is provider-side prompt caching, a different feature from [LiteLLM response caching](../proxy/caching). It needs no Redis.

- The provider caches a prefix against the **upstream credentials** that sent it, not against the LiteLLM key, team or end user.
- Anyone whose request repeats that prefix exactly reuses it. That sharing is the point: a long system prompt cached by one user is reused by everyone else on the same credentials, and an agent benefits from a prefix a user already cached.
- The flip side: responses report `cache_read_input_tokens`, and a cache hit is faster, so a caller repeating a prefix exactly can tell someone else on those credentials sent it recently.
- That is bounded. The prefix must match exactly, and providers will not cache a prefix below a minimum size (for Anthropic that is model-dependent, currently 1k to 4k tokens), so it reveals *whether* a prompt the caller already holds was sent, not its contents.
- For isolation, give tenants separate credentials. The boundary is the provider account, not anything LiteLLM can enforce.

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

It adds the same `cache_control_injection_points` you would have written by hand, one checkpoint on the system prompt and one on the trailing turn, so the stable prefix stays cached while the checkpoint advances with the conversation. That is what a client like Claude Code needs, since it never sets `cache_control` itself.

- **Off by default.** Upgrading changes nothing until you enable it.
- **Claude only.** `anthropic/` and `bedrock/` models the cost map marks as supporting prompt caching. Claude on `vertex_ai/` and `azure_ai/` is not covered; use `cache_control_injection_points` for those.
- **Never double-injects.** If the request already carries its own `cache_control`, LiteLLM stands down and the client's checkpoints win.
- **Explicit config wins.** The flag only fills in when no `cache_control_injection_points` are set.
- **Respects the 4 block provider limit**, counting client-supplied blocks toward it.
- **Works on `/v1/messages` and `/chat/completions`.**

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

### OpenAI GPT-5.6 and newer

The same `cache_control_injection_points` work when the deployment resolves to an OpenAI model that supports [explicit prompt cache breakpoints](https://developers.openai.com/api/docs/guides/prompt-caching#prompt-cache-breakpoints), which the cost map marks with `supports_prompt_cache_breakpoint` (GPT-5.6 and newer on `openai/`). LiteLLM looks at the resolved deployment, not at the shape of the incoming request, so one config pattern covers a mixed Anthropic and OpenAI fleet and Anthropic-shaped clients on `/v1/messages` get the OpenAI markers too

| Anthropic target | OpenAI GPT-5.6+ target |
|---|---|
| `"cache_control": {"type": "ephemeral"}` on the targeted block | `"prompt_cache_breakpoint": {"mode": "explicit"}` on the targeted block |
| nothing at the request level | `"prompt_cache_options": {"mode": "explicit"}` at the request root |
| `control.ttl` picks the 5m or 1h cache | `control` is ignored; set `prompt_cache_options` yourself for `ttl` |

The request-level `prompt_cache_options` LiteLLM adds switches OpenAI to explicit mode, so the configured checkpoints are the whole caching strategy, exactly as they are on Anthropic. A `prompt_cache_options` already on the request wins and is never overwritten, which is how you change the mode or ask for the 30 minute cache per deployment:

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: gpt-5.6
    litellm_params:
      model: openai/gpt-5.6
      api_key: os.environ/OPENAI_API_KEY
      cache_control_injection_points:
        - location: message
          role: system
      prompt_cache_options:
        mode: implicit
        ttl: 30m
```

With `mode: implicit` OpenAI keeps its automatic checkpoint on the latest user or tool message alongside the explicit one LiteLLM placed, which suits long multi-turn sessions; with the default `explicit` only the configured checkpoints write to the cache, which suits many single-turn requests that share one long system prompt. Either way OpenAI serves reads from the longest cached prefix it can match

What to know about the OpenAI mapping:

- **Block-level only.** OpenAI accepts the marker on text, image and file blocks. A string system prompt or message is wrapped into a one-block list before the marker is placed. Assistant blocks and tool results cannot carry a breakpoint, so an injection point that lands there is skipped
- **`/v1/messages` system prompt.** OpenAI does not accept a breakpoint on the top-level `instructions` field, so when the Anthropic `system` carries a checkpoint LiteLLM sends it as a leading `developer` message instead. OpenAI treats both shapes as the same cache prefix, so switching does not cold-start the cache
- **Stands down like Anthropic.** A request that already carries its own `cache_control` or `prompt_cache_breakpoint` markers keeps them; configured points are not added. Claude Code sets its own `cache_control`, so a Claude Code session on a GPT-5.6 deployment stays on OpenAI's implicit caching
- **Respects the 4 breakpoint limit**, counting client-supplied markers toward it
- **Only for requests that go to OpenAI itself.** The mapping fires for a GPT-5.6 or newer OpenAI model (the cost map's `supports_prompt_cache_breakpoint` flag when the entry carries one, otherwise the GPT version in the model name) when the deployment talks to `api.openai.com` (or a regional `*.api.openai.com` host), meaning no `api_base` (or `base_url`) or one on those hosts. A deployment with a custom `api_base`, such as another LiteLLM proxy or gateway in front of OpenAI, keeps today's behavior unless its `litellm_params` also set `prompt_cache_options`, which opts it in. `litellm_proxy/` deployments and Azure OpenAI deployments are not covered yet
- **`/v1/responses`.** The marker lands on `input_text` blocks of the targeted message, and a string message is wrapped into a one-block list first. OpenAI does not accept a marker on the top-level `instructions` field, so a system prompt sent there stays on implicit caching; send it as a `developer` or `system` message to get the checkpoint. A `prompt_cache_options` the client sends is forwarded as is
- **Cost reporting is unchanged.** OpenAI's `cached_tokens` and `cache_write_tokens` already come back as `cache_read_input_tokens` and `cache_creation_input_tokens` on `/v1/messages` and as `prompt_tokens_details` on `/chat/completions`

## LiteLLM Python SDK Usage

Use the `cache_control_injection_points` parameter in your completion calls to automatically inject caching directives.

#### Basic Example - Cache System Messages

```python showLineNumbers title="cache_system_messages.py"
from litellm import completion
import os

os.environ["ANTHROPIC_API_KEY"] = ""

response = completion(
    model="anthropic/{{anthropic}}",
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
    model="anthropic/{{anthropic}}",
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
      model: anthropic/{{anthropic}}
      api_key: os.environ/ANTHROPIC_API_KEY
      cache_control_injection_points:
        - location: message
          role: system
  - model_name: gpt-5.6
    litellm_params:
      model: openai/gpt-5.6
      api_key: os.environ/OPENAI_API_KEY
      cache_control_injection_points:
        - location: message
          role: system
```

The second entry resolves to an OpenAI GPT-5.6 model, so the same injection point becomes a `prompt_cache_breakpoint` marker plus `prompt_cache_options` on the outbound request, as described in [OpenAI GPT-5.6 and newer](#openai-gpt-56-and-newer)
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

### 3. The same request on an OpenAI GPT-5.6 deployment

With the deployment pointing at `openai/gpt-5.6` instead, the same configuration produces OpenAI's explicit breakpoint on the block and explicit mode at the request root:

```json showLineNumbers title="modified_request_openai.json"
{
    "prompt_cache_options": {"mode": "explicit"},
    "messages": [
        {
            "role": "system",
            "content": [
                {
                    "type": "text",
                    "text": "You are a helpful assistant. This is a set of very long instructions that you will follow. Here is a legal document that you will use to answer the user's question.",
                    "prompt_cache_breakpoint": {"mode": "explicit"}
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

## Related Documentation

- [Manual Prompt Caching](../completion/prompt_caching.md) - Learn how to manually add `cache_control` directives to your messages



