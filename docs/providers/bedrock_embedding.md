# Bedrock Embedding

## Supported Embedding Models

| Provider | LiteLLM Route | AWS Documentation | Cost Tracking |
|----------|---------------|-------------------|---------------|
| Amazon Titan | `bedrock/amazon.titan-*` | [Amazon Titan Embeddings](https://docs.aws.amazon.com/bedrock/latest/userguide/titan-embedding-models.html) | ✅ |
| Amazon Nova | `bedrock/amazon.nova-*` | [Amazon Nova Embeddings](https://docs.aws.amazon.com/bedrock/latest/userguide/nova-embed.html) | ✅ |
| Cohere | `bedrock/cohere.*` | [Cohere Embeddings](https://docs.aws.amazon.com/bedrock/latest/userguide/model-parameters-cohere-embed.html) | ✅ |
| TwelveLabs | `bedrock/twelvelabs.*`, `bedrock/us.twelvelabs.*`, `bedrock/eu.twelvelabs.*` | [TwelveLabs](https://docs.aws.amazon.com/bedrock/latest/userguide/model-parameters-twelvelabs.html), [Marengo Embed 3.0](https://docs.aws.amazon.com/bedrock/latest/userguide/model-parameters-marengo-3.html) | ✅ |

## Async Invoke Support

LiteLLM supports AWS Bedrock's async-invoke feature for embedding models that require asynchronous processing, particularly useful for large media files (video, audio) or when you need to process embeddings in the background.

### Supported Models

| Provider | Async Invoke Route | Use Case |
|----------|-------------------|----------|
| Amazon Nova | `bedrock/async_invoke/amazon.nova-2-multimodal-embeddings-v1:0` | Multimodal embeddings with segmentation for long text, video, and audio |
| TwelveLabs Marengo Embed 2.7 | `bedrock/async_invoke/twelvelabs.marengo-embed-2-7-v1:0` | Video, audio, image, and text embeddings |
| TwelveLabs Marengo Embed 3.0 | `bedrock/async_invoke/twelvelabs.marengo-embed-3-0-v1:0` | Video and audio embeddings (text and image run synchronously, see [Marengo Embed 3.0](#twelvelabs-marengo-embed-30)) |

### Required Parameters

Bedrock's async invoke only accepts base model ids, so use `twelvelabs.marengo-embed-2-7-v1:0` or `twelvelabs.marengo-embed-3-0-v1:0` here rather than a `us.` or `eu.` inference profile, which Bedrock rejects with `The provided model doesn't support async inference`

When using async-invoke, you must provide:

| Parameter | Description | Required |
|-----------|-------------|----------|
| `output_s3_uri` | S3 URI where the embedding results will be stored | ✅ Yes |
| `input_type` | Type of input: `"text"`, `"image"`, `"video"`, or `"audio"` (Marengo Embed 3.0 also takes `"text_image"` and `"multi_input"`) | ✅ Yes |
| `aws_region_name` | AWS region for the request | ✅ Yes |

### Usage

#### Basic Async Invoke

```python
from litellm import embedding

# Text embedding with async-invoke
response = embedding(
    model="bedrock/async_invoke/twelvelabs.marengo-embed-2-7-v1:0",
    input=["Hello world from LiteLLM async invoke!"],
    aws_region_name="us-east-1",
    input_type="text",
    output_s3_uri="s3://your-bucket/async-invoke-output/"
)

print(f"Job submitted! Invocation ARN: {response._hidden_params._invocation_arn}")
```

#### Video/Audio Embedding

```python
# Video embedding (requires async-invoke)
response = embedding(
    model="bedrock/async_invoke/twelvelabs.marengo-embed-2-7-v1:0",
    input=["s3://your-bucket/video.mp4"],  # S3 URL for video
    aws_region_name="us-east-1",
    input_type="video",
    output_s3_uri="s3://your-bucket/async-invoke-output/"
)

print(f"Video embedding job submitted! ARN: {response._hidden_params._invocation_arn}")
```

#### Image Embedding with Base64

```python
import base64

# Load and encode image
with open("image.jpg", "rb") as img_file:
    img_data = base64.b64encode(img_file.read()).decode('utf-8')
    img_base64 = f"data:image/jpeg;base64,{img_data}"

response = embedding(
    model="bedrock/async_invoke/twelvelabs.marengo-embed-2-7-v1:0",
    input=[img_base64],
    aws_region_name="us-east-1",
    input_type="image",
    output_s3_uri="s3://your-bucket/async-invoke-output/"
)
```

### Retrieving Job Information

#### Getting Job ID and Invocation ARN

The async-invoke response includes the invocation ARN in the hidden parameters:

```python
response = embedding(
    model="bedrock/async_invoke/twelvelabs.marengo-embed-2-7-v1:0",
    input=["Hello world"],
    aws_region_name="us-east-1",
    input_type="text",
    output_s3_uri="s3://your-bucket/async-invoke-output/"
)

# Access invocation ARN
invocation_arn = response._hidden_params._invocation_arn
print(f"Invocation ARN: {invocation_arn}")

# Extract job ID from ARN (last part after the last slash)
job_id = invocation_arn.split("/")[-1]
print(f"Job ID: {job_id}")
```

#### Checking Job Status

Use LiteLLM's `retrieve_batch` function to check if your job is still processing:

```python
from litellm import retrieve_batch

def check_async_job_status(invocation_arn, aws_region_name="us-east-1"):
    """Check the status of an async invoke job using LiteLLM batch API"""
    try:
        response = retrieve_batch(
            batch_id=invocation_arn,  # Pass the invocation ARN here
            custom_llm_provider="bedrock",
            aws_region_name=aws_region_name
        )
        return response
    except Exception as e:
        print(f"Error checking job status: {e}")
        return None

# Check status
status = check_async_job_status(invocation_arn, "us-east-1")
if status:
    print(f"Job Status: {status.status}")  # "in_progress", "completed", or "failed"
    print(f"Output Location: {status.metadata['output_file_id']}")  # S3 URI where results are stored
```

#### Polling Until Complete

Here's a complete example of polling for job completion:

```python
def wait_for_async_job(invocation_arn, aws_region_name="us-east-1", max_wait=3600):
    """Poll job status until completion"""
    start_time = time.time()
    
    while True:
        status = retrieve_batch(
            batch_id=invocation_arn,
            custom_llm_provider="bedrock",
            aws_region_name=aws_region_name,
        )
        
        if status.status == "completed":
            print("✅ Job completed!")
            return status
        elif status.status == "failed":
            error_msg = status.metadata.get('failure_message', 'Unknown error')
            raise Exception(f"❌ Job failed: {error_msg}")
        else:
            elapsed = time.time() - start_time
            if elapsed > max_wait:
                raise TimeoutError(f"Job timed out after {max_wait} seconds")
            
            print(f"⏳ Job still processing... (elapsed: {elapsed:.0f}s)")
            time.sleep(10)  # Wait 10 seconds before checking again

# Wait for completion
completed_status = wait_for_async_job(invocation_arn)
output_s3_uri = completed_status.metadata['output_file_id']
print(f"Results available at: {output_s3_uri}")
```

**Note:** The actual embedding results are stored in S3. When the job is completed, download the results from the S3 location specified in `status.metadata['output_file_id']`. The results will be in JSON/JSONL format containing the embedding vectors.

## TwelveLabs Marengo Embed 3.0

Marengo Embed 3.0 (`twelvelabs.marengo-embed-3-0-v1:0`, with the `us.` and `eu.` inference profiles for us-east-1 and eu-west-1) returns 512-dimensional vectors and takes text of up to 500 tokens. Text, image, text plus image, and multi-image inputs run synchronously through `bedrock/<model id>`; video and audio go through `bedrock/async_invoke/twelvelabs.marengo-embed-3-0-v1:0` with an `output_s3_uri`, using the base model id because Bedrock's async invoke rejects inference profiles. 3.0 sends Bedrock a different request body than 2.7, and LiteLLM builds it from the same `input_type` parameter, so moving from 2.7 (scheduled for deprecation on 2026-11-30) is a model id change

### Input types

| `input_type` | `input` | Extra parameters |
|--------------|---------|------------------|
| `text` (default) | The text to embed | |
| `image` | A base64 image or an `s3://` uri | |
| `text_image` | The text | `media_source`: a base64 image or an `s3://` uri |
| `multi_input` | The text, referencing each image as `<@name>` | `media_sources`: a mapping of name to base64 image or `s3://` uri |
| `video`, `audio` | An `s3://` uri or base64 media, async invoke only | `startSec`, `endSec`, `segmentation`, `embeddingOption`, `embeddingType`, `embeddingScope`, as documented by [AWS](https://docs.aws.amazon.com/bedrock/latest/userguide/model-parameters-marengo-3.html) |

`inferenceId` and `bucketOwner` (for an `s3://` uri owned by another account) are passed through on every input type. A `text_image` request without `media_source`, or a `multi_input` request without `media_sources`, is rejected with a 400 naming the missing parameter. Marengo 2.7's `textTruncate`, `lengthSec`, `useFixedLengthSec`, and `minClipSec`, and the video and audio options on any other input type, are rejected with a 400 on 3.0 unless `drop_params` is set, which drops them instead

### Proxy config

```yaml
model_list:
  - model_name: marengo-3
    litellm_params:
      model: bedrock/us.twelvelabs.marengo-embed-3-0-v1:0
      aws_region_name: us-east-1
  - model_name: marengo-3-async
    litellm_params:
      model: bedrock/async_invoke/twelvelabs.marengo-embed-3-0-v1:0
      aws_region_name: us-east-1
```

### Text

```bash
curl http://0.0.0.0:4000/v1/embeddings \
  -H "Authorization: Bearer $LITELLM_API_KEY" -H "Content-Type: application/json" \
  -d '{"model": "marengo-3", "input": "a dog running on the beach", "input_type": "text"}'
```

### Image

```bash
curl http://0.0.0.0:4000/v1/embeddings \
  -H "Authorization: Bearer $LITELLM_API_KEY" -H "Content-Type: application/json" \
  -d '{"model": "marengo-3", "input": "<base64 image>", "input_type": "image"}'
```

### Text plus image

```bash
curl http://0.0.0.0:4000/v1/embeddings \
  -H "Authorization: Bearer $LITELLM_API_KEY" -H "Content-Type: application/json" \
  -d '{"model": "marengo-3", "input": "a duck", "input_type": "text_image", "media_source": "s3://your-bucket/duck.png"}'
```

### Multiple images

```bash
curl http://0.0.0.0:4000/v1/embeddings \
  -H "Authorization: Bearer $LITELLM_API_KEY" -H "Content-Type: application/json" \
  -d '{"model": "marengo-3", "input": "a photo of <@bird> on water", "input_type": "multi_input", "media_sources": {"bird": "<base64 image>"}}'
```

### Video through async invoke

```python
from litellm import embedding

response = embedding(
    model="bedrock/async_invoke/twelvelabs.marengo-embed-3-0-v1:0",
    input=["s3://your-bucket/video.mp4"],
    aws_region_name="us-east-1",
    input_type="video",
    embeddingOption=["visual", "audio"],
    segmentation={"method": "fixed", "fixed": {"durationSec": 10}},
    output_s3_uri="s3://your-bucket/async-invoke-output/",
)
print(response._hidden_params._invocation_arn)
```

## Amazon Nova Multimodal Embeddings

Amazon Nova supports multimodal embeddings for text, images, video, and audio. It offers flexible embedding dimensions and purposes optimized for different use cases.

### Supported Features

- **Modalities**: Text, Image, Video, Audio
- **Dimensions**: 256, 384, 1024, 3072 (default: 3072)
- **Embedding Purposes**: 
  - `GENERIC_INDEX` (default)
  - `GENERIC_RETRIEVAL`
  - `TEXT_RETRIEVAL`
  - `IMAGE_RETRIEVAL`
  - `VIDEO_RETRIEVAL`
  - `AUDIO_RETRIEVAL`
  - `CLASSIFICATION`
  - `CLUSTERING`

### Text Embedding

```python
from litellm import embedding

response = embedding(
    model="bedrock/amazon.nova-2-multimodal-embeddings-v1:0",
    input=["Hello, world!"],
    aws_region_name="us-east-1",
    dimensions=1024,  # Optional: 256, 384, 1024, or 3072
)

print(response.data[0].embedding)
```

### Image Embedding with Base64

Amazon Nova accepts images in base64 format using the standard data URL format:

```python
import base64
from litellm import embedding

# Method 1: Load image from file
with open("image.jpg", "rb") as image_file:
    image_data = base64.b64encode(image_file.read()).decode('utf-8')
    # Create data URL with proper format
    image_base64 = f"data:image/jpeg;base64,{image_data}"

response = embedding(
    model="bedrock/amazon.nova-2-multimodal-embeddings-v1:0",
    input=[image_base64],
    aws_region_name="us-east-1",
    dimensions=1024,
)

print(f"Image embedding: {response.data[0].embedding[:10]}...")  # First 10 dimensions
```

#### Supported Image Formats

Nova supports the following image formats:
- JPEG: `data:image/jpeg;base64,...`
- PNG: `data:image/png;base64,...`
- GIF: `data:image/gif;base64,...`
- WebP: `data:image/webp;base64,...`

#### Complete Example with Error Handling

```python
import base64
from litellm import embedding

def get_image_embedding(image_path, dimensions=1024):
    """
    Get embedding for an image file.
    
    Args:
        image_path: Path to the image file
        dimensions: Embedding dimension (256, 384, 1024, or 3072)
    
    Returns:
        List of embedding values
    """
    try:
        # Determine image format from file extension
        if image_path.lower().endswith('.png'):
            mime_type = "image/png"
        elif image_path.lower().endswith(('.jpg', '.jpeg')):
            mime_type = "image/jpeg"
        elif image_path.lower().endswith('.gif'):
            mime_type = "image/gif"
        elif image_path.lower().endswith('.webp'):
            mime_type = "image/webp"
        else:
            raise ValueError(f"Unsupported image format: {image_path}")
        
        # Read and encode image
        with open(image_path, "rb") as image_file:
            image_data = base64.b64encode(image_file.read()).decode('utf-8')
            image_base64 = f"data:{mime_type};base64,{image_data}"
        
        # Get embedding
        response = embedding(
            model="bedrock/amazon.nova-2-multimodal-embeddings-v1:0",
            input=[image_base64],
            aws_region_name="us-east-1",
            dimensions=dimensions,
        )
        
        return response.data[0].embedding
        
    except Exception as e:
        print(f"Error getting image embedding: {e}")
        raise

# Example usage
image_embedding = get_image_embedding("photo.jpg", dimensions=1024)
print(f"Got embedding with {len(image_embedding)} dimensions")
```

### Error Handling

#### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `ValueError: output_s3_uri cannot be empty` | Missing S3 output URI | Provide a valid S3 URI |
| `ValueError: Input type 'video' requires async_invoke route` | Using video/audio without async-invoke | Use `bedrock/async_invoke/` model prefix |
| `ValueError: input_type is required` | Missing input type parameter | Specify `input_type` parameter |

#### Example Error Handling

```python
try:
    response = embedding(
        model="bedrock/async_invoke/twelvelabs.marengo-embed-2-7-v1:0",
        input=["Hello world"],
        aws_region_name="us-east-1",
        input_type="text",
        output_s3_uri="s3://your-bucket/output/"  # Required for async-invoke
    )
    print("Job submitted successfully!")
    
except ValueError as e:
    if "output_s3_uri cannot be empty" in str(e):
        print("Error: Please provide a valid S3 output URI")
    elif "requires async_invoke route" in str(e):
        print("Error: Use async_invoke model for video/audio inputs")
    else:
        print(f"Error: {e}")
except Exception as e:
    print(f"Unexpected error: {e}")
```

### Best Practices

1. **Use async-invoke for large files**: Video and audio files are better processed asynchronously
2. **Use LiteLLM batch API**: Use `retrieve_batch()` instead of direct Bedrock API calls for status checking
3. **Monitor job status**: Check job status periodically using the batch API to know when results are ready
4. **Handle errors gracefully**: Implement proper error handling for network issues and job failures
5. **Set appropriate timeouts**: Consider the processing time for large files
6. **Use S3 for large inputs**: For video/audio, use S3 URLs instead of base64 encoding

### Limitations

- Async-invoke is supported for TwelveLabs Marengo and Amazon Nova models
- Results are stored in S3 and must be retrieved separately using the output file ID
- Job status checking requires using LiteLLM's `retrieve_batch()` function
- No built-in polling mechanism in LiteLLM (must implement your own status checking loop)

### API keys
This can be set as env variables or passed as **params to litellm.embedding()**
```python
import os
os.environ["AWS_ACCESS_KEY_ID"] = ""        # Access key
os.environ["AWS_SECRET_ACCESS_KEY"] = ""    # Secret access key
os.environ["AWS_REGION_NAME"] = ""           # us-east-1, us-east-2, us-west-1, us-west-2
```

## Usage
### LiteLLM Python SDK
```python
from litellm import embedding
response = embedding(
    model="bedrock/amazon.titan-embed-text-v1",
    input=["good morning from litellm"],
)
print(response)
```

### LiteLLM Proxy Server

#### 1. Setup config.yaml
```yaml
model_list:
  - model_name: titan-embed-v1
    litellm_params:
      model: bedrock/amazon.titan-embed-text-v1
      aws_access_key_id: os.environ/AWS_ACCESS_KEY_ID
      aws_secret_access_key: os.environ/AWS_SECRET_ACCESS_KEY
      aws_region_name: us-east-1
  - model_name: titan-embed-v2
    litellm_params:
      model: bedrock/amazon.titan-embed-text-v2:0
      aws_access_key_id: os.environ/AWS_ACCESS_KEY_ID
      aws_secret_access_key: os.environ/AWS_SECRET_ACCESS_KEY
      aws_region_name: us-east-1
```

#### 2. Start Proxy 
```bash
litellm --config /path/to/config.yaml
```

#### 3. Use with OpenAI Python SDK
```python
import openai
client = openai.OpenAI(
    api_key="anything",
    base_url="http://0.0.0.0:4000"
)

response = client.embeddings.create(
    input=["good morning from litellm"],
    model="titan-embed-v1"
)
print(response)
```

#### 4. Use with LiteLLM Python SDK
```python
import litellm
response = litellm.embedding(
    model="titan-embed-v1", # model alias from config.yaml
    input=["good morning from litellm"],
    api_base="http://0.0.0.0:4000",
    api_key="anything"
)
print(response)
```

## Supported AWS Bedrock Embedding Models

| Model Name           | Usage                               | Supported Additional OpenAI params |
|----------------------|---------------------------------------------|-----|
| **Amazon Nova Multimodal Embeddings** | `embedding(model="bedrock/amazon.nova-2-multimodal-embeddings-v1:0", input=input)` | Supports multimodal input (text, image, video, audio), multiple purposes, dimensions (256, 384, 1024, 3072) |
| Titan Embeddings V2 | `embedding(model="bedrock/amazon.titan-embed-text-v2:0", input=input)` | [here](https://github.com/BerriAI/litellm/blob/f5905e100068e7a4d61441d7453d7cf5609c2121/litellm/llms/bedrock/embed/amazon_titan_v2_transformation.py#L59) |
| Titan Embeddings - V1 | `embedding(model="bedrock/amazon.titan-embed-text-v1", input=input)` | [here](https://github.com/BerriAI/litellm/blob/f5905e100068e7a4d61441d7453d7cf5609c2121/litellm/llms/bedrock/embed/amazon_titan_g1_transformation.py#L53)
| Titan Multimodal Embeddings | `embedding(model="bedrock/amazon.titan-embed-image-v1", input=input)` | [here](https://github.com/BerriAI/litellm/blob/f5905e100068e7a4d61441d7453d7cf5609c2121/litellm/llms/bedrock/embed/amazon_titan_multimodal_transformation.py#L28) |
| TwelveLabs Marengo Embed 2.7 | `embedding(model="bedrock/us.twelvelabs.marengo-embed-2-7-v1:0", input=input)` | Supports multimodal input (text, video, audio, image) |
| TwelveLabs Marengo Embed 3.0 | `embedding(model="bedrock/us.twelvelabs.marengo-embed-3-0-v1:0", input=input)` | Text, image, `text_image`, and `multi_input` synchronously, video and audio through async invoke, 512 dimensions |
| Cohere Embeddings - English | `embedding(model="bedrock/cohere.embed-english-v3", input=input)` | [here](https://github.com/BerriAI/litellm/blob/f5905e100068e7a4d61441d7453d7cf5609c2121/litellm/llms/bedrock/embed/cohere_transformation.py#L18)
| Cohere Embeddings - Multilingual | `embedding(model="bedrock/cohere.embed-multilingual-v3", input=input)` | [here](https://github.com/BerriAI/litellm/blob/f5905e100068e7a4d61441d7453d7cf5609c2121/litellm/llms/bedrock/embed/cohere_transformation.py#L18)
| Cohere Embed v4 | `embedding(model="bedrock/cohere.embed-v4:0", input=input)` | Supports text and image input, configurable dimensions (256, 512, 1024, 1536), 128k context length |

### Advanced - [Drop Unsupported Params](https://docs.litellm.ai/docs/completion/drop_params#openai-proxy-usage)

### Advanced - [Pass model/provider-specific Params](https://docs.litellm.ai/docs/completion/provider_specific_params#proxy-usage)