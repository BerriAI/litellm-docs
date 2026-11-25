---
title: "Anthropic Tool Search in LiteLLM"
sidebar_label: "Tool Search"
description: "Use Claude tool search via LiteLLM to load tools on demand from large catalogs, with regex and BM25 variants on Chat Completions, Messages and Responses."
---

# Tool Search

Tool search enables Claude to dynamically discover and load tools on-demand from large tool catalogs (10,000+ tools). Instead of loading all tool definitions into the context window upfront, Claude searches your tool catalog and loads only the tools it needs.

## Supported Providers

| Provider | Chat Completions API | Messages API | [Responses API](#responses-api) |
|----------|---------------------|--------------|---------------|
| **Anthropic API** | ✅ | ✅ | ✅ |
| **Azure Anthropic** (Microsoft Foundry) | ✅ | ✅ | ✅ |
| **Google Cloud Vertex AI** | ✅ | ✅ | ✅ |
| **Amazon Bedrock** | ✅ (Invoke API only, Claude 4.5 and newer) | ✅ (Invoke API only, Claude 4.5 and newer) | ✅ (Invoke API only, Claude 4.5 and newer) |


## Benefits

- **Context efficiency**: Avoid consuming massive portions of your context window with tool definitions
- **Better tool selection**: Claude's tool selection accuracy degrades with more than 30-50 tools. Tool search maintains accuracy even with thousands of tools
- **On-demand loading**: Tools are only loaded when Claude needs them

## Tool Search Variants

LiteLLM supports both tool search variants:

### 1. Regex Tool Search (`tool_search_tool_regex_20251119`)

Claude constructs regex patterns to search for tools. Best for exact pattern matching (faster).

### 2. BM25 Tool Search (`tool_search_tool_bm25_20251119`)

Claude uses natural language queries to search for tools using the BM25 algorithm. Best for natural language semantic search.

On Amazon Bedrock, both variants work through the Invoke API (`bedrock/invoke/` models), not Converse. Before [PR #52959](https://github.com/BerriAI/litellm/pull/52959), LiteLLM dropped the BM25 tool from Bedrock Chat Completions requests, so upgrade if Claude on Bedrock can't find your deferred tools with BM25.

---

## Chat Completions API

### SDK Usage

#### Basic Example with Regex Tool Search

```python showLineNumbers title="Basic Tool Search Example"
import litellm

response = litellm.completion(
    model="anthropic/{{anthropic}}",
    messages=[
        {"role": "user", "content": "What is the weather in San Francisco?"}
    ],
    tools=[
        # Tool search tool (regex variant)
        {
            "type": "tool_search_tool_regex_20251119",
            "name": "tool_search_tool_regex"
        },
        # Deferred tool - will be loaded on-demand
        {
            "type": "function",
            "function": {
                "name": "get_weather",
                "description": "Get the weather at a specific location",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "location": {"type": "string"},
                        "unit": {
                            "type": "string",
                            "enum": ["celsius", "fahrenheit"]
                        }
                    },
                    "required": ["location"]
                }
            },
            "defer_loading": True  # Mark for deferred loading
        }
    ]
)

print(response.choices[0].message.content)
```

#### BM25 Tool Search Example

```python showLineNumbers title="BM25 Tool Search"
import litellm

response = litellm.completion(
    model="anthropic/{{anthropic}}",
    messages=[
        {"role": "user", "content": "Search for Python files containing 'authentication'"}
    ],
    tools=[
        # Tool search tool (BM25 variant)
        {
            "type": "tool_search_tool_bm25_20251119",
            "name": "tool_search_tool_bm25"
        },
        # Deferred tools...
        {
            "type": "function",
            "function": {
                "name": "search_codebase",
                "description": "Search through codebase files by content and filename",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "query": {"type": "string"},
                        "file_pattern": {"type": "string"}
                    },
                    "required": ["query"]
                }
            },
            "defer_loading": True
        }
    ]
)
```

#### Azure Anthropic Example

```python showLineNumbers title="Azure Anthropic Tool Search"
import litellm

response = litellm.completion(
    model="azure_anthropic/{{anthropic}}",
    api_base="https://<your-resource>.services.ai.azure.com/anthropic",
    api_key="your-azure-api-key",
    messages=[
        {"role": "user", "content": "What's the weather like?"}
    ],
    tools=[
        {
            "type": "tool_search_tool_regex_20251119",
            "name": "tool_search_tool_regex"
        },
        {
            "type": "function",
            "function": {
                "name": "get_weather",
                "description": "Get current weather",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "location": {"type": "string"}
                    },
                    "required": ["location"]
                }
            },
            "defer_loading": True
        }
    ]
)
```

#### Vertex AI Example

```python showLineNumbers title="Vertex AI Tool Search"
import litellm

response = litellm.completion(
    model="vertex_ai/{{anthropic}}",
    vertex_project="your-project-id",
    vertex_location="us-central1",
    messages=[
        {"role": "user", "content": "Search my documents"}
    ],
    tools=[
        {
            "type": "tool_search_tool_bm25_20251119",
            "name": "tool_search_tool_bm25"
        },
        # Your deferred tools...
    ]
)
```

#### Bedrock Example

```python showLineNumbers title="Bedrock Tool Search (Invoke)"
import litellm

response = litellm.completion(
    model="bedrock/invoke/global.anthropic.{{anthropic_large}}",
    messages=[
        {"role": "user", "content": "Where is my parcel? The tracking number is 1Z999AA10123456784."}
    ],
    tools=[
        {
            "type": "tool_search_tool_bm25_20251119",
            "name": "tool_search_tool_bm25"
        },
        {
            "type": "function",
            "function": {
                "name": "lookup_package_tracking",
                "description": "Look up the delivery status of a parcel by tracking number",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "tracking_number": {"type": "string"}
                    },
                    "required": ["tracking_number"]
                }
            },
            "defer_loading": True
        }
    ]
)
```

#### Streaming Support

```python showLineNumbers title="Streaming with Tool Search"
import litellm

response = litellm.completion(
    model="anthropic/{{anthropic}}",
    messages=[
        {"role": "user", "content": "Get the weather"}
    ],
    tools=[
        {
            "type": "tool_search_tool_regex_20251119",
            "name": "tool_search_tool_regex"
        },
        {
            "type": "function",
            "function": {
                "name": "get_weather",
                "description": "Get weather information",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "location": {"type": "string"}
                    },
                    "required": ["location"]
                }
            },
            "defer_loading": True
        }
    ],
    stream=True
)

for chunk in response:
    if chunk.choices[0].delta.content:
        print(chunk.choices[0].delta.content, end="")
```

### AI Gateway Usage

Tool search works automatically through the LiteLLM proxy.

#### Proxy Configuration

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: claude-sonnet
    litellm_params:
      model: anthropic/{{anthropic}}
      api_key: os.environ/ANTHROPIC_API_KEY
```

#### Client Request

```python showLineNumbers title="Client Request via Proxy"
from anthropic import Anthropic

client = Anthropic(
    api_key="your-litellm-proxy-key",
    base_url="http://0.0.0.0:4000"
)

response = client.messages.create(
    model="claude-sonnet",
    max_tokens=1024,
    messages=[
        {"role": "user", "content": "What's the weather?"}
    ],
    tools=[
        {
            "type": "tool_search_tool_regex_20251119",
            "name": "tool_search_tool_regex"
        },
        {
            "name": "get_weather",
            "description": "Get weather information",
            "input_schema": {
                "type": "object",
                "properties": {
                    "location": {"type": "string"}
                },
                "required": ["location"]
            },
            "defer_loading": True
        }
    ]
)
```

---

## Messages API

The Messages API provides native Anthropic-style tool search support via the `litellm.anthropic.messages` interface.

### SDK Usage

#### Basic Example

```python showLineNumbers title="Messages API - Basic Tool Search"
import litellm

response = await litellm.anthropic.messages.acreate(
    model="anthropic/{{anthropic}}",
    messages=[
        {
            "role": "user",
            "content": "What's the weather in San Francisco?"
        }
    ],
    tools=[
        {
            "type": "tool_search_tool_regex_20251119",
            "name": "tool_search_tool_regex"
        },
        {
            "name": "get_weather",
            "description": "Get the current weather for a location",
            "input_schema": {
                "type": "object",
                "properties": {
                    "location": {
                        "type": "string",
                        "description": "The city and state, e.g. San Francisco, CA"
                    }
                },
                "required": ["location"]
            },
            "defer_loading": True
        }
    ],
    max_tokens=1024,
    extra_headers={"anthropic-beta": "advanced-tool-use-2025-11-20"}
)

print(response)
```

#### Azure Anthropic Messages Example

```python showLineNumbers title="Azure Anthropic Messages API"
import litellm

response = await litellm.anthropic.messages.acreate(
    model="azure_anthropic/{{anthropic}}",
    messages=[
        {
            "role": "user",
            "content": "What's the stock price of Apple?"
        }
    ],
    tools=[
        {
            "type": "tool_search_tool_regex_20251119",
            "name": "tool_search_tool_regex"
        },
        {
            "name": "get_stock_price",
            "description": "Get the current stock price for a ticker symbol",
            "input_schema": {
                "type": "object",
                "properties": {
                    "ticker": {
                        "type": "string",
                        "description": "The stock ticker symbol, e.g. AAPL"
                    }
                },
                "required": ["ticker"]
            },
            "defer_loading": True
        }
    ],
    max_tokens=1024,
    extra_headers={"anthropic-beta": "advanced-tool-use-2025-11-20"}
)
```

#### Vertex AI Messages Example

```python showLineNumbers title="Vertex AI Messages API"
import litellm

response = await litellm.anthropic.messages.acreate(
    model="vertex_ai/{{anthropic}}",
    messages=[
        {
            "role": "user",
            "content": "Search the web for information about AI"
        }
    ],
    tools=[
        {
            "type": "tool_search_tool_bm25_20251119",
            "name": "tool_search_tool_bm25"
        },
        {
            "name": "search_web",
            "description": "Search the web for information",
            "input_schema": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "The search query"
                    }
                },
                "required": ["query"]
            },
            "defer_loading": True
        }
    ],
    max_tokens=1024,
    extra_headers={"anthropic-beta": "tool-search-tool-2025-10-19"}
)
```

#### Bedrock Messages Example

```python showLineNumbers title="Bedrock Messages API (Invoke)"
import litellm

response = await litellm.anthropic.messages.acreate(
    model="bedrock/invoke/global.anthropic.{{anthropic_large}}",
    messages=[
        {
            "role": "user",
            "content": "What's the weather?"
        }
    ],
    tools=[
        {
            "type": "tool_search_tool_regex_20251119",
            "name": "tool_search_tool_regex"
        },
        {
            "name": "get_weather",
            "description": "Get weather information",
            "input_schema": {
                "type": "object",
                "properties": {
                    "location": {"type": "string"}
                },
                "required": ["location"]
            },
            "defer_loading": True
        }
    ],
    max_tokens=1024,
    extra_headers={"anthropic-beta": "tool-search-tool-2025-10-19"}
)
```

#### Streaming Support

```python showLineNumbers title="Messages API - Streaming"
import litellm
import json

response = await litellm.anthropic.messages.acreate(
    model="anthropic/{{anthropic}}",
    messages=[
        {
            "role": "user",
            "content": "What's the weather in Tokyo?"
        }
    ],
    tools=[
        {
            "type": "tool_search_tool_regex_20251119",
            "name": "tool_search_tool_regex"
        },
        {
            "name": "get_weather",
            "description": "Get weather information",
            "input_schema": {
                "type": "object",
                "properties": {
                    "location": {"type": "string"}
                },
                "required": ["location"]
            },
            "defer_loading": True
        }
    ],
    max_tokens=1024,
    stream=True,
    extra_headers={"anthropic-beta": "advanced-tool-use-2025-11-20"}
)

async for chunk in response:
    if isinstance(chunk, bytes):
        chunk_str = chunk.decode("utf-8")
        for line in chunk_str.split("\n"):
            if line.startswith("data: "):
                try:
                    json_data = json.loads(line[6:])
                    print(json_data)
                except json.JSONDecodeError:
                    pass
```

### AI Gateway Usage

Configure the proxy to use Messages API endpoints.

#### Proxy Configuration

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: claude-sonnet-messages
    litellm_params:
      model: anthropic/{{anthropic}}
      api_key: os.environ/ANTHROPIC_API_KEY
```

#### Client Request

```python showLineNumbers title="Client Request via Proxy (Messages API)"
from anthropic import Anthropic

client = Anthropic(
    api_key="your-litellm-proxy-key",
    base_url="http://0.0.0.0:4000"
)

response = client.messages.create(
    model="claude-sonnet-messages",
    max_tokens=1024,
    messages=[
        {
            "role": "user",
            "content": "What's the weather?"
        }
    ],
    tools=[
        {
            "type": "tool_search_tool_regex_20251119",
            "name": "tool_search_tool_regex"
        },
        {
            "name": "get_weather",
            "description": "Get weather information",
            "input_schema": {
                "type": "object",
                "properties": {
                    "location": {"type": "string"}
                },
                "required": ["location"]
            },
            "defer_loading": True
        }
    ],
    extra_headers={"anthropic-beta": "advanced-tool-use-2025-11-20"}
)

print(response)
```

---

## Responses API

From v1.107.0, an OpenAI Responses API caller can send OpenAI's `tool_search` tool to a Claude model on `/v1/responses`. LiteLLM sends Claude Anthropic's regex tool search tool in its place and returns Claude's search as a `tool_search_call` output item, so one request works on both OpenAI and Claude models.

A `{"type": "tool_search"}` tool with `"execution": "server"`, or with no `execution`, becomes `tool_search_tool_regex_20251119`. Function tools keep `defer_loading`, and so do the member tools of a `namespace` tool. Claude's search comes back as a `tool_search_call` item before the `function_call` it led to. Its `call_id` is Anthropic's `srvtoolu_` id, its `id` is `tsc_` plus that id, its `arguments` is an object that holds Claude's search pattern, and its `execution` is `server`. A streamed response sends it as `response.output_item.added` and `response.output_item.done` events, and the pattern is in the `done` event.

A follow-up turn can send the `tool_search_call` back as an input item together with the rest of the output, or use `previous_response_id` when the proxy [stores sessions](../response_api.md#session-management). LiteLLM leaves the search call out of the request it sends Claude, so Claude sees the function calls and their outputs but not the search that found them, and its answer can say that it called a tool without a search first.

This works on routes where LiteLLM builds an Anthropic request (Anthropic, Azure Anthropic, Vertex AI and Bedrock Invoke) for every model whose cost map entry has `supports_tool_search`, which covers Claude 4.5 and newer. On every other route, Bedrock Converse included, LiteLLM drops the `tool_search` tool, logs a warning and sends the function tools without `defer_loading`.

Two parts of OpenAI's tool search are not translated. LiteLLM drops a `tool_search` tool with `"execution": "client"`, and on Claude routes it keeps `defer_loading` on the other tools, so a request where every tool is deferred gets a 400 from Anthropic (`All tools cannot be deferred.`). LiteLLM also returns no `tool_search_output` item. OpenAI fills that item with the definitions of the tools the search loaded, which the caller already has.

### AI Gateway Usage

#### Proxy Configuration

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: claude-sonnet
    litellm_params:
      model: anthropic/{{anthropic}}
      api_key: os.environ/ANTHROPIC_API_KEY
```

#### Client Request

Every function tool in this request sets `defer_loading`, so Claude has to search for the one it needs.

```bash showLineNumbers title="tool_search on a Claude model through /v1/responses"
curl http://0.0.0.0:4000/v1/responses \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-sonnet",
    "input": "What is the weather in Paris right now? Use the right tool.",
    "tools": [
      {"type": "tool_search", "execution": "server"},
      {"type": "function", "name": "get_weather", "description": "Get the current weather for a city", "parameters": {"type": "object", "properties": {"city": {"type": "string"}}, "required": ["city"]}, "defer_loading": true},
      {"type": "function", "name": "get_stock_price", "description": "Get the current stock price for a ticker", "parameters": {"type": "object", "properties": {"ticker": {"type": "string"}}, "required": ["ticker"]}, "defer_loading": true},
      {"type": "function", "name": "send_email", "description": "Send an email to a recipient", "parameters": {"type": "object", "properties": {"to": {"type": "string"}, "body": {"type": "string"}}, "required": ["to", "body"]}, "defer_loading": true}
    ]
  }'
```

The `output` array of the response holds the search call and then the function call:

```json showLineNumbers title="Response output"
[
  {
    "id": "tsc_srvtoolu_01F8hTt8WqVTUttskjushEVj",
    "arguments": {"pattern": "weather|forecast|temperature"},
    "call_id": "srvtoolu_01F8hTt8WqVTUttskjushEVj",
    "execution": "server",
    "status": "completed",
    "type": "tool_search_call"
  },
  {
    "arguments": "{\"city\": \"Paris\"}",
    "call_id": "toolu_01K24WmFy7Wp67qTowYf2cw3",
    "name": "get_weather",
    "type": "function_call",
    "id": "fc_toolu_01K24WmFy7Wp67qTowYf2cw3",
    "namespace": null,
    "status": "completed"
  }
]
```

With the OpenAI Python SDK, the follow-up turn sends the first response's output back with the function result:

```python showLineNumbers title="tool_search on a Claude model with the OpenAI SDK"
from openai import OpenAI

client = OpenAI(api_key="your-litellm-proxy-key", base_url="http://0.0.0.0:4000")

tools = [
    {"type": "tool_search"},
    {
        "type": "function",
        "name": "get_weather",
        "description": "Get the current weather for a city",
        "parameters": {"type": "object", "properties": {"city": {"type": "string"}}, "required": ["city"]},
        "defer_loading": True,
    },
    {
        "type": "function",
        "name": "send_email",
        "description": "Send an email to a recipient",
        "parameters": {
            "type": "object",
            "properties": {"to": {"type": "string"}, "body": {"type": "string"}},
            "required": ["to", "body"],
        },
        "defer_loading": True,
    },
]

question = [{"role": "user", "content": "What is the weather in Paris right now? Use the right tool."}]
response = client.responses.create(model="claude-sonnet", input=question, tools=tools)

for item in response.output:
    if item.type == "tool_search_call":
        print(f"Searched with {item.arguments}")
    elif item.type == "function_call":
        print(f"Called {item.name}({item.arguments})")

weather_call = next(item for item in response.output if item.type == "function_call")
follow_up = client.responses.create(
    model="claude-sonnet",
    input=[
        *question,
        *response.output,
        {"type": "function_call_output", "call_id": weather_call.call_id, "output": '{"temp_c": 18, "condition": "cloudy"}'},
    ],
    tools=tools,
)
print(follow_up.output_text)
```

---

## Claude Code Tool Search on Non-Claude Models

Claude Code with `ENABLE_TOOL_SEARCH=true` sends large tool sets, such as MCP server tools, with `defer_loading: true` and a `ToolSearch` tool that loads them on demand. Each load changes the tool list Claude Code sends on the next request. On a model behind `/v1/messages` that is not Claude, that change breaks the provider's prompt cache, so the request right after every tool load pays the full input price.

Set `deferred_tools` in a deployment's `model_info` to choose how LiteLLM handles those deferred tools for that deployment.

<SinceVersion v="1.113.0" />

| Value | What LiteLLM sends | Use it for |
|-------|--------------------|------------|
| `drop` (default) | Every deferred tool as a normal tool, without `defer_loading` | Backends where the cache loss is acceptable |
| `native` | The request to the provider's Responses API, with `ToolSearch` as client `tool_search` and deferred tools kept deferred | Azure OpenAI and OpenAI |
| `emulate` | One fixed tool list, with deferred tools replaced by a `CallLoadedTool` tool that calls a loaded tool by name | Chat-only backends such as Bedrock or Fireworks Kimi |
| `passthrough` | Each tool with its `defer_loading` flag as Claude Code sent it, and each `ToolSearch` result as text naming the loaded tools | Backends that accept Anthropic-style deferral |

With `emulate`, a `ToolSearch` result reaches the model as text that names each loaded tool with its description and input schema, and the model calls the tool through `CallLoadedTool`. LiteLLM returns that call to Claude Code under the loaded tool's own name, so Claude Code runs the tool as usual. The tool list stays the same for the whole session, so the prompt cache holds across tool loads. `emulate` changes nothing on a request that has no `ToolSearch` tool.

With `native`, the deployment uses the Responses API even when `use_chat_completions_url_for_anthropic_messages` is on, so a conversation never switches API and loses its cache. A request that forces `tool_choice` onto `ToolSearch` answers 400, since the Responses API cannot force client tool search.

With `emulate`, a loaded tool's arguments reach the model as the free-form `input` of `CallLoadedTool`, so the provider no longer checks them against the tool's schema. A deferred tool with `strict: true` answers 400 under `emulate`, since `CallLoadedTool` cannot enforce strict input. LiteLLM returns a `CallLoadedTool` call under the real tool's name only when it names a tool that a `ToolSearch` result in the conversation loaded, and any other call reaches the client as `CallLoadedTool`. A request that forces `tool_choice` onto a deferred tool is forced through `CallLoadedTool` with that tool's name fixed.

`deferred_tools` applies only where LiteLLM translates `/v1/messages` to another API. A provider LiteLLM calls through its own `/v1/messages` API, such as Anthropic, gets deferred tools as Claude Code sent them, so any value other than `passthrough` answers 400 there.

An unknown value, `native` on a provider other than the two above, or `passthrough` on OpenAI, Azure OpenAI, or Mistral, whose APIs reject `defer_loading`, answers 400. So does `passthrough` on a route that cannot carry `defer_loading` to the model: Bedrock Converse, Bedrock's native chat route (which falls back to Converse for many request params), Gemini, and Vertex AI Gemini. With `drop_params: true`, LiteLLM uses `drop` instead (and ignores the setting on a provider's own `/v1/messages` API), drops a forced `ToolSearch` `tool_choice`, sends `strict` deferred tools under `emulate` without `strict`, and logs a warning that names the setting.

The proxy turns on `drop_params` for Claude Code requests by default, so a Claude Code session gets that fallback and the warning instead of the 400. Set `drop_params: false` under `litellm_settings` to get the 400 there too.

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: azure-gpt
    litellm_params:
      model: azure/{{openai_large}}
      api_base: os.environ/AZURE_API_BASE
      api_key: os.environ/AZURE_API_KEY
    model_info:
      deferred_tools: native
  - model_name: kimi
    litellm_params:
      model: bedrock/chat_completions/us.moonshotai.kimi-k3.1
      aws_region_name: us-east-1
    model_info:
      deferred_tools: emulate
```

Start Claude Code against the proxy with tool search on, then use an MCP tool. The request after the tool load reports most of its input as `cache_read_input_tokens` in its usage.

```bash showLineNumbers title="Start Claude Code"
export ANTHROPIC_BASE_URL=http://0.0.0.0:4000
export ANTHROPIC_AUTH_TOKEN=$LITELLM_API_KEY
export ENABLE_TOOL_SEARCH=true
claude --model kimi
```

---

## Additional Resources

- [Anthropic Tool Search Documentation](https://docs.anthropic.com/en/docs/build-with-claude/tool-use/tool-search)
- [LiteLLM Tool Calling Guide](https://docs.litellm.ai/docs/completion/function_call)
