import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# GPUSTACK AI

## Overview

| Property | Details |
|-------|-------|
| Description | GPUStack is an open-source GPU cluster manager designed for efficient AI model deployment. It configures and orchestrates inference engines — vLLM, SGLang, TensorRT-LLM, or your own — to optimize performance across GPU clusters.. |
| Provider Route on LiteLLM | `gpustack/v1` |
| Link to Provider Doc | [GPUSTACK AI ↗](https://docs.gpustack.ai/) |
| Base URL | `https://gpustack.ai/` |
| Supported Operations | [`/chat/completions`](#all vllm/sglang/openai/anthropic support format) |

<br />
<br />

https://gpustack.ai/

**We support ALL OPEN SOURCE AI models with all type of inference engine**

## Required Variables


**ATTENTION:**

litellm config gpustack as upstream model provider same like openrouter


## 1.Usage - config gpustack

1. install gpustack
```text
sudo docker run -d --name gpustack \
    --restart unless-stopped \
    -p 80:80 \
    --volume gpustack-data:/var/lib/gpustack \
    gpustack/gpustack
```

2. In GPUStack UI, navigate to the Deployments page and click on Deploy Model to deploy the models you need. Here are some example models:
```text
http://your-gpustack-url
```
get your password with username admin
```text
sudo docker exec gpustack cat /var/lib/gpustack/initial_admin_password
```




qwen3-8b
qwen2.5-vl-3b-instruct
bge-m3
bge-reranker-v2-m3

2. In the model’s Operations, open API Access Info to see how to integrate with this model.

3. Create an API Key in GPUStack

Navigate to the Access Control > API Keys page in GPUStack, then click on New API Key.

Fill in the name, then click Save.

Copy the API key and save it for later use.

### 2.Usage - config litellm

1. Open LiteLLM manage ui

```text
http://your-litellm-url:4000/ui
```
