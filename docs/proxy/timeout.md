import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Timeouts

The timeout set in router is for the entire length of the call, and is passed down to the completion() call level as well. 

### Global Timeouts

<Tabs>
<TabItem value="sdk" label="SDK">

```python
from litellm import Router 

model_list = [{...}]

router = Router(model_list=model_list, 
                timeout=30) # raise timeout error if call takes > 30s 

print(response)
```

</TabItem>
<TabItem value="proxy" label="PROXY">

```yaml
router_settings:
    timeout: 30 # sets a 30s timeout for the entire call
```

**Start Proxy** 

```shell
$ litellm --config /path/to/config.yaml
```

</TabItem>
</Tabs>

### Custom Timeouts & Stream Timeouts (Per Model)

For each model, you can set `timeout` and `stream_timeout` under `litellm_params`:

- **`timeout`** → maximum time for the *complete response*.  
  Use this to cap long-running completions.

- **`stream_timeout`** → maximum time to wait for the *first chunk* (i.e., first token) in a streaming response.  
  Use this to abort “hanging” providers (e.g., Bedrock slow start) and retry another model.
<Tabs>
<TabItem value="sdk" label="SDK">

```python
from litellm import Router 
import asyncio

model_list = [{
    "model_name": "gpt-3.5-turbo",
    "litellm_params": {
        "model": "azure/chatgpt-v-2",
        "api_key": os.getenv("AZURE_API_KEY"),
        "api_version": os.getenv("AZURE_API_VERSION"),
        "api_base": os.getenv("AZURE_API_BASE"),
        "timeout": 300 # sets a 5 minute timeout
        "stream_timeout": 30 # sets a 30s timeout for streaming calls
    }
}]

# init router
router = Router(model_list=model_list, routing_strategy="least-busy")
async def router_acompletion():
    response = await router.acompletion(
        model="gpt-3.5-turbo", 
        messages=[{"role": "user", "content": "Hey, how's it going?"}]
    )
    print(response)
    return response

asyncio.run(router_acompletion())
```

</TabItem>
<TabItem value="proxy" label="PROXY">

```yaml
model_list:
  - model_name: gpt-3.5-turbo
    litellm_params:
      model: azure/gpt-turbo-small-eu
      api_base: https://my-endpoint-europe-berri-992.openai.azure.com/
      api_key: <your-key>
      timeout: 0.1                      # timeout in (seconds)
      stream_timeout: 0.01              # timeout for stream requests (seconds)
      max_retries: 5
  - model_name: gpt-3.5-turbo
    litellm_params:
      model: azure/gpt-turbo-small-ca
      api_base: https://my-endpoint-canada-berri992.openai.azure.com/
      api_key: 
      timeout: 0.1                      # timeout in (seconds)
      stream_timeout: 0.01              # timeout for stream requests (seconds)
      max_retries: 5

```


**Start Proxy**

```shell
$ litellm --config /path/to/config.yaml
```


</TabItem>
</Tabs>

### Keepalive Pings for Idle Streaming Connections

`timeout` and `stream_timeout` cap how long a request is allowed to run. A separate problem is that load balancers and reverse proxies in front of the proxy often close connections that look idle, even when the client is legitimately waiting on a response. Streaming requests to models with long silent gaps before the first token, such as extended or adaptive thinking models, or otherwise slow providers, can trip these idle-connection timeouts before any content arrives.

Set `keepalive_seconds` under a deployment's `litellm_params` to keep the connection alive during these gaps. Once a stream goes silent for longer than `keepalive_seconds`, the proxy sends an SSE comment frame (`: ping`) down the connection, repeating every `keepalive_seconds` until real content resumes. Comment frames are part of the SSE spec, and clients and intermediate proxies are expected to ignore them, so they don't affect the response your application sees.

```yaml
model_list:
  - model_name: claude-opus
    litellm_params:
      model: anthropic/claude-opus-4-8
      api_key: os.environ/ANTHROPIC_API_KEY
      keepalive_seconds: 15
```

```shell
curl http://0.0.0.0:4000/v1/chat/completions \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer sk-1234' \
  -d '{
    "model": "claude-opus",
    "messages": [{"role": "user", "content": "Think step by step about..."}],
    "stream": true
  }'
```

`keepalive_seconds` can also be set per request, in which case it overrides the deployment default:

```shell
curl http://0.0.0.0:4000/v1/chat/completions \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer sk-1234' \
  -d '{
    "model": "claude-opus",
    "messages": [{"role": "user", "content": "Think step by step about..."}],
    "stream": true,
    "keepalive_seconds": 1
  }'
```

An explicit `0` at the request level disables pings even if the deployment sets a non-zero default. The reverse is also true and takes priority: if the deployment sets `keepalive_seconds: 0`, that is an operator-level disable a request can't override, so requests can narrow the deployment's setting but can't force heartbeats on for a deployment that has turned them off. The effective value is clamped to the range 1-300 seconds.

### Setting Dynamic Timeouts - Per Request

LiteLLM supports setting a `timeout` per request 

**Example Usage**
<Tabs>
<TabItem value="sdk" label="SDK">

```python
from litellm import Router 

model_list = [{...}]
router = Router(model_list=model_list)

response = router.completion(
    model="gpt-3.5-turbo", 
    messages=[{"role": "user", "content": "what color is red"}],
    timeout=1
)
```

</TabItem>
<TabItem value="proxy" label="PROXY">

<Tabs>
<TabItem value="Curl" label="Curl Request">

```shell
curl --location 'http://0.0.0.0:4000/chat/completions' \
     --header 'Content-Type: application/json' \
     --data-raw '{
        "model": "gpt-3.5-turbo",
        "messages": [
            {"role": "user", "content": "what color is red"}
        ],
        "logit_bias": {12481: 100},
        "timeout": 1
     }'
```
</TabItem>
<TabItem value="openai" label="OpenAI v1.0.0+">

```python
import openai


client = openai.OpenAI(
    api_key="anything",
    base_url="http://0.0.0.0:4000"
)

response = client.chat.completions.create(
    model="gpt-3.5-turbo",
    messages=[
        {"role": "user", "content": "what color is red"}
    ],
    logit_bias={12481: 100},
    extra_body={"timeout": 1} # 👈 KEY CHANGE
)

print(response)
```
</TabItem>
</Tabs>

</TabItem>
</Tabs>


## Testing timeout handling 

To test if your retry/fallback logic can handle timeouts, you can set `mock_timeout=True` for testing. 

This is currently only supported on `/chat/completions` and `/completions` endpoints. Please [let us know](https://github.com/BerriAI/litellm/issues) if you need this for other endpoints. 

```bash
curl -L -X POST 'http://0.0.0.0:4000/v1/chat/completions' \
    -H 'Content-Type: application/json' \
    -H 'Authorization: Bearer sk-1234' \
    --data-raw '{
        "model": "gemini/gemini-1.5-flash",
        "messages": [
        {"role": "user", "content": "hi my email is ishaan@berri.ai"}
        ],
        "mock_timeout": true # 👈 KEY CHANGE
    }'
```
