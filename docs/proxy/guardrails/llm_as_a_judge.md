import Image from '@theme/IdealImage';
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# LLM-as-a-Judge

## Overview

| Property | Details |
|-------|-------|
| Description | Score every incoming request or LLM response 0-100 against weighted criteria using a judge model, and block or log the ones that fall below a threshold. |
| Provider | LiteLLM native (any chat model on your proxy or any provider model can act as the judge) |
| Supported Actions | `block` (raises HTTP 422 when the score is below the threshold), `log` (records the verdict, lets the request or response through) |
| Supported Modes | `pre_call` (the judge evaluates the request messages before they reach the LLM), `during_call` (same as `pre_call`, but the judge runs in parallel with the LLM call), `post_call` (the judge evaluates the LLM response) |
| Streaming Support | Yes. A failing verdict terminates the stream. |
| API Requirements | Credentials for the judge model, either a proxy deployment or provider environment variables |

## How it works

In `post_call` mode the guardrail sends the conversation and the LLM response to the judge model with your criteria. In `pre_call` and `during_call` mode it judges the latest request turn instead, with the earlier role-labelled messages passed along only as context, so an on-topic history does not hide an off-topic new turn and an earlier rejected turn does not sink later valid ones. The judged turn is the trailing run of `user` messages in the request, all of their text parts joined, taken from the messages the guardrail scope keeps (`skip_system_message_in_guardrail`, `skip_tool_message_in_guardrail` and `scan_only_tool_results` apply as usual); when the request does not end with a user turn (for example a tool-result round trip), or the endpoint hands the guardrail no per-message structure, the judge evaluates all of the kept request text. This runs before any response exists, so the judge can reject an off-topic or disallowed request without spending tokens on the main model (`during_call` still runs the main call in parallel and discards its result when the judge rejects). The judge returns a verdict per criterion (score 0-100, reasoning, pass/fail) plus a weighted overall score. If the overall score is below `overall_threshold` and `on_failure` is `block`, the request fails with HTTP 422 carrying the full verdicts; with `on_failure: log` the call proceeds and the verdict is recorded in the request's logging metadata (`eval_information`), visible in spend logs and logging integrations.

Every judged request or response costs one extra LLM call to the judge model.

## Quick Start

### 1. Define Guardrails on your LiteLLM config.yaml

Define your guardrails under the `guardrails` section:

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: chat-model
    litellm_params:
      model: anthropic/{{anthropic_large}}
      api_key: os.environ/ANTHROPIC_API_KEY
  - model_name: my-judge-model
    litellm_params:
      model: anthropic/{{anthropic}}
      api_key: os.environ/ANTHROPIC_API_KEY

guardrails:
  - guardrail_name: "quality-judge"
    litellm_params:
      guardrail: llm_as_a_judge
      mode: post_call
      judge_model: my-judge-model
      overall_threshold: 80
      on_failure: block
      default_on: true
      criteria:
        - name: helpfulness
          weight: 60
          description: Is the response helpful and correct?
        - name: tone
          weight: 40
          description: Is the response professional and polite?
```

Criterion weights must sum to 100. `overall_threshold` defaults to 80 and `on_failure` defaults to `block`.

To judge the request instead of the response, set `mode: pre_call` (or `mode: [pre_call, post_call]` to judge both sides) and write the criteria about the request, for example `description: Is the request about cooking or recipes?`. A rejected request returns HTTP 422 with `"message": "LLM judge rejected request: score below threshold"` and the same `verdicts` payload as below, and the main model is never called.

### 2. Start LiteLLM Gateway

```shell
litellm --config config.yaml --detailed_debug
```

### 3. Test request

<Tabs>
<TabItem label="Blocked Request" value="blocked">

A response that fails the criteria is rejected with HTTP 422 and the verdicts attached:

```shell
curl -i http://localhost:4000/v1/chat/completions \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "chat-model",
    "messages": [{"role": "user", "content": "hi"}]
  }'
```

```json
{
  "error": {
    "message": "LLM judge rejected response: score below threshold",
    "code": "422",
    "provider_specific_fields": {
      "overall_score": 40.0,
      "threshold": 80.0,
      "verdicts": [
        {"criterion_name": "helpfulness", "score": 40, "reasoning": "...", "passed": false, "weight": 60}
      ],
      "guardrail_name": "quality-judge"
    }
  }
}
```

</TabItem>
<TabItem label="Passing Request" value="passing">

A response that meets the threshold is returned unchanged. With `on_failure: log`, even failing responses are returned; the verdict is recorded in `eval_information` in the request metadata so it reaches spend logs and logging callbacks.

</TabItem>
</Tabs>

## Creating the guardrail from the Admin UI

The guardrail can be created entirely from the dashboard: Guardrails, Add New Guardrail, provider "LiteLLM LLM as a Judge". The judge model dropdown is populated from your proxy's model list, and the criteria, threshold, and failure action map to the config fields above. Guardrails created this way are stored in the database and load on startup with no config file entry.

<Image img={require('../../../img/llm_judge_ui_dropdown.png')} />

A blocked response as seen from the Playground; the judge's rejection terminates the stream:

<Image img={require('../../../img/llm_judge_playground_blocked.png')} />

## How the judge model's credentials resolve

`judge_model` is resolved against the proxy's Router first. If the name matches a configured deployment (exact public name, a wildcard route such as `anthropic/*`, or a `model_group_alias` entry), the judge call goes through that deployment and uses its credentials; this is what makes judge models selected in the Admin UI dropdown work, since their keys live in the deployment rather than the environment. A name the Router cannot serve falls back to the SDK, resolving credentials from environment variables like any direct `litellm.completion` call.

Two consequences of the Router path are worth knowing. If a judge model name matches both a deployment and a valid provider model id, the deployment wins, so the deployment's key is used rather than the environment key. And judge calls through a deployment participate in that deployment's rate and cooldown accounting like any other call, so a persistently failing judge can cool down a deployment it shares with user traffic. The judge call itself is made with retries and standard fallbacks disabled so the configured `judge_model` stays authoritative.

## Failure behavior

The guardrail fails open on judge errors: if the judge call fails or returns an unparsable verdict, a warning is logged, the guardrail status is recorded as `guardrail_failed_to_respond`, and the response is returned to the caller. Markdown-fenced JSON verdicts (which some judge models produce) are parsed normally and do not count as failures. Only a successfully parsed verdict below the threshold triggers a block.

## Supported params

```yaml
guardrails:
  - guardrail_name: string          # required, unique name
    litellm_params:
      guardrail: llm_as_a_judge     # required
      mode: pre_call | during_call | post_call  # required; pre_call and during_call judge the request, post_call judges the response
      judge_model: string           # required, proxy model name or provider model id
      criteria:                     # required, at least one entry, weights sum to 100
        - name: string
          weight: number            # percent share of the overall score
          description: string       # what the judge checks for this criterion
      overall_threshold: number     # optional, 0-100, default 80
      on_failure: block | log       # optional, default block
      default_on: boolean           # optional, run on every request without being requested per-call
```
