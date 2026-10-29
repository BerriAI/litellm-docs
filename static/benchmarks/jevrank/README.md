# JevRank measured SciFact run

The local LiteLLM SDK completed 300 BEIR SciFact test queries and saved 6,000 document decisions. Every returned model version was `jev-1.13.0`. The measured nDCG@10 was 0.767626, compared with 0.686300 for the same BM25 candidates. Median rerank latency was 0.500629 seconds; p95 was 1.151318 seconds at eight concurrent document calls per query.

The estimated cost was $0.172618278 for 300 queries, or $0.57539426 per 1,000 queries. This uses 4,109,959 returned input tokens at $0.042 per million, with no output-token charge. These are configured gateway rates, not an invoice. `independent-audit.json` records a separate recomputation from the raw probabilities and dataset labels.

`measured-run.json` records model identity, source revision, hashes, retrieval settings, runtime and cost provenance. `measured-per-query.csv` contains every query's metrics, usage and latency. `measured-responses.jsonl.gz` contains normalized provider responses and scores, without credentials or local paths. `before-results.json` records the baseline behavior before the adapter. The three JPG files and `final-results.json` show separate live sync, async and multiple-choice smoke tests; those examples use final preview commit `931b03c0bc12c8e82ce0e5dd27b510f2468c76ed` and are not the 300-query benchmark, which remains pinned to `5aa0a8304c`.

`automatic-rerank/` contains the newer SDK and Router checks at commit `9b8e0715ea6ea9f34a0141e452ccdfc7645c02cb`. Those calls use model-catalog detection without strategy parameters. The earlier benchmark and smoke evidence keep their original revisions.

## Reproduce

Download the runner, pinned requirements, configuration and tests from this directory. Prepare candidates in a Python 3.11 environment:

```sh
uv venv --python 3.11 .venv
uv pip sync --python .venv/bin/python requirements.lock.txt
.venv/bin/python -m pytest -q test_scifact_benchmark.py
.venv/bin/python scifact_benchmark.py prepare --output prepared
```

The runner downloads the official BEIR archive and verifies its published checksum. It uses BM25s 0.3.13, Lucene BM25 with k1=1.5 and b=0.75, English stop words and Snowball stemming, full title plus abstract, and stable corpus-ID order for ties. It saves exactly 20 candidates per query. It does not tune retrieval to match a reference score.

This runner reproduces the historical benchmark and retains the adapter arguments from that revision. Current usage examples in the [JevRank article](https://docs.litellm.ai/blog/jevrank) use the normal rerank interface.

Use the LiteLLM implementation at commit `5aa0a8304cd5bfa095bbd07e77f6f8c367084595` from PR #47782. From that checkout's installed environment:

```sh
uv run --no-sync python /path/to/scifact_benchmark.py run \
  --prepared /path/to/prepared \
  --config /path/to/jev-gateway-sdk.json \
  --output /path/to/run \
  --mode sdk --sdk-root "$PWD"
```

This creates a plan and sends no model requests. Set the key and API base environment variables named by the configuration, then add `--execute` to send requests. A complete pointwise run makes 6,000 logical provider calls. Use `--limit 3` and a separate output directory for a smoke test.

The supplied configuration uses an existing gateway's `/v1/decisions` transport while executing the new rerank adapter locally. The alias `typesafe/jev-latest` returned Jev 1.13.0 in this run; the runner rejects a changed or unverifiable model version. Another gateway can use different aliases, prices, retry policies or models. Configure and verify them before comparing results. Provider keys and endpoint credentials belong in environment variables, never in result files.

SDK mode verifies that imports resolve to the requested checkout. It records the exact source hashes, disables local caching and automatic client retries, and requests no-cache behavior. Gateway-side routing and retry policies remain outside its control. To resume, use `--resume --execute` with the same source, configuration and candidates; completed errors are not silently retried.

The external reference rows in the launch graphic come from a separate experiment and are not included in this measured dataset. The reference does not pin every retrieval detail, and its Jev model is version 1.14. Do not treat those rows as measurements from this run or infer a paired quality difference between experiments.

## Chart data

`figure-data.json` and `figure-data.csv` contain all six plotted rows, their methods, origins and cost provenance. `jevrank-quality-cost.svg` compares quality and cost with zero-baseline bars; `jevrank-cost-quality.svg` plots the same values on two linear axes. The SVGs include provider logos and can be viewed at full size. Matching PNG downloads are 2880 × 2000 pixels.
