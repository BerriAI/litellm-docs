# Pass-Through Cost & Usage Tracking

Some pass-through targets fan a single HTTP request out to several models internally. LiteLLM cannot price those requests from the response body, so before this contract existed they landed in the spend logs with zero cost and zero tokens

The target can instead report the totals for the whole request in two response headers. LiteLLM records what it reports, without recomputing it

## The headers

| Header | Format | Meaning |
| --- | --- | --- |
| `x-litellm-response-cost` | decimal string, USD | Total cost of this request across every internal model call, e.g. `0.000415` |
| `x-litellm-total-tokens` | integer string | Total tokens across every internal model call, e.g. `1874` |

Send one total per HTTP request. There is no per-model breakdown, and the reported values are authoritative

## Quick start

Define the pass-through endpoint as usual. Nothing in the config opts into this contract; LiteLLM reads the headers whenever the target sends them

```yaml
general_settings:
  pass_through_endpoints:
    - path: "/internal-api"
      target: "https://internal-api.example.com/v1/answer"
      include_subpath: true
      headers:
        Authorization: "Bearer os.environ/INTERNAL_API_TOKEN"
```

Call it through the proxy with your LiteLLM key:

```shell
curl -i -X POST 'http://localhost:4000/internal-api/summarize' \
  -H 'Authorization: Bearer sk-1234' \
  -H 'Content-Type: application/json' \
  -d '{"document_id": "doc-9931"}'
```

Have the target answer with the totals it computed:

```
HTTP/1.1 200 OK
content-type: application/json
x-litellm-response-cost: 0.000415
x-litellm-total-tokens: 1874
```

LiteLLM books `0.000415` and `1874` against the calling key, team, and user, and the values show up in the spend logs and on the usage dashboards alongside the rest of that key's traffic

## What LiteLLM records

The reported values are written as sent. LiteLLM parses them, checks them for sanity, and never recomputes a cost of its own on top

Only the values the target actually reported are written. A target that sends a cost but no token count keeps the token count LiteLLM derived on its own, rather than having it zeroed. A target that sends neither header is left alone entirely, which is the normal case for provider pass-through routes like Anthropic or Vertex AI, where LiteLLM derives the cost from the response body

## Validation

A value that fails any of these checks is treated as not reported, and a warning is written to the proxy logs naming the header and the offending value

| Header | Accepted | Rejected |
| --- | --- | --- |
| `x-litellm-response-cost` | Any finite, non-negative decimal, including `0` | Unparseable text, negative values, `inf`, `nan` |
| `x-litellm-total-tokens` | Any non-negative integer, including `0` | Unparseable text, negative values |

An explicit `0` is a real value, not a missing one, so send both headers even when the totals are zero

## Error responses

The headers are read on every upstream response, whatever the status code. A request that burned tokens before failing books its spend on the failure row instead of being dropped for having a 4xx or 5xx status. Send the headers on error responses too whenever cost was still incurred

On a failure row, a value that was missing or unusable is recorded as `0`

## Precedence over `cost_per_request`

A target that prices its own requests always wins over the flat [`cost_per_request`](./pass_through.md) estimate configured on the endpoint. `cost_per_request` defaults to `0.0` on every config-defined endpoint, so honoring it would zero out the real cost the target just reported

That holds even when the reported value could not be parsed. The request records `0` rather than billing an estimate the target has contradicted

## Rate limits and budgets

Reported tokens charge the same TPM window as the rest of the caller's traffic, so a key or team cannot exceed its shared token limit through pass-through traffic alone. Before this contract, pass-through usage never reached the token window at all, because the rate limiter only read usage off response shapes it models

Recorded cost counts toward budgets the same way any other request's cost does

## Streaming

Streaming targets work, because response headers arrive before the body. A target that only knows its final cost after it has finished streaming cannot report it through this contract, since by then the headers are already on the wire

## Reading the values back

Upstream response headers relay through to the calling client, so callers see the same `x-litellm-response-cost` shape they get from the general API. LiteLLM adds `x-litellm-call-id` on the way out, which is the value to match against the spend logs when reconciling any individual request
