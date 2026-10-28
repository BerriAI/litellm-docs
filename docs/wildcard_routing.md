---
sidebar_label: "Wildcard Routing"
---

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


## [PROXY-Only] Team-scoped wildcards take precedence

A team can [add its own wildcard deployment](/docs/proxy/team_model_add) with its own credentials, so that team's keys use the team's provider account. When a proxy-wide wildcard with the same pattern also exists, the team's deployment serves that team's keys and the proxy-wide deployment serves every other key. The two are never load balanced together, and a team without a matching wildcard of its own falls through to the proxy-wide one.

```yaml
model_list:
  # Proxy-wide: serves keys that have no team-scoped openrouter/* deployment
  - model_name: openrouter/*
    litellm_params:
      model: openrouter/*
      api_key: os.environ/SHARED_OPENROUTER_API_KEY
```

```bash
# Team-scoped: serves keys that belong to this team, with the team's own credentials
curl -X POST 'http://0.0.0.0:4000/model/new' \
  -H 'Authorization: Bearer $LITELLM_MASTER_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "model_name": "openrouter/*",
    "litellm_params": {"model": "openrouter/*", "api_key": "<team-openrouter-key>"},
    "model_info": {"team_id": "<team-id>"}
  }'
```

The `x-litellm-model-id` response header names the deployment that served a request, so a call with one of the team's keys returns the team deployment's id and a call with any other key returns the proxy-wide deployment's id.

## [[PROXY-Only] Control Wildcard Model Access](/docs/proxy/model_access#advanced-model-access-groups)