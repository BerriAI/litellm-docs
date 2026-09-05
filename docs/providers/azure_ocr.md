# Azure AI OCR (Mistral, Cohere Parse)

## Overview

| Property | Details |
|-------|-------|
| Description | Azure AI OCR provides document intelligence capabilities powered by Mistral and Cohere Parse, enabling text extraction from PDFs and images |
| Provider Route on LiteLLM | `azure_ai/` |
| Supported Operations | `/ocr` |
| Link to Provider Doc | [Azure AI ↗](https://ai.azure.com/)

Extract text from documents and images using Azure AI's OCR models, powered by Mistral. Cohere Parse deployments are covered [below](#cohere-parse).

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

Azure AI Foundry also serves [Cohere Parse](https://ai.azure.com/catalog/models/Cohere-parse-v5) through the same `/ocr` endpoint. Use `azure_ai/<deployment name>`: any deployment whose name contains `parse` is sent to the Cohere Parse API on your Foundry resource, at `{api_base}/providers/cohere/v2/parse`.

Parse accepts `image_url` documents only, an image URL or a base64 `data:image/...` URI. PDFs and `document_url` inputs are rejected with a 400 before anything is sent to Azure. Foundry cannot fetch external URLs, so LiteLLM downloads a remote image and sends it inline as a data URI, the same conversion it applies for the Mistral models above.

### **LiteLLM SDK**

```python showLineNumbers title="Cohere Parse on Azure AI"
import litellm
import os

os.environ["AZURE_AI_API_KEY"] = ""
os.environ["AZURE_AI_API_BASE"] = "https://<resource>.services.ai.azure.com"

response = litellm.ocr(
    model="azure_ai/Cohere-parse-v5",
    document={
        "type": "image_url",
        "image_url": "https://raw.githubusercontent.com/mistralai/cookbook/refs/heads/main/mistral/ocr/receipt.png",
    },
    output_format="markdown",
)

for page in response.pages:
    print(page.markdown)
print(response.usage_info.pages_processed)
```

### **LiteLLM PROXY**

```yaml showLineNumbers title="proxy_config.yaml"
model_list:
  - model_name: azure-cohere-parse
    litellm_params:
      model: azure_ai/Cohere-parse-v5
      api_key: "os.environ/AZURE_AI_API_KEY"
      api_base: "os.environ/AZURE_AI_API_BASE"
```

```bash showLineNumbers title="Test request"
curl http://0.0.0.0:4000/v1/ocr \
  -H "Authorization: Bearer sk-1234" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "azure-cohere-parse",
    "document": {
      "type": "image_url",
      "image_url": "https://raw.githubusercontent.com/mistralai/cookbook/refs/heads/main/mistral/ocr/receipt.png"
    }
  }'
```

`output_format` accepts `markdown` (default) or `blocks`, and `req_format: native` returns Cohere's own response body instead of the LiteLLM OCR shape. Cost tracking bills `usage_info.pages_processed` at the per-page price in the model cost map.

## Supported Models

- `mistral-document-ai-2505` - Latest Mistral OCR model on Azure AI
- `Cohere-parse-v5` - Cohere Parse, image documents only

Use the Azure AI provider prefix: `azure_ai/<model-name>`

