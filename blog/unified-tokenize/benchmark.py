"""Measure public atokenize calls against an independent loopback HTTP stub.

Run from a LiteLLM source checkout after `uv run maturin develop --release`:
    PYTHONPATH=. uv run --no-sync python /path/to/benchmark.py --output results.json

Requires the checkout's compiled Rust extension, uvicorn, and Starlette.
The stub returns fixed tokens; this does not measure a provider's tokenizer.
"""

from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import math
import os
import platform
import socket
import statistics
import subprocess
import sys
import time
from datetime import UTC, datetime
from pathlib import Path
from urllib.error import URLError
from urllib.request import urlopen


def serve(port: int) -> None:
    import uvicorn
    from starlette.applications import Starlette
    from starlette.requests import Request
    from starlette.responses import JSONResponse
    from starlette.routing import Route

    requests = 0

    async def tokenize(request: Request) -> JSONResponse:
        nonlocal requests
        expected = {
            "model": "benchmark-model",
            "prompt": "Hello world",
            "add_special_tokens": True,
            "return_token_strs": True,
        }
        if await request.json() != expected:
            return JSONResponse({"error": "Unexpected provider request"}, status_code=400)
        if request.headers.get("authorization") != "Bearer benchmark-key":
            return JSONResponse({"error": "Unexpected provider authorization"}, status_code=401)
        requests += 1
        return JSONResponse({"count": 2, "tokens": [101, 102], "token_strs": ["Hello", " world"]})

    async def stats(_: Request) -> JSONResponse:
        return JSONResponse({"requests": requests})

    app = Starlette(routes=[Route("/tokenize", tokenize, methods=["POST"]), Route("/stats", stats)])
    uvicorn.run(app, host="127.0.0.1", port=port, loop="asyncio", http="h11", log_level="error", access_log=False)


def percentile(values: list[float], fraction: float) -> float:
    return sorted(values)[max(0, math.ceil(len(values) * fraction) - 1)]


async def measure(base: str, concurrency: int, requests: int) -> dict[str, object]:
    import litellm

    async def worker(count: int) -> list[float]:
        latencies = []
        for _ in range(count):
            start = time.perf_counter()
            response = await litellm.atokenize(
                model="hosted_vllm/benchmark-model",
                prompt="Hello world",
                api_base=base,
                api_key="benchmark-key",
            )
            elapsed_ms = (time.perf_counter() - start) * 1000
            if response.model_dump() != {
                "model": "benchmark-model",
                "count": 2,
                "token_ids": [101, 102],
                "tokens": ["Hello", " world"],
            }:
                raise AssertionError("Unexpected normalized tokenization response")
            headers = response._hidden_params.get("additional_headers", {})
            if headers.get("x-litellm-rust") != "true":
                raise AssertionError("Response was not marked as Rust execution")
            latencies.append(elapsed_ms)
        return latencies

    counts = [requests // concurrency + (index < requests % concurrency) for index in range(concurrency)]
    start = time.perf_counter()
    batches = await asyncio.gather(*(worker(count) for count in counts))
    duration = time.perf_counter() - start
    latencies = [value for batch in batches for value in batch]
    return {
        "requests": len(latencies),
        "elapsed_seconds": duration,
        "requests_per_second": len(latencies) / duration,
        "p50_ms": statistics.median(latencies),
        "p95_ms": percentile(latencies, 0.95),
        "p99_ms": percentile(latencies, 0.99),
        "max_ms": max(latencies),
    }


def command_output(*arguments: str) -> str:
    return subprocess.check_output(arguments, text=True).strip()


def stats(base: str) -> dict[str, int]:
    with urlopen(f"{base}/stats", timeout=1) as response:
        return json.load(response)


async def benchmark(args: argparse.Namespace) -> dict[str, object]:
    import uvicorn

    from litellm.rust_bridge.loader import get_native_bridge

    native = get_native_bridge()
    if native is None or native.__file__ is None:
        raise RuntimeError("Build and install the Rust extension before benchmarking")
    native_path = Path(native.__file__)
    artifact = Path("litellm-rust/target/release/lib_native.dylib")
    if not artifact.exists():
        artifact = Path("litellm-rust/target/release/lib_native.so")
    digest = hashlib.sha256(native_path.read_bytes()).hexdigest()
    if not artifact.exists() or hashlib.sha256(artifact.read_bytes()).hexdigest() != digest:
        raise RuntimeError("Installed native extension must match this checkout's release artifact")

    with socket.socket() as listener:
        listener.bind(("127.0.0.1", 0))
        port = listener.getsockname()[1]
    base = f"http://127.0.0.1:{port}"
    server = subprocess.Popen([sys.executable, str(Path(__file__).resolve()), "--serve", str(port)])
    try:
        for _ in range(100):
            if server.poll() is not None:
                raise RuntimeError("Stub provider exited before startup")
            try:
                stats(base)
                break
            except (URLError, TimeoutError):
                await asyncio.sleep(0.05)
        else:
            raise RuntimeError("Stub provider did not become ready")

        results = []
        for concurrency in args.concurrency:
            await measure(base, concurrency, args.warmup)
            trials = []
            for trial in range(args.trials):
                result = await measure(base, concurrency, args.requests)
                result["trial"] = trial + 1
                trials.append(result)
                print(json.dumps({"concurrency": concurrency, **result}), flush=True)
            ordered = sorted(trials, key=lambda trial: trial["requests_per_second"])
            representative = ordered[len(ordered) // 2]
            results.append({"concurrency": concurrency, **representative, "trials": trials})

        provider_requests = stats(base)["requests"]
        expected_requests = len(args.concurrency) * (args.warmup + args.requests * args.trials)
        if provider_requests != expected_requests:
            raise AssertionError(f"Provider received {provider_requests}, expected {expected_requests}")
    finally:
        server.terminate()
        server.wait(timeout=10)

    machine = platform.processor() or platform.machine()
    if sys.platform == "darwin":
        machine = command_output("sysctl", "-n", "machdep.cpu.brand_string")
    return {
        "environment": {
            "measured_at_utc": datetime.now(UTC).isoformat(),
            "machine": machine,
            "logical_cpus": os.cpu_count(),
            "os": f"macOS {platform.mac_ver()[0]}" if sys.platform == "darwin" else platform.platform(),
            "python": platform.python_version(),
            "rustc": command_output("rustc", "--version"),
            "uvicorn": uvicorn.__version__,
            "extension_profile": "release",
            "build_command": "uv run --no-sync maturin develop --release",
            "extension_sha256": digest,
            "implementation_commit": command_output("git", "rev-parse", "HEAD"),
        },
        "methodology": {
            "api": "litellm.atokenize",
            "requests_per_trial": args.requests,
            "warmup_requests_per_concurrency": args.warmup,
            "trials": args.trials,
            "concurrency": args.concurrency,
            "prompt": "Hello world",
            "provider_response": {"count": 2, "tokens": [101, 102], "token_strs": ["Hello", " world"]},
            "provider_requests_verified": provider_requests,
            "errors": 0,
            "summary_selection": "Trial with median throughput at each concurrency; latency percentiles from that same trial.",
            "load": "Closed-loop workers; each worker starts its next call after its previous call completes.",
            "timing": "Latency spans await atokenize; throughput also includes validation of each returned response.",
            "scope": "Public async Python SDK, Python/Rust bridge, Rust provider integration, loopback HTTP, independent uvicorn/h11 stub, response normalization.",
            "excluded": "Real provider tokenization, external network, TLS, cold starts, proxy authentication/routing, database, and configured observability callbacks.",
            "caveat": "Local development-machine measurement. Fixed mock provider response. Not a provider latency benchmark or a comparison with Python.",
        },
        "results": results,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--serve", type=int, help=argparse.SUPPRESS)
    parser.add_argument("--requests", type=int, default=4096)
    parser.add_argument("--warmup", type=int, default=256)
    parser.add_argument("--trials", type=int, default=3)
    parser.add_argument("--concurrency", type=int, nargs="+", default=[1, 8, 32])
    parser.add_argument("--output", type=Path, default=Path("results.json"))
    args = parser.parse_args()
    if args.serve is not None:
        serve(args.serve)
        return
    if min(args.requests, args.warmup, args.trials, *args.concurrency) < 1:
        parser.error("Request counts, trial count, and concurrency must be positive")
    result = asyncio.run(benchmark(args))
    args.output.write_text(json.dumps(result, indent=2) + "\n")


if __name__ == "__main__":
    main()
