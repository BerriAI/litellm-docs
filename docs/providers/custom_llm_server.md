import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';
import Image from '@theme/IdealImage';

# Custom API Server (Custom Format)

Call your custom torch-serve / internal LLM APIs via LiteLLM

:::info

- For calling an openai-compatible endpoint, [go here](./openai_compatible.md)
- For modifying incoming/outgoing calls on proxy, [go here](../proxy/call_hooks.md)
:::

Supported Routes:
- `/v1/chat/completions` -> `litellm.acompletion`
- `/v1/completions` -> `litellm.atext_completion`
- `/v1/embeddings` -> `litellm.aembedding`
- `/v1/images/generations` -> `litellm.aimage_generation`
- `/v1/images/edits` -> `litellm.aimage_edit`

- `/v1/messages` -> `litellm.acompletion`

## Quick Start 

```python showLineNumbers
import litellm
from litellm import CustomLLM, completion, get_llm_provider


class MyCustomLLM(CustomLLM):
    def completion(self, *args, **kwargs) -> litellm.ModelResponse:
        return litellm.completion(
            model="{{openai_small}}",
            messages=[{"role": "user", "content": "Hello world"}],
            mock_response="Hi!",
        )  # type: ignore

my_custom_llm = MyCustomLLM()

litellm.custom_provider_map = [ # KEY STEP - REGISTER HANDLER
        {"provider": "my-custom-llm", "custom_handler": my_custom_llm}
    ]

resp = completion(
        model="my-custom-llm/my-fake-model",
        messages=[{"role": "user", "content": "Hello world!"}],
    )

assert resp.choices[0].message.content == "Hi!"
```

## OpenAI Proxy Usage

1. Setup your `custom_handler.py` file 

```python
import litellm
from litellm import CustomLLM, completion, get_llm_provider


class MyCustomLLM(CustomLLM):
    def completion(self, *args, **kwargs) -> litellm.ModelResponse:
        return litellm.completion(
            model="{{openai_small}}",
            messages=[{"role": "user", "content": "Hello world"}],
            mock_response="Hi!",
        )  # type: ignore

    async def acompletion(self, *args, **kwargs) -> litellm.ModelResponse:
        return litellm.completion(
            model="{{openai_small}}",
            messages=[{"role": "user", "content": "Hello world"}],
            mock_response="Hi!",
        )  # type: ignore


my_custom_llm = MyCustomLLM()
```

2. Add to `config.yaml` 

In the config below, we pass

python_filename: `custom_handler.py`
custom_handler_instance_name: `my_custom_llm`. This is defined in Step 1

custom_handler: `custom_handler.my_custom_llm`

```yaml
model_list:
  - model_name: "test-model"             
    litellm_params:
      model: "openai/text-embedding-ada-002"
  - model_name: "my-custom-model"
    litellm_params:
      model: "my-custom-llm/my-model"

litellm_settings:
  custom_provider_map:
  - {"provider": "my-custom-llm", "custom_handler": custom_handler.my_custom_llm}
```

```bash
litellm --config /path/to/config.yaml
```

3. Test it! 

```bash
curl -X POST 'http://0.0.0.0:4000/chat/completions' \
-H 'Content-Type: application/json' \
-H "Authorization: Bearer $LITELLM_API_KEY" \
-d '{
    "model": "my-custom-model",
    "messages": [{"role": "user", "content": "Say \"this is a test\" in JSON!"}],
}'
```

Expected Response

```
{
    "id": "chatcmpl-06f1b9cd-08bc-43f7-9814-a69173921216",
    "choices": [
        {
            "finish_reason": "stop",
            "index": 0,
            "message": {
                "content": "Hi!",
                "role": "assistant",
                "tool_calls": null,
                "function_call": null
            }
        }
    ],
    "created": 1721955063,
    "model": "{{openai_small}}",
    "object": "chat.completion",
    "system_fingerprint": null,
    "usage": {
        "prompt_tokens": 10,
        "completion_tokens": 20,
        "total_tokens": 30
    }
}
```

## Add Streaming Support 

Here's a simple example of returning unix epoch seconds for both completion + streaming use-cases. 

s/o [@Eloy Lafuente](https://github.com/stronk7) for this code example.

```python
import time
from typing import Iterator, AsyncIterator
from litellm.types.utils import GenericStreamingChunk, ModelResponse
from litellm import CustomLLM, completion, acompletion

class UnixTimeLLM(CustomLLM):
    def completion(self, *args, **kwargs) -> ModelResponse:
        return completion(
            model="test/unixtime",
            mock_response=str(int(time.time())),
        )  # type: ignore

    async def acompletion(self, *args, **kwargs) -> ModelResponse:
        return await acompletion(
            model="test/unixtime",
            mock_response=str(int(time.time())),
        )  # type: ignore

    def streaming(self, *args, **kwargs) -> Iterator[GenericStreamingChunk]:
        generic_streaming_chunk: GenericStreamingChunk = {
            "finish_reason": "stop",
            "index": 0,
            "is_finished": True,
            "text": str(int(time.time())),
            "tool_use": None,
            "usage": {"completion_tokens": 0, "prompt_tokens": 0, "total_tokens": 0},
        }
        return generic_streaming_chunk # type: ignore

    async def astreaming(self, *args, **kwargs) -> AsyncIterator[GenericStreamingChunk]:
        generic_streaming_chunk: GenericStreamingChunk = {
            "finish_reason": "stop",
            "index": 0,
            "is_finished": True,
            "text": str(int(time.time())),
            "tool_use": None,
            "usage": {"completion_tokens": 0, "prompt_tokens": 0, "total_tokens": 0},
        }
        yield generic_streaming_chunk # type: ignore

unixtime = UnixTimeLLM()
```

## Image Generation

1. Setup your `custom_handler.py` file 
```python
import litellm
from litellm import CustomLLM
from litellm.types.utils import ImageResponse, ImageObject


class MyCustomLLM(CustomLLM):
    async def aimage_generation(self, model: str, prompt: str, model_response: ImageResponse, api_key: Optional[str], api_base: Optional[str], optional_params: dict, logging_obj: Any, timeout: Optional[Union[float, httpx.Timeout]] = None, client: Optional[AsyncHTTPHandler] = None,) -> ImageResponse:
        return ImageResponse(
            created=int(time.time()),
            data=[ImageObject(url="https://example.com/image.png")],
        )

my_custom_llm = MyCustomLLM()
```


2. Add to `config.yaml` 

In the config below, we pass

python_filename: `custom_handler.py`
custom_handler_instance_name: `my_custom_llm`. This is defined in Step 1

custom_handler: `custom_handler.my_custom_llm`

```yaml
model_list:
  - model_name: "test-model"             
    litellm_params:
      model: "openai/text-embedding-ada-002"
  - model_name: "my-custom-model"
    litellm_params:
      model: "my-custom-llm/my-model"

litellm_settings:
  custom_provider_map:
  - {"provider": "my-custom-llm", "custom_handler": custom_handler.my_custom_llm}
```

```bash
litellm --config /path/to/config.yaml
```

3. Test it! 

```bash
curl -X POST 'http://0.0.0.0:4000/v1/images/generations' \
-H 'Content-Type: application/json' \
-H "Authorization: Bearer $LITELLM_API_KEY" \
-d '{
    "model": "my-custom-model",
    "prompt": "A cute baby sea otter",
}'
```

Expected Response

```
{
    "created": 1721955063,
    "data": [{"url": "https://example.com/image.png"}],
}
```

## Image Edit

1. Setup your `custom_handler.py` file
```python
import litellm
from litellm import CustomLLM
from litellm.types.utils import ImageResponse, ImageObject
import time

class MyCustomLLM(CustomLLM):
    async def aimage_edit(
        self,
        model: str,
        image: Any,
        prompt: str,
        model_response: ImageResponse,
        api_key: Optional[str],
        api_base: Optional[str],
        optional_params: dict,
        logging_obj: Any,
        timeout: Optional[Union[float, httpx.Timeout]] = None,
        client: Optional[AsyncHTTPHandler] = None,
    ) -> ImageResponse:
        # Your custom image edit logic here
        # e.g., call Stability AI, Black Forest Labs, etc.
        return ImageResponse(
            created=int(time.time()),
            data=[ImageObject(url="https://example.com/edited-image.png")],
        )

my_custom_llm = MyCustomLLM()
```


2. Add to `config.yaml`

In the config below, we pass

python_filename: `custom_handler.py`
custom_handler_instance_name: `my_custom_llm`. This is defined in Step 1

custom_handler: `custom_handler.my_custom_llm`

```yaml
model_list:
  - model_name: "my-custom-image-edit-model"
    litellm_params:
      model: "my-custom-llm/my-model"

litellm_settings:
  custom_provider_map:
  - {"provider": "my-custom-llm", "custom_handler": custom_handler.my_custom_llm}
```

```bash
litellm --config /path/to/config.yaml
```

3. Test it!

```bash
curl -X POST 'http://0.0.0.0:4000/v1/images/edits' \
-H "Authorization: Bearer $LITELLM_API_KEY" \
-F 'model=my-custom-image-edit-model' \
-F 'image=@/path/to/image.png' \
-F 'prompt=Make the sky blue'
```

Expected Response

```
{
    "created": 1721955063,
    "data": [{"url": "https://example.com/edited-image.png"}],
}
```

## Video Generation

Video jobs are asynchronous, so a custom video provider is not a `CustomLLM` handler. It is a `BaseVideoConfig` subclass that describes the HTTP requests and replies for your backend, and LiteLLM's shared HTTP client sends them. The caller gets a job id back from `POST /v1/videos` right away and polls `GET /v1/videos/{id}` until the job is done, so nothing is held open while the video renders.

1. Setup your `custom_video.py` file

The create, status and content routes call the methods at the top. The list, remix and delete methods at the bottom are abstract on `BaseVideoConfig` too, so they have to exist, and can raise `NotImplementedError` when your backend has no such call.

```python
import httpx
from litellm.llms.base_llm.videos.transformation import BaseVideoConfig
from litellm.types.videos.main import VideoObject
from litellm.types.videos.utils import encode_video_id_with_provider, extract_original_video_id


class MyVideoConfig(BaseVideoConfig):
    def get_supported_openai_params(self, model):
        return ["seconds"]

    def map_openai_params(self, video_create_optional_params, model, drop_params):
        return {k: v for k, v in video_create_optional_params.items() if k == "seconds"}

    def validate_environment(self, headers, model, api_key=None, litellm_params=None):
        key = (litellm_params.api_key if litellm_params is not None else None) or api_key or ""
        return {**headers, "X-Api-Key": key}

    def get_complete_url(self, model, api_base, litellm_params):
        return f"{api_base.rstrip('/')}/jobs"

    def transform_video_create_request(self, model, prompt, api_base, video_create_optional_request_params, litellm_params, headers):
        body = {"model": model, "prompt": prompt, "seconds": video_create_optional_request_params.get("seconds")}
        return body, [], api_base  # (json body, files, url)

    def transform_video_create_response(self, model, raw_response, logging_obj, custom_llm_provider=None, request_data=None):
        job = raw_response.json()
        video_id = encode_video_id_with_provider(job["job_id"], custom_llm_provider, model)
        return VideoObject(id=video_id, object="video", status="queued", created_at=0, model=model)

    def transform_video_status_retrieve_request(self, video_id, api_base, litellm_params, headers):
        return f"{api_base}/{extract_original_video_id(video_id)}", {}  # empty body means GET

    def transform_video_status_retrieve_response(self, raw_response, logging_obj, custom_llm_provider=None, client=None):
        job = raw_response.json()
        status = "completed" if job["state"] == "done" else "in_progress"
        return VideoObject(id=encode_video_id_with_provider(job["job_id"], custom_llm_provider), object="video", status=status, created_at=0)

    def transform_video_content_request(self, video_id, api_base, litellm_params, headers, variant=None):
        return f"{api_base}/{extract_original_video_id(video_id)}/file", {}

    def transform_video_content_response(self, raw_response, logging_obj, client=None):
        return raw_response.content

    # The list, remix and delete methods are abstract too. Raise when your backend has no such call.
    def transform_video_list_request(self, api_base, litellm_params, headers, after=None, limit=None, order=None, extra_query=None):
        return api_base, {}

    def transform_video_list_response(self, raw_response, logging_obj, custom_llm_provider=None):
        return raw_response.json()

    def transform_video_remix_request(self, video_id, prompt, api_base, litellm_params, headers, extra_body=None):
        raise NotImplementedError("remix is not supported")

    def transform_video_remix_response(self, raw_response, logging_obj, custom_llm_provider=None):
        raise NotImplementedError("remix is not supported")

    def transform_video_delete_request(self, video_id, api_base, litellm_params, headers):
        raise NotImplementedError("delete is not supported")

    def transform_video_delete_response(self, raw_response, logging_obj):
        raise NotImplementedError("delete is not supported")


my_video_config = MyVideoConfig()
```

2. Add to `config.yaml`

The provider name before the `/` in `model` is the one you register in `custom_provider_map`. `api_base` and `api_key` on the deployment reach your config through `get_complete_url` and `validate_environment`.

```yaml
model_list:
  - model_name: "my-video-model"
    litellm_params:
      model: "my-video-provider/seedance-1"
      api_base: "https://video.internal.example.com"
      api_key: os.environ/MY_VIDEO_API_KEY

litellm_settings:
  custom_provider_map:
  - {"provider": "my-video-provider", "custom_handler": custom_video.my_video_config}
```

```bash
litellm --config /path/to/config.yaml
```

3. Test it!

```bash
curl -X POST 'http://0.0.0.0:4000/v1/videos' \
-H 'Content-Type: application/json' \
-H "Authorization: Bearer $LITELLM_API_KEY" \
-d '{"model": "my-video-model", "prompt": "A cute baby sea otter", "seconds": "8"}'
```

Expected Response

```
{"id": "video_bGl0ZWxs...", "object": "video", "status": "queued", "model": "seedance-1", ...}
```

The id carries your provider name, so the status and content routes find your config without the caller saying which provider it is.

```bash
curl 'http://0.0.0.0:4000/v1/videos/video_bGl0ZWxs...' -H "Authorization: Bearer $LITELLM_API_KEY"
curl 'http://0.0.0.0:4000/v1/videos/video_bGl0ZWxs.../content' -H "Authorization: Bearer $LITELLM_API_KEY" --output video.mp4
```

A provider registered with a `CustomLLM` handler has no video methods, so a video request for it returns `400 video generation is not supported for <provider>`.

## Anthropic `/v1/messages`

- Write the integration for .acompletion
- litellm will transform it to /v1/messages

1. Setup your `custom_handler.py` file 

```python
import litellm
from litellm import CustomLLM, completion, get_llm_provider


class MyCustomLLM(CustomLLM):
    async def acompletion(self, *args, **kwargs) -> litellm.ModelResponse:
        return litellm.completion(
            model="{{openai_small}}",
            messages=[{"role": "user", "content": "Hello world"}],
            mock_response="Hi!",
        )  # type: ignore


my_custom_llm = MyCustomLLM()
```

2. Add to `config.yaml` 

In the config below, we pass

python_filename: `custom_handler.py`
custom_handler_instance_name: `my_custom_llm`. This is defined in Step 1

custom_handler: `custom_handler.my_custom_llm`

```yaml
model_list:
  - model_name: "test-model"             
    litellm_params:
      model: "openai/text-embedding-ada-002"
  - model_name: "my-custom-model"
    litellm_params:
      model: "my-custom-llm/my-model"

litellm_settings:
  custom_provider_map:
  - {"provider": "my-custom-llm", "custom_handler": custom_handler.my_custom_llm}
```

```bash
litellm --config /path/to/config.yaml
```

3. Test it! 

```bash
curl -L -X POST 'http://0.0.0.0:4000/v1/messages' \
-H 'anthropic-version: 2023-06-01' \
-H 'content-type: application/json' \
-H "Authorization: Bearer $LITELLM_API_KEY" \
-d '{
   "model": "my-custom-model",
     "max_tokens": 1024,
     "messages": [{
         "role": "user",
         "content": [
         {
             "type": "text",
             "text": "What are the key findings in this document 12?"
         }]
     }]
}'
```

Expected Response

```json
{
    "id": "chatcmpl-Bm4qEp4h4vCe7Zi4Gud1MAxTWgibO",
    "type": "message",
    "role": "assistant",
    "model": "{{openai_small}}",
    "stop_sequence": null,
    "usage": {
        "input_tokens": 18,
        "output_tokens": 44
    },
    "content": [
        {
            "type": "text",
            "text": "Without the specific document being provided, it is not possible to determine the key findings within it. If you can provide the content or a summary of document 12, I would be happy to help identify the key findings."
        }
    ],
    "stop_reason": "end_turn"
}
```


## Additional Parameters

Additional parameters are passed inside `optional_params` key in the `completion` or `image_generation` function.

Here's how to set this: 

<Tabs>
<TabItem value="sdk" label="SDK">

```python
import litellm
from litellm import CustomLLM, completion, get_llm_provider


class MyCustomLLM(CustomLLM):
    def completion(self, *args, **kwargs) -> litellm.ModelResponse:
        assert kwargs["optional_params"] == {"my_custom_param": "my-custom-param"} # CHECK HERE
        return litellm.completion(
            model="{{openai_small}}",
            messages=[{"role": "user", "content": "Hello world"}],
            mock_response="Hi!",
        )  # type: ignore

my_custom_llm = MyCustomLLM()

litellm.custom_provider_map = [ # KEY STEP - REGISTER HANDLER
        {"provider": "my-custom-llm", "custom_handler": my_custom_llm}
    ]

resp = completion(model="my-custom-llm/my-model", my_custom_param="my-custom-param")
```

</TabItem>
<TabItem value="proxy" label="Proxy">


1. Setup your `custom_handler.py` file 
```python
import litellm
from litellm import CustomLLM
from litellm.types.utils import ImageResponse, ImageObject


class MyCustomLLM(CustomLLM):
    async def aimage_generation(self, model: str, prompt: str, model_response: ImageResponse, api_key: Optional[str], api_base: Optional[str], optional_params: dict, logging_obj: Any, timeout: Optional[Union[float, httpx.Timeout]] = None, client: Optional[AsyncHTTPHandler] = None,) -> ImageResponse:
        assert optional_params == {"my_custom_param": "my-custom-param"} # CHECK HERE
        return ImageResponse(
            created=int(time.time()),
            data=[ImageObject(url="https://example.com/image.png")],
        )

my_custom_llm = MyCustomLLM()
```


2. Add to `config.yaml` 

In the config below, we pass

python_filename: `custom_handler.py`
custom_handler_instance_name: `my_custom_llm`. This is defined in Step 1

custom_handler: `custom_handler.my_custom_llm`

```yaml
model_list:
  - model_name: "test-model"             
    litellm_params:
      model: "openai/text-embedding-ada-002"
  - model_name: "my-custom-model"
    litellm_params:
      model: "my-custom-llm/my-model"
      my_custom_param: "my-custom-param" # CUSTOM PARAM

litellm_settings:
  custom_provider_map:
  - {"provider": "my-custom-llm", "custom_handler": custom_handler.my_custom_llm}
```

```bash
litellm --config /path/to/config.yaml
```

3. Test it! 

```bash
curl -X POST 'http://0.0.0.0:4000/v1/images/generations' \
-H 'Content-Type: application/json' \
-H "Authorization: Bearer $LITELLM_API_KEY" \
-d '{
    "model": "my-custom-model",
    "prompt": "A cute baby sea otter",
}'
```

</TabItem>
</Tabs>



## Custom Handler Spec

```python
from litellm.types.utils import GenericStreamingChunk, ModelResponse, ImageResponse
from typing import Iterator, AsyncIterator, Any, Optional, Union
from litellm.llms.base import BaseLLM

class CustomLLMError(Exception):  # use this for all your exceptions
    def __init__(
        self,
        status_code,
        message,
    ):
        self.status_code = status_code
        self.message = message
        super().__init__(
            self.message
        )  # Call the base class constructor with the parameters it needs

class CustomLLM(BaseLLM):
    def __init__(self) -> None:
        super().__init__()

    def completion(self, *args, **kwargs) -> ModelResponse:
        raise CustomLLMError(status_code=500, message="Not implemented yet!")

    def streaming(self, *args, **kwargs) -> Iterator[GenericStreamingChunk]:
        raise CustomLLMError(status_code=500, message="Not implemented yet!")

    async def acompletion(self, *args, **kwargs) -> ModelResponse:
        raise CustomLLMError(status_code=500, message="Not implemented yet!")

    async def astreaming(self, *args, **kwargs) -> AsyncIterator[GenericStreamingChunk]:
        raise CustomLLMError(status_code=500, message="Not implemented yet!")

    def image_generation(
        self,
        model: str,
        prompt: str,
        api_key: Optional[str],
        api_base: Optional[str],
        model_response: ImageResponse,
        optional_params: dict,
        logging_obj: Any,
        timeout: Optional[Union[float, httpx.Timeout]] = None,
        client: Optional[HTTPHandler] = None,
    ) -> ImageResponse:
        raise CustomLLMError(status_code=500, message="Not implemented yet!")

    async def aimage_generation(
        self,
        model: str,
        prompt: str,
        model_response: ImageResponse,
        api_key: Optional[str],
        api_base: Optional[str],
        optional_params: dict,
        logging_obj: Any,
        timeout: Optional[Union[float, httpx.Timeout]] = None,
        client: Optional[AsyncHTTPHandler] = None,
    ) -> ImageResponse:
        raise CustomLLMError(status_code=500, message="Not implemented yet!")

    def image_edit(
        self,
        model: str,
        image: Any,
        prompt: str,
        model_response: ImageResponse,
        api_key: Optional[str],
        api_base: Optional[str],
        optional_params: dict,
        logging_obj: Any,
        timeout: Optional[Union[float, httpx.Timeout]] = None,
        client: Optional[HTTPHandler] = None,
    ) -> ImageResponse:
        raise CustomLLMError(status_code=500, message="Not implemented yet!")

    async def aimage_edit(
        self,
        model: str,
        image: Any,
        prompt: str,
        model_response: ImageResponse,
        api_key: Optional[str],
        api_base: Optional[str],
        optional_params: dict,
        logging_obj: Any,
        timeout: Optional[Union[float, httpx.Timeout]] = None,
        client: Optional[AsyncHTTPHandler] = None,
    ) -> ImageResponse:
        raise CustomLLMError(status_code=500, message="Not implemented yet!")
```
