import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Nvidia Riva (Speech-to-Text)

LiteLLM supports NVIDIA Riva for speech-to-text via `/audio/transcriptions`. Works with both the **NVCF-hosted** Riva endpoint (e.g. Parakeet on `build.nvidia.com`) and **self-hosted** Riva deployments.

| Property | Details |
|-------|-------|
| Description | Riva is NVIDIA's GPU-accelerated speech AI. LiteLLM streams the audio to Riva over gRPC and returns OpenAI-compatible transcripts. |
| Provider Route on LiteLLM | `nvidia_riva/` |
| Provider Doc | [Riva ASR docs ↗](https://docs.nvidia.com/deeplearning/riva/user-guide/docs/asr/asr-overview.html) |
| Transport | gRPC (not HTTP) |
| Supported OpenAI Endpoints | `/audio/transcriptions` |

:::info Optional install

`nvidia_riva` requires the gRPC client and audio decoding libraries. Install them with:

```bash
pip install 'litellm[stt-nvidia-riva]'
```

This pulls in `nvidia-riva-client`, `soundfile`, `audioread`, and `numpy`. They are imported lazily so the rest of LiteLLM keeps working without them.

:::

## Quick Start

```python
from litellm import transcription
import os

os.environ["NVIDIA_RIVA_API_KEY"] = "nvapi-..."   # your nvapi key

audio_file = open("/path/to/audio.mp3", "rb")

response = transcription(
    model="nvidia_riva/nvidia/parakeet-ctc-1_1b-asr",
    file=audio_file,
    api_base="grpc.nvcf.nvidia.com:443",
    nvcf_function_id="1598d209-5e27-4d3c-8079-4751568b1081",  # NVCF function id
)

print(response.text)
```

LiteLLM resamples the audio to 16 kHz mono LINEAR_PCM (Riva's required wire format) before streaming, so you can send mp3 / wav / flac / ogg directly. No need to preprocess.

## Deployment modes

Riva runs in two very different shapes. The presence of `nvcf_function_id` is the signal LiteLLM uses to default `use_ssl`, but you can always override it.

### NVCF (NVIDIA-hosted)

```yaml
model_list:
  - model_name: parakeet-asr
    litellm_params:
      model: nvidia_riva/nvidia/parakeet-ctc-1_1b-asr
      api_base: grpc.nvcf.nvidia.com:443
      api_key: os.environ/NVIDIA_RIVA_API_KEY     # nvapi-...
      nvcf_function_id: 1598d209-5e27-4d3c-8079-4751568b1081
```

When `nvcf_function_id` is set, LiteLLM:
- enables TLS (`use_ssl=True`)
- attaches the `function-id` gRPC metadata
- attaches `authorization: Bearer <api_key>`

### Self-hosted (no TLS)

```yaml
model_list:
  - model_name: parakeet-asr
    litellm_params:
      model: nvidia_riva/nvidia/parakeet-ctc-1_1b-asr
      api_base: localhost:50051
```

### Self-hosted behind an ingress with TLS

```yaml
model_list:
  - model_name: parakeet-asr
    litellm_params:
      model: nvidia_riva/nvidia/parakeet-ctc-1_1b-asr
      api_base: riva.internal.company.com:443
      use_ssl: true
```

## LiteLLM Proxy Usage

### 1. Add the model to your config

```yaml
model_list:
  - model_name: parakeet-asr
    litellm_params:
      model: nvidia_riva/nvidia/parakeet-ctc-1_1b-asr
      api_base: grpc.nvcf.nvidia.com:443
      api_key: os.environ/NVIDIA_RIVA_API_KEY
      nvcf_function_id: 1598d209-5e27-4d3c-8079-4751568b1081
    model_info:
      mode: audio_transcription

general_settings:
  master_key: sk-1234
```

### 2. Start the proxy

```bash
litellm --config /path/to/config.yaml

# RUNNING on http://0.0.0.0:4000
```

### 3. Send a request

<Tabs>
<TabItem value="curl" label="curl">

```bash
curl --location 'http://0.0.0.0:4000/v1/audio/transcriptions' \
  --header 'Authorization: Bearer sk-1234' \
  --form 'file=@"/path/to/speech.mp3"' \
  --form 'model="parakeet-asr"'
```

</TabItem>
<TabItem value="openai" label="OpenAI SDK">

```python
from openai import OpenAI

client = OpenAI(
    api_key="sk-1234",
    base_url="http://0.0.0.0:4000",
)

audio_file = open("speech.mp3", "rb")
transcript = client.audio.transcriptions.create(
    model="parakeet-asr",
    file=audio_file,
)
print(transcript.text)
```

</TabItem>
</Tabs>

## Supported parameters

OpenAI parameters that map cleanly to Riva:

| OpenAI param | Behavior |
|---|---|
| `language` | Mapped to Riva `language_code`. Bare codes like `en` are normalized to `en-US`. BCP-47 codes like `de-DE` pass through. |
| `response_format` | `json` (default) returns `{ "text": "..." }`. `verbose_json` adds `duration` and `words` (timestamps in seconds). |
| `timestamp_granularities` | Pass `["word"]` to enable word-level timestamps. |

Riva-specific parameters you can set in `litellm_params` (or pass directly to `transcription(...)`):

| Param | Default | Purpose |
|---|---|---|
| `nvcf_function_id` | unset | NVCF function id. When set, defaults `use_ssl=True` and attaches NVCF metadata. |
| `use_ssl` | `True` if `nvcf_function_id` is set, else `False` | Force TLS on or off. Useful for self-hosted Riva behind a TLS ingress. |
| `riva_model_name` | `""` (auto-select) | Override the internal Riva model name. Leaving it empty lets Riva pick based on `language_code` + `sample_rate_hertz`. Recommended unless you know exactly what you want. |
| `enable_automatic_punctuation` | `True` | Standard Riva flag. |
| `endpointing_config` | unset | Pass a dict that mirrors Riva's `EndpointingConfig` (`start_threshold`, `stop_threshold`, `stop_history`, `stop_history_eou`, ...). |
| `chunking_strategy` | unset | OpenAI-style VAD config (`{"type": "server_vad", "threshold": 0.5, "silence_duration_ms": 700, "prefix_padding_ms": 250}`). LiteLLM translates it to Riva's `EndpointingConfig`. |

### Why is `riva_model_name` empty by default?

Internal Riva deployment names like `parakeet-1.1b-en-US-asr-streaming-silero-vad-sortformer` are NVIDIA's deployment identifiers. They change across NIM versions, regions, and self-hosted builds. Leaving `model=""` in `RecognitionConfig` lets Riva auto-select the right one based on `language_code` and `sample_rate_hertz` — which is what you almost always want. Only set `riva_model_name` if you have a specific deployed model you need to pin.

## Audio formats

LiteLLM decodes inbound audio with `soundfile` (wav / flac / ogg) and falls back to `audioread` for `mp3` / `m4a` / `mp4` / `webm`. Audio is then resampled to 16 kHz mono LINEAR_PCM before streaming to Riva.

If decoding fails (e.g. exotic codecs, DRM, or `audioread` not installed), LiteLLM raises a clear error asking you to convert upstream:

```bash
ffmpeg -i input.mp3 -ac 1 -ar 16000 -sample_fmt s16 output.wav
```

## Environment variables

| Variable | Purpose |
|---|---|
| `NVIDIA_RIVA_API_KEY` | API key sent as `authorization: Bearer ...`. NVCF expects `nvapi-...`. |
| `NVIDIA_RIVA_API_BASE` | Default `host:port` for the gRPC endpoint. Same effect as setting `api_base` in `litellm_params`. |
| `NVIDIA_NIM_API_KEY` | Used as a fallback for `NVIDIA_RIVA_API_KEY` since most users reuse the same `nvapi-...` key across NVCF services. |

## Notes & limitations

- Transport is gRPC streaming. NVCF only supports streaming ASR today, so even short files are sent as a stream.
- Diarization (`diarization_config`) and `srt` / `vtt` response formats aren't wired up yet — open an issue if you need them.
- Cost calc: Riva doesn't return token usage. LiteLLM stores the audio duration on `_hidden_params["audio_transcription_duration"]` so cost can be derived externally.
