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

**Note**: BM25 variant is not supported on Bedrock.

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

## Additional Resources

- [Anthropic Tool Search Documentation](https://docs.anthropic.com/en/docs/build-with-claude/tool-use/tool-search)
- [LiteLLM Tool Calling Guide](https://docs.litellm.ai/docs/completion/function_call)
