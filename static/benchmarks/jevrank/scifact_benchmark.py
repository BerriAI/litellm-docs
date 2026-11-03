#!/usr/bin/env python3
"""Prepare fixed SciFact candidates, then evaluate rerankers with auditable records."""
from __future__ import annotations

import argparse
import asyncio
import csv
import hashlib
import importlib
import importlib.metadata
import json
import math
import os
from pathlib import Path
import platform
import random
import statistics
import subprocess
import sys
import time
from datetime import datetime, timezone
from urllib.parse import urlsplit
import zipfile

DATA_URL = "https://public.ukp.informatik.tu-darmstadt.de/thakur/BEIR/datasets/scifact.zip"
DATA_MD5 = "5f7d1de60b170fc8027bb7898e2efca1"
EXPECTED_CORPUS = 5183
EXPECTED_QUERIES = 300
MODEL_KEYS = {
    "name", "model", "api_key_env", "api_base_env", "strategy",
    "max_concurrency", "refusal_policy", "pricing", "expected_model_version",
}


def now():
    return datetime.now(timezone.utc).isoformat()


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False,
                                     separators=(",", ":")).encode()).hexdigest()


def file_digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def save_json(path, value):
    Path(path).write_text(json.dumps(value, indent=2, ensure_ascii=False,
                                    allow_nan=False) + "\n")


def read_jsonl(path):
    return [json.loads(line) for line in Path(path).read_text().splitlines() if line]


def save_jsonl(path, rows):
    with Path(path).open("w") as stream:
        for row in rows:
            stream.write(json.dumps(row, ensure_ascii=False, allow_nan=False) + "\n")


def metrics(ranking, qrels):
    """Linear relevance gains, log2 discount, macro average performed by caller."""
    if len(ranking) != len(set(ranking)):
        raise ValueError("Duplicate document in ranking")
    relevant = {doc: float(rel) for doc, rel in qrels.items() if float(rel) > 0}
    ideal = sorted(relevant.values(), reverse=True)[:10]
    idcg = sum(rel / math.log2(i + 2) for i, rel in enumerate(ideal))
    dcg = sum(relevant.get(doc, 0.0) / math.log2(i + 2)
              for i, doc in enumerate(ranking[:10]))
    return {
        "ndcg_at_10": dcg / idcg if idcg else 0.0,
        "hit_at_1": float(any(doc in relevant for doc in ranking[:1])),
        "hit_at_3": float(any(doc in relevant for doc in ranking[:3])),
        "hit_at_20": float(any(doc in relevant for doc in ranking[:20])),
        "recall_at_20": (sum(doc in relevant for doc in ranking[:20]) / len(relevant)
                         if relevant else 0.0),
    }


def average_metrics(rows):
    names = ("ndcg_at_10", "hit_at_1", "hit_at_3", "hit_at_20", "recall_at_20")
    return {name: statistics.mean(row[name] for row in rows) if rows else None
            for name in names}


def prepare(args):
    import bm25s
    import Stemmer
    import httpx
    import numpy as np

    output = Path(args.output).resolve()
    output.mkdir(parents=True, exist_ok=True)
    if (output / "manifest.json").exists():
        raise ValueError("Prepared output already exists; use a new output directory")
    archive = output / "scifact.zip"
    if not archive.exists():
        with httpx.Client(timeout=120, follow_redirects=True) as client:
            response = client.get(DATA_URL)
            response.raise_for_status()
            archive.write_bytes(response.content)
    if hashlib.md5(archive.read_bytes()).hexdigest() != DATA_MD5:
        raise ValueError("Dataset checksum differs from the official BEIR checksum")
    dataset = output / "dataset"
    dataset.mkdir(exist_ok=True)
    wanted = ("corpus.jsonl", "queries.jsonl", "qrels/test.tsv")
    with zipfile.ZipFile(archive) as zipped:
        for name in wanted:
            target = dataset / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(zipped.read("scifact/" + name))
    corpus_rows = read_jsonl(dataset / "corpus.jsonl")
    query_rows = read_jsonl(dataset / "queries.jsonl")
    qrels = {}
    with (dataset / "qrels/test.tsv").open() as stream:
        for row in csv.DictReader(stream, delimiter="\t"):
            qrels.setdefault(row["query-id"], {})[row["corpus-id"]] = int(row["score"])
    if len(corpus_rows) != EXPECTED_CORPUS or len(qrels) != EXPECTED_QUERIES:
        raise ValueError("Unexpected BEIR SciFact corpus or test-query count")
    queries = {row["_id"]: row["text"] for row in query_rows}
    # Freeze corpus order before scoring; equal BM25 scores use this order.
    corpus_rows.sort(key=lambda row: str(row["_id"]))
    texts = [(row.get("title", "").strip() + "\n" + row["text"].strip()).strip()
             for row in corpus_rows]
    settings = {
        "library": "bm25s", "version": importlib.metadata.version("bm25s"),
        "method": "lucene", "k1": 1.5, "b": 0.75, "dtype": "float32",
        "stemmer": "Snowball English", "stemmer_package": importlib.metadata.version("PyStemmer"),
        "stopwords": "en", "lower": True, "token_pattern": r"(?u)\b\w\w+\b",
        "document_format": "stripped title + newline + stripped abstract",
        "top_k": 20, "tie_break": "lexicographic corpus id",
        "numpy_version": np.__version__,
    }
    stemmer = Stemmer.Stemmer("english")
    tokens = bm25s.tokenize(texts, stopwords="en", stemmer=stemmer,
                           token_pattern=settings["token_pattern"], show_progress=False)
    search = bm25s.BM25(k1=1.5, b=0.75, method="lucene", dtype="float32")
    search.index(tokens, show_progress=False)
    prepared = []
    baseline = []
    for qid in sorted(qrels):
        query = queries[qid]
        token_strings = bm25s.tokenize(query, stopwords="en", stemmer=stemmer,
                                      token_pattern=settings["token_pattern"],
                                      return_ids=False, show_progress=False)[0]
        scores = search.get_scores(token_strings)
        indices = np.argsort(-scores, kind="stable")[:20]
        candidates = [{
            "doc_id": str(corpus_rows[int(i)]["_id"]),
            "text": texts[int(i)], "bm25_score": float(scores[int(i)]),
        } for i in indices]
        row = {"query_id": qid, "query": query, "qrels": qrels[qid],
               "candidates": candidates}
        row["input_sha256"] = digest({"query": query, "candidates": candidates})
        prepared.append(row)
        baseline.append({"query_id": qid,
                         **metrics([doc["doc_id"] for doc in candidates], qrels[qid])})
    save_jsonl(output / "candidates.jsonl", prepared)
    save_jsonl(output / "bm25-per-query.jsonl", baseline)
    summary = {
        "origin": "measured_locally", "provider_calls": 0, "queries": len(prepared),
        "metrics": average_metrics(baseline), "reranking_cost_usd": 0,
    }
    save_json(output / "bm25-summary.json", summary)
    manifest = {
        "created_at": now(), "dataset": "BEIR SciFact", "split": "test",
        "dataset_source": DATA_URL, "dataset_archive_md5": DATA_MD5,
        "dataset_archive_sha256": file_digest(archive),
        "dataset_file_sha256": {name: file_digest(dataset / name) for name in wanted},
        "query_count": len(prepared), "corpus_count": len(corpus_rows),
        "retrieval": settings, "retrieval_sha256": digest(settings),
        "candidates_sha256": file_digest(output / "candidates.jsonl"),
        "script_sha256": file_digest(__file__), "python": platform.python_version(),
        "scope_note": "BEIR test split; fixed candidates; no parameter tuning to match reference values.",
    }
    save_json(output / "manifest.json", manifest)
    (output / "preparation-script.py").write_bytes(Path(__file__).read_bytes())
    print(json.dumps(summary, indent=2))


def load_prepared(path):
    path = Path(path)
    manifest = json.loads((path / "manifest.json").read_text())
    if file_digest(path / "candidates.jsonl") != manifest["candidates_sha256"]:
        raise ValueError("Candidate file changed after preparation")
    rows = read_jsonl(path / "candidates.jsonl")
    if len(rows) != manifest["query_count"] or len({r["query_id"] for r in rows}) != len(rows):
        raise ValueError("Prepared query count or IDs are invalid")
    for row in rows:
        expected = digest({"query": row["query"], "candidates": row["candidates"]})
        if expected != row["input_sha256"]:
            raise ValueError("Prepared query content checksum mismatch")
    return rows, manifest


def validate_config(config):
    allowed = {"models", "gateway_url_env", "gateway_revision", "timeout_seconds"}
    if set(config) - allowed or not isinstance(config.get("models"), list):
        raise ValueError("Unknown config fields or missing models list")
    names = []
    for model in config["models"]:
        if set(model) - MODEL_KEYS:
            raise ValueError("Unknown model config fields; credentials must be environment variables")
        name = model.get("name", "")
        if not name or not all(c.isalnum() or c in "-_" for c in name):
            raise ValueError("Model name must contain only letters, numbers, dash, underscore")
        if not isinstance(model.get("model"), str) or not model["model"]:
            raise ValueError("A provider model ID or gateway alias is required")
        if model.get("strategy") not in (None, "pointwise", "multiple_choice"):
            raise ValueError("Unsupported scoring strategy")
        if model.get("expected_model_version") is not None and not isinstance(model["expected_model_version"], str):
            raise ValueError("expected_model_version must be a concrete provider version string")
        if model.get("refusal_policy", "error") != "error":
            raise ValueError("Benchmark uses error refusal policy; no silent zero judgments")
        concurrency = model.get("max_concurrency", 8)
        if type(concurrency) is not int or not 1 <= concurrency <= 32:
            raise ValueError("max_concurrency must be an integer from 1 to 32")
        for key in ("api_key_env", "api_base_env"):
            value = model.get(key)
            if value is not None and (not isinstance(value, str) or not value.isidentifier()):
                raise ValueError("Credential and URL references must name environment variables")
        pricing = model.get("pricing")
        if pricing is not None:
            supported = {"input_usd_per_million", "output_usd_per_million", "usd_per_search_unit", "source"}
            if set(pricing) - supported or not pricing.get("source"):
                raise ValueError("Pricing requires an explicit source and supported rate fields")
            for key, value in pricing.items():
                if key != "source" and (type(value) not in (int, float) or
                                        not math.isfinite(value) or value < 0):
                    raise ValueError("Invalid pricing rate")
        names.append(name)
    if not names or len(set(names)) != len(names):
        raise ValueError("Model names must be nonempty and unique")
    timeout = config.get("timeout_seconds", 120)
    if type(timeout) not in (float, int) or not math.isfinite(timeout) or timeout <= 0:
        raise ValueError("timeout_seconds must be positive")


def validated_url(value):
    parts = urlsplit(value)
    if (parts.scheme not in ("http", "https") or not parts.hostname or parts.username
            or parts.password or parts.query or parts.fragment):
        raise ValueError("Use a base URL without credentials, query parameters, or fragments")
    if parts.scheme == "http" and parts.hostname not in ("localhost", "127.0.0.1", "::1"):
        raise ValueError("Remote gateway URLs must use HTTPS")
    return value.rstrip("/")


def normalized_ranking(response, candidates):
    results = response.get("results")
    if not isinstance(results, list) or len(results) != len(candidates):
        raise ValueError("Reranker did not return a complete candidate ranking")
    scores = {}
    for result in results:
        index = result.get("index")
        score = result.get("relevance_score")
        if type(index) is not int or not 0 <= index < len(candidates) or index in scores:
            raise ValueError("Invalid, repeated, or missing result index")
        if type(score) not in (int, float) or not math.isfinite(score):
            raise ValueError("Invalid relevance score")
        scores[index] = float(score)
    order = sorted(scores, key=lambda i: (-scores[i], i))
    return [candidates[i]["doc_id"] for i in order], [
        {"index": i, "doc_id": candidates[i]["doc_id"], "score": scores[i]} for i in order
    ]


def cost_record(response, model, reported=None, source=None):
    usage = response.get("meta", {}).get("tokens", {})
    billed = response.get("meta", {}).get("billed_units", {})
    record = {"usd": None, "source": None, "input_tokens": usage.get("input_tokens"),
              "output_tokens": usage.get("output_tokens"), "billed_units": billed}
    pricing = model.get("pricing")
    expected = None
    if pricing and type(usage.get("input_tokens")) is int and type(usage.get("output_tokens")) is int:
        if "input_usd_per_million" in pricing and "output_usd_per_million" in pricing:
            expected = (usage["input_tokens"] * pricing["input_usd_per_million"]
                        + usage["output_tokens"] * pricing["output_usd_per_million"]) / 1_000_000
    if reported is not None:
        try:
            value = float(reported)
            # Unknown custom aliases can produce zero locally; that is not proof of free usage.
            if math.isfinite(value) and value > 0:
                record.update(usd=value, source=source)
        except (ValueError, TypeError):
            pass
    if pricing and record["usd"] is None:
        units = billed.get("search_units")
        if "usd_per_search_unit" in pricing and type(units) in (float, int):
            record.update(usd=units * pricing["usd_per_search_unit"],
                          source="estimate_from_reported_search_units")
        elif expected is not None:
            record.update(usd=expected, source="estimate_from_reported_tokens")
        record["pricing"] = pricing
    if expected is not None:
        record["token_rate_estimate_usd"] = expected
        record["pricing"] = pricing
    return record


def check_model_version(record, model):
    observed = record.get("resolved_models", [])
    expected = model.get("expected_model_version")
    # A requested ID may be a formatting fallback. Only a distinct concrete provider
    # version can be verified from this response surface.
    requested = model["model"].removeprefix("openai/")
    returned = [version for version in observed if version not in (requested, model["model"])]
    record["model_version_check"] = {
        "expected": expected, "observed": observed,
        "status": "not_requested" if not expected else "unavailable",
    }
    if expected:
        if not returned:
            raise ValueError("Provider did not return a distinct concrete version; expected version cannot be verified")
        if set(returned) != {expected} or len(returned) != len(observed):
            record["model_version_check"]["status"] = "mismatch"
            raise ValueError("Returned provider model version differs from expected_model_version")
        record["model_version_check"]["status"] = "verified"


def validate_resume_records(records, fingerprint, prepared, models):
    queries = {row["query_id"]: row for row in prepared}
    names = {model["name"] for model in models}
    seen = set()
    for row in records:
        key = (row.get("model_name"), row.get("query_id"))
        query = queries.get(key[1])
        if (row.get("run_sha256") != fingerprint or key in seen or key[0] not in names
                or query is None or row.get("input_sha256") != query["input_sha256"]
                or row.get("status") not in ("success", "error")):
            raise ValueError("Saved response does not match this run, or duplicates an existing query")
        seen.add(key)
    return seen


def sanitize(value, secrets):
    if isinstance(value, dict):
        return {k: sanitize(v, secrets) for k, v in value.items()
                if k.lower() not in {"authorization", "api_key", "x-api-key", "cookie", "set-cookie"}}
    if isinstance(value, list):
        return [sanitize(v, secrets) for v in value]
    if isinstance(value, str):
        for secret in secrets:
            if secret:
                value = value.replace(secret, "[REDACTED]")
    return value


def sdk_provenance(root):
    root = Path(root).resolve()
    sys.path.insert(0, str(root))
    litellm = importlib.import_module("litellm")
    if not Path(litellm.__file__).resolve().is_relative_to(root):
        raise ValueError("SDK import did not resolve to the requested worktree")
    adapter = root / "litellm/rerank_api/decision_rerank.py"
    if not adapter.exists():
        raise ValueError("Requested SDK tree does not contain the decision-rerank adapter")
    revision = subprocess.check_output(["git", "-C", str(root), "rev-parse", "HEAD"], text=True).strip()
    dirty = subprocess.check_output(["git", "-C", str(root), "status", "--porcelain", "--untracked-files=no"], text=True)
    return litellm, {"revision": revision, "tracked_changes": bool(dirty),
                     "adapter_sha256": file_digest(adapter),
                     "decisions_transport_sha256": file_digest(root / "litellm/decisions/call.py"),
                     "decisions_source_sha256": {str(path.relative_to(root)): file_digest(path)
                         for path in sorted((root / "litellm/decisions").rglob("*.py"))},
                     "httpx_version": importlib.metadata.version("httpx"),
                     "import_path": str(Path(litellm.__file__).resolve())}


async def run(args):
    import httpx

    config = json.loads(Path(args.config).read_text())
    validate_config(config)
    prepared, preparation = load_prepared(args.prepared)
    if args.limit is not None:
        if args.limit < 1:
            raise ValueError("limit must be positive")
        prepared = prepared[:args.limit]
    output = Path(args.output).resolve()
    output.mkdir(parents=True, exist_ok=True)
    run_config = {
        "mode": args.mode, "models": config["models"], "preparation": preparation,
        "limit": args.limit, "timeout_seconds": config.get("timeout_seconds", 120),
        "query_concurrency": 1, "automatic_retries": 0,
        "script_sha256": file_digest(__file__),
    }
    litellm = None
    if args.mode == "sdk":
        if not args.sdk_root:
            raise ValueError("SDK mode requires --sdk-root pointing to the PR worktree")
        litellm, run_config["sdk"] = sdk_provenance(args.sdk_root)
        litellm.suppress_debug_info = True
        litellm.num_retries = 0
    else:
        env_name = config.get("gateway_url_env", "LITELLM_BASE_URL")
        if not os.environ.get(env_name):
            raise ValueError(f"Gateway URL environment variable is missing: {env_name}")
        run_config["gateway_url"] = validated_url(os.environ[env_name])
        run_config["gateway_revision"] = config.get("gateway_revision")
    key_values = {}
    for model in config["models"]:
        env_name = model.get("api_key_env", "LITELLM_API_KEY")
        if args.execute and not os.environ.get(env_name):
            raise ValueError(f"API key environment variable is missing for {model['name']}: {env_name}")
        key_values[model["name"]] = os.environ.get(env_name, "")
        base_env = model.get("api_base_env")
        if base_env:
            if not os.environ.get(base_env):
                raise ValueError(f"API base environment variable is missing: {base_env}")
            run_config.setdefault("model_api_bases", {})[model["name"]] = validated_url(os.environ[base_env])
    fingerprint = digest(run_config)
    manifest_path = output / "manifest.json"
    planned = {m["name"]: sum(len(q["candidates"]) for q in prepared)
               if m.get("strategy") == "pointwise" else len(prepared)
               for m in config["models"]}
    if not args.execute:
        plan = {"dry_run": True, "configuration_sha256": fingerprint, "configuration": run_config,
                "queries": len(prepared), "logical_provider_requests": planned,
                "note": "No model requests sent. --execute is required."}
        save_json(output / "plan.json", plan)
        print(json.dumps({k: v for k, v in plan.items() if k != "configuration"}, indent=2))
        return
    if manifest_path.exists():
        previous = json.loads(manifest_path.read_text())
        if not args.resume or previous["configuration_sha256"] != fingerprint:
            raise ValueError("Existing run requires --resume and identical dataset/configuration")
    else:
        save_json(manifest_path, {"started_at": now(), "configuration_sha256": fingerprint,
                                 "configuration": run_config, "script_sha256": file_digest(__file__),
                                 "python": platform.python_version(), "execute": args.execute})
    path = output / "responses.jsonl"
    records = read_jsonl(path) if path.exists() else []
    done = validate_resume_records(records, fingerprint, prepared, config["models"])
    secrets = list(key_values.values())
    async with httpx.AsyncClient(timeout=config.get("timeout_seconds", 120),
                                 follow_redirects=False) as client:
        for model in config["models"]:
            for query in prepared:
                if (model["name"], query["query_id"]) in done:
                    continue
                request = {"model": model["model"], "query": query["query"],
                           "documents": [d["text"] for d in query["candidates"]],
                           "top_n": len(query["candidates"]), "return_documents": False}
                if model.get("strategy"):
                    request.update(rerank_mode="decisions", decision_rerank={
                        "strategy": model["strategy"],
                        "max_concurrency": model.get("max_concurrency", 8),
                        "refusal_policy": "error"})
                record = {"run_sha256": fingerprint, "model_name": model["name"],
                          "query_id": query["query_id"], "started_at": now(),
                          "input_sha256": query["input_sha256"], "request_sha256": digest(request),
                          "candidate_ids": [d["doc_id"] for d in query["candidates"]]}
                started = time.perf_counter()
                try:
                    reported_cost, cost_source = None, None
                    if args.mode == "gateway":
                        url = run_config["gateway_url"] + "/rerank"
                        response = await client.post(url, json=request,
                            headers={"Authorization": "Bearer " + key_values[model["name"]],
                                     "Cache-Control": "no-cache"})
                        record["http_status"] = response.status_code
                        record["response_headers"] = {k: v for k, v in response.headers.items()
                            if k.lower() in {"x-litellm-call-id", "x-litellm-response-cost",
                                             "x-litellm-model-id", "x-litellm-version", "x-request-id"}}
                        try:
                            raw = response.json()
                        except ValueError:
                            raw = {"unparsed_body": response.text}
                        record["response"] = raw
                        response.raise_for_status()
                        reported_cost = response.headers.get("x-litellm-response-cost")
                        cost_source = "gateway_reported_cost"
                    else:
                        kwargs = dict(request, api_key=key_values[model["name"]],
                                      timeout=config.get("timeout_seconds", 120),
                                      caching=False, num_retries=0,
                                      extra_headers={"Cache-Control": "no-cache"})
                        pricing = model.get("pricing", {})
                        if "input_usd_per_million" in pricing and "output_usd_per_million" in pricing:
                            kwargs.update(input_cost_per_token=pricing["input_usd_per_million"] / 1_000_000,
                                          output_cost_per_token=pricing["output_usd_per_million"] / 1_000_000)
                        if model.get("api_base_env"):
                            kwargs["api_base"] = run_config["model_api_bases"][model["name"]]
                        result = await litellm.arerank(**kwargs)
                        raw = result.model_dump(mode="json")
                        record["response"] = raw
                        decision_responses = getattr(result, "decision_responses", ())
                        record["decision_responses"] = [r.model_dump(mode="json") for r in decision_responses]
                        hidden = getattr(result, "_hidden_params", {})
                        reported_cost = hidden.get("response_cost")
                        cost_source = "litellm_calculated_cost"
                        record["resolved_models"] = sorted({r.model for r in decision_responses})
                    record["cost"] = cost_record(raw, model, reported_cost, cost_source)
                    check_model_version(record, model)
                    ranking, scores = normalized_ranking(raw, query["candidates"])
                    record.update(status="success", ranking=scores, metrics=metrics(ranking, query["qrels"]))
                except Exception as exc:
                    record.update(status="error", error_type=type(exc).__name__,
                                  error=str(exc), metrics=metrics([], query["qrels"]))
                    record.setdefault("cost", {"usd": None, "source": None})
                record["latency_seconds"] = time.perf_counter() - started
                record = sanitize(record, secrets)
                with path.open("a") as stream:
                    stream.write(json.dumps(record, ensure_ascii=False, allow_nan=False) + "\n")
                records.append(record)
                print(f"{model['name']} {query['query_id']} {record['status']}", flush=True)
    summarize(output, records, prepared, config["models"], fingerprint)
    return 2 if any(row["status"] == "error" for row in records) else 0


def percentile(values, quantile):
    if not values:
        return None
    ordered = sorted(values)
    location = (len(ordered) - 1) * quantile
    lower = int(location)
    upper = min(lower + 1, len(ordered) - 1)
    return ordered[lower] + (ordered[upper] - ordered[lower]) * (location - lower)


def summarize(output, records, queries, models, fingerprint):
    summaries = []
    by_model = {}
    for model in models:
        rows = [r for r in records if r["model_name"] == model["name"]]
        successful = [r for r in rows if r["status"] == "success"]
        costs = [r["cost"]["usd"] for r in rows if r["cost"].get("usd") is not None]
        complete = len(rows) == len(queries) and len(successful) == len(queries)
        all_costs = complete and len(costs) == len(queries)
        by_model[model["name"]] = {r["query_id"]: r for r in successful}
        summaries.append({
            "model_name": model["name"], "model_config": model,
            "origin": "measured_via_litellm", "queries_expected": len(queries),
            "queries_attempted": len(rows), "queries_succeeded": len(successful),
            "errors": len(rows) - len(successful), "complete": complete,
            "full_test_split": len(queries) == EXPECTED_QUERIES,
            "eligible_for_full_benchmark": complete and len(queries) == EXPECTED_QUERIES,
            "resolved_models": sorted({v for r in rows for v in r.get("resolved_models", [])}),
            "model_versions_verified": complete and all(
                r.get("model_version_check", {}).get("status") == "verified" for r in rows),
            "metrics_all_queries_errors_zero": average_metrics([r["metrics"] for r in rows]),
            "metrics_successes_only": average_metrics([r["metrics"] for r in successful]),
            "latency_p50_seconds": percentile([r["latency_seconds"] for r in successful], .5),
            "latency_p95_seconds": percentile([r["latency_seconds"] for r in successful], .95),
            "known_cost_sum_usd": sum(costs), "cost_known_queries": len(costs),
            "cost_complete": all_costs,
            "cost_per_1000_queries_usd": sum(costs) / len(queries) * 1000 if all_costs else None,
            "cost_sources": sorted({r["cost"].get("source") for r in rows if r["cost"].get("source")}),
            "cost_note": "Reported/calculated API costs; provider billing may include unobserved failed work.",
        })
    pairs = []
    for left_index, left in enumerate(models):
        for right in models[left_index + 1:]:
            ids = sorted(set(by_model[left["name"]]) & set(by_model[right["name"]]))
            deltas = [by_model[left["name"]][q]["metrics"]["ndcg_at_10"] -
                      by_model[right["name"]][q]["metrics"]["ndcg_at_10"] for q in ids]
            rng = random.Random(42)
            samples = sorted(statistics.mean(rng.choices(deltas, k=len(deltas)))
                             for _ in range(5000)) if deltas else []
            pairs.append({"left": left["name"], "right": right["name"],
                          "shared_successful_queries": len(ids),
                          "excluded_queries": len(queries) - len(ids),
                          "ndcg_at_10_delta": statistics.mean(deltas) if deltas else None,
                          "paired_bootstrap_95pct": [percentile(samples, .025), percentile(samples, .975)],
                          "bootstrap_samples": 5000, "seed": 42})
    save_json(Path(output) / "summary.json", {"finished_at": now(), "run_sha256": fingerprint,
              "models": summaries, "paired_comparisons": pairs,
              "publication_note": "Require complete coverage, verified model versions and cost sources before claims."})


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    prep = commands.add_parser("prepare", help="Download BEIR and prepare fixed BM25 candidates; no model calls")
    prep.add_argument("--output", required=True)
    evaluation = commands.add_parser("run", help="Dry run by default; --execute sends model requests")
    evaluation.add_argument("--prepared", required=True)
    evaluation.add_argument("--config", required=True)
    evaluation.add_argument("--output", required=True)
    evaluation.add_argument("--mode", choices=("gateway", "sdk"), required=True)
    evaluation.add_argument("--sdk-root")
    evaluation.add_argument("--limit", type=int)
    evaluation.add_argument("--execute", action="store_true")
    evaluation.add_argument("--resume", action="store_true")
    args = parser.parse_args()
    if args.command == "prepare":
        prepare(args)
    else:
        raise SystemExit(asyncio.run(run(args)))


if __name__ == "__main__":
    main()
