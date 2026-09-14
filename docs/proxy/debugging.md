# Debugging

2 levels of debugging supported. 

- debug (prints info logs)
- detailed debug (prints debug logs)

The proxy also supports json logs. [See here](#json-logs)

## `debug`

**via cli**

```bash showLineNumbers
$ litellm --debug
```

**via env**

```python showLineNumbers
os.environ["LITELLM_LOG"] = "INFO"
```

## `detailed debug`

**via cli**

```bash showLineNumbers
$ litellm --detailed_debug
```

**via env**

```python showLineNumbers
os.environ["LITELLM_LOG"] = "DEBUG"
```

### Debug Logs 

Run the proxy with `--detailed_debug` to view detailed debug logs
```shell showLineNumbers
litellm --config /path/to/config.yaml --detailed_debug
```

When making requests you should see the POST request sent by LiteLLM to the LLM on the Terminal output
```shell showLineNumbers
POST Request Sent from LiteLLM:
curl -X POST \
https://api.openai.com/v1/chat/completions \
-H 'content-type: application/json' -H 'Authorization: Bearer sk-qnWGUIW9****************************************' \
-d '{"model": "{{openai_small}}", "messages": [{"role": "user", "content": "this is a test request, write a short poem"}]}'
```

## Debug single request

Pass in `litellm_request_debug=True` in the request body

```bash showLineNumbers
curl -L -X POST 'http://0.0.0.0:4000/chat/completions' \
-H 'Content-Type: application/json' \
-H 'Authorization: Bearer sk-1234' \
-d '{ 
    "model":"fake-openai-endpoint",
    "messages": [{"role": "user","content": "How many r in the word strawberry?"}],
    "litellm_request_debug": true
}'
```

This will emit the raw request sent by LiteLLM to the API Provider and raw response received from the API Provider for **just** this request in the logs. 


```bash showLineNumbers keep-model-ids
INFO:     Uvicorn running on http://0.0.0.0:4000 (Press CTRL+C to quit)
20:14:06 - LiteLLM:WARNING: litellm_logging.py:938 - 

POST Request Sent from LiteLLM:
curl -X POST \
https://exampleopenaiendpoint-production.up.railway.app/chat/completions \
-H 'Authorization: Be****ey' -H 'Content-Type: application/json' \
-d '{'model': 'fake', 'messages': [{'role': 'user', 'content': 'How many r in the word strawberry?'}], 'stream': False}'


20:14:06 - LiteLLM:WARNING: litellm_logging.py:1015 - RAW RESPONSE:
{"id":"chatcmpl-817fc08f0d6c451485d571dab39b26a1","object":"chat.completion","created":1677652288,"model":"gpt-3.5-turbo-0301","system_fingerprint":"fp_44709d6fcb","choices":[{"index":0,"message":{"role":"assistant","content":"\n\nHello there, how may I assist you today?"},"logprobs":null,"finish_reason":"stop"}],"usage":{"prompt_tokens":9,"completion_tokens":12,"total_tokens":21}}


INFO:     127.0.0.1:56155 - "POST /chat/completions HTTP/1.1" 200 OK

```


## JSON LOGS

Set `JSON_LOGS="True"` in your env:

```bash showLineNumbers
export JSON_LOGS="True"
```
**OR**

Set `json_logs: true` in your yaml: 

```yaml showLineNumbers
litellm_settings:
    json_logs: true
```

Start proxy 

```bash showLineNumbers
$ litellm
```

The proxy will now all logs in json format.

## Request Correlation IDs

Set `request_correlation_in_logs: true` to stamp every log line with the request's `trace_id` and `session_id`. This lets you filter your log aggregator down to every line tied to a single request, or every request in a single end-user session, without adding logging calls at each call site. Works with both plaintext and JSON logs

```yaml showLineNumbers
litellm_settings:
    request_correlation_in_logs: true
```

`trace_id` comes from the `x-litellm-trace-id` request header (or is generated per request if the header isn't set). `session_id` comes from `litellm_session_id` in the request body, or from the `x-litellm-session-id` header; see [Request Headers](./request_headers#litellm-headers) for the full resolution order. It's only added to a log line once a session id has actually been supplied

If neither of those explicit headers is present, `trace_id`/`session_id` fall back to the standard [W3C Trace Context](https://www.w3.org/TR/trace-context/) `traceparent` header and [W3C Baggage](https://www.w3.org/TR/baggage/) `baggage` header respectively: the trace-id from `traceparent` becomes `trace_id`, and a `session.id` entry in `baggage` becomes `session_id`. This lets a request already carrying real OpenTelemetry trace context correlate litellm's logs with the same trace in your existing observability backend, without needing a separate litellm-specific header. The explicit litellm headers always take precedence when present

Example log line with `json_logs: true`:

```json showLineNumbers
{"message": "...", "level": "INFO", "timestamp": "...", "trace_id": "2a5cbcfa-ccdf-493c-858b-eb8e9b07f32c", "session_id": "user-123-session-1"}
```

Example log line without `json_logs` (plaintext):

```bash showLineNumbers
15:30:43 - LiteLLM Proxy:ERROR: common_request_processing.py:848 - some log message [trace_id=2a5cbcfa-ccdf-493c-858b-eb8e9b07f32c session_id=user-123-session-1]
```

`request_correlation_in_logs` also adds an independent `session_id` field to `StandardLoggingPayload` (sent to logging integrations like S3 and Langfuse), populated the same way. See the [StandardLoggingPayload spec](./logging_spec#standardloggingpayload)

Both `trace_id` and `session_id` are sanitized before they're stored: control characters (including `\r`/`\n`) are stripped and the value is capped at 256 characters, so a caller-supplied `litellm_session_id` can't be used to forge fake log lines or bloat log storage

The flag defaults to `false`, so existing log output is unaffected until you opt in.

This currently applies to requests handled by the proxy and to `litellm.acompletion()` calls made directly through the SDK. Synchronous SDK calls (`litellm.completion()`) don't stamp `trace_id`/`session_id` yet; support for that path is planned as a follow-up.

## Control Log Output 

Turn off fastapi's default 'INFO' logs 

1. Turn on 'json logs' 
```yaml showLineNumbers
litellm_settings:
    json_logs: true
```

2. Set `LITELLM_LOG` to 'ERROR' 

Only get logs if an error occurs. 

```bash showLineNumbers
LITELLM_LOG="ERROR"
```

3. Start proxy 


```bash showLineNumbers
$ litellm
```

Expected Output: 

```bash showLineNumbers
# no info statements
```

## Common Errors 

1. "No available deployments..."

```
No deployments available for selected model, Try again in 60 seconds. Passed model={{anthropic}}. pre-call-checks=False, allowed_model_region=n/a.
```

This can be caused due to all your models hitting rate limit errors, causing the cooldown to kick in. 

How to control this? 
- Adjust the cooldown time

```yaml showLineNumbers
router_settings:
    cooldown_time: 0 # 👈 KEY CHANGE
```

- Disable Cooldowns [NOT RECOMMENDED]

```yaml showLineNumbers
router_settings:
    disable_cooldowns: True
```

This is not recommended, as it will lead to requests being routed to deployments over their tpm/rpm limit.