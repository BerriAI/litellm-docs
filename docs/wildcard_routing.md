import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Provider specific Wildcard routing 

**Proxy all models from a provider**

Use this if you want to **proxy all models from a specific provider without defining them on the config.yaml**

## Step 1. Define provider specific routing 

<Tabs>
<TabItem value="sdk" label="SDK">

```python
import os
from litellm import Router

router = Router(
    model_list=[
        {
            "model_name": "anthropic/*",
            "litellm_params": {
                "model": "anthropic/*",
                "api_key": os.environ["ANTHROPIC_API_KEY"]
            }
        }, 
        {
            "model_name": "groq/*",
            "litellm_params": {
                "model": "groq/*",
                "api_key": os.environ["GROQ_API_KEY"]
            }
        }, 
        {
            "model_name": "fo::*:static::*", # all requests matching this pattern will be routed to this deployment, example: model="fo::hi::static::hi" will be routed to deployment: "openai/fo::*:static::*"
            "litellm_params": {
                "model": "openai/fo::*:static::*",
                "api_key": os.environ["OPENAI_API_KEY"]
            }
        }
    ]
)
```

</TabItem>
<TabItem value="proxy" label="PROXY">

**Step 1** - define provider specific routing on config.yaml
```yaml
model_list:
  # provider specific wildcard routing
  - model_name: "anthropic/*"
    litellm_params:
      model: "anthropic/*"
      api_key: os.environ/ANTHROPIC_API_KEY
  - model_name: "groq/*"
    litellm_params:
      model: "groq/*"
      api_key: os.environ/GROQ_API_KEY
  - model_name: "fo::*:static::*" # all requests matching this pattern will be routed to this deployment, example: model="fo::hi::static::hi" will be routed to deployment: "openai/fo::*:static::*"
    litellm_params:
      model: "openai/fo::*:static::*"
      api_key: os.environ/OPENAI_API_KEY
```
</TabItem>
</Tabs>

## [PROXY-Only] Step 2 - Run litellm proxy 

```shell
$ litellm --config /path/to/config.yaml
```

## Step 3 - Test it 

<Tabs>  
<TabItem value="sdk" label="SDK">

```python
from litellm import Router

router = Router(model_list=...)

# Test with `anthropic/` - all models with `anthropic/` prefix will get routed to `anthropic/*`
resp = router.completion(model="anthropic/{{anthropic}}", messages=[{"role": "user", "content": "Hello, Claude!"}])
print(resp)

# Test with `groq/` - all models with `groq/` prefix will get routed to `groq/*`
resp = router.completion(model="groq/llama3-8b-8192", messages=[{"role": "user", "content": "Hello, Groq!"}])
print(resp)

# Test with `fo::*::static::*` - all requests matching this pattern will be routed to `openai/fo::*:static::*`
resp = router.completion(model="fo::hi::static::hi", messages=[{"role": "user", "content": "Hello, Claude!"}])
print(resp)
```

</TabItem>
<TabItem value="proxy" label="PROXY">

Test with `anthropic/` - all models with `anthropic/` prefix will get routed to `anthropic/*`
```bash
curl http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -d '{
    "model": "anthropic/{{anthropic}}",
    "messages": [
      {"role": "user", "content": "Hello, Claude!"}
    ]
  }'
```

Test with `groq/` - all models with `groq/` prefix will get routed to `groq/*`
```shell
curl http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -d '{
    "model": "groq/llama3-8b-8192",
    "messages": [
      {"role": "user", "content": "Hello, Claude!"}
    ]
  }'
```

Test with `fo::*::static::*` - all requests matching this pattern will be routed to `openai/fo::*:static::*`
```shell
curl http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -d '{
    "model": "fo::hi::static::hi",
    "messages": [
      {"role": "user", "content": "Hello, Claude!"}
    ]
  }'
```

</TabItem>
</Tabs>



## [PROXY-Only] List wildcard routes in `/v1/models`

By default `GET /v1/models` returns only the models a wildcard route expands to, so a config with `openai/*` lists `openai/gpt-4o` and the rest but not `openai/*` itself. A single request can ask for the routes with `?return_wildcard_routes=true`, but a client that fills its model picker from `/v1/models` (Open WebUI, for example) sends the plain request and never sees them.

Set `general_settings.model_list_return_wildcard_routes` to make every plain `GET /v1/models` include the wildcard routes. The same switch is on the Admin UI under Router Settings, General, and a value saved there applies to every proxy instance after its next settings reload.

```yaml
model_list:
  - model_name: "openai/*"
    litellm_params:
      model: "openai/*"
      api_key: os.environ/OPENAI_API_KEY

general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
  model_list_return_wildcard_routes: true
```

```bash
curl http://localhost:4000/v1/models \
  -H "Authorization: Bearer $LITELLM_API_KEY"
```

The response now has `openai/*` next to the expanded models. `GET /v1/models/{model_id}` follows the same setting and query parameter, so a slash-free route such as `gpt-5*` also resolves at `GET /v1/models/gpt-5*` while it is listed.

A request that passes `?return_wildcard_routes=false` still gets the list without them, whatever the setting says, and `?return_wildcard_routes=true` keeps working when the setting is off. The Admin UI's own model pickers and `/cursor/v1/models` always leave wildcard routes out, since both offer every listed id as a callable model.

Keep in mind that a wildcard route is a routing pattern rather than a model. A request that names `openai/*` as its model is forwarded to the provider, which rejects it with a `400 invalid model ID`, exactly as it does for anyone listing with `?return_wildcard_routes=true` today.

## [[PROXY-Only] Control Wildcard Model Access](/docs/proxy/model_access#advanced-model-access-groups)
