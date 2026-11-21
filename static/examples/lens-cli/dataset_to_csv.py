import csv
import json
from pathlib import Path

source = Path("dataset.jsonl")
cases = [json.loads(line) for line in source.read_text().splitlines() if line.strip()]
included = [case for case in cases if case.get("included", True)]
if not included:
    raise ValueError("The dataset has no included cases")

with Path("gateway-tasks.csv").open("w", newline="") as destination:
    writer = csv.DictWriter(
        destination,
        fieldnames=["id", "prompt", "expected", "messages", "dataset_case"],
    )
    writer.writeheader()
    for case in included:
        messages = case["messages"]
        user_messages = [message["content"] for message in messages if message["role"] == "user"]
        expected = case.get("expected", "")
        if not user_messages:
            raise ValueError(f"Case {case['id']} has no user message")
        if not expected.strip():
            raise ValueError(f"Case {case['id']} needs an expected outcome before evaluation")
        writer.writerow(
            {
                "id": case["id"],
                "prompt": user_messages[-1],
                "expected": expected,
                "messages": json.dumps(messages, ensure_ascii=False),
                "dataset_case": json.dumps(case, ensure_ascii=False),
            }
        )
print(f"Wrote {len(included)} cases to gateway-tasks.csv")
