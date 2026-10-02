# Amazon Transcribe

Pass-through endpoints for the [Amazon Transcribe](https://docs.aws.amazon.com/transcribe/latest/dg/what-is.html) batch and management API (start, poll and delete transcription jobs, manage custom vocabularies, vocabulary filters, language models and Call Analytics categories), in native AWS format (no translation).

| Feature | Supported | Notes |
|-------|-------|-------|
| Cost Tracking | ✅ | `StartTranscriptionJob` is priced when the job completes, from the length of the media file it transcribed, at the `transcribe/StartTranscriptionJob` rate in the LiteLLM model cost map, so key, team and user budgets apply. Management calls are logged as `transcribe/{Operation}` with spend `0`. Job types and media LiteLLM cannot price yet are rejected, see Cost tracking and budgets |
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

2. List the S3 buckets that virtual keys may transcribe from and write transcripts to, then start the proxy. Without this list only proxy admin keys can start jobs, see Access control

```yaml showLineNumbers
general_settings:
  transcribe_media_buckets:
    - my-bucket
```

```bash showLineNumbers
litellm --config config.yaml

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

The operation name in the URL is any operation of the Amazon Transcribe JSON API, e.g. `StartTranscriptionJob`, `GetTranscriptionJob`, `ListTranscriptionJobs`, `DeleteTranscriptionJob`, `CreateVocabulary`. The allowlist is read from the AWS service model shipped with botocore, so it tracks the installed SDK version. Anything else returns a 400 listing the supported set. [See all Amazon Transcribe operations](https://docs.aws.amazon.com/transcribe/latest/APIReference/API_Operations_Amazon_Transcribe_Service.html). The billable job types LiteLLM does not price yet (`StartMedicalTranscriptionJob`, `StartMedicalScribeJob`, `StartCallAnalyticsJob`) are rejected with a 400 before anything is sent to AWS, see Cost tracking and budgets

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

## Cost tracking and budgets

Amazon Transcribe bills every second of the media file, silence included, and does not report that duration. After a successful `StartTranscriptionJob`, LiteLLM polls `GetTranscriptionJob` in the background until the job reaches `COMPLETED` or `FAILED`, downloads the media file the job transcribed from S3 with the proxy's AWS credentials, reads its length, rounds it up to whole seconds and multiplies by `input_cost_per_second` of the `transcribe/StartTranscriptionJob` entry in the model cost map. That spend is written to SpendLogs and to the key, team and user, so `max_budget` blocks further requests once it is exceeded. A `FAILED` job is charged `0`. If the job cannot be polled, or the media cannot be fetched or read, LiteLLM charges the longest media Transcribe accepts for a standard batch job (8 hours, 28800 seconds) so an unreadable job can never be free. Every other operation (`GetTranscriptionJob`, `ListTranscriptionJobs`, vocabulary management, and so on) is logged as `transcribe/{Operation}` with spend `0`.

Because spend lands when the job completes, jobs submitted before the first charge is written are not stopped by the budget, and a job whose polling is interrupted by a proxy restart is not charged. Use key or team `rpm_limit` to bound how many jobs a key can start in that window, and use `allowed_routes` to restrict which keys may reach `/transcribe` at all.

Only the standard batch rate is priced. `StartTranscriptionJob` requests that add a per-second surcharge (`ContentRedaction`, `ToxicityDetection`, or a custom language model through `ModelSettings.LanguageModelName` or `LanguageIdSettings.<language>.LanguageModelName`) and the separately priced job types `StartMedicalTranscriptionJob`, `StartMedicalScribeJob` and `StartCallAnalyticsJob` are rejected with a 400 explaining why, before anything is sent to AWS. If `transcribe/StartTranscriptionJob` is missing from the model cost map, `StartTranscriptionJob` is rejected the same way rather than being forwarded unpriced.

LiteLLM reads the media length with libsndfile, so the media must be `flac`, `mp3`, `ogg` or `wav`. The format is taken from `MediaFormat` when set, otherwise from the file extension of `Media.MediaFileUri`. A request whose media is in another format (`mp4`, `m4a`, `webm`, `amr`) or whose format cannot be determined is rejected with a 400 before anything is sent to AWS; convert the file or set `MediaFormat` to submit it.

## Access control

Every request through `/transcribe` runs under the proxy's AWS credentials, so LiteLLM limits what a virtual key can reach with them.

A key that is not a proxy admin may only start jobs whose `Media.MediaFileUri` and `OutputBucketName` name a bucket listed in `general_settings.transcribe_media_buckets`, and may not set `DataAccessRoleArn` or `JobExecutionSettings`; anything else is rejected with a 403 before the request is signed. When the list is unset, empty or malformed, only proxy admin keys can start jobs. The list can be set in `config.yaml` as above, or from the Admin UI under Settings, Router Settings, General Settings (`transcribe_media_buckets`, comma-separated bucket names); a value saved there is picked up by the running proxy on its next config reload, and a value in `config.yaml` takes precedence over it.

Each `StartTranscriptionJob` is tagged with the calling key's owner (its team when it has one, otherwise its user, otherwise the key itself). `GetTranscriptionJob` and `DeleteTranscriptionJob` answer only for jobs carrying the caller's owner tag and return a 404 for any other job name, and a caller-supplied `litellm-owner` tag is rejected. Account-wide operations such as `ListTranscriptionJobs` and vocabulary management are limited to proxy admin keys. Proxy admins bypass both checks and see every job in the AWS account.

## Limitations

Only the `transcribe.{region}.amazonaws.com` JSON API is proxied. Streaming transcription uses the separate `transcribestreaming.{region}.amazonaws.com` endpoint over HTTP/2 event streams or WebSockets and cannot be routed through these endpoints; clients that stream should continue to call AWS directly for now.

Transcripts are written by AWS to S3 and returned as a presigned `TranscriptFileUri`; the transcript body is never returned through LiteLLM. To price the job, the proxy downloads the media file once with its own AWS credentials, so they need `s3:GetObject` on the bucket named in `Media.MediaFileUri`, and the proxy needs enough temporary disk for one media file at a time.
