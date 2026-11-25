---
title: "Gemini Multimodal File Inspection with LiteLLM"
sidebar_label: "Multimodal File Inspection"
description: "Use Gemini Multimodal File Inspection through LiteLLM: slice PDFs, Office files, spreadsheets, audio and video by page, sheet, cell range or time segment on the generateContent, Interactions and /gemini passthrough routes."
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Gemini Multimodal File Inspection

<SinceVersion v="1.80.11" />

Gemini Multimodal File Inspection allows you to send just a portion of a file to the model: a page range of a PDF or Office document, a slide range of a presentation, a worksheet or cell range of a workbook, or a time segment of an audio or video file. Gemini can also natively read Microsoft Office and OpenDocument files and only charges for the tokens in the slice you send.

[Official Gemini document processing documentation](https://aistudio.google.com/docs/document-processing)

## Supported routes

LiteLLM proxy just passes the slice fields through unchanged on the routes that use Gemini's own request format. Write the request out exactly as Google specify and point it at the proxy.

| Route | Proxy path | Slicing fields |
|-------|-----------|----------------|
| [generateContent](../../generateContent.md) | `/v1beta/models/{model}:generateContent` and `:streamGenerateContent` | `documentMetadata`, `spreadsheetMetadata`, `videoMetadata`, `audioMetadata`, `mediaResolution` on a `fileData` part |
| [Interactions](../../interactions.md) | `/v1beta/interactions` | `processing` on a `document`, `video` or `audio` input block |
| [Google AI Studio passthrough](../../pass_through/google_ai_studio.md) | `/gemini/v1beta/...` | Either of the above, it depends on which Google endpoint you're calling |

Each route returns the same input token count as a direct call to Google and LiteLLM calculates spend from that usage. The examples on this page were all run against LiteLLM `v1.110.2`.

Slicing through the OpenAI compatible `/v1/chat/completions` route is not covered on this page. Use one of the routes listed above.

## Setup

Add a Gemini model to your proxy config and get the proxy going.

```yaml title="config.yaml"
model_list:
  - model_name: gemini-4-hydrogen
    litellm_params:
      model: gemini/gemini-4-hydrogen
      api_key: os.environ/GEMINI_API_KEY
```

```bash
litellm --config config.yaml
```

Upload the file via the [Gemini Files API](https://aistudio.google.com/docs/files) and use the returned file URI in the examples below. Google state that slicing works on Gemini 3 and Gemini 4 models.

## Slice pages or slides

Use these fields for PDFs (`.pdf`), documents (`.docx`, `.doc`, `.dotx`, `.odt`) and presentations (`.pptx`, `.ppt`, `.odp`). Pages and slides are 1-indexed and both ends of the range are inclusive.

<Tabs>
<TabItem value="interactions" label="Interactions">

```bash
curl -X POST "http://localhost:4000/v1beta/interactions" \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gemini-4-hydrogen",
    "input": [
      {
        "type": "document",
        "uri": "https://generativelanguage.googleapis.com/v1beta/files/FILE_ID",
        "mime_type": "application/pdf",
        "resolution": "high",
        "processing": {
          "type": "static",
          "page_options": {
            "start_page": 3,
            "end_page": 4,
            "content_layers": ["page_image"]
          }
        }
      },
      {"type": "text", "text": "Summarize the chart and footnotes on pages 3 and 4."}
    ]
  }'
```

</TabItem>
<TabItem value="generate-content" label="generateContent">

```bash
curl -X POST "http://localhost:4000/v1beta/models/gemini-4-hydrogen:generateContent" \
  -H "x-goog-api-key: $LITELLM_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "contents": [{
      "role": "user",
      "parts": [
        {
          "fileData": {
            "fileUri": "https://generativelanguage.googleapis.com/v1beta/files/FILE_ID",
            "mimeType": "application/pdf"
          },
          "documentMetadata": {
            "startPage": 3,
            "endPage": 4,
            "contentLayers": ["PAGE_IMAGE"]
          },
          "mediaResolution": {"level": "MEDIA_RESOLUTION_HIGH"}
        },
        {"text": "Summarize the chart and footnotes on pages 3 and 4."}
      ]
    }]
  }'
```

</TabItem>
<TabItem value="passthrough" label="/gemini passthrough">

```bash
curl -X POST "http://localhost:4000/gemini/v1beta/models/gemini-4-hydrogen:generateContent" \
  -H "x-goog-api-key: $LITELLM_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "contents": [{
      "role": "user",
      "parts": [
        {
          "fileData": {
            "fileUri": "https://generativelanguage.googleapis.com/v1beta/files/FILE_ID",
            "mimeType": "application/pdf"
          },
          "documentMetadata": {"startPage": 3, "endPage": 4}
        },
        {"text": "Summarize the chart and footnotes on pages 3 and 4."}
      ]
    }]
  }'
```

The passthrough will also take the Interactions body at `/gemini/v1beta/interactions`.

</TabItem>
</Tabs>

| generateContent | Interactions | Meaning |
|-----------------|--------------|---------|
| `documentMetadata.startPage` | `processing.page_options.start_page` | First page or slide to send |
| `documentMetadata.endPage` | `processing.page_options.end_page` | Last page or slide to send |
| `documentMetadata.contentLayers` | `processing.page_options.content_layers` | `PAGE_IMAGE` / `page_image` (rendered pages), `PAGE_TEXT` / `page_text` (extracted text), or both |
| `mediaResolution.level` | `resolution` on the `document` block | Detail level of the rendered page images |

For an Office file, change the MIME type and leave the fields as they are. A `.pptx` deck uses `application/vnd.openxmlformats-officedocument.presentationml.presentation` and `startPage`/`endPage` select the slides.

## Slice a worksheet or cell range

Use these fields for spreadsheets (`.xlsx`, `.xls`, `.ods`). `sheetIndex` is the 1-indexed position of the worksheet in tab order and `visibleCells` is an A1 cell or range.

<Tabs>
<TabItem value="interactions" label="Interactions">

```bash
curl -X POST "http://localhost:4000/v1beta/interactions" \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gemini-4-hydrogen",
    "input": [
      {
        "type": "document",
        "uri": "https://generativelanguage.googleapis.com/v1beta/files/WORKBOOK_FILE_ID",
        "mime_type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "processing": {
          "type": "static",
          "spreadsheet_options": {
            "sheet_index": 2,
            "visible_cells": "A1:H50",
            "content_layers": ["data", "formulas"]
          }
        }
      },
      {"type": "text", "text": "List the formulas in this range and what each one computes."}
    ]
  }'
```

</TabItem>
<TabItem value="generate-content" label="generateContent">

```bash
curl -X POST "http://localhost:4000/v1beta/models/gemini-4-hydrogen:generateContent" \
  -H "x-goog-api-key: $LITELLM_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "contents": [{
      "role": "user",
      "parts": [
        {
          "fileData": {
            "fileUri": "https://generativelanguage.googleapis.com/v1beta/files/WORKBOOK_FILE_ID",
            "mimeType": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          },
          "spreadsheetMetadata": {
            "sheetIndex": 2,
            "visibleCells": "A1:H50",
            "contentLayers": ["DATA", "FORMULAS"]
          }
        },
        {"text": "List the formulas in this range and what each one computes."}
      ]
    }]
  }'
```

</TabItem>
</Tabs>

| generateContent | Interactions | Meaning |
|-----------------|--------------|---------|
| `spreadsheetMetadata.sheetIndex` | `processing.spreadsheet_options.sheet_index` | Worksheet to send. Omit it to send every sheet |
| `spreadsheetMetadata.visibleCells` | `processing.spreadsheet_options.visible_cells` | Cell or range to crop to, such as `A1:H50` |
| `spreadsheetMetadata.contentLayers` | `processing.spreadsheet_options.content_layers` | `DATA` / `data` (cell values), `FORMULAS` / `formulas` (raw formulas), `VISUAL` / `visual` (rendered snapshot) |

## Slice a video or audio segment

Offsets are strings of seconds ending in `s` (e.g. `"10s"`, `"10.5s"`).

<Tabs>
<TabItem value="interactions" label="Interactions">

```bash
curl -X POST "http://localhost:4000/v1beta/interactions" \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gemini-4-hydrogen",
    "input": [
      {
        "type": "video",
        "uri": "https://generativelanguage.googleapis.com/v1beta/files/VIDEO_FILE_ID",
        "mime_type": "video/mp4",
        "processing": {
          "type": "static",
          "start_offset": "10s",
          "end_offset": "20s"
        }
      },
      {"type": "text", "text": "Describe what happens in this segment."}
    ]
  }'
```

For audio use `"type": "audio"` with the audio MIME type (e.g. `audio/mpeg`) and the same `processing` offsets.

</TabItem>
<TabItem value="generate-content" label="generateContent">

```bash
curl -X POST "http://localhost:4000/v1beta/models/gemini-4-hydrogen:generateContent" \
  -H "x-goog-api-key: $LITELLM_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "contents": [{
      "role": "user",
      "parts": [
        {
          "fileData": {
            "fileUri": "https://generativelanguage.googleapis.com/v1beta/files/VIDEO_FILE_ID",
            "mimeType": "video/mp4"
          },
          "videoMetadata": {"startOffset": "10s", "endOffset": "20s", "fps": 1}
        },
        {"text": "Describe what happens in this segment."}
      ]
    }]
  }'
```

For audio: set `mimeType` to the audio type (e.g. `audio/mpeg`) and replace `videoMetadata` with `"audioMetadata": {"startOffset": "60s", "endOffset": "90s"}`.

</TabItem>
</Tabs>

## Token usage and cost

Gemini only bills for the slice that it sends to the model and the proxy reports the same input token count as a direct call. The table shows `promptTokenCount` for the same requests made to Google directly and via LiteLLM `v1.110.2` on `gemini-4-hydrogen`. All three proxy routes returned the same count as the direct call.

| File | Request | Input tokens | Change |
|------|---------|--------------|--------|
| 6-page PDF | Whole file | 5840 | |
| 6-page PDF | Pages 3 to 4 | 1147 | 80% fewer |
| 3-sheet workbook | Whole file | 1008 | |
| 3-sheet workbook | Sheet 2 | 391 | 61% fewer |
| 3-sheet workbook | Sheet 1, cells `A1:B3` | 173 | 83% fewer |
| 3-slide deck (`.pptx`) | Whole file | 1704 | |
| 3-slide deck (`.pptx`) | Slide 2, text layer | 73 | 96% fewer |
| 60-second video | Whole file | 6159 | |
| 60-second video | Seconds 10 to 20 | 1059 | 83% fewer |
| 120-second audio | Whole file | 3879 | |
| 120-second audio | Seconds 60 to 90 | 999 | 74% fewer |

Savings are file dependent. LiteLLM tracks the spend on these calls from the usage that Gemini returns and the proxy then sends the cost back in the `x-litellm-response-cost` response header.

## Limits

Google apply their file limits to the entire uploaded file (even if you've sliced it up): 50 MB per file, 1,000 pages per PDF, 2,000 pages or slides per Office/OpenDocument file and 50,000 cells per sheet. Full list of formats and options is at [Google's documentation](https://aistudio.google.com/docs/document-processing).
