# Customize Prompt Templates on OpenAI-Compatible server 

**You will learn:** How to set a custom prompt template on our OpenAI compatible server. 
**How?** We will modify the prompt template for a Mistral 7B Instruct model on Bedrock

Custom prompt templates only apply to providers where LiteLLM builds the raw text prompt itself (for example Bedrock Mistral and Llama text models). Providers that receive chat `messages`, such as `huggingface/` models (including TGI endpoints set with `api_base`), apply the chat template on the server side and ignore `roles`

## Step 1: Start OpenAI Compatible server

Create a `config.yaml` with the model:

```yaml
model_list:
  - model_name: mistral-7b
    litellm_params:
      model: bedrock/mistral.mistral-7b-instruct-v0:2
      aws_region_name: us-east-1
```

Set a master key (the proxy refuses to start without one), then start the proxy with `--detailed_debug` so it logs the raw request it sends to the provider:

```shell
$ export LITELLM_MASTER_KEY="sk-$(openssl rand -hex 32)"
$ litellm --config config.yaml --detailed_debug

# OpenAI compatible server running on http://0.0.0.0:4000
```

In a new shell with the same `LITELLM_MASTER_KEY` exported, send a test request: 
```shell
curl http://0.0.0.0:4000/v1/chat/completions \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "mistral-7b",
    "max_tokens": 30,
    "messages": [
      {"role": "system", "content": "You are terse."},
      {"role": "user", "content": "Say hi"}
    ]
  }'
``` 

The proxy logs show the prompt LiteLLM built with its default Mistral formatting:

```shell
POST Request Sent from LiteLLM:
curl -X POST \
https://bedrock-runtime.us-east-1.amazonaws.com/model/mistral.mistral-7b-instruct-v0:2/invoke \
-d '{'prompt': '<s>[INST] \nYou are terse. [/INST]\n[INST] Say hi [/INST]\n', 'max_tokens': 30}'
```

Let's say we want our own template instead:
* BOS (`<s>`) tokens at the start of every System and Human message
* A `<<SYS>>` block around the system message
* EOS (`</s>`) tokens at the end of every assistant message

## Step 2: Create Custom Prompt Template

Our litellm server accepts prompt templates as part of the model's `litellm_params` in `config.yaml`. You can save api keys, fallback models, prompt templates etc. in this config. [See a complete config file](../proxy/configs.md#set-custom-prompt-templates)

Update `config.yaml`:

```yaml
model_list:
  - model_name: mistral-7b
    litellm_params:
      model: bedrock/mistral.mistral-7b-instruct-v0:2
      aws_region_name: us-east-1
      roles:
        system:
          pre_message: "<s>[INST] <<SYS>>\n"
          post_message: "\n<</SYS>>\n [/INST]\n"
        user:
          pre_message: "<s>[INST] "
          post_message: " [/INST]\n"
        assistant:
          pre_message: ""
          post_message: "</s>"
```

## Step 3: Run new template

Restart the proxy with the updated config:
```shell
$ litellm --config config.yaml --detailed_debug
```

Send the same curl request as in Step 1. The proxy logs now show our custom prompt sent to Bedrock:

```shell
-d '{'prompt': '<s>[INST] <<SYS>>\nYou are terse.\n<</SYS>>\n [/INST]\n<s>[INST] Say hi [/INST]\n', 'max_tokens': 30}'
```
