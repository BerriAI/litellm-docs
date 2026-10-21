# Automatic JevRank SDK and Router checks

These three live checks use LiteLLM commit `9b8e0715ea6ea9f34a0141e452ccdfc7645c02cb`: synchronous `rerank`, asynchronous `arerank`, and a Router deployment alias. Each sends a query and two documents through the existing gateway. The model catalog selects the scoring method; the calls contain no strategy parameters or mode override.

All three checks returned Jev 1.13.0, ranked the relevant document first, and preserved the original document indexes. Each completed two HTTP 200 provider requests and reported 642 input tokens and 44 output tokens. The SDK cost calculation, tokens multiplied by the configured price, and observed gateway cost headers each totalled $0.000026964. Latencies were 0.439 seconds for sync, 0.154 for async, and 0.296 for the Router alias.

`final-results.json` records the responses, usage, cost reconciliation, model identity and source revision. The three PNGs are browser captures of those recorded results. The preview uses its bundled model catalog with `LITELLM_LOCAL_MODEL_COST_MAP=True` and an explicit gateway price of $0.042 per million input tokens with no output charge. Credentials are not included.

`before-results.json` records the same public SDK paths at merge base `0e24bbb8a2c4e250cde60ca92df92ea2ffe3de60`. All three raised the unsupported-provider error, used no real API key, and made zero audited socket connection attempts.

These checks verify request routing, response mapping and accounting. They do not measure ranking quality. The 300-query SciFact benchmark remains pinned to `5aa0a8304c` in the parent directory.
