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
    "model_name": "{{openai_small}}",
    "litellm_params": {
        "model": "azure/chatgpt-v-2",
        "api_key": os.getenv("AZURE_API_KEY"),
        "api_version": os.getenv("AZURE_API_VERSION"),
        "api_base": os.getenv("AZURE_API_BASE"),
        "timeout": 300, # sets a 5 minute timeout
        "stream_timeout": 30, # sets a 30s timeout for streaming calls
    }
}]

# init router
router = Router(model_list=model_list, routing_strategy="least-busy")
async def router_acompletion():
    response = await router.acompletion(
        model="{{openai_small}}", 
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
  - model_name: {{openai_small}}
    litellm_params:
      model: azure/gpt-turbo-small-eu
      api_base: https://my-endpoint-europe-berri-992.openai.azure.com/
      api_key: <your-key>
      timeout: 0.1                      # timeout in (seconds)
      stream_timeout: 0.01              # timeout for stream requests (seconds)
      max_retries: 5
  - model_name: {{openai_small}}
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
      model: anthropic/{{anthropic_large}}
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

`keepalive_seconds` is operator-only by default. A client's request-level `keepalive_seconds` has no effect unless the deployment also sets `allow_client_keepalive_override: true`, since letting any client enable heartbeats at will would let it keep an idle-looking stream alive past a load balancer's timeout indefinitely, tying up a `max_parallel_requests` slot for longer than intended.

```yaml
model_list:
  - model_name: claude-opus
    litellm_params:
      model: anthropic/{{anthropic_large}}
      api_key: os.environ/ANTHROPIC_API_KEY
      keepalive_seconds: 15
      allow_client_keepalive_override: true
```

With override allowed, a request can change the deployment's default, including disabling it with an explicit `0`:

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

If `allow_client_keepalive_override` isn't set, that same request body is silently ignored and the deployment's own configured value applies instead. A deployment-level `keepalive_seconds: 0` is a hard disable that takes priority over everything, including a grant of override permission: it can't be re-enabled by a request no matter what. The effective value is clamped to the range 1-300 seconds.

`keepalive_seconds` can also be set with an `x-litellm-keepalive-seconds` header instead of a request body field, for clients that can set custom headers more easily than extra body fields:

```shell
curl http://0.0.0.0:4000/v1/chat/completions \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer sk-1234' \
  -H 'x-litellm-keepalive-seconds: 1' \
  -d '{
    "model": "claude-opus",
    "messages": [{"role": "user", "content": "Think step by step about..."}],
    "stream": true
  }'
```

The header goes through the same `allow_client_keepalive_override` gate as the body field, so it has no effect on a deployment that hasn't opted in either.

#### A proxy-wide default

`keepalive_seconds` is per deployment. To apply one interval across every deployment, and to every pass-through route, set `sse_keepalive_ping_interval_seconds` under `litellm_settings`:

```yaml
litellm_settings:
  sse_keepalive_ping_interval_seconds: 15
```

A deployment's own `keepalive_seconds` still wins where it is set, and a deployment-level `0` still hard-disables. The global value only applies where nothing more specific does.

One nuance applies before the upstream has answered, since no deployment has served the request yet: a per-deployment value is only used when every deployment behind the requested model name carries the same one. Where they disagree, the global value applies until the serving deployment is known, after which its own setting takes over for the rest of the stream.

#### Silence before the upstream answers at all

Some providers withhold their response headers until the first token, so on those the model's whole thinking time passes before the proxy has anything to relay. `sse_keepalive_ping_interval_seconds` covers that window too: when the upstream call has not come back within one interval, the proxy opens the SSE response and starts sending `: ping` comments, then replays the real response onto the same connection once it arrives.

Two things follow from opening the response that early, and both are why this stays off until you set an interval:

- The status line is committed before the outcome is known, so a request that fails after the first ping arrives as an SSE error frame under a `200` rather than as an HTTP error status. Any error transformation your callbacks apply still applies to that frame
- LiteLLM's `x-litellm-*` response headers are not known yet, so they are absent on a stream that pinged


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
    model="{{openai_small}}", 
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
        "model": "{{openai_small}}",
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
    model="{{openai_small}}",
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
        "model": "gemini/{{gemini_flash}}",
        "messages": [
        {"role": "user", "content": "hi my email is ishaan@berri.ai"}
        ],
        "mock_timeout": true # 👈 KEY CHANGE
    }'
```
