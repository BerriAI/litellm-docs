# Azure AI Speech

Pass-through endpoints for [Azure AI Speech](https://learn.microsoft.com/azure/ai-services/speech-service/) speech to text: the short audio REST recognition endpoint and the batch transcription REST API, in native Azure format (no translation). This is the Cognitive Services speech service, distinct from Azure OpenAI Whisper and `gpt-4o-transcribe`, which LiteLLM serves through `/v1/audio/transcriptions`.

| Feature | Supported | Notes |
|-------|-------|-------|
| Cost Tracking | ✅ | Short audio recognition and fast transcription are priced per second of audio from the `azure/speech/azure-stt` entry in `model_prices_and_context_window.json`. Batch transcription jobs cannot be priced from their responses and are shared across every key on the proxy, so the batch API is limited to proxy admin keys and logged with spend `0` |
| Logging | ✅ | works across all integrations |
| End-user Tracking | ❌ | [Tell us if you need this](https://github.com/BerriAI/litellm/issues/new) |
| Streaming | ❌ | Realtime recognition uses the Speech SDK WebSocket protocol, which is not covered by this pass-through |

Just replace `https://{region}.stt.speech.microsoft.com` or `https://{region}.api.cognitive.microsoft.com` with `LITELLM_PROXY_BASE_URL/azure_speech` 🚀

LiteLLM injects the `Ocp-Apim-Subscription-Key` header from the proxy's Azure Speech credential, so clients only need a LiteLLM virtual key. A subscription key sent by the client is dropped and never reaches Azure.

## Quick Start

1. Set the Azure Speech key and region in the proxy environment. The key is the subscription key of your Azure AI Speech resource

```bash showLineNumbers
export AZURE_SPEECH_API_KEY=""
export AZURE_SPEECH_REGION="swedencentral"
```

The key can also be saved from the Admin UI under Models + Endpoints > Credentials by picking the `Azure AI Speech` provider, in which case the environment variable is not needed. Set `AZURE_SPEECH_API_BASE` instead of `AZURE_SPEECH_REGION` when the resource is reached through a custom domain or private endpoint; the same base is used for both endpoint families

2. Start the proxy

```bash showLineNumbers
litellm

# RUNNING on http://0.0.0.0:4000
```

3. Transcribe a short WAV file through the proxy. The audio bytes are forwarded unchanged, so send the file exactly as you would to Azure

```bash showLineNumbers
curl -X POST 'http://0.0.0.0:4000/azure_speech/speech/recognition/conversation/cognitiveservices/v1?language=en-US&format=detailed' \
-H "Authorization: Bearer $LITELLM_API_KEY" \
-H 'Content-Type: audio/wav; codecs=audio/pcm; samplerate=16000' \
--data-binary @audio.wav
```

```json
{"RecognitionStatus":"Success","Offset":9700000,"Duration":89500000,"DisplayText":"Britain Tranquility Base. Here the eagle has landed."}
```

4. Or transcribe a file with the fast transcription API, which returns the transcript in one request and reports the audio duration LiteLLM prices

```bash showLineNumbers
curl -X POST 'http://0.0.0.0:4000/azure_speech/speechtotext/transcriptions:transcribe?api-version=2024-11-15' \
-H "Authorization: Bearer $LITELLM_API_KEY" \
-F 'audio=@audio.wav' \
-F 'definition={"locales":["en-US"]};type=application/json'
```

```json
{"durationMilliseconds":5061,"combinedPhrases":[{"text":"Listen, Tranquility Base here. The Eagle has landed."}],"phrases":[...]}
```

5. Or, with a proxy admin key, create a batch transcription job and poll it (the whole batch API is admin only, see Limitations)

```bash showLineNumbers
curl -X POST 'http://0.0.0.0:4000/azure_speech/speechtotext/v3.2/transcriptions' \
-H "Authorization: Bearer $LITELLM_API_KEY" \
-H 'Content-Type: application/json' \
-d '{
  "displayName": "my-job",
  "locale": "en-US",
  "contentUrls": ["https://example.blob.core.windows.net/audio/recording.wav?<sas>"]
}'

curl 'http://0.0.0.0:4000/azure_speech/speechtotext/v3.2/transcriptions?top=10' \
-H "Authorization: Bearer $LITELLM_API_KEY"
```

## Endpoint families and hosts

Azure serves the two APIs from different hosts, and LiteLLM picks the host from the path you call. Paths under `/azure_speech/speech/` (the short audio REST API, for example `/speech/recognition/conversation/cognitiveservices/v1`) go to `https://{AZURE_SPEECH_REGION}.stt.speech.microsoft.com`. Paths under `/azure_speech/speechtotext/` (the batch transcription API, for example `/speechtotext/v3.2/transcriptions` and its `/files` sub resources) go to `https://{AZURE_SPEECH_REGION}.api.cognitive.microsoft.com`. Query parameters, JSON bodies, multipart bodies and raw audio bodies are forwarded verbatim; only `Content-Type` and `Accept` are copied from the client request. Any other path under `/azure_speech/` returns a 400 before anything is sent to Azure. [See the short audio REST reference](https://learn.microsoft.com/azure/ai-services/speech-service/rest-speech-to-text-short) and the [batch transcription reference](https://learn.microsoft.com/azure/ai-services/speech-service/batch-transcription)

Clients that speak the native Azure protocol and put their credential in `Ocp-Apim-Subscription-Key` can send the LiteLLM virtual key in that header instead of `Authorization: Bearer`; LiteLLM authenticates the call with it and replaces the header with the proxy's Azure key before forwarding

## Limitations

Only the REST APIs are proxied. Realtime and continuous recognition use the Speech SDK's WebSocket protocol on `wss://{region}.stt.speech.microsoft.com`, which cannot be routed through this pass-through; clients that stream should continue to call Azure directly for now

Only subscription key authentication is supported. Microsoft Entra ID tokens (`Authorization: Bearer <token>` against Azure) are not issued or forwarded by this route, so the proxy's credential has to be a subscription key of the Speech resource

Short audio recognition responses carry `Offset` and `Duration` in 100 nanosecond ticks, and fast transcription responses carry `durationMilliseconds`. LiteLLM converts both to seconds and prices them with the `azure/speech/azure-stt` entry in `model_prices_and_context_window.json` (the same entry used for Azure Speech through `/v1/audio/transcriptions`), so successful transcriptions count against key, team and user budgets. Fast transcription requests are logged with model `azure_speech/fast-transcription`. For short audio recognition LiteLLM also decodes the uploaded audio and bills whichever is longer, the uploaded length or the recognized `Duration`, so a `RecognitionStatus: NoMatch` response for a decodable upload (silence, or speech in a language the request did not ask for) is still priced for the audio Azure processed. Only a request whose upload LiteLLM cannot decode and whose response carries no duration is logged with spend `0`

The rest of the batch API (`/speechtotext/v3.2/...`) is limited to proxy admin keys; any other key gets a 403 for every method there. Two reasons: it bills per hour of audio on the Azure side but its responses do not report a duration LiteLLM could price, so a `POST` or `PUT` (creating a transcription job, a custom model, an endpoint) would spend against the proxy's Azure resource without touching any LiteLLM budget, and every job, file and model under that API belongs to the proxy's single Azure subscription, so a `GET`, `PATCH` or `DELETE` from one key could read or remove work another key created. Admin calls there are logged with model `azure_speech/batch-transcription` and spend `0`. Ordinary keys that need one-shot transcription should use the fast transcription endpoint above, which is priced per request
