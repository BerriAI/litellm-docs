# Amazon Transcribe

Pass-through endpoints for the [Amazon Transcribe](https://docs.aws.amazon.com/transcribe/latest/dg/what-is.html) batch and management API (start, poll and delete transcription jobs, manage custom vocabularies, vocabulary filters, language models and Call Analytics), in native AWS format (no translation).

| Feature | Supported | Notes |
|-------|-------|-------|
| Cost Tracking | ❌ | Requests are logged with model `transcribe/{Operation}` and spend `0`; Transcribe bills per second of audio, which is not known at request time |
| Logging | ✅ | works across all integrations |
| End-user Tracking | ❌ | [Tell us if you need this](https://github.com/BerriAI/litellm/issues/new) |
| Streaming | ❌ | Streaming transcription (`StartStreamTranscription`, the `transcribestreaming` HTTP/2 and WebSocket endpoint) is a separate protocol and is not covered by this pass-through |

Just replace `https://transcribe.{aws_region_name}.amazonaws.com` with `LITELLM_PROXY_BASE_URL/transcribe` 🚀

LiteLLM signs the forwarded request with SigV4 using the proxy's AWS credentials, so clients only need a LiteLLM virtual key.

## Quick Start

1. Set AWS credentials and region in the proxy environment. The credentials need `transcribe:*` permissions for the operations you call, plus read access to the S3 bucket holding the audio

```bash showLineNumbers
export AWS_ACCESS_KEY_ID=""
export AWS_SECRET_ACCESS_KEY=""
export AWS_REGION_NAME="us-west-2"
```

2. Start the proxy

```bash showLineNumbers
litellm

# RUNNING on http://0.0.0.0:4000
```

3. Start a transcription job through the proxy

```bash showLineNumbers
curl -X POST 'http://0.0.0.0:4000/transcribe/StartTranscriptionJob' \
-H "Authorization: Bearer $LITELLM_API_KEY" \
-H 'Content-Type: application/json' \
-d '{
  "TranscriptionJobName": "my-job",
  "LanguageCode": "en-US",
  "MediaFormat": "wav",
  "Media": {"MediaFileUri": "s3://my-bucket/audio.wav"}
}'
```

4. Poll the job until it completes, then download the transcript from `TranscriptFileUri`

```bash showLineNumbers
curl -X POST 'http://0.0.0.0:4000/transcribe/GetTranscriptionJob' \
-H "Authorization: Bearer $LITELLM_API_KEY" \
-H 'Content-Type: application/json' \
-d '{"TranscriptionJobName": "my-job"}'
```

The operation name in the URL is any operation of the Amazon Transcribe JSON API, e.g. `StartTranscriptionJob`, `GetTranscriptionJob`, `ListTranscriptionJobs`, `DeleteTranscriptionJob`, `StartMedicalTranscriptionJob`, `StartCallAnalyticsJob`, `CreateVocabulary`. The allowlist is read from the AWS service model shipped with botocore, so it tracks the installed SDK version. Anything else returns a 400 listing the supported set. [See all Amazon Transcribe operations](https://docs.aws.amazon.com/transcribe/latest/APIReference/API_Operations_Amazon_Transcribe_Service.html)

## Usage with the AWS SDK (boto3)

Point the SDK's `endpoint_url` at `LITELLM_PROXY_BASE_URL/transcribe` and pass your LiteLLM virtual key as the AWS access key id. The proxy reads the operation from the SDK's `X-Amz-Target` header, per the AWS JSON 1.1 protocol.

```python showLineNumbers
import boto3

client = boto3.client(
    "transcribe",
    region_name="us-west-2",
    endpoint_url="http://0.0.0.0:4000/transcribe",
    aws_access_key_id="sk-<your-litellm-api-key>",
    aws_secret_access_key="placeholder",
)

client.start_transcription_job(
    TranscriptionJobName="my-job",
    LanguageCode="en-US",
    MediaFormat="wav",
    Media={"MediaFileUri": "s3://my-bucket/audio.wav"},
)
job = client.get_transcription_job(TranscriptionJobName="my-job")["TranscriptionJob"]
print(job["TranscriptionJobStatus"])
```

The SDK signs the request locally with the placeholder credentials. LiteLLM reads the virtual key from the `Credential=` field of that signature, authenticates the call with it, discards the SDK signature, and re-signs the request with the proxy's AWS credentials.

## Limitations

Only the `transcribe.{region}.amazonaws.com` JSON API is proxied. Streaming transcription uses the separate `transcribestreaming.{region}.amazonaws.com` endpoint over HTTP/2 event streams or WebSockets and cannot be routed through these endpoints; clients that stream should continue to call AWS directly for now.

Transcripts are written by AWS to S3 and returned as a presigned `TranscriptFileUri`; the transcript body itself never passes through LiteLLM.

Spend is not computed for Transcribe calls. Every request is still logged with model `transcribe/{Operation}` and provider `transcribe`, so calls show up in SpendLogs and logging integrations with a spend of `0`.
