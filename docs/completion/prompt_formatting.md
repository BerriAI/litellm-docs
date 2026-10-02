# Prompt Formatting

LiteLLM automatically translates the OpenAI ChatCompletions prompt format, to other models. You can control this by setting a custom prompt template for a model as well. 

## Stored Templates

Prompt templates only apply to providers that take a single raw text prompt, such as `ollama/`, `petals/`, `replicate/`, `sagemaker/`, and `predibase/`. `huggingface/` and `together_ai/` call the providers' OpenAI-compatible chat completions APIs, so LiteLLM sends your `messages` as-is and the provider applies the model's own chat template. Neither the stored templates below nor templates registered with `register_prompt_template` are used for them

For raw-prompt providers, LiteLLM supports [Huggingface Chat Templates](https://huggingface.co/docs/transformers/main/chat_templating) and falls back to the model's registered chat template on the Hugging Face Hub (e.g. [Mistral-7b](https://huggingface.co/mistralai/Mistral-7B-Instruct-v0.1/blob/main/tokenizer_config.json#L32)). On `sagemaker/`, pass `hf_model_name` to pick the template for your endpoint's base model. For popular models, the templates are saved as part of the package

| Model Name | Works for Models |
| -------- | -------- |
| mistralai/Mistral-7B-Instruct-v0.1 | mistralai/Mistral-7B-Instruct-v0.1 |
| meta-llama/Llama-2-7b-chat | All meta-llama llama2 chat models |
| tiiuae/falcon-7b-instruct | All falcon instruct models |
| mosaicml/mpt-7b-chat | All mpt chat models |
| codellama/CodeLlama-34b-Instruct-hf | All codellama instruct models |
| WizardLM/WizardCoder-Python-34B-V1.0 | All wizardcoder models |
| Phind/Phind-CodeLlama-34B-v2 | All phind-codellama models |

[**Jump to code**](https://github.com/BerriAI/litellm/blob/main/litellm/litellm_core_utils/prompt_templates/factory.py)

## Format Prompt Yourself

You can also format the prompt yourself. Register the template under the model name without the provider prefix. Here's how: 

```python 
import litellm
from litellm import completion

# Create your own custom prompt template 
litellm.register_prompt_template(
	    model="llama2",
        initial_prompt_value="You are a good assistant", # [OPTIONAL]
	    roles={
            "system": {
                "pre_message": "[INST] <<SYS>>\n", # [OPTIONAL]
                "post_message": "\n<</SYS>>\n [/INST]\n" # [OPTIONAL]
            },
            "user": { 
                "pre_message": "[INST] ", # [OPTIONAL]
                "post_message": " [/INST]" # [OPTIONAL]
            }, 
            "assistant": {
                "pre_message": "\n", # [OPTIONAL]
                "post_message": "\n" # [OPTIONAL]
            }
        },
        final_prompt_value="Now answer as best you can:" # [OPTIONAL]
)

messages = [{"role": "user", "content": "Hey, how's it going?"}]
response = completion(model="ollama/llama2", messages=messages, api_base="http://localhost:11434")
print(response['choices'][0]['message']['content'])
```

This is supported for raw-prompt providers such as Ollama (`ollama/`, not `ollama_chat/`), Petals, Replicate, SageMaker, and Predibase. It has no effect on `huggingface/` or `together_ai/` chat models

Other providers either have fixed prompt templates (e.g. Anthropic), or accept chat messages and format them server-side (e.g. Hugging Face, Together AI). If there's a provider we're missing coverage for, let us know! 

## All Providers

Here's the code for how we format all providers. Let us know how we can improve this further


| Provider | Model Name | Code |
| -------- | -------- | -------- |
| Anthropic | `claude-instant-1`, `claude-instant-1.2`, `claude-2` | [Code](https://github.com/BerriAI/litellm/blob/721564c63999a43f96ee9167d0530759d51f8d45/litellm/llms/anthropic.py#L84)
| OpenAI Text Completion | `text-davinci-003`, `text-curie-001`, `text-babbage-001`, `text-ada-001`, `babbage-002`, `davinci-002`, | [Code](https://github.com/BerriAI/litellm/blob/721564c63999a43f96ee9167d0530759d51f8d45/litellm/main.py#L442)
| Replicate | all model names starting with `replicate/` | [Code](https://github.com/BerriAI/litellm/blob/721564c63999a43f96ee9167d0530759d51f8d45/litellm/llms/replicate.py#L180)
| Cohere | `command-nightly`, `command`, `command-light`, `command-medium-beta`, `command-xlarge-beta`, `command-r-plus` | [Code](https://github.com/BerriAI/litellm/blob/721564c63999a43f96ee9167d0530759d51f8d45/litellm/llms/cohere.py#L115)
| Huggingface | all model names starting with `huggingface/` | [Code](https://github.com/BerriAI/litellm/blob/721564c63999a43f96ee9167d0530759d51f8d45/litellm/llms/huggingface_restapi.py#L186)
| OpenRouter | all model names starting with `openrouter/` | [Code](https://github.com/BerriAI/litellm/blob/721564c63999a43f96ee9167d0530759d51f8d45/litellm/main.py#L611)
| AI21 | `j2-mid`, `j2-light`, `j2-ultra` | [Code](https://github.com/BerriAI/litellm/blob/721564c63999a43f96ee9167d0530759d51f8d45/litellm/llms/ai21.py#L107)
| VertexAI | `text-bison`, `text-bison@001`, `chat-bison`, `chat-bison@001`, `chat-bison-32k`, `code-bison`, `code-bison@001`, `code-gecko@001`, `code-gecko@latest`, `codechat-bison`, `codechat-bison@001`, `codechat-bison-32k` | [Code](https://github.com/BerriAI/litellm/blob/721564c63999a43f96ee9167d0530759d51f8d45/litellm/llms/vertex_ai.py#L89)
| Bedrock | all model names starting with `bedrock/` | [Code](https://github.com/BerriAI/litellm/blob/721564c63999a43f96ee9167d0530759d51f8d45/litellm/llms/bedrock.py#L183)
| Sagemaker | `sagemaker/jumpstart-dft-meta-textgeneration-llama-2-7b` | [Code](https://github.com/BerriAI/litellm/blob/721564c63999a43f96ee9167d0530759d51f8d45/litellm/llms/sagemaker.py#L89)
| TogetherAI | all model names starting with `together_ai/` | [Code](https://github.com/BerriAI/litellm/blob/721564c63999a43f96ee9167d0530759d51f8d45/litellm/llms/together_ai.py#L101)
| AlephAlpha | all model names starting with `aleph_alpha/` | [Code](https://github.com/BerriAI/litellm/blob/721564c63999a43f96ee9167d0530759d51f8d45/litellm/llms/aleph_alpha.py#L184)
| Palm | all model names starting with `palm/` | [Code](https://github.com/BerriAI/litellm/blob/721564c63999a43f96ee9167d0530759d51f8d45/litellm/llms/palm.py#L95)
| NLP Cloud | all model names starting with `palm/` | [Code](https://github.com/BerriAI/litellm/blob/721564c63999a43f96ee9167d0530759d51f8d45/litellm/llms/nlp_cloud.py#L120)
| Petals | all model names starting with `petals/` | [Code](https://github.com/BerriAI/litellm/blob/721564c63999a43f96ee9167d0530759d51f8d45/litellm/llms/petals.py#L87)