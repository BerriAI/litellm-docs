import base64, json, os, secrets, time, requests

BASE = os.getenv("LITELLM_URL", "http://localhost:4002")
KEY = os.getenv("LITELLM_KEY", "local-tracing-master-key")
MODEL = os.getenv("MODEL", "gpt-6.1-sol")
H = {"Authorization": f"Bearer {KEY}"}

trace = secrets.token_bytes(16)
spans, now = [], time.time_ns()


def attr(k, v):
    return {"key": k, "value": {"stringValue": str(v)}}


def span(name, parent, dur_ms, attrs):
    global now
    sid = secrets.token_bytes(8)
    s = {"traceId": base64.b64encode(trace).decode(), "spanId": base64.b64encode(sid).decode(),
         "name": name, "kind": 1, "startTimeUnixNano": str(now),
         "endTimeUnixNano": str(now + dur_ms * 1_000_000), "attributes": attrs, "status": {"code": 1}}
    if parent:
        s["parentSpanId"] = parent
    spans.append(s)
    now += dur_ms * 1_000_000
    return s["spanId"]


def chat(parent, prompt):
    r = requests.post(f"{BASE}/v1/chat/completions", headers=H,
                      json={"model": MODEL, "messages": [{"role": "user", "content": prompt}]}).json()
    span(f"chat {MODEL}", parent, 900, [
        attr("gen_ai.operation.name", "chat"), attr("gen_ai.request.model", MODEL),
        attr("gen_ai.response.id", r["id"]),  # links this span to its cost
        attr("gen_ai.input.messages", json.dumps([{"role": "user", "content": prompt}])),
        attr("gen_ai.output.messages", json.dumps(r["choices"][0]["message"]))])


root = span("invoke_agent research-agent", None, 0, [
    attr("gen_ai.operation.name", "invoke_agent"), attr("gen_ai.agent.name", "research-agent"),
    attr("gen_ai.input.messages", json.dumps([{"role": "user", "content": "Why did p99 latency regress?"}]))])
chat(root, "Plan the research steps")
for i in range(20):
    span("execute_tool web_search", root, 300, [
        attr("gen_ai.operation.name", "execute_tool"), attr("gen_ai.tool.name", "web_search"),
        attr("gen_ai.tool.call.arguments", json.dumps({"q": f"query {i}"})), attr("gen_ai.tool.call.result", "10 results")])
chat(root, "Summarize what you found")

payload = {"resourceSpans": [{"resource": {"attributes": [attr("service.name", "my-agent")]},
                              "scopeSpans": [{"scope": {"name": "demo"}, "spans": spans}]}]}
r = requests.post(f"{BASE}/v1/traces", headers={**H, "Content-Type": "application/json"}, data=json.dumps(payload))
print(r.status_code, "trace", trace.hex())
