---
title: Quickstart
description: Start LiteLLM with one command or one click and go from zero to your first gateway request in about five minutes, using the Admin UI for everything after startup.
---

import Image from '@theme/IdealImage';
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Quickstart

LiteLLM ships as a ready-to-run gateway. You start it with one command (or one click), then do everything else in your browser: connect providers, add models, create keys, and send test requests from the built-in Admin UI. No config files are required for this guide.

By the end you will have LiteLLM running at `http://localhost:4000` with a model connected, a virtual key issued, and a request served through the gateway.

## 1. Start LiteLLM

<Tabs>
<TabItem value="local" label="Run locally" default>

```bash
curl -sSL https://docs.litellm.ai/docker-compose.yml | docker compose -f - up -d
```

This brings up the gateway on port 4000 and a Postgres database that stores your models, keys, and spend logs. The [compose file](https://docs.litellm.ai/docker-compose.yml) it pipes in defines just those two services; to customize anything (pin a release tag instead of `latest`, change credentials), download it and start it the usual way:

```bash
curl -sSLO https://docs.litellm.ai/docker-compose.yml
docker compose up -d
```

</TabItem>
<TabItem value="cloud" label="1-click deploy">

<div style={{display: 'flex', alignItems: 'center', gap: '1.5rem'}}>
  <a href="https://railway.com/deploy/RhvhdC?referralCode=7mRv9K&utm_medium=integration&utm_source=template&utm_campaign=generic" target="_blank" rel="nofollow"><img src="https://railway.com/button.svg" alt="Deploy on Railway" height="40" /></a>
  <a href="https://render.com/deploy?repo=https://github.com/BerriAI/litellm" target="_blank" rel="nofollow"><img src="https://render.com/images/deploy-to-render-button.svg" alt="Deploy to Render" height="40" /></a>
</div>

For the rest of this guide, use your deployment's URL wherever you see `http://localhost:4000`.

</TabItem>
</Tabs>

:::warning Set a real salt key
`LITELLM_SALT_KEY` encrypts the provider API keys you add in the UI. The quickstart compose file ships a placeholder; before adding models to anything you intend to keep, set it to a long random value, and never change it afterwards. Credentials encrypted with the old value cannot be decrypted with a new one. A password generator works well for this.
:::

## 2. Log in to the Admin UI

Open [http://localhost:4000/ui](http://localhost:4000/ui). The username is `admin` and the password is your `LITELLM_MASTER_KEY` value (`sk-1234` in the quickstart compose file).

<Image img={require('../../img/ui_quickstart_login.png')} alt="LiteLLM Admin UI login page" />

## 3. Add your first model

Go to **Models + Endpoints**, open the **Add Model** tab, pick your provider and the models you want to expose, and paste your provider API key. LiteLLM ships with each provider's model catalog, so you select models rather than type them.

<Image img={require('../../img/ui_quickstart_add_model.png')} alt="Add Model form with OpenAI provider and gpt-5.5 selected" />

Click **Test Connect** to verify the key against the provider, then **Add Model**. It appears under **All Models** with its pricing already mapped:

<Image img={require('../../img/ui_quickstart_models_list.png')} alt="All Models list showing the newly added model with cost data" />

:::tip Keep provider keys out of the UI
If you prefer to manage provider keys as environment variables, download the compose file, add them to the `litellm` service (for example `OPENAI_API_KEY: ${OPENAI_API_KEY}`), and enter `os.environ/OPENAI_API_KEY` in the API key field instead of the raw key.
:::

## 4. Send a test message

Go to **Playground**, select your model, and send a message. The request goes through the gateway to your provider, and the response comes back with latency and token counts:

<Image img={require('../../img/ui_quickstart_playground.png')} alt="Playground showing a live response from the model with latency and token metrics" />

Your gateway works end to end. The **Get Code** button in the Playground generates the equivalent API call for your language.

## 5. Create a virtual key

Virtual keys are what you hand to applications and teammates instead of raw provider keys. Each key can carry its own budget, rate limits, and model access, and all its spend is tracked automatically.

Go to **Virtual Keys**, click **+ Create New Key**, give it a name, and click **Create Key**:

<Image img={require('../../img/ui_quickstart_create_key.png')} alt="Save your Key modal showing the newly created virtual key" />

Copy the key now; it is shown only once.

## 6. Call the gateway from your app

The gateway is OpenAI-compatible, so any OpenAI SDK works by pointing it at `http://localhost:4000` with your virtual key.

<Tabs>
<TabItem value="curl" label="curl">

```bash
curl http://localhost:4000/v1/chat/completions \
  -H 'Authorization: Bearer sk-<your-virtual-key>' \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "{{openai_large}}",
    "messages": [{"role": "user", "content": "Say hello in five words."}]
  }'
```

Expected response:

```json
{
  "id": "chatcmpl-DzGKiNRbQ4fe9Mgt8HSHFQ6ApfRJi",
  "model": "{{openai_large}}",
  "object": "chat.completion",
  "choices": [
    {
      "finish_reason": "stop",
      "index": 0,
      "message": {
        "content": "Hello, nice to meet you.",
        "role": "assistant"
      }
    }
  ],
  "usage": {
    "completion_tokens": 70,
    "prompt_tokens": 12,
    "total_tokens": 82
  }
}
```

</TabItem>
<TabItem value="python" label="OpenAI Python SDK">

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:4000",
    api_key="sk-<your-virtual-key>",
)

response = client.chat.completions.create(
    model="{{openai_large}}",
    messages=[{"role": "user", "content": "Say hello in five words."}],
)
print(response.choices[0].message.content)
```

</TabItem>
<TabItem value="js" label="OpenAI JS SDK">

```javascript
import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "http://localhost:4000",
  apiKey: "sk-<your-virtual-key>",
});

const response = await client.chat.completions.create({
  model: "{{openai_large}}",
  messages: [{ role: "user", content: "Say hello in five words." }],
});
console.log(response.choices[0].message.content);
```

</TabItem>
</Tabs>

## The whole flow, end to end

<Image img={require('../../img/ui_quickstart_flow.gif')} alt="Animated walkthrough: add a model, test it in the Playground, create a virtual key" />

## Running without a database

If you only need the OpenAI-compatible API (no Admin UI model management, virtual keys, or spend tracking), you can run the plain `litellm` image with a config file instead:

```yaml
# litellm_config.yaml
model_list:
  - model_name: {{openai_large}}
    litellm_params:
      model: openai/{{openai_large}}
      api_key: os.environ/OPENAI_API_KEY
```

```bash
docker run \
  -v $(pwd)/litellm_config.yaml:/app/config.yaml \
  -e OPENAI_API_KEY=<your-openai-key> \
  -e LITELLM_MASTER_KEY=sk-1234 \
  -p 4000:4000 \
  docker.litellm.ai/berriai/litellm:latest \
  --config /app/config.yaml
```

Requests authenticate with the master key. See the [full config reference](./configs.md) for everything the file supports.

:::warning Budgets are not enforced without a database

`litellm_settings.max_budget` is not a spend cap on this path. Loading the proxy's global spend requires a database client, so without one the running total stays unknown and the global budget check never fires; a proxy configured with `max_budget: 100` keeps serving requests past $100 with no per-request error and no budget alert. The proxy does log a one-time warning at startup when a budget is configured with no database connected, and that startup line is the only signal you get

Key and team budgets are not an alternative here either, because virtual keys themselves need a database (requests carrying one fail with `No connected db.`), so the master key is the only credential and it has no budget of its own

If a budget is part of how you bound spend, run LiteLLM with a database as shown at the top of this page. Without one, bound spend upstream instead, at your provider's own spending limits

:::

## Next steps

Going to production: the [Production Deployment guide](./deploy.md) covers Helm, Terraform, and Kubernetes on AWS, GCP, and Azure, and the [production checklist](./prod.md) covers hardening and tuning. Full container and database options, including Redis and Prometheus, are covered in the repo [docker-compose.yml](https://github.com/BerriAI/litellm/blob/main/docker-compose.yml).
