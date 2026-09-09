# Azure AI OCR

## Overview

| Property | Details |
|-------|-------|
| Description | Azure AI OCR provides document intelligence capabilities powered by Mistral, enabling text extraction from PDFs and images |
| Provider Route on LiteLLM | `azure_ai/` |
| Supported Operations | `/ocr` |
| Link to Provider Doc | [Azure AI ↗](https://ai.azure.com/)

Extract text from documents and images using Azure AI's OCR models, powered by Mistral.

## Quick Start

### **LiteLLM SDK**

```python showLineNumbers title="SDK Usage"
import litellm
import os

# Set environment variables
os.environ["AZURE_AI_API_KEY"] = ""
os.environ["AZURE_AI_API_BASE"] = ""

# OCR with PDF URL
response = litellm.ocr(
    model="azure_ai/mistral-document-ai-2505",
    document={
        "type": "document_url",
        "document_url": "https://example.com/document.pdf"
    }
)

# Access extracted text
for page in response.pages:
    print(page.text)
```

### **LiteLLM PROXY**

```yaml showLineNumbers title="proxy_config.yaml"
model_list:
  - model_name: azure-ocr
    litellm_params:
      model: azure_ai/mistral-document-ai-2505
      api_key: "os.environ/AZURE_AI_API_KEY"
      api_base: "os.environ/AZURE_AI_API_BASE"
    model_info:
      mode: ocr
```

## Document Types

Azure AI OCR supports both PDFs and images.

### PDF Documents

```python showLineNumbers title="PDF OCR"
response = litellm.ocr(
    model="azure_ai/mistral-document-ai-2505",
    document={
        "type": "document_url",
        "document_url": "https://example.com/document.pdf"
    }
)
```

### Image Documents

```python showLineNumbers title="Image OCR"
response = litellm.ocr(
    model="azure_ai/mistral-document-ai-2505",
    document={
        "type": "image_url",
        "image_url": "https://example.com/image.png"
    }
)
```

### Base64 Encoded Documents

```python showLineNumbers title="Base64 PDF"
import base64

# Read and encode PDF
with open("document.pdf", "rb") as f:
    pdf_base64 = base64.b64encode(f.read()).decode()

response = litellm.ocr(
    model="azure_ai/mistral-document-ai-2505",
    document={
        "type": "document_url",
        "document_url": f"data:application/pdf;base64,{pdf_base64}"
    }
)
```

## Supported Parameters

```python showLineNumbers title="All Parameters"
response = litellm.ocr(
    model="azure_ai/mistral-document-ai-2505",
    document={                           # Required: Document to process
        "type": "document_url",
        "document_url": "https://..."
    },
    include_image_base64=True,           # Optional: Include base64 images
    pages=[0, 1, 2],                     # Optional: Specific pages to process
    image_limit=10                       # Optional: Limit number of images
)
```

## Response Format

```python showLineNumbers title="Response Structure"
# Response has the following structure
response.pages          # List of pages with extracted text
response.model          # Model used
response.object         # "ocr"
response.usage_info     # Token usage information

# Access page content
for page in response.pages:
    print(f"Page {page.page_number}:")
    print(page.text)
```

## Async Support

```python showLineNumbers title="Async Usage"
import litellm

response = await litellm.aocr(
    model="azure_ai/mistral-document-ai-2505",
    document={
        "type": "document_url",
        "document_url": "https://example.com/document.pdf"
    }
)
```

## Important Notes

:::info URL Conversion
Azure AI OCR endpoints don't have internet access. LiteLLM automatically converts public URLs to base64 data URIs before sending requests to Azure AI.
:::

## Cohere Parse

LiteLLM supports Cohere Parse v5 through Azure AI Foundry with the `azure_ai/Cohere-parse-v5` route. Set `AZURE_AI_API_KEY` and `AZURE_AI_API_BASE`, for example `https://<resource>.services.ai.azure.com/models`. LiteLLM rewrites this base URL to `/providers/cohere/v2/parse`

### LiteLLM SDK

```python showLineNumbers title="Cohere Parse SDK Usage"
import litellm
import os

os.environ["AZURE_AI_API_KEY"] = "your Azure AI key"
os.environ["AZURE_AI_API_BASE"] = "https://<resource>.services.ai.azure.com/models"

response = litellm.ocr(
    model="azure_ai/Cohere-parse-v5",
    document={
        "type": "image_url",
        "image_url": "https://example.com/image.png",
    },
    output_format="markdown",
)
```

### LiteLLM Proxy

```yaml showLineNumbers title="proxy_config.yaml"
model_list:
  - model_name: cohere-parse-v5
    litellm_params:
      model: azure_ai/Cohere-parse-v5
      api_key: "os.environ/AZURE_AI_API_KEY"
      api_base: "os.environ/AZURE_AI_API_BASE"
    model_info:
      mode: ocr
```

The `azure_ai` provider fronts several OCR backends and picks one from the model name in `litellm_params.model`. Any name containing both `cohere` and `parse`, case-insensitively, routes to Cohere Parse, so a custom Foundry deployment name works as long as it contains both strings. A name missing either string falls through to the Mistral OCR route and fails against a Cohere endpoint, so keep `litellm_params.model` as `azure_ai/Cohere-parse-v5` if your deployment is named differently; the `model_name` alias can be anything

Cohere Parse accepts image inputs only. Use an `image_url` document with an image URL or a base64 image data URI. `document_url` and PDF inputs raise an error. Local image files passed with `{"type": "file", ...}` are converted to data URIs by LiteLLM

Foundry cannot fetch external image URLs, so LiteLLM downloads remote images and inlines them as base64 data URIs before sending the request. The response uses the standard OCR format with `pages[].index`, `pages[].markdown`, `pages[].images`, and `usage_info.pages_processed`

## Supported Models

- `mistral-document-ai-2505` - Latest Mistral OCR model on Azure AI
- `Cohere-parse-v5` - Cohere Parse v5 OCR model on Azure AI

Use the Azure AI provider prefix: `azure_ai/<model-name>`
