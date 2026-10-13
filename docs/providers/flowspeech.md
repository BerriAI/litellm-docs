# FlowSpeech

[FlowSpeech](https://flowspeech.io/) converts text to speech. This adapter sends a JSON request to its speech endpoint and decodes the Base64 audio response into binary audio

:::note Availability
This provider requires the implementation in [LiteLLM PR #38498](https://github.com/BerriAI/litellm/pull/38498). Until that change is merged and released, these examples require a checkout containing the provider
:::

| Property | Value |
| --- | --- |
| Provider prefix | `flowspeech/` |
| Model route | `flowspeech/flowspeech-tts` |
| LiteLLM endpoint | `/audio/speech` |
| Default voice | `Kore` |

## Authentication and Endpoint

Set `FLOWSPEECH_API_KEY` in the environment of the SDK process or proxy. Use a valid FlowSpeech API credential, not a browser session cookie. The adapter sends it as a Bearer token

`FLOWSPEECH_API_BASE` is optional and defaults to `https://flowspeech.io`. The adapter appends `/api/ai/text-to-speech` unless that complete path is already present. Only override the base with an endpoint you trust, because it will receive your API key and input text

Explicit `api_key` and `api_base` arguments override these environment variables. A configured `litellm.api_key` also takes precedence over `FLOWSPEECH_API_KEY`

## Python SDK

```python
import litellm

audio = litellm.speech(
    model="flowspeech/flowspeech-tts",
    input="The next section explains how to review an audio draft.",
    voice="Kore",
)

print(audio.response.headers["content-type"])
with open("speech.audio", "wb") as output:
    output.write(audio.content)
```

The response uses the provider's MIME type. The `.audio` extension above does not imply a particular container or encoding. Inspect the content type before choosing a playback or conversion tool

## Proxy

Configure the model and supply `FLOWSPEECH_API_KEY` and `LITELLM_MASTER_KEY` through your deployment's secret configuration

```yaml
model_list:
  - model_name: flowspeech-narration
    litellm_params:
      model: flowspeech/flowspeech-tts
      api_key: os.environ/FLOWSPEECH_API_KEY

general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
```

Start the proxy with your configuration

```bash
litellm --config config.yaml
```

Send the request using your LiteLLM proxy key, not the provider key

```bash
curl --fail-with-body http://localhost:4000/v1/audio/speech \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"flowspeech-narration","input":"Welcome to the audio guide.","voice":"Kore"}' \
  --dump-header speech.headers \
  --output speech.audio
```

## Parameters and Limits

`input` is sent as both `text` and `originalText`. `voice` is sent as `speakers[0].voiceName`; use a FlowSpeech voice name rather than assuming OpenAI voice names are mapped automatically. The `flowspeech-tts` suffix identifies the LiteLLM route and is not forwarded as a provider-side model selection

This adapter supports voice selection only. It does not implement `instructions`, speed control, output format conversion, multi-speaker requests, or streaming. The provider endpoint does not read a separate `prompt` field, so the adapter does not advertise instructions as a supported parameter

The provider returns JSON containing `code` and `data.audioBase64` with `data.mimeType`. LiteLLM validates and decodes the Base64 field and returns the binary content with that MIME type. Missing audio, provider error responses, and malformed audio data raise an exception rather than being returned as an audio file

Generation requires a valid credential and sufficient provider quota. Before using the integration in production, make a short live request and verify the returned audio. Mock transport tests validate request and response handling but do not establish voice quality or live account access
