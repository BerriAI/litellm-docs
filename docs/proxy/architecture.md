import { RequestFlowDiagram, RouterFlowDiagram, ImageFlowDiagram } from '@site/src/components/CloudArchitecture';

# Life of a Request

## High Level architecture

<RequestFlowDiagram />


### Request Flow 

1. **User Sends Request**: The process begins when a user sends a request to the LiteLLM Proxy Server (Gateway).

2. [**Virtual Keys**](./virtual_keys): At this stage the `Bearer` token in the request is checked to ensure it is valid and under its budget. [Here is the list of checks that run for each request](https://github.com/BerriAI/litellm/blob/main/litellm/proxy/auth/auth_checks.py)
    - 2.1 Check if the Virtual Key exists in Redis Cache or In Memory Cache
    - 2.2 **If not in Cache**, Lookup Virtual Key in DB

3. **Rate Limiting**: The [parallel request limiter](https://github.com/BerriAI/litellm/blob/main/litellm/proxy/hooks/parallel_request_limiter_v3.py) checks the **rate limit (rpm/tpm)** for the following components:
    - Global Server Rate Limit
    - Virtual Key Rate Limit
    - User Rate Limit
    - Team Limit

4. **LiteLLM `proxy_server.py`**: Contains the `/chat/completions` and `/embeddings` endpoints. Requests to these endpoints are sent through the LiteLLM Router

5. [**LiteLLM Router**](../routing): The LiteLLM Router handles Load balancing, Fallbacks, Retries for LLM API deployments.

6. [**litellm.completion() / litellm.embedding()**:](../index.md#litellm-python-sdk) The litellm Python SDK is used to call the LLM in the OpenAI API format (Translation and parameter mapping)

7. **Post-Request Processing**: After the response is sent back to the client, the following **asynchronous** tasks are performed:
   - [Logging to Lunary, MLflow, LangFuse or other logging destinations](./logging)
   - The [parallel request limiter](https://github.com/BerriAI/litellm/blob/main/litellm/proxy/hooks/parallel_request_limiter_v3.py) updates the rpm/tpm usage for the 
        - Global Server Rate Limit
        - Virtual Key Rate Limit
        - User Rate Limit
        - Team Limit
    - The `_ProxyDBLogger` updates spend / usage in the LiteLLM database. [Here is everything tracked in the DB per request](https://github.com/BerriAI/litellm/blob/main/schema.prisma)

## The router: fallbacks and retries

<RouterFlowDiagram />

Step 5 above hands the request to the LiteLLM Router, which owns load balancing, fallbacks, and retries. All unified endpoints (`.completion`, `.embeddings`, and so on) flow through it the same way.

The request first enters `function_with_fallbacks`, which wraps the call in a try-except so it can fall back to another deployment if the primary one fails. From there it passes to `function_with_retries`, which wraps the call again and retries on an available deployment within the same model group when a request fails. Finally `function_with_retries` calls a base litellm unified function such as `litellm.completion` or `litellm.embeddings`, which makes the actual request to the LLM API.

A **model_group** is a set of LLM API deployments that share the same `model_name` and can be load balanced across.

## Image URL handling

<ImageFlowDiagram />

Some LLM APIs don't accept image URLs but do accept base64 strings. For those, LiteLLM detects a URL in the request, checks whether the target API supports URLs, and if not, downloads the image and sends the provider a base64 string instead. Up to 10 converted images are cached in memory to reduce latency on repeated calls, and individual downloads are capped at 50MB (configurable with `MAX_IMAGE_URL_DOWNLOAD_SIZE_MB`).

## Frequently Asked Questions

1. Is a db transaction tied to the lifecycle of request?
    - No, a db transaction is not tied to the lifecycle of a request.
    - The check if a virtual key is valid relies on a DB read if it's not in cache.
    - All other DB transactions are async in background tasks
