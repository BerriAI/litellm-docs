# Batch API Guardrails

Guard the records inside a batch input file, so a batch job cannot move content past a guardrail that would have blocked the same content on `/chat/completions`

## How it works

A batch job is submitted in two steps. You upload a `.jsonl` file to `/v1/files` with `purpose=batch`, then create the job against the file id. The records only ever execute at the provider, so the upload is the one moment LiteLLM holds their content.

That is where guardrails run. Each record is scanned on its own, under the call type its `url` names, so a record targeting `/v1/chat/completions` is checked exactly as the equivalent chat request would be:

```
POST /v1/files  (purpose=batch)
        │
        ▼
┌──────────────────────┐
│    LiteLLM Proxy     │  scans every record against your pre_call guardrails
└──────────┬───────────┘
           │
           │  record 1  clean          -> submitted unchanged
           │  record 2  guardrail masks -> submitted with the mask applied
           │  record 3  guardrail blocks -> left out of the file
           │
           ▼
      Provider receives the remaining records
```

One offending record does not reject the file. A batch job routinely holds thousands of rows, so rejecting all of them because of one is rarely what you want.

## Setup

Nothing to turn on. Any guardrail that runs on `pre_call` is applied to batch uploads:

```yaml
model_list:
  - model_name: {{openai_small}}
    litellm_params:
      model: openai/{{openai_small}}
      api_key: os.environ/OPENAI_API_KEY

guardrails:
  - guardrail_name: pii-guard
    litellm_params:
      guardrail: presidio
      mode: pre_call
      default_on: true

files_settings:
  - custom_llm_provider: openai
    api_key: os.environ/OPENAI_API_KEY
```

## What happens to each record

A guardrail that rewrites content, such as PII masking, has its rewrite applied and the record is submitted in that form. A guardrail that blocks means the record is left out of the file that reaches the provider, and the rest of the job continues.

Records the guardrails did not object to are passed through as written, byte for byte, so enabling a guardrail does not reformat the rest of your file.

## The upload response

The response is the usual file object with one extra field, `litellm_batch_guardrail`, present only when a guardrail changed something:

```bash
curl -sS http://localhost:4000/v1/files \
  -H "Authorization: Bearer sk-1234" \
  -F purpose=batch \
  -F file=@batch_input.jsonl
```

```json
{
  "id": "file-Cr85eqBTg1WiNb1S4ystvR",
  "object": "file",
  "purpose": "batch",
  "bytes": 594,
  "status": "processed",
  "litellm_batch_guardrail": {
    "submitted_records": 3,
    "modified_records": [
      {"line": 2, "custom_id": "row-2", "action": "redacted", "guardrail": null},
      {"line": 3, "custom_id": "row-3", "action": "dropped", "guardrail": "pii-guard"}
    ]
  }
}
```

`submitted_records` is how many reached the provider. Each entry in `modified_records` identifies the record by both its `custom_id` and its 1-based `line` in the file you uploaded, so you can reconcile against your source either way.

`action` is `redacted` when the record was submitted with a guardrail's rewrite applied, and `dropped` when it was left out.

`guardrail` names which guardrail dropped a record, when it identified itself. It deliberately reports the guardrail rather than a reason: a guardrail refusing content and a guardrail that could not be reached under its fail-closed default raise the same way, so the two cannot be told apart at this point. The name tells you what to go and check.

The same outcome is written to the proxy logs and to the request metadata that logging callbacks read, so a dropped record is visible server side and not only to the caller.

## When the upload is refused

Four cases still fail the whole upload rather than dropping a record.

If every record is blocked there is nothing left to submit, so the upload returns 400 rather than creating an empty job.

If a guardrail cannot be reached, or fails in a way that is not a decision about the content, the upload returns 400 carrying that guardrail's own status. Dropping a record that was never actually inspected would silently cost you data, so the file is refused instead. This covers a guardrail configured to fail closed whose backend is down, which is otherwise easy to mistake for a policy block, since many integrations report both the same way.

If a guardrail is configured to route sensitive content to a different model, a record that trips it returns 400 naming the line. Every record of a batch file is submitted to one provider, so there is no way to send that one record elsewhere. Send it outside the batch.

If a record's `body` is not an object, or carries no `messages`, `prompt` or `input`, there is nothing for a guardrail to read and the upload returns 400 naming the line. Records are also checked before this for the usual batch file requirements, so a line that does not parse or is missing `custom_id`, `method`, `url` or `body` is rejected earlier with its own message.

## Limits

Only guardrails that run on `pre_call` see batch records. A guardrail configured for `post_call` alone does not participate, since there is no response to inspect at upload time.

A `guardrails` key inside a record's own body is ignored when choosing what to run, so a record cannot opt out of what your key or team selected. It is preserved in the record that reaches the provider.

Guardrails attached to a specific deployment through `litellm_params` are applied after routing, which batch uploads do not go through, so those are not applied to batch records.

Records are scanned in bounded batches rather than all at once, and a very large file with a network-backed guardrail will take correspondingly longer to upload. There is no cap on how many records will be scanned.
