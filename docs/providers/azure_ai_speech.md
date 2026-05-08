# Azure AI Speech (Cognitive Services)

Azure AI Speech is Azure's Cognitive Services speech API, separate from Azure OpenAI. LiteLLM supports Azure AI Speech for text-to-speech (TTS) and speech-to-text (STT) through the `azure/speech/` provider route.

**When to use this vs Azure OpenAI TTS:**
- **Azure AI Speech** - More languages, neural voices, SSML support, speech customization
- **Azure OpenAI TTS** - OpenAI models, integrated with Azure OpenAI services


## Overview

| Property | Details |
|-------|-------|
| Description | Azure AI Speech is Azure's Cognitive Services speech API, separate from Azure OpenAI. It supports Text-to-Speech (TTS) and Speech-to-Text (STT). |
| Provider Route on LiteLLM | `azure/speech/` |
| Supported Endpoints | `/v1/audio/speech`, `/v1/audio/transcriptions` |

## Quick Start

### Text-to-Speech

**LiteLLM SDK**

```python showLineNumbers title="SDK Usage"
from litellm import speech
from pathlib import Path
import os

os.environ["AZURE_TTS_API_KEY"] = "your-cognitive-services-key"

speech_file_path = Path(__file__).parent / "speech.mp3"
response = speech(
    model="azure/speech/azure-tts",
    voice="alloy",
    input="Hello, this is Azure AI Speech",
    api_base="https://eastus.tts.speech.microsoft.com",
    api_key=os.environ["AZURE_TTS_API_KEY"],
)
response.stream_to_file(speech_file_path)
```

**LiteLLM Proxy**

```yaml showLineNumbers title="proxy_config.yaml"
model_list:
  - model_name: azure-speech
    litellm_params:
      model: azure/speech/azure-tts
      api_base: https://eastus.tts.speech.microsoft.com
      api_key: os.environ/AZURE_TTS_API_KEY
```

### Speech-to-Text

Use `azure/speech/azure-stt` with the `/v1/audio/transcriptions` endpoint to call Azure AI Speech STT through LiteLLM.

**LiteLLM SDK**

```python showLineNumbers title="SDK Usage"
from litellm import transcription

response = transcription(
    model="azure/speech/azure-stt",
    file=open("audio.wav", "rb"),
    api_base="https://eastus.api.cognitive.microsoft.com",
    api_key="your-cognitive-services-key",
    language="en-US",
)

print(response.text)
```

You can pass either the Cognitive Services endpoint or the regional STT endpoint:

```python
# Cognitive Services endpoint
api_base="https://eastus.api.cognitive.microsoft.com"

# STT endpoint
api_base="https://eastus.stt.speech.microsoft.com"
```

**LiteLLM Proxy**

```yaml showLineNumbers title="proxy_config.yaml"
model_list:
  - model_name: azure-speech-stt
    litellm_params:
      model: azure/speech/azure-stt
      api_base: https://eastus.api.cognitive.microsoft.com
      api_key: your-cognitive-services-key
```

Make a request to the proxy:

```bash
curl http://0.0.0.0:4000/v1/audio/transcriptions \
  -H "Authorization: Bearer sk-1234" \
  -F "model=azure-speech-stt" \
  -F "file=@audio.wav" \
  -F "language=en-US"
```

**Supported STT parameters**

| Parameter | Description | Notes |
|-----------|-------------|-------|
| `language` | Recognition language | Defaults to `en-US` |
| `response_format` | Response format | Use `verbose_json` for Azure detailed output; defaults to Azure simple output |

## Setup

1. Create an Azure Cognitive Services resource in the [Azure Portal](https://portal.azure.com)
2. Get your API key from the resource
3. Note your region (e.g., `eastus`, `westus`, `westeurope`)
4. Use the regional endpoint for your use case:
   - TTS: `https://{region}.tts.speech.microsoft.com`
   - STT: `https://{region}.stt.speech.microsoft.com`
   - Cognitive Services endpoint: `https://{region}.api.cognitive.microsoft.com`

## Cost Tracking (Pricing)

LiteLLM automatically tracks TTS costs for Azure AI Speech based on the number of characters processed. STT usage is supported through `azure/speech/azure-stt`; configure custom pricing if you need non-zero STT spend tracking.

### Available Models

| Model | Mode | Default Cost |
|-------|------|--------------|
| `azure/speech/azure-tts` | TTS Neural | $15 per 1M characters |
| `azure/speech/azure-tts-hd` | TTS Neural HD | $30 per 1M characters |
| `azure/speech/azure-stt` | STT | $0 by default; override with custom pricing if needed |

### How Costs are Calculated

Azure AI Speech charges based on the number of characters in your input text. LiteLLM automatically:
- Counts the number of characters in your `input` parameter
- Calculates the cost based on the model pricing
- Returns the cost in the response object

```python showLineNumbers title="View Request Cost"
from litellm import speech

response = speech(
    model="azure/speech/azure-tts",
    voice="alloy",
    input="Hello, this is a test message",
    api_base="https://eastus.tts.speech.microsoft.com",
    api_key=os.environ["AZURE_TTS_API_KEY"],
)

# Access the calculated cost
cost = response._hidden_params.get("response_cost")
print(f"Request cost: ${cost}")
```

### Verify Azure Pricing

To check the latest Azure AI Speech pricing:

1. Visit the [Azure Pricing Calculator](https://azure.microsoft.com/en-us/pricing/calculator/)
2. Set **Service** to "AI Services"
3. Set **API** to "Azure AI Speech"
4. Select **Text to Speech** and your region
5. View the current pricing per million characters

**Note:** Pricing may vary by region and Azure subscription type.

## Voice Mapping

LiteLLM automatically maps OpenAI voice names to Azure Neural voices:

| OpenAI Voice | Azure Neural Voice | Description |
|-------------|-------------------|-------------|
| `alloy` | en-US-JennyNeural | Neutral and balanced |
| `echo` | en-US-GuyNeural | Warm and upbeat |
| `fable` | en-GB-RyanNeural | Expressive and dramatic |
| `onyx` | en-US-DavisNeural | Deep and authoritative |
| `nova` | en-US-AmberNeural | Friendly and conversational |
| `shimmer` | en-US-AriaNeural | Bright and cheerful |

## Supported Parameters

```python showLineNumbers title="All Parameters"
response = speech(
    model="azure/speech/azure-tts",
    voice="alloy",                    # Required: Voice selection
    input="text to convert",          # Required: Input text
    speed=1.0,                        # Optional: 0.25 to 4.0 (default: 1.0)
    response_format="mp3",            # Optional: mp3, opus, wav, pcm
    api_base="https://eastus.tts.speech.microsoft.com",
    api_key="your-key",
)
```

### Response Formats

| Format | Azure Output Format | Sample Rate |
|--------|-------------------|-------------|
| `mp3` | audio-24khz-48kbitrate-mono-mp3 | 24kHz |
| `opus` | ogg-48khz-16bit-mono-opus | 48kHz |
| `wav` | riff-24khz-16bit-mono-pcm | 24kHz |
| `pcm` | raw-24khz-16bit-mono-pcm | 24kHz |

## Passing Raw SSML

LiteLLM automatically detects when your `input` contains SSML (by checking for `<speak>` tags) and passes it through to Azure without any transformation. This gives you complete control over speech synthesis.

**When to use raw SSML:**
- Using the `<lang>` element with multilingual voices to translate text (e.g., English text → Spanish speech)
- Complex SSML structures with multiple voices or prosody changes
- Fine-grained control over pronunciation, breaks, emphasis, and other speech features

### LiteLLM SDK

```python showLineNumbers title="Raw SSML for Multilingual Translation"
from litellm import speech

# Use <lang> element to convert English text to Spanish speech
# The <lang> element forces the output language regardless of input text language
language_code = "es-ES"
text = "Hello, how are you today?"  # English text
voice = "en-US-AvaMultilingualNeural"

ssml = f"""<speak version="1.0"
    xmlns="http://www.w3.org/2001/10/synthesis"
    xmlns:mstts="http://www.w3.org/2001/mstts"
    xml:lang="{language_code}">
<voice name="{voice}">
    <lang xml:lang="{language_code}">{text}</lang>
</voice>
</speak>"""

response = speech(
    model="azure/speech/azure-tts",
    voice=voice,
    input=ssml,  # LiteLLM auto-detects SSML and sends as-is
    api_base="https://eastus.tts.speech.microsoft.com",
    api_key=os.environ["AZURE_TTS_API_KEY"],
)
response.stream_to_file("speech.mp3")
```

```python showLineNumbers title="Raw SSML with Complex Features"
from litellm import speech

# Complex SSML with multiple prosody adjustments
ssml = """<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' 
    xmlns:mstts='https://www.w3.org/2001/mstts' xml:lang='en-US'>
<voice name='en-US-JennyNeural'>
    <mstts:express-as style='cheerful' styledegree='2'>
        <prosody rate='+20%' pitch='high'>
            Welcome to our service!
        </prosody>
    </mstts:express-as>
    <break time='500ms'/>
    <prosody rate='-10%'>
        How can I help you today?
    </prosody>
</voice>
</speak>"""

response = speech(
    model="azure/speech/azure-tts",
    voice="en-US-JennyNeural",
    input=ssml,  # LiteLLM detects <speak> and passes through unchanged
    api_base="https://eastus.tts.speech.microsoft.com",
    api_key=os.environ["AZURE_TTS_API_KEY"],
)
response.stream_to_file("speech.mp3")
```

### LiteLLM Proxy

```bash
curl http://0.0.0.0:4000/v1/audio/speech \
  -H "Authorization: Bearer sk-1234" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "azure-speech",
    "voice": "en-US-AvaMultilingualNeural",
    "input": "<speak version=\"1.0\" xmlns=\"http://www.w3.org/2001/10/synthesis\" xmlns:mstts=\"http://www.w3.org/2001/mstts\" xml:lang=\"es-ES\"><voice name=\"en-US-AvaMultilingualNeural\"><lang xml:lang=\"es-ES\">Hello, how are you today?</lang></voice></speak>"
  }' \
  --output speech.mp3
```


## Sending Azure-Specific Params

Azure AI Speech supports advanced SSML features through optional parameters:

- `style`: Speaking style (e.g., "cheerful", "sad", "angry", "whispering")
- `styledegree`: Style intensity (0.01 to 2)
- `role`: Voice role (e.g., "Girl", "Boy", "SeniorFemale", "SeniorMale")
- `lang`: Language code for multilingual voices (e.g., "es-ES", "fr-FR", "hi-IN")

### **LiteLLM SDK**

#### Custom Azure Voice

```python showLineNumbers title="Custom Azure Voice"
from litellm import speech

response = speech(
    model="azure/speech/azure-tts",
    voice="en-US-AndrewNeural",       # Use Azure voice directly
    input="Hello, this is a test",
    api_base="https://eastus.tts.speech.microsoft.com",
    api_key=os.environ["AZURE_TTS_API_KEY"],
    response_format="mp3"
)
response.stream_to_file("speech.mp3")
```

#### Speaking Style

```python showLineNumbers title="Speaking Style"
from litellm import speech

response = speech(
    model="azure/speech/azure-tts",
    voice="en-US-JennyNeural",        # Must be a voice that supports styles
    input="Who are you? What is chicken dinner?",
    api_base="https://eastus.tts.speech.microsoft.com",
    api_key=os.environ["AZURE_TTS_API_KEY"],
    style="whispering",               # Azure-specific: cheerful, sad, angry, whispering, etc.
)
response.stream_to_file("speech.mp3")
```

#### Style with Degree and Role

```python showLineNumbers title="Style with Degree and Role"
from litellm import speech

response = speech(
    model="azure/speech/azure-tts",
    voice="en-US-AriaNeural",
    input="Good morning! How are you today?",
    api_base="https://eastus.tts.speech.microsoft.com",
    api_key=os.environ["AZURE_TTS_API_KEY"],
    style="cheerful",                 # Azure-specific: Speaking style
    styledegree="2",                  # Azure-specific: 0.01 to 2 (intensity)
    role="SeniorFemale",              # Azure-specific: Girl, Boy, SeniorFemale, etc.
)
response.stream_to_file("speech.mp3")
```

#### Language Override for Multilingual Voices

```python showLineNumbers title="Language Override"
from litellm import speech

response = speech(
    model="azure/speech/azure-tts",
    voice="en-US-AvaMultilingualNeural",  # Multilingual voice
    input="आप कौन हैं? चिकन डिनर क्या है?",  # Hindi text
    api_base="https://eastus.tts.speech.microsoft.com",
    api_key=os.environ["AZURE_TTS_API_KEY"],
    lang="hi-IN",                         # Azure-specific: Override language
)
response.stream_to_file("speech.mp3")
```

### **LiteLLM AI Gateway (CURL)**

First, ensure you have set up your proxy config as shown in the [LiteLLM Proxy setup](#quick-start) above.

**Using the model name from your config:**

```yaml
model_list:
  - model_name: azure-speech  # This is what you'll use in your API calls
    litellm_params:
      model: azure/speech/azure-tts
      api_base: https://eastus.tts.speech.microsoft.com
      api_key: os.environ/AZURE_TTS_API_KEY
```

#### Custom Azure Voice

```bash
curl http://0.0.0.0:4000/v1/audio/speech \
  -H "Authorization: Bearer sk-1234" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "azure-speech",
    "voice": "en-US-AndrewNeural",
    "input": "Hello, this is a test"
  }' \
  --output speech.mp3
```

#### Speaking Style

```bash
curl http://0.0.0.0:4000/v1/audio/speech \
  -H "Authorization: Bearer sk-1234" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "azure-speech",
    "input": "Who are you? What is chicken dinner?",
    "voice": "en-US-JennyNeural",
    "style": "whispering"
  }' \
  --output speech.mp3
```

#### Style with Degree and Role

```bash
curl http://0.0.0.0:4000/v1/audio/speech \
  -H "Authorization: Bearer sk-1234" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "azure-speech",
    "voice": "en-US-AriaNeural",
    "input": "Good morning! How are you today?",
    "style": "cheerful",
    "styledegree": "2",
    "role": "SeniorFemale"
  }' \
  --output speech.mp3
```

#### Language Override

```bash
curl http://0.0.0.0:4000/v1/audio/speech \
  -H "Authorization: Bearer sk-1234" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "azure-speech",
    "input": "आप कौन हैं? चिकन डिनर क्या है?",
    "voice": "en-US-AvaMultilingualNeural",
    "lang": "hi-IN"
  }' \
  --output speech.mp3
```

### Azure-Specific Parameters Reference

| Parameter | Description | Example Values | Notes |
|-----------|-------------|----------------|-------|
| `style` | Speaking style | `cheerful`, `sad`, `angry`, `excited`, `friendly`, `hopeful`, `shouting`, `terrified`, `unfriendly`, `whispering` | Only supported by certain voices. See [Azure voice styles documentation](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/speech-synthesis-markup-voice#use-speaking-styles-and-roles) |
| `styledegree` | Style intensity | `0.01` to `2` | Higher values = more intense. Default is `1` |
| `role` | Voice role | `Girl`, `Boy`, `YoungAdultFemale`, `YoungAdultMale`, `OlderAdultFemale`, `OlderAdultMale`, `SeniorFemale`, `SeniorMale` | Only supported by certain voices |
| `lang` | Language code | `es-ES`, `fr-FR`, `de-DE`, `hi-IN`, etc. | For multilingual voices. Overrides the default language |

## Async Support

```python showLineNumbers title="Async Usage"
import asyncio
from litellm import aspeech
from pathlib import Path

async def generate_speech():
    response = await aspeech(
        model="azure/speech/azure-tts",
        voice="alloy",
        input="Hello from async",
        api_base="https://eastus.tts.speech.microsoft.com",
        api_key=os.environ["AZURE_TTS_API_KEY"],
    )
    
    speech_file_path = Path(__file__).parent / "speech.mp3"
    response.stream_to_file(speech_file_path)

asyncio.run(generate_speech())
```

## Regional Endpoints

Replace `{region}` with your Azure resource region:

- US East: `https://eastus.tts.speech.microsoft.com`
- US West: `https://westus.tts.speech.microsoft.com`
- Europe West: `https://westeurope.tts.speech.microsoft.com`
- Asia Southeast: `https://southeastasia.tts.speech.microsoft.com`

For STT, use the corresponding `stt.speech.microsoft.com` regional host, or use the Cognitive Services endpoint (`https://{region}.api.cognitive.microsoft.com`) and LiteLLM will map it to the STT REST endpoint.

[Full list of regions](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/regions)

## Advanced Features

### Custom Neural Voices

You can use any Azure Neural voice by passing the full voice name:

```python showLineNumbers title="Custom Voice"
response = speech(
    model="azure/speech/azure-tts",
    voice="en-US-AriaNeural",  # Direct Azure voice name
    input="Using a specific neural voice",
    api_base="https://eastus.tts.speech.microsoft.com",
    api_key=os.environ["AZURE_TTS_API_KEY"],
)
```

Browse available voices in the [Azure Speech Gallery](https://speech.microsoft.com/portal/voicegallery).

## Error Handling

```python showLineNumbers title="Error Handling"
from litellm import speech
from litellm.exceptions import APIError

try:
    response = speech(
        model="azure/speech/azure-tts",
        voice="alloy",
        input="Test message",
        api_base="https://eastus.tts.speech.microsoft.com",
        api_key=os.environ["AZURE_TTS_API_KEY"],
    )
except APIError as e:
    print(f"Azure Speech error: {e}")
```

## Reference

- [Azure Speech Service Documentation](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/)
- [Text-to-Speech REST API](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/rest-text-to-speech)
- [Speech-to-Text REST API](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/rest-speech-to-text-short)

