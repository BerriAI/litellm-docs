import Image from '@theme/IdealImage';
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Team/Key Based Logging

## Overview

Allow each key/team to use their own Langfuse Project / custom callbacks. This enables granular control over logging and compliance requirements.

**Example Use Cases:**
```showLineNumbers title="Team Based Logging"
Team 1 -> Logs to Langfuse Project 1 
Team 2 -> Logs to Langfuse Project 2
Team 3 -> Disabled Logging (for GDPR compliance)
```

## Supported Logging Integrations
- `langfuse`
- `gcs_bucket`
- `langsmith`
- `arize`


## [BETA] Team Logging

<EnterpriseFeature />

### UI Usage

1. Create a Team with Logging Settings

Create a team called "AI Agents"
<Image 
  img={require('../../img/team_logging1.png')}
  style={{width: '100%', display: 'block', margin: '2rem auto'}}
/>

<br />


2. Create a Key for the Team

We will create a key for the team "AI Agents". The team logging settings will be used for all keys created for the team.

<Image 
  img={require('../../img/team_logging2.png')}
  style={{width: '80%', display: 'block', margin: '2rem auto', border: '1px solid #E5E7EB'}}
/>

<br />


3. Make a test LLM API Request 

Use the new key to make a test LLM API Request, we expect to see the logs on your logging provider configured in step 1.

<Image 
  img={require('../../img/team_logging3.png')}
  style={{width: '100%', display: 'block', margin: '2rem auto'}}
/>

<br />

4. Check Logs on your Logging Provider 

Navigate to your configured logging provider and check if you received the logs from step 2.

<Image 
  img={require('../../img/team_logging4.png')}
  style={{width: '100%', display: 'block', margin: '2rem auto'}}
/>

<br />

### API Usage
### Set Callbacks Per Team

#### 1. Set callback for team 

We make a request to `POST /team/{team_id}/callback` to add a callback for

```shell
curl -X POST 'http:/localhost:4000/team/dbe2f686-a686-4896-864a-4c3924458709/callback' \
-H 'Content-Type: application/json' \
-H 'Authorization: Bearer sk-1234' \
-d '{
  "callback_name": "langfuse",
  "callback_type": "success",
  "callback_vars": {
    "langfuse_public_key": "pk", 
    "langfuse_secret_key": "sk_", 
    "langfuse_host": "https://cloud.langfuse.com"
    }
  
}'
```

##### Supported Values

| Field | Supported Values | Notes |
|-------|------------------|-------|
| `callback_name` | `"langfuse"`, `"gcs_bucket"`| Currently only supports `"langfuse"`, `"gcs_bucket"` |
| `callback_type` | `"success"`, `"failure"`, `"success_and_failure"` | |
| `callback_vars` | | dict of callback settings |
| &nbsp;&nbsp;&nbsp;&nbsp;`langfuse_public_key` | string | Required for Langfuse |
| &nbsp;&nbsp;&nbsp;&nbsp;`langfuse_secret_key` | string | Required for Langfuse |
| &nbsp;&nbsp;&nbsp;&nbsp;`langfuse_host` | string | Optional for Langfuse (defaults to https://cloud.langfuse.com) |
| &nbsp;&nbsp;&nbsp;&nbsp;`gcs_bucket_name` | string | Required for GCS Bucket. Name of your GCS bucket |
| &nbsp;&nbsp;&nbsp;&nbsp;`gcs_path_service_account` | string | Required for GCS Bucket. Path to your service account json |

#### 2. Create key for team

All keys created for team `dbe2f686-a686-4896-864a-4c3924458709` will log to langfuse project specified on [Step 1. Set callback for team](#1-set-callback-for-team)


```shell
curl --location 'http://0.0.0.0:4000/key/generate' \
    --header 'Authorization: Bearer sk-1234' \
    --header 'Content-Type: application/json' \
    --data '{
        "team_id": "dbe2f686-a686-4896-864a-4c3924458709"
}'
```


#### 3. Make `/chat/completion` request for team

```shell
curl -i http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-KbUuE0WNptC0jXapyMmLBA" \
  -d '{
    "model": "{{openai_large}}",
    "messages": [
      {"role": "user", "content": "Hello, Claude gm!"}
    ]
}'
```

Expect this to be logged on the langfuse project specified on [Step 1. Set callback for team](#1-set-callback-for-team)


### Disable Logging for a Team

To disable logging for a specific team, you can use the following endpoint:

`POST /team/{team_id}/disable_logging`

This endpoint removes all success and failure callbacks for the specified team, effectively disabling logging. To remove a single integration and leave the team's other callbacks running, use `DELETE /team/{team_id}/callback/{callback_name}` instead, documented below

#### Step 1. Disable logging for team

```shell
curl -X POST 'http://localhost:4000/team/YOUR_TEAM_ID/disable_logging' \
    -H 'Authorization: Bearer YOUR_API_KEY'
```
Replace YOUR_TEAM_ID with the actual team ID

**Response**
A successful request will return a response similar to this:
```json
{
    "status": "success",
    "message": "Logging disabled for team YOUR_TEAM_ID",
    "data": {
        "team_id": "YOUR_TEAM_ID",
        "success_callbacks": [],
        "failure_callbacks": []
    }
}
```

#### Step 2. Test it - `/chat/completions`

Use a key generated for team = `team_id` - you should see no logs on your configured success callback (eg. Langfuse)

```shell
curl -i http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-KbUuE0WNptC0jXapyMmLBA" \
  -d '{
    "model": "{{openai_large}}",
    "messages": [
      {"role": "user", "content": "Hello, Claude gm!"}
    ]
}'
```

#### Debugging / Troubleshooting

- Check active callbacks for team using `GET /team/{team_id}/callback`

Use this to check what success/failure callbacks are active for team=`team_id`

```shell
curl -X GET 'http://localhost:4000/team/dbe2f686-a686-4896-864a-4c3924458709/callback' \
        -H 'Authorization: Bearer sk-1234'
```

### Remove a Single Callback from a Team

To deregister one integration while the team's other callbacks keep running, use:

`DELETE /team/{team_id}/callback/{callback_name}`

Every entry registered under that `callback_name` is removed, across callback types, so an integration registered for both `success` and `failure` is deregistered by one call. The response lists the callbacks that survive, and a `callback_name` the team has not registered returns `404` without changing anything

### Team Logging Endpoints

- [`POST /team/{team_id}/callback` Add a success/failure callback to a team](https://litellm-api.up.railway.app/#/team%20management/add_team_callbacks_team__team_id__callback_post)
- [`GET /team/{team_id}/callback` - Get the success/failure callbacks and variables for a team](https://litellm-api.up.railway.app/#/team%20management/get_team_callbacks_team__team_id__callback_get)
- [`DELETE /team/{team_id}/callback/{callback_name}` - Remove a single callback from a team](https://litellm-api.up.railway.app/#/team%20management/delete_team_callback_team__team_id__callback__callback_name__delete)
- [`POST /team/{team_id}/disable_logging` - Remove every callback from a team](https://litellm-api.up.railway.app/#/team%20management/disable_team_logging_team__team_id__disable_logging_post)



## Team Logging - `config.yaml`

Turn on/off logging and caching for a specific team id. 

This section is team-scoped only: `litellm_settings.default_team_settings` configures callbacks for every key that belongs to a team id. There is no `config.yaml` surface for declaring individual virtual keys; per-key callbacks are provisioned through the `/key/generate` or `/key/update` API, documented in [Key Based Logging](#beta-key-based-logging).

Because `config.yaml` is trusted operator-controlled configuration, `os.environ/...` references are supported here and are resolved from the proxy's environment at startup. The same references are rejected when sent through the management API (see [Secret handling for API-provisioned callbacks](#secret-handling-for-api-provisioned-callbacks)).

**Example:**

This config would send langfuse logs to 2 different langfuse projects, based on the team id 

```yaml
litellm_settings:
  default_team_settings: 
    - team_id: "dbe2f686-a686-4896-864a-4c3924458709"
      success_callback: ["langfuse"]
      langfuse_public_key: os.environ/LANGFUSE_PUB_KEY_1 # Project 1
      langfuse_secret: os.environ/LANGFUSE_PRIVATE_KEY_1 # Project 1
    - team_id: "06ed1e01-3fa7-4b9e-95bc-f2e59b74f3a8"
      success_callback: ["langfuse"]
      langfuse_public_key: os.environ/LANGFUSE_PUB_KEY_2 # Project 2
      langfuse_secret: os.environ/LANGFUSE_SECRET_2 # Project 2
```

Now, when you [generate keys](./virtual_keys.md) for this team-id 

```bash
curl -X POST 'http://0.0.0.0:4000/key/generate' \
-H 'Authorization: Bearer sk-1234' \
-H 'Content-Type: application/json' \
-d '{"team_id": "06ed1e01-3fa7-4b9e-95bc-f2e59b74f3a8"}'
```

All requests made with these keys will log data to their team-specific logging. 


## [BETA] Key Based Logging 

Use the `/key/generate` or `/key/update` endpoints to add logging callbacks to a specific key.

<EnterpriseFeature />

**How key based logging works:**

- If **Key has no callbacks** configured, it will use the default callbacks specified in the config.yaml file
- If **Key has callbacks** configured, it will use the callbacks specified in the key


### UI Usage 

1. Create a Key with Logging Settings

When creating a key, you can configure the specific logging settings for the key. These logging settings will be used for all requests made with this key.

<Image 
  img={require('../../img/key_logging.png')}
  style={{width: '100%', display: 'block', margin: '2rem auto'}}
/>
<br />


2. Make a test LLM API Request 

Use the new key to make a test LLM API Request, we expect to see the logs on your logging provider configured in step 1.

<Image 
  img={require('../../img/key_logging2.png')}
  style={{width: '100%', display: 'block', margin: '2rem auto'}}
/>

<br />

3. Check Logs on your Logging Provider 

Navigate to your configured logging provider and check if you received the logs from step 2.

<Image 
  img={require('../../img/key_logging_arize.png')}
  style={{width: '100%', display: 'block', margin: '2rem auto'}}
/>

<br />

### API Usage



<Tabs>
<TabItem label="Langfuse" value="langfuse">

```bash
curl -X POST 'http://0.0.0.0:4000/key/generate' \
-H 'Authorization: Bearer sk-1234' \
-H 'Content-Type: application/json' \
-d '{
    "metadata": {
        "logging": [{
            "callback_name": "langfuse", # "otel", "gcs_bucket"
            "callback_type": "success", # "success", "failure", "success_and_failure"
            "callback_vars": {
                "langfuse_public_key": "pk-lf-...", # pass the resolved value, not an os.environ/ reference
                "langfuse_secret_key": "sk-lf-...", # pass the resolved value, not an os.environ/ reference
                "langfuse_host": "https://cloud.langfuse.com"
            }
        }]
    }
}'

```

Each key can point at a different Langfuse project: generate one key per project and pass that project's credentials in `callback_vars`.

#### Secret handling for API-provisioned callbacks

`os.environ/...` references inside API-supplied `callback_vars` are rejected (since v1.84). Resolving environment references from a request body would let any caller with key-management access read arbitrary secrets out of the proxy's environment, so the request fails with a validation error instead. Pass the resolved secret value in the request; LiteLLM encrypts `callback_vars` credentials at rest using the proxy's salt key. If you want the proxy to resolve credentials from its own environment, configure the callback in trusted `config.yaml` (globally under `litellm_settings`, or per team via [`default_team_settings`](#team-logging---configyaml)).

<iframe width="840" height="500" src="https://www.youtube.com/embed/8iF0Hvwk0YU" frameborder="0" webkitallowfullscreen mozallowfullscreen allowfullscreen></iframe>

</TabItem>
<TabItem label="GCS Bucket" value="gcs_bucket">

1. Create Virtual Key to log to a specific GCS Bucket

  Set `GCS_SERVICE_ACCOUNT` in your environment to the path of the service account json
  ```bash
  export GCS_SERVICE_ACCOUNT=/path/to/service-account.json # GCS_SERVICE_ACCOUNT=/Users/ishaanjaffer/Downloads/adroit-crow-413218-a956eef1a2a8.json
  ```

  ```bash
  curl -X POST 'http://0.0.0.0:4000/key/generate' \
  -H 'Authorization: Bearer sk-1234' \
  -H 'Content-Type: application/json' \
  -d '{
      "metadata": {
          "logging": [{
              "callback_name": "gcs_bucket", # "otel", "gcs_bucket"
              "callback_type": "success", # "success", "failure", "success_and_failure"
              "callback_vars": {
                  "gcs_bucket_name": "my-gcs-bucket", # Name of your GCS Bucket to log to
                  "gcs_path_service_account": "/path/to/service-account.json" # path to the service account json, not an os.environ/ reference
              }
          }]
      }
  }'

  ```

2. Test it - `/chat/completions` request

  Use the virtual key from step 3 to make a `/chat/completions` request

  You should see your logs on GCS Bucket on a successful request

  ```shell
  curl -i http://localhost:4000/v1/chat/completions \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer sk-Fxq5XSyWKeXDKfPdqXZhPg" \
    -d '{
      "model": "fake-openai-endpoint",
      "messages": [
        {"role": "user", "content": "Hello, Claude"}
      ],
      "user": "hello",
    }'
  ```

</TabItem>

<TabItem label="Langsmith" value="langsmith">

1. Create Virtual Key to log to a specific Langsmith Project

  ```bash
  curl -X POST 'http://0.0.0.0:4000/key/generate' \
  -H 'Authorization: Bearer sk-1234' \
  -H 'Content-Type: application/json' \
  -d '{
      "metadata": {
          "logging": [{
              "callback_name": "langsmith", # "otel", "gcs_bucket"
              "callback_type": "success", # "success", "failure", "success_and_failure"
              "callback_vars": {
                  "langsmith_api_key": "lsv2_pt_...", # resolved Langsmith API key, not an os.environ/ reference
                  "langsmith_project": "pr-brief-resemblance-72", # project name on langsmith
                  "langsmith_base_url": "https://api.smith.langchain.com"
              }
          }]
      }
  }'

  ```

2. Test it - `/chat/completions` request

  Use the virtual key from step 3 to make a `/chat/completions` request

  You should see your logs on your Langsmith project on a successful request

  ```shell
  curl -i http://localhost:4000/v1/chat/completions \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer sk-Fxq5XSyWKeXDKfPdqXZhPg" \
    -d '{
      "model": "fake-openai-endpoint",
      "messages": [
        {"role": "user", "content": "Hello, Claude"}
      ],
      "user": "hello",
    }'
  ```

</TabItem>
</Tabs>

---

Help us improve this feature, by filing a [ticket here](https://github.com/BerriAI/litellm/issues)

### Check if key callbacks are configured correctly `/key/health`

Call `/key/health` with the key to check if the callback settings are configured correctly

Pass the key in the request header

```bash
curl -X POST "http://localhost:4000/key/health" \
  -H "Authorization: Bearer <your-key>" \
  -H "Content-Type: application/json"
```

<Tabs>
<TabItem label="Response when key is configured correctly" value="Response when key is configured correctly">

Response when logging callbacks are setup correctly:

A key is **healthy** when the logging callbacks are setup correctly.

```json
{
  "key": "healthy",
  "logging_callbacks": {
    "callbacks": [
      "gcs_bucket"
    ],
    "status": "healthy",
    "details": "No logger exceptions triggered, system is healthy. Manually check if logs were sent to ['gcs_bucket']"
  }
}
```

</TabItem>

<TabItem label="Response when key is configured incorrectly" value="Response when key is configured incorrectly">

Response when logging callbacks are not setup correctly

A key is **unhealthy** when the logging callbacks are not setup correctly.

```json
{
  "key": "unhealthy",
  "logging_callbacks": {
    "callbacks": [
      "gcs_bucket"
    ],
    "status": "unhealthy",
    "details": "Logger exceptions triggered, system is unhealthy: Failed to load vertex credentials. Check to see if credentials containing partial/invalid information."
  }
}
```

</TabItem>
</Tabs>

### Disable/Enable Message redaction

Use this to enable prompt logging for specific keys when you have globally disabled it

Example config.yaml with globally disabled prompt logging (message redaction)
```yaml
model_list:
  - model_name: {{openai_large}}
    litellm_params:
      model: {{openai_large}}
litellm_settings:
  callbacks: ["datadog"]
  turn_off_message_logging: True # 👈 Globally logging prompt / response is disabled
```

**Enable prompt logging for key**

Set `turn_off_message_logging` to `false` for the key you want to enable prompt logging for. This will override the global `turn_off_message_logging` setting.

```shell
curl -X POST 'http://0.0.0.0:4000/key/generate' \
-H 'Authorization: Bearer sk-1234' \
-H 'Content-Type: application/json' \
-d '{
    "metadata": {
        "logging": [{
            "callback_name": "datadog",
            "callback_vars": {
                "turn_off_message_logging": false # 👈 Enable prompt logging
            }
        }]
    }
}'
```

Response from `/key/generate`

```json
{
    "key_alias": null,
    "key": "sk-9v6I-jf9-eYtg_PwM8OKgQ",
    "metadata": {
        "logging": [
            {
                "callback_name": "datadog",
                "callback_vars": {
                    "turn_off_message_logging": false
                }
            }
        ]
    },
    "token_id": "a53a33db8c3cf832ceb28565dbb034f19f0acd69ee7f03b7bf6752f9f804081e"
}
```

Use key for `/chat/completions` request

This key will log the prompt to the callback specified in the request

```shell
curl -i http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-9v6I-jf9-eYtg_PwM8OKgQ" \
  -d '{
    "model": "{{openai_large}}",
    "messages": [
      {"role": "user", "content": "hi my name is ishaan what key alias is this"}
    ]
  }'
```





