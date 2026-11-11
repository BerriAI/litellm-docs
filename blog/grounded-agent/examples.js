export const setup = String.raw`git clone https://github.com/BerriAI/litellm-grounded-agent-starter.git
cd litellm-grounded-agent-starter
uv sync
uv run grounded-agent-demo`;

export const bedrockConfig = String.raw`guardrails:
  - guardrail_name: answer-grounding
    litellm_params:
      guardrail: bedrock
      mode: post_call
      default_on: false
      guardrailIdentifier: os.environ/BEDROCK_GUARDRAIL_ID
      guardrailVersion: os.environ/BEDROCK_GUARDRAIL_VERSION
      aws_region_name: os.environ/AWS_REGION_NAME
      contextual_grounding_from_messages: true
      outputScope: FULL`;

export const sdkConnection = String.raw`import os
import litellm

litellm.api_base = os.environ["LITELLM_API_BASE"]
litellm.api_key = os.environ["LITELLM_API_KEY"]`;

export const policy = String.raw`Employees receive a one-time home office equipment allowance of $500.
Submit receipts within 30 days of purchase.`;

export const evidence = String.raw`from pathlib import Path

question = "How much can I spend on my home office?"
evidence = Path("home-office.md").read_text()

source_messages = [
    {"role": "system", "content": evidence},
    {"role": "user", "content": question},
]`;

export const generateAnswer = String.raw`completion = await litellm.acompletion(
    model="openai/agent",
    messages=[
        {"role": "system", "content": "Answer using only this policy:\n" + evidence},
        {"role": "user", "content": question},
    ],
)
answer = completion.choices[0].message.content`;

export const sdkCall = String.raw`native_result = await litellm.guardrails.apply(
    "answer-grounding",
    response=answer,
    messages=source_messages,
)`;

export const bedrockResult = String.raw`{
  "contextualGroundingPolicy": {
    "filters": [{
      "type": "GROUNDING",
      "score": 0.98,
      "threshold": 0.7,
      "detected": false
    }]
  }
}`;

export const readAssessment = String.raw`results = native_result if isinstance(native_result, list) else [native_result]
checks_by_result = [
    [check
     for assessment in result.get("assessments", [])
     for check in assessment.get("contextualGroundingPolicy", {}).get("filters", [])
     if check["type"] == "GROUNDING"]
    for result in results
]

is_grounded = None
if checks_by_result and all(checks_by_result):
    is_grounded = all(
        check["score"] >= check["threshold"] and not check.get("detected", False)
        for checks in checks_by_result
        for check in checks
    )`;

export const chatBadge = String.raw`export function GroundingBadge({grounded}) {
  if (grounded == null) {
    return <span>Grounding check unavailable</span>;
  }

  return (
    <span data-status={grounded ? "supported" : "unsupported"}>
      {grounded ? "Supported by your documents" : "Not supported"}
    </span>
  );
}`;
