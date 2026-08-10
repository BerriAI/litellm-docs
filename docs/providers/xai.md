import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# xAI

https://docs.x.ai/docs

:::tip

**We support ALL xAI models, just set `model=xai/<any-model-on-xai>` as a prefix when sending litellm requests**

:::

## Supported Models

**Grok 4.5** - Frontier model for coding, agentic tasks, and knowledge work with 500K context, reasoning (low/medium/high), vision, tools, web search, and prompt caching.

| Model | Context | Features |
|-------|---------|----------|
| `xai/grok-4.5` | 500K tokens | **Reasoning**, Function calling, Vision, Web search, Caching |

**Example:**
```python
from litellm import completion

response = completion(
    model="xai/grok-4.5",
    messages=[{"role": "user", "content": "Find and fix the bug, then explain it."}],
    reasoning_effort="high",  # low | medium | high (default high)
)
```

**Features:**
- **Reasoning** = Chain-of-thought reasoning with reasoning tokens
- **Tools** = Function calling / Tool use
- **Web search** = Live internet search
- **Vision** = Image understanding
- **Caching** = Prompt caching for cost savings
- **Structured outputs** = JSON / schema-constrained responses

**Pricing:** See [xAI's pricing page](https://docs.x.ai/docs/models) for current rates.

## API Key
```python
# env variable
os.environ['XAI_API_KEY']
```

## Sample Usage

```python showLineNumbers title="LiteLLM python sdk usage - Non-streaming"
from litellm import completion
import os

os.environ['XAI_API_KEY'] = ""
response = completion(
    model="xai/grok-4.5",
    messages=[
        {
            "role": "user",
            "content": "What's the weather like in Boston today in Fahrenheit?",
        }
    ],
    max_tokens=10,
    response_format={ "type": "json_object" },
    seed=123,
    temperature=0.2,
    top_p=0.9,
    tool_choice="auto",
    tools=[],
    user="user",
)
print(response)
```

## Sample Usage - Streaming

```python showLineNumbers title="LiteLLM python sdk usage - Streaming"
from litellm import completion
import os

os.environ['XAI_API_KEY'] = ""
response = completion(
    model="xai/grok-4.5",
    messages=[
        {
            "role": "user",
            "content": "What's the weather like in Boston today in Fahrenheit?",
        }
    ],
    stream=True,
    max_tokens=10,
    response_format={ "type": "json_object" },
    seed=123,
    temperature=0.2,
    top_p=0.9,
    tool_choice="auto",
    tools=[],
    user="user",
)

for chunk in response:
    print(chunk)
```

## Sample Usage - Vision

```python showLineNumbers title="LiteLLM python sdk usage - Vision"
import os 
from litellm import completion

os.environ["XAI_API_KEY"] = "your-api-key"

response = completion(
    model="xai/grok-4.5",
    messages=[
        {
            "role": "user",
            "content": [
                {
                    "type": "image_url",
                    "image_url": {
                        "url": "https://science.nasa.gov/wp-content/uploads/2023/09/web-first-images-release.png",
                        "detail": "high",
                    },
                },
                {
                    "type": "text",
                    "text": "What's in this image?",
                },
            ],
        },
    ],
)
```

## Usage with LiteLLM Proxy Server

Here's how to call a XAI model with the LiteLLM Proxy Server

1. Modify the config.yaml 

  ```yaml showLineNumbers
  model_list:
    - model_name: my-model
      litellm_params:
        model: xai/<your-model-name>  # add xai/ prefix to route as XAI provider
        api_key: api-key                 # api key to send your model
  ```


2. Start the proxy 

  ```bash
  $ litellm --config /path/to/config.yaml
  ```

3. Send Request to LiteLLM Proxy Server

  <Tabs>

  <TabItem value="openai" label="OpenAI Python v1.0.0+">

  ```python showLineNumbers
  import openai
  client = openai.OpenAI(
      api_key="sk-1234",             # pass litellm proxy key, if you're using virtual keys
      base_url="http://0.0.0.0:4000" # litellm-proxy-base url
  )

  response = client.chat.completions.create(
      model="my-model",
      messages = [
          {
              "role": "user",
              "content": "what llm are you"
          }
      ],
  )

  print(response)
  ```
  </TabItem>

  <TabItem value="curl" label="curl">

  ```shell
  curl --location 'http://0.0.0.0:4000/chat/completions' \
      --header 'Authorization: Bearer sk-1234' \
      --header 'Content-Type: application/json' \
      --data '{
      "model": "my-model",
      "messages": [
          {
          "role": "user",
          "content": "what llm are you"
          }
      ],
  }'
  ```
  </TabItem>

  </Tabs>


## Reasoning Usage

LiteLLM supports reasoning usage for xAI models.

<Tabs>

<TabItem value="python" label="LiteLLM Python SDK">

```python showLineNumbers title="reasoning with xai/grok-4.5"
import litellm
response = litellm.completion(
    model="xai/grok-4.5",
    messages=[{"role": "user", "content": "What is 101*3?"}],
    reasoning_effort="low",  # low | medium | high
)

print("Reasoning Content:")
print(response.choices[0].message.reasoning_content)

print("\nFinal Response:")
print(response.choices[0].message.content)

print("\nNumber of completion tokens:")
print(response.usage.completion_tokens)

print("\nNumber of reasoning tokens:")
print(response.usage.completion_tokens_details.reasoning_tokens)
```
</TabItem>

<TabItem value="curl" label="LiteLLM Proxy - OpenAI SDK Usage">

```python showLineNumbers title="reasoning with xai/grok-4.5"
import openai
client = openai.OpenAI(
    api_key="sk-1234",             # pass litellm proxy key, if you're using virtual keys
    base_url="http://0.0.0.0:4000" # litellm-proxy-base url
)

response = client.chat.completions.create(
    model="xai/grok-4.5",
    messages=[{"role": "user", "content": "What is 101*3?"}],
    reasoning_effort="low",  # low | medium | high
)

print("Reasoning Content:")
print(response.choices[0].message.reasoning_content)

print("\nFinal Response:")
print(response.choices[0].message.content)

print("\nNumber of completion tokens:")
print(response.usage.completion_tokens)

print("\nNumber of reasoning tokens:")
print(response.usage.completion_tokens_details.reasoning_tokens)
```

</TabItem>
</Tabs>

**Example Response:**

```shell
Reasoning Content:
Let me calculate 101 multiplied by 3:
101 * 3 = 303.
I can double-check that: 100 * 3 is 300, and 1 * 3 is 3, so 300 + 3 = 303. Yes, that's correct.

Final Response:
The result of 101 multiplied by 3 is 303.

Number of completion tokens:
14

Number of reasoning tokens:
310
```
