#!/usr/bin/env bash
# Quick check that Headroom compression fires on the payloads that matter.
# Calls the Headroom /v1/compress endpoint (the same call the LiteLLM guardrail
# makes) and prints tokens_before/after/saved + the transform applied:
#   1. a tiny prompt              -> 0 saved (nothing to compress)
#   2. a large JSON tool result   -> compressed
#
# Requires a reachable Headroom proxy. Spin one up with the Dockerfile in the
# docs, or locally:  pip install "headroom-ai[proxy]" && headroom proxy --port 8787
# No LLM/provider key needed; /v1/compress rewrites messages without calling a model.
#
# Usage:
#   HEADROOM_URL=http://localhost:8787 bash headroom_compression_check.sh

set -euo pipefail

HEADROOM_URL="${HEADROOM_URL:-http://localhost:8787}"
MODEL="${MODEL:-claude-sonnet-4}"

check() {
  local label="$1" messages="$2"
  echo "=== ${label} ==="
  jq -n --arg m "$MODEL" --argjson msgs "$messages" '{model:$m, messages:$msgs}' \
    | curl -s -X POST "${HEADROOM_URL}/v1/compress" -H "Content-Type: application/json" --data @- \
    | jq -c '{tokens_before, tokens_after, tokens_saved, transforms_applied}'
  echo
}

check "tiny prompt (expect 0 saved)" \
  '[{"role":"user","content":"What is the capital of France? One word."}]'

json=$(jq -nc '{items: [range(0;300) | {id:., name:("product-"+(.|tostring)), price:(.*1.5), tags:["a","b","c"], description:"A high quality product for enterprise use cases."}]}')
check "large JSON tool result (expect compression)" \
  "$(jq -n --arg json "$json" '[
    {role:"assistant", content:null, tool_calls:[{id:"c1", type:"function", function:{name:"get_products", arguments:"{}"}}]},
    {role:"tool", tool_call_id:"c1", content:$json}
  ]')"
