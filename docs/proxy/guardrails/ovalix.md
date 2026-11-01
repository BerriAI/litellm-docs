import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Ovalix

<SinceVersion v="1.109.0" />

[Ovalix](https://www.ovalix.ai) is an AI security and governance platform. The LiteLLM guardrail sends prompts, model responses, attached files, tool calls and tool results to the Ovalix Tracker, which applies the policies of one Ovalix application and can block or anonymize content before it reaches the model or the client.

## Quick Start

### 1. Get your Ovalix application details

From your Ovalix tenant, collect:

- the Tracker base URL and API key
- the application ID whose policies LiteLLM should apply
- the checkpoint IDs for prompts (pre), responses (post) and, optionally, files

### 2. Add Ovalix to your LiteLLM config.yaml

```yaml title="config.yaml"
model_list:
  - model_name: {{openai_small}}
    litellm_params:
      model: openai/{{openai_small}}
      api_key: os.environ/OPENAI_API_KEY

guardrails:
  - guardrail_name: ovalix-guard
    litellm_params:
      guardrail: ovalix
      mode: [pre_call, post_call]
      default_on: true
      tracker_api_base: os.environ/OVALIX_TRACKER_API_BASE
      tracker_api_key: os.environ/OVALIX_TRACKER_API_KEY
      application_id: os.environ/OVALIX_APPLICATION_ID
      pre_checkpoint_id: os.environ/OVALIX_PRE_CHECKPOINT_ID
      post_checkpoint_id: os.environ/OVALIX_POST_CHECKPOINT_ID
      file_checkpoint_id: os.environ/OVALIX_FILE_CHECKPOINT_ID  # optional
```

To add it from the Admin UI instead, open the Guardrails page, pick **Ovalix Guardrail** as the provider and fill in the same fields.

### 3. Start LiteLLM Proxy

```shell
export OPENAI_API_KEY=sk-...
export OVALIX_TRACKER_API_BASE=https://<your-tracker-host>
export OVALIX_TRACKER_API_KEY=...
export OVALIX_APPLICATION_ID=aiApp_...
export OVALIX_PRE_CHECKPOINT_ID=checkpoint_...
export OVALIX_POST_CHECKPOINT_ID=checkpoint_...
litellm --config config.yaml
```

### 4. Make your first request

The examples assume an Ovalix application with a policy that blocks the phrase "Project Falcon" and anonymizes names.

<Tabs>
<TabItem label="Blocked request" value="blocked">

```shell
curl -sSLX POST 'http://0.0.0.0:4000/v1/chat/completions' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer sk-your-virtual-key' \
--data '{
  "model": "{{openai_small}}",
  "messages": [
    {"role": "user", "content": "Summarize the launch plan for Project Falcon"}
  ]
}'
```

```json
{
  "error": {
    "message": "This message was blocked by Ovalix",
    "type": "invalid_request_error",
    "param": null,
    "code": "400"
  }
}
```

The message is the one Ovalix returns for the policy, falling back to `This message was blocked by Ovalix`. The model is not called.

</TabItem>
<TabItem label="Anonymized request" value="anonymized">

```shell
curl -sSLX POST 'http://0.0.0.0:4000/v1/chat/completions' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer sk-your-virtual-key' \
--data '{
  "model": "{{openai_small}}",
  "messages": [
    {"role": "user", "content": "My name is David Cohen. Write a one-line greeting to me."}
  ]
}'
```

Ovalix rewrites the prompt, so the model receives `My name is {Name}. Write a one-line greeting to me.` and answers with something like `Hello, {Name}! It's great to connect with you!`.

</TabItem>
<TabItem label="Permitted request" value="allowed">

```shell
curl -sSLX POST 'http://0.0.0.0:4000/v1/chat/completions' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer sk-your-virtual-key' \
--data '{
  "model": "{{openai_small}}",
  "messages": [
    {"role": "user", "content": "What is the capital of Japan?"}
  ]
}'
```

The request reaches the model and the response is returned unchanged.

</TabItem>
</Tabs>

## What Ovalix checks

`pre_call` checks the request before the model is called, against `pre_checkpoint_id`. `post_call` checks the model's response, against `post_checkpoint_id`.

| Content | When Ovalix blocks it | When Ovalix anonymizes it |
|---|---|---|
| Message text | The newest message fails the request with a 400. An earlier message in the conversation is replaced with the block message and the request continues | The text is replaced with Ovalix's rewrite |
| Files and images sent inline (base64 or data URL) | The request fails with a 400 | The request fails with a 400, because LiteLLM can't rewrite file content |
| Tool calls, from the conversation or from the model | The request fails with a 400 | The request fails with a 400, because LiteLLM can't rewrite tool calls |
| Tool results | The request fails with a 400 | The request fails with a 400, because LiteLLM can't rewrite tool results |

Files and images are checked against `file_checkpoint_id`, or against the prompt or response checkpoint when it is not set. A few file cases work differently:

- A file or image given by URL or `file_id` is not downloaded, so Ovalix gets at most its name
- A file larger than 64 MB is sent by name with `oversize: true` instead of its content
- An inline file that can't be decoded fails the request with a 400

## Supported parameters

| Parameter | Environment variable | Required | Description |
|---|---|---|---|
| `tracker_api_base` | `OVALIX_TRACKER_API_BASE` | Yes | Ovalix Tracker base URL. LiteLLM calls `/tracking/beta/checkpoint` and `/tracking/beta/file_checkpoint` on it |
| `tracker_api_key` | `OVALIX_TRACKER_API_KEY` | Yes | Tracker API key, sent as the `x-api-key` header |
| `application_id` | `OVALIX_APPLICATION_ID` | Yes | Ovalix application whose policies apply to this guardrail |
| `pre_checkpoint_id` | `OVALIX_PRE_CHECKPOINT_ID` | With `pre_call` | Checkpoint for prompts |
| `post_checkpoint_id` | `OVALIX_POST_CHECKPOINT_ID` | With `post_call` | Checkpoint for model responses |
| `file_checkpoint_id` | `OVALIX_FILE_CHECKPOINT_ID` | No | Checkpoint for files and images. Defaults to the prompt or response checkpoint |
| `mode` | | Yes | `pre_call`, `post_call`, or both as a list |
| `default_on` | | No | Run this guardrail on every request. Defaults to `false` |
| `timeout` | | No | Seconds to wait for each Tracker call. Defaults to 600 |

The proxy does not start when the base URL, API key or application ID is missing. When a mode has no checkpoint ID for it, the proxy logs `Skipping guardrail '<guardrail_name>': invalid configuration` and starts without this guardrail, so check the startup logs after a config change.

## Use several Ovalix applications

Each guardrail entry applies the policies of one Ovalix application. To give keys or teams different policies, add one guardrail entry per application and attach the matching entry to each key or team, or name it per request with `"guardrails": ["<guardrail_name>"]`.

```yaml title="config.yaml"
guardrails:
  - guardrail_name: ovalix-finance
    litellm_params:
      guardrail: ovalix
      mode: [pre_call, post_call]
      tracker_api_base: os.environ/OVALIX_TRACKER_API_BASE
      tracker_api_key: os.environ/OVALIX_TRACKER_API_KEY
      application_id: aiApp_finance
      pre_checkpoint_id: checkpoint_finance_pre
      post_checkpoint_id: checkpoint_finance_post

  - guardrail_name: ovalix-support
    litellm_params:
      guardrail: ovalix
      mode: [pre_call, post_call]
      tracker_api_base: os.environ/OVALIX_TRACKER_API_BASE
      tracker_api_key: os.environ/OVALIX_TRACKER_API_KEY
      application_id: aiApp_support
      pre_checkpoint_id: checkpoint_support_pre
      post_checkpoint_id: checkpoint_support_post
```

## What LiteLLM sends to Ovalix

Every Tracker call carries the application and checkpoint IDs, the content being checked, and:

- `actor`: the email of the user who owns the virtual key, else that user's ID, else `unknown`
- `session_id`: a short hash of the actor, the UTC date and the application ID, so Ovalix can group one user's checks for the day

## Supported endpoints and errors

Ovalix runs on `/v1/chat/completions`, `/v1/messages` and `/v1/responses`, streaming and non-streaming. On a streaming request, a `pre_call` block returns a 400 before any chunk is sent.

If the Tracker can't be reached, times out or returns an error, the request fails with `Ovalix guardrail error: ...` instead of going through unchecked.

## Further reading

- [Ovalix](https://www.ovalix.ai)
- [LiteLLM guardrails overview](https://docs.litellm.ai/docs/proxy/guardrails/quick_start)
