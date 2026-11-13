---
title: "Topaz Image Variations API with LiteLLM"
sidebar_label: "Topaz"
description: "Call the Topaz Labs enhance API via LiteLLM's image_variation() with the topaz/ prefix. Set TOPAZ_API_KEY and pass response_format and size for each image."
---

# Topaz

| Property | Details |
|-------|-------|
| Description | Professional-grade photo and video editing powered by AI. |
| Provider Route on LiteLLM | `topaz/` |
| Provider Doc | [Topaz ↗](https://www.topazlabs.com/enhance-api) |
| API Endpoint for Provider | https://api.topazlabs.com |
| Supported OpenAI Endpoints | `/image/variations` |


## Quick Start

```python
from litellm import image_variation
import os 

os.environ["TOPAZ_API_KEY"] = ""
response = image_variation(
    model="topaz/Standard V2", image=image_url
)
```

## Supported OpenAI Params

- `response_format`
- `size` (widthxheight)
