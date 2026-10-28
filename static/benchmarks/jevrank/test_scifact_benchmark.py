import asyncio
import copy
import json
from argparse import Namespace

import pytest

import scifact_benchmark as bench


def test_metrics_distinguish_hit_and_fractional_recall():
    result = bench.metrics(["a", "z"], {"a": 1, "b": 1})
    assert result["hit_at_20"] == 1
    assert result["recall_at_20"] == .5
    assert result["ndcg_at_10"] == pytest.approx(1 / (1 + 1 / __import__("math").log2(3)))


def test_ranking_uses_candidate_order_for_ties():
    response = {"results": [{"index": 1, "relevance_score": .5}, {"index": 0, "relevance_score": .5}]}
    ranking, _ = bench.normalized_ranking(response, [{"doc_id": "a"}, {"doc_id": "b"}])
    assert ranking == ["a", "b"]


@pytest.mark.parametrize("results", [
    [{"index": 0, "relevance_score": 1}],
    [{"index": 0, "relevance_score": 1}, {"index": 0, "relevance_score": .1}],
    [{"index": 0, "relevance_score": 1}, {"index": 1, "relevance_score": float("nan")}],
])
def test_invalid_rankings_are_rejected(results):
    with pytest.raises(ValueError):
        bench.normalized_ranking({"results": results}, [{"doc_id": "a"}, {"doc_id": "b"}])


def test_unknown_zero_is_not_free_and_explicit_rate_recovers_cost():
    response = {"meta": {"tokens": {"input_tokens": 1000, "output_tokens": 30}}}
    assert bench.cost_record(response, {}, 0, "local_unknown_alias")["usd"] is None
    record = bench.cost_record(response, {"pricing": {
        "input_usd_per_million": .042, "output_usd_per_million": 0, "source": "test"}}, 0)
    assert record["usd"] == pytest.approx(.000042)
    assert record["source"] == "estimate_from_reported_tokens"


@pytest.mark.parametrize("observed", [[], ["typesafe/jev-latest"], ["jev-1.14.0"]])
def test_version_must_be_returned_and_match(observed):
    with pytest.raises(ValueError):
        bench.check_model_version({"resolved_models": observed}, {
            "model": "openai/typesafe/jev-latest", "expected_model_version": "jev-1.13.0"})


def test_matching_concrete_version_is_verified():
    row = {"resolved_models": ["jev-1.13.0"]}
    bench.check_model_version(row, {"model": "openai/typesafe/jev-latest", "expected_model_version": "jev-1.13.0"})
    assert row["model_version_check"]["status"] == "verified"


def test_resume_rejects_duplicate_foreign_or_modified_records():
    query = {"query_id": "q", "input_sha256": "input"}
    row = {"model_name": "m", "query_id": "q", "input_sha256": "input",
           "run_sha256": "run", "status": "success"}
    assert bench.validate_resume_records([row], "run", [query], [{"name": "m"}]) == {("m", "q")}
    for bad in ([row, row], [dict(row, input_sha256="changed")], [dict(row, run_sha256="foreign")]):
        with pytest.raises(ValueError):
            bench.validate_resume_records(bad, "run", [query], [{"name": "m"}])


def test_secrets_removed_from_nested_response_and_errors():
    safe = bench.sanitize({"Authorization": "Bearer secret", "nested": ["error secret", {"api_key": "secret"}]}, ["secret"])
    assert "secret" not in json.dumps(safe)
    assert safe == {"nested": ["error [REDACTED]", {}]}


def test_smoke_cannot_be_a_full_benchmark(tmp_path):
    model = {"name": "m", "model": "m"}
    row = {"model_name": "m", "query_id": "q", "status": "success", "metrics": bench.metrics(["a"], {"a": 1}),
           "latency_seconds": .1, "cost": {"usd": .01, "source": "test"}}
    bench.summarize(tmp_path, [row], [{"query_id": "q"}], [model], "run")
    summary = json.loads((tmp_path / "summary.json").read_text())["models"][0]
    assert summary["complete"]
    assert not summary["eligible_for_full_benchmark"]
    assert not summary["full_test_split"]


def test_dry_run_makes_plan_without_model_calls_or_executed_manifest(tmp_path, monkeypatch):
    config = tmp_path / "config.json"
    config.write_text(json.dumps({"models": [{"name": "m", "model": "m", "strategy": "pointwise"}]}))
    monkeypatch.setattr(bench, "load_prepared", lambda _: ([{"query_id": "q", "candidates": [1, 2]}], {}))
    monkeypatch.setenv("LITELLM_BASE_URL", "https://example.com")
    args = Namespace(config=config, prepared="unused", limit=None, output=tmp_path / "out", mode="gateway",
                     sdk_root=None, execute=False, resume=False)
    asyncio.run(bench.run(args))
    assert not (args.output / "manifest.json").exists()
    assert json.loads((args.output / "plan.json").read_text())["logical_provider_requests"] == {"m": 2}


def test_sdk_passes_price_and_strategy_and_saves_raw_provider_version(tmp_path, monkeypatch):
    seen = {}
    class Decision:
        model = "jev-1.13.0"
        def model_dump(self, **kwargs):
            return {"model": self.model, "usage": {"input_tokens": 1000, "output_tokens": 30}}
    class Result:
        decision_responses = [Decision()]
        _hidden_params = {"response_cost": 0}
        def model_dump(self, **kwargs):
            return {"results": [{"index": 0, "relevance_score": .9}],
                    "meta": {"tokens": {"input_tokens": 1000, "output_tokens": 30}}}
    class SDK:
        async def arerank(self, **kwargs):
            seen.update(kwargs)
            return Result()
    query = {"query_id": "q", "query": "query", "qrels": {"a": 1}, "input_sha256": "input",
             "candidates": [{"doc_id": "a", "text": "passage"}]}
    config = {"models": [{"name": "jev", "model": "openai/typesafe/jev-latest", "strategy": "pointwise",
                           "expected_model_version": "jev-1.13.0", "pricing": {
                               "input_usd_per_million": .042, "output_usd_per_million": 0, "source": "test"}}]}
    path = tmp_path / "config.json"
    path.write_text(json.dumps(config))
    monkeypatch.setattr(bench, "load_prepared", lambda _: ([query], {}))
    monkeypatch.setattr(bench, "sdk_provenance", lambda _: (SDK(), {"revision": "test"}))
    monkeypatch.setenv("LITELLM_API_KEY", "test-secret")
    args = Namespace(config=path, prepared="unused", limit=None, output=tmp_path / "out", mode="sdk",
                     sdk_root="mock", execute=True, resume=False)
    assert asyncio.run(bench.run(args)) == 0
    assert seen["input_cost_per_token"] == pytest.approx(4.2e-8)
    assert seen["decision_rerank"]["strategy"] == "pointwise"
    assert seen["extra_headers"] == {"Cache-Control": "no-cache"}
    row = bench.read_jsonl(args.output / "responses.jsonl")[0]
    assert row["model_version_check"]["status"] == "verified"
    assert row["cost"]["usd"] > 0
    assert "test-secret" not in (args.output / "responses.jsonl").read_text()

