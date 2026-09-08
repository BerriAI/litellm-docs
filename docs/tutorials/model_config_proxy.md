import Image from '@theme/IdealImage';

# Customize Prompt Templates on OpenAI-Compatible server 

**You will learn:** How to set a custom prompt template on our OpenAI compatible server. 
**How?** We will modify the prompt template for CodeLlama

## Step 1: Start OpenAI Compatible server
Let's spin up a local OpenAI-compatible server, to call a deployed `codellama/CodeLlama-34b-Instruct-hf` model using Huggingface's [Text-Generation-Inference (TGI)](https://github.com/huggingface/text-generation-inference) format.

```shell
$ litellm --model huggingface/codellama/CodeLlama-34b-Instruct-hf --api_base https://my-endpoint.com --detailed_debug

# OpenAI compatible server running on http://0.0.0.0:4000
```

In a new shell, run: 
```shell
$ litellm --test
``` 
This will send a test request to our endpoint. 

Now, let's see what got sent to huggingface. With `--detailed_debug` enabled, the server logs the raw request sent to the provider in the shell it's running in.

As we can see, this is the formatting sent to huggingface: 

<Image img={require('../../img/codellama_input.png')} />  


This follows [our formatting](https://github.com/BerriAI/litellm/blob/9932371f883c55fd0f3142f91d9c40279e8fe241/litellm/llms/prompt_templates/factory.py#L10) for CodeLlama (based on the [Huggingface's documentation](https://huggingface.co/blog/codellama#conversational-instructions)). 

But this lacks BOS(`<s>`) and EOS(`</s>`) tokens.

So instead of using the LiteLLM default, let's use our own prompt template to use these in our messages. 

## Step 2: Create Custom Prompt Template

Our litellm server accepts prompt templates as part of a config file. You can save api keys, fallback models, prompt templates etc. in this config. [See a complete config file](../proxy/configs.md)

For now, let's just create a simple config file with our prompt template, and tell our server about it. 

Create a file called `litellm_config.yaml`:

```shell
$ touch litellm_config.yaml
```
We want to add:
* BOS (`<s>`) tokens at the start of every System and Human message
* EOS (`</s>`) tokens at the end of every assistant message. 

Let's open our file in our terminal: 
```shell
$ vi litellm_config.yaml
```

paste our prompt template:
```yaml
model_list:
  - model_name: codellama
    litellm_params:
      model: huggingface/codellama/CodeLlama-34b-Instruct-hf
      api_base: https://my-endpoint.com
      roles: {"system":{"pre_message":"<s>[INST]  <<SYS>>\n]", "post_message":"\n<</SYS>>\n [/INST]\n"}, "user":{"pre_message":"<s>[INST] ", "post_message":" [/INST]\n"}, "assistant":{"pre_message":"", "post_message":"</s>"}}
```

save our file (in vim): 
```shell
:wq
```

## Step 3: Run new template

Re-start our server, this time pointing it at our config file:
```shell
$ litellm --config ./litellm_config.yaml --detailed_debug
```

In a new shell, run: 
```shell
$ litellm --test
``` 

See our new input prompt to Huggingface! 

<Image img={require('../../img/codellama_formatted_input.png')} /> 

Congratulations 🎉
