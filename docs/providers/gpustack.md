# GPUSTACK AI

most popular ai inference platform in github(very simple to one button to start)
From GPU to Token Factory in Minutes

# GPUSTACK FUCNTION

1. Multi-Cluster GPU Management
Manages GPU clusters across multiple environments, including on-premises servers, Kubernetes clusters, and cloud providers.

2. Pluggable Inference Engines
Automatically configures high-performance inference engines such as vLLM, SGLang, and TensorRT-LLM. Supports adding custom inference engines as needed.

3. Day 0 Model Support
Leverages a pluggable engine architecture to enable zero-day deployment of newly released models.

4. Performance-Optimized
Offers pre-tuned modes for low latency or high throughput. Supports extended KV cache (LMCache, HiCache) and speculative decoding (EAGLE3, MTP).

5. Enterprise-Grade Operations
Provides support for automated failure recovery, load balancing, monitoring, authentication, and access control.

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
 ```text    
     local deploy model fg with gpustack:
     qwen3-8b
     qwen2.5-vl-3b-instruct
     bge-m3
     bge-reranker-v2-m3
 ```
3. In the model’s Operations, open API Access Info to see how to integrate with this model.

4. Create an API Key in GPUStack

 ```text
    Navigate to the Access Control > API Keys page in GPUStack, then click on New API Key.

    Fill in the name, then click Save.

    Copy the API key and save it for later use.
 ```
### 2.Usage - config litellm
 ```text
1. Open LiteLLM manage ui

```text
   http://your-litellm-url:4000/ui
```

2. add gpustack model of deployment



2.1. Navigate to the Add Model Page
    1. Click **Models + Endpoints** on the left sidebar menu.
    2. Select the **Add Model** tab at the top of the page.


2.2. Configure Basic Model Info
    3. **Provider**: Select `Custom OpenAI` from the dropdown list.
    4. **LiteLLM Model Name(s)**: Enter `glm-5.2-1` (the GPUStack deployment name or route name that LiteLLM will send to the LLM API).
    5. **Model Mappings - Public Model Name**: Enter `glm-5.2-1` (the GPUStack model name).
    6. **Model Mappings - LiteLLM Model Name**: Enter `glm-5.2-1` (the mapped LiteLLM model name).

2.3. Configure API Credentials
    7. **API Base**: Enter the endpoint URL, e.g., `https://gpu.abd.com/v1` (append `/v1` for OpenAI-compatible interfaces).
    8. **API Key**: Enter your GPUStack API Key.

2.4. Test and Save
    9. Click the **Test Connect** button at the bottom to verify the connection.
    10. Once the connection test passes, click **Add Model** to complete the setup.


3. test chat in litellm

3.1. Access the Playground
    1. Click **Playground** on the left sidebar menu.
    2. Ensure you are on the **Chat** tab at the top.

3.2. Configure Chat Settings
    3. **Endpoint Type**: Select `/v1/chat/completions` from the dropdown list.
    4. **Select Model**: Choose your newly added model name (e.g., `glm-5.2-1`).

3.3. Start Chatting

    5. Type your test message (e.g., "Hello") in the message input box at the bottom and send it to chat with the model.
 ```
### 3.gpustack best practices with vllm&sglang -dspark config cookbook(updating)
```text
    https://github.com/yiminghub2024/gpustack/tree/main/docs/cookbook
 ```
