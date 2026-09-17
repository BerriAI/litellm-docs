# Azure AI Speech

Pass-through endpoints for [Azure AI Speech](https://learn.microsoft.com/azure/ai-services/speech-service/) speech to text: the short audio REST recognition endpoint and the batch transcription REST API, in native Azure format (no translation). This is the Cognitive Services speech service, distinct from Azure OpenAI Whisper and `gpt-4o-transcribe`, which LiteLLM serves through `/v1/audio/transcriptions`.

| Feature | Supported | Notes |
|-------|-------|-------|
| Cost Tracking | ❌ | Requests are logged with model `azure_speech/short-audio` or `azure_speech/batch-transcription` and spend `0`. Azure Speech bills per hour of audio, and LiteLLM has no price entry for it, so LiteLLM key, team and user budgets do not limit Azure Speech usage |
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

4. Or create a batch transcription job and poll it

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

Spend is not computed for Azure Speech calls. Every request is still logged with model `azure_speech/short-audio` or `azure_speech/batch-transcription` and provider `azure_speech`, so calls show up in SpendLogs and logging integrations with a spend of `0`. Because spend is `0`, `max_budget` on keys, teams and users never blocks an Azure Speech request. Restrict who can call the service with key or team `allowed_routes` (for example, only grant `/azure_speech` to the keys that need it) and use Azure cost alerts or resource quotas on the Speech resource to cap the Azure side
