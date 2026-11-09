---
title: Quickstart
description: Start LiteLLM with one command or one click and go from zero to your first gateway request in about five minutes, using the Admin UI for everything after startup.
---

import Image from '@theme/IdealImage';
import ThemedVideo from '@site/src/components/ThemedVideo';
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';
import QuickStartBox from '@site/src/components/QuickStartBox';
import {OneClickDeploy} from '@site/src/components/Conversion';

# Quickstart

LiteLLM ships as a ready-to-run gateway. You start it with one command (or one click), then do everything else in your browser: connect providers, add models, create keys, and send test requests from the built-in Admin UI. No config files are required for this guide.

<QuickStartBox variant="gateway" showTitle={false} heading="Up and running in a minute" source="docker-quickstart">

When the command finishes, open the Admin UI. Then you can [add your models](#3-add-your-first-model), [create virtual keys](#5-create-a-virtual-key), and [call the gateway from your apps](#6-call-the-gateway-from-your-app).

</QuickStartBox>

For detailed installation steps, follow the rest of the guide. By the end you will have LiteLLM running at `http://localhost:4000` with a model connected, a virtual key issued, and a request served through the gateway.

## 1. Start LiteLLM

```bash
curl -sSLO https://github.com/BerriAI/litellm/raw/main/docker/docker-compose.quickstart.yml
printf 'LITELLM_MASTER_KEY=sk-%s\nLITELLM_SALT_KEY=sk-%s\n' "$(openssl rand -hex 32)" "$(openssl rand -hex 32)" > .env
docker compose -f docker-compose.quickstart.yml up -d
```

This brings up the gateway on port 4000 and a Postgres database that stores your models, keys, and spend logs. The [compose file](https://github.com/BerriAI/litellm/blob/main/docker/docker-compose.quickstart.yml) defines just those two services and now sits in your working directory, so you can read it before starting it, and edit it afterwards to pin a specific release tag.

The second command generates your master key, which is the credential you will use for every request below. The proxy refuses to start without it. Keep the `.env` file: regenerating `LITELLM_SALT_KEY` makes credentials already stored in the database unreadable.

<OneClickDeploy source="docker-quickstart" />

:::warning[What the two keys do]
Running locally, the command above generated both into `.env` and the compose file refuses to start without them. On a 1-click deploy, set them in the provider's environment.

`LITELLM_MASTER_KEY` is the root credential for the gateway: it authorizes every management API call and, by default, doubles as the Admin UI password. Anyone holding it has full admin access, so treat it like a root password, keep it out of source control, and rotate it if it ever leaks. The `sk-` prefix in the generated value is a convention, not a requirement

`LITELLM_SALT_KEY` encrypts the provider API keys you add in the UI. It has no in-place rotation, so keep the generated value: changing it later makes every stored credential unreadable until you re-enter it. See [key rotations](./master_key_rotations) for how the two keys relate.
:::

## 2. Log in to the Admin UI

Open [http://localhost:4000/ui](http://localhost:4000/ui). The username is `admin` and the password is your `LITELLM_MASTER_KEY` value, the one in the `.env` file you just generated.

<Image img={require('../../img/ui_quickstart_login.png')} dark={require('../../img/ui_quickstart_login_dark.png')} alt="LiteLLM Admin UI login page" />

## 3. Add your first model

Go to **Models + Endpoints**, open the **Add Model** tab, pick your provider and the models you want to expose, and paste your provider API key. LiteLLM ships with each provider's model catalog, so you select models rather than type them.

<Image img={require('../../img/ui_quickstart_add_model.png')} dark={require('../../img/ui_quickstart_add_model_dark.png')} alt="Add Model form with OpenAI provider and gpt-5.5 selected" />

Click **Test Connect** to verify the key against the provider, then **Add Model**. It appears under **Deployed Models** with its pricing already mapped:

<Image img={require('../../img/ui_quickstart_models_list.png')} dark={require('../../img/ui_quickstart_models_list_dark.png')} alt="Deployed Models list showing the newly added model with cost data" />

:::tip[Keep provider keys out of the UI]
If you prefer to manage provider keys as environment variables, download the compose file, add them to the `litellm` service (for example `OPENAI_API_KEY: ${OPENAI_API_KEY}`), and enter `os.environ/OPENAI_API_KEY` in the API key field instead of the raw key.
:::

## 4. Send a test message

Go to **Playground**, select your model, and send a message. The request goes through the gateway to your provider, and the response comes back with latency and token counts:

<Image img={require('../../img/ui_quickstart_playground.png')} dark={require('../../img/ui_quickstart_playground_dark.png')} alt="Playground showing a live response from the model with latency and token metrics" />

Your gateway works end to end. The **Get Code** button in the Playground generates the equivalent API call for your language.

## 5. Create a virtual key

Virtual keys are what you hand to applications and teammates instead of raw provider keys. Each key can carry its own budget, rate limits, and model access, and all its spend is tracked automatically.

Go to **Virtual Keys**, click **+ Create New Key**, give it a name, and click **Create Key**:

<Image img={require('../../img/ui_quickstart_create_key.png')} dark={require('../../img/ui_quickstart_create_key_dark.png')} alt="Save your Key modal showing the newly created virtual key" />

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

<ThemedVideo
  src={require('../../img/ui_quickstart_flow.mp4')}
  dark={require('../../img/ui_quickstart_flow_dark.mp4')}
  poster={require('../../img/ui_quickstart_flow_poster.png')}
  darkPoster={require('../../img/ui_quickstart_flow_poster_dark.png')}
  title="Walkthrough: add a model, test it in the Playground, create a virtual key"
/>

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
  -e LITELLM_MASTER_KEY=sk-<paste-a-long-random-key> \
  -p 4000:4000 \
  docker.litellm.ai/berriai/litellm:latest \
  --config /app/config.yaml
```

Requests authenticate with the master key. See the [full config reference](./configs.md) for everything the file supports.

:::warning[Budgets are not enforced without a database]

`litellm_settings.max_budget` is not a spend cap on this path. Loading the proxy's global spend requires a database client, so without one the running total stays unknown and the global budget check never fires; a proxy configured with `max_budget: 100` keeps serving requests past $100 with no per-request error and no budget alert. The proxy does log a one-time warning at startup when a budget is configured with no database connected, and that startup line is the only signal you get

Key and team budgets are not an alternative here either, because virtual keys themselves need a database (requests carrying one fail with `No connected db.`), so the master key is the only credential and it has no budget of its own

If a budget is part of how you bound spend, run LiteLLM with a database as shown at the top of this page. Without one, bound spend upstream instead, at your provider's own spending limits

:::

## Next steps

Going to production: the [Production Deployment guide](./deploy.md) covers Helm, Terraform, and Kubernetes on AWS, GCP, and Azure, and the [production checklist](./prod.md) covers hardening and tuning. Full container and database options, including Redis and Prometheus, are covered in the repo [docker-compose.yml](https://github.com/BerriAI/litellm/blob/main/docker-compose.yml).
