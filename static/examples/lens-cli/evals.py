import json
import os
from collections.abc import Mapping

from litellm import (
    AgentInput,
    AgentOutput,
    EvalAgent,
    EvalOutput,
    EvalTarget,
    EvalTask,
    Harness,
    ModelNotMappedError,
    PredicateCheck,
    acompletion,
    completion_cost,
)
from litellm.harness import Usage

MODEL_A = os.environ["LENS_MODEL_A"]
MODEL_B = os.environ["LENS_MODEL_B"]
INSTRUCTIONS = (
    "Classify the support ticket as exactly one of: billing, technical, sales. "
    "If given a recorded conversation, classify its final user request. "
    "Return only the category word."
)


class MyAgent(EvalAgent):
    async def run(self, task: AgentInput) -> AgentOutput:
        response = await acompletion(
            model=MODEL_A,
            messages=[{"role": "user", "content": task.prompt}],
            metadata=dict(task.metadata),
        )
        try:
            cost = completion_cost(completion_response=response)
        except ModelNotMappedError:
            cost = None
        return AgentOutput(
            text=response.choices[0].message.content or "",
            cost=cost,
            usage=Usage(
                input_tokens=response.usage.prompt_tokens,
                output_tokens=response.usage.completion_tokens,
                calls=1,
            ),
            events=(),
        )


targets = [
    EvalTarget(Harness.TOOL_LOOP, MODEL_A, label="fast/tool_loop"),
    EvalTarget(Harness.CODEX, MODEL_A, label="fast/codex"),
    EvalTarget(Harness.TOOL_LOOP, MODEL_B, label="accurate/tool_loop"),
    EvalTarget(Harness.CODEX, MODEL_B, label="accurate/codex"),
    MyAgent("my-agent"),
]
run_options = {"max_turns": 4, "timeout": 120}


def task(row: Mapping[str, str | None]) -> EvalTask:
    expected = (row.get("expected") or "").strip().casefold()
    if expected not in {"billing", "technical", "sales"}:
        raise ValueError("Each case needs an expected category: billing, technical, or sales")
    recorded = row.get("messages")
    content = (
        "Recorded conversation:\n" + json.dumps(json.loads(recorded), ensure_ascii=False)
        if recorded
        else row.get("prompt") or ""
    )
    if not content.strip():
        raise ValueError("Each case needs a prompt or recorded conversation")

    def matches(output: EvalOutput) -> bool:
        return output.text.strip().strip(".").casefold() == expected

    return EvalTask(
        id=row["id"] or "",
        prompt=INSTRUCTIONS + "\n\n" + content,
        check=PredicateCheck(matches),
    )
