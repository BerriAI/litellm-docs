import subprocess, time, threading, socket, json, os, sys, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
BIN = os.path.join(HERE, "target", "release", "bench")
APP = os.path.join(HERE, "llm_app.py")
# Python interpreter that has litellm + fastapi + uvicorn installed.
# Override with: LITELLM_PYTHON=/path/to/venv/bin/python python3 orchestrate_compare.py
VENVPY = os.environ.get("LITELLM_PYTHON", sys.executable)

MOCK_CHAT = "http://127.0.0.1:9001/v1/chat/completions"
RUST_CHAT = "http://127.0.0.1:9000/v1/chat/completions"
LITELLM_CHAT = "http://127.0.0.1:9002/v1/chat/completions"

def wait_port(port, timeout=90):
    end = time.time() + timeout
    while time.time() < end:
        try:
            s = socket.create_connection(("127.0.0.1", port), 0.3); s.close(); return True
        except OSError:
            time.sleep(0.2)
    return False

def post_ok(url):
    body = json.dumps({"model": "mock", "messages": [{"role": "user", "content": "hi"}]}).encode()
    req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json", "Authorization": "Bearer sk-1234"})
    try:
        with urllib.request.urlopen(req, timeout=5) as r:
            return r.status == 200
    except Exception as e:
        return False

def run_bench(url, total, conc):
    out = subprocess.check_output([BIN, "bench", url, str(total), str(conc)], text=True).strip()
    p50, p90, p95, p99, rps = [float(x) for x in out.split(",")]
    return dict(p50=p50, p90=p90, p95=p95, p99=p99, rps=rps)

def sample_rss(pid, stop, vals):
    while not stop.is_set():
        try:
            r = subprocess.check_output(["ps", "-o", "rss=", "-p", str(pid)], text=True).strip()
            if r:
                vals.append(int(r))
        except subprocess.CalledProcessError:
            pass
        time.sleep(0.03)

mock = subprocess.Popen([BIN, "mock"])
gw = subprocess.Popen([BIN, "gateway"])
assert wait_port(9001) and wait_port(9000), "rust servers failed"

env = dict(os.environ, LITELLM_MASTER_KEY="sk-1234")
env.pop("DATABASE_URL", None)
litellm = subprocess.Popen([VENVPY, APP], env=env, cwd=HERE,
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
assert wait_port(9002, 120), "litellm app failed to bind"
# wait until it actually serves a 200
for _ in range(120):
    if post_ok(LITELLM_CHAT):
        break
    time.sleep(0.5)
else:
    raise SystemExit("litellm proxy never returned 200")
time.sleep(1.0)

CONC = 10  # measure per-request path overhead, not saturation

# warmup
for u in (MOCK_CHAT, RUST_CHAT, LITELLM_CHAT):
    run_bench(u, 1000, CONC)

direct = run_bench(MOCK_CHAT, 20000, CONC)
rust = run_bench(RUST_CHAT, 20000, CONC)

stop = threading.Event(); rss = []
t = threading.Thread(target=sample_rss, args=(litellm.pid, stop, rss)); t.start()
lite = run_bench(LITELLM_CHAT, 6000, CONC)
stop.set(); t.join()
litellm_rss_mb = max(rss) / 1024.0 if rss else float("nan")

for p in (mock, gw, litellm):
    p.terminate()

res = {
    "concurrency": CONC,
    "direct": direct,
    "rust": rust,
    "litellm": lite,
    "rust_overhead_p50_ms": round(rust["p50"] - direct["p50"], 4),
    "rust_overhead_p95_ms": round(rust["p95"] - direct["p95"], 4),
    "litellm_overhead_p50_ms": round(lite["p50"] - direct["p50"], 4),
    "litellm_overhead_p95_ms": round(lite["p95"] - direct["p95"], 4),
    "litellm_rss_mb": round(litellm_rss_mb, 1),
}
print(json.dumps(res, indent=2))
