import csv
import json
from pathlib import Path
from tempfile import TemporaryDirectory

source = Path("dataset.jsonl")
cases = [json.loads(line) for line in source.read_text(encoding="utf-8").splitlines() if line.strip()]
included = [case for case in cases if case.get("included", True)]
if not included:
    raise ValueError("The dataset has no included cases")

def csv_row(case):
    messages = case["messages"]
    user_messages = [message["content"] for message in messages if message["role"] == "user"]
    expected = case.get("expected") or ""
    if not user_messages:
        raise ValueError(f"Case {case['id']} has no user message")
    if not expected.strip():
        raise ValueError(f"Case {case['id']} needs an expected outcome before evaluation")
    return {
        "id": case["id"],
        "prompt": user_messages[-1],
        "expected": expected,
        "messages": json.dumps(messages, ensure_ascii=False),
        "dataset_case": json.dumps(case, ensure_ascii=False),
    }


rows = tuple(csv_row(case) for case in included)
destination = Path("gateway-tasks.csv")
with TemporaryDirectory(prefix=".lens-dataset-", dir=destination.parent) as directory:
    temporary = Path(directory) / destination.name
    with temporary.open("w", newline="", encoding="utf-8") as output:
        writer = csv.DictWriter(output, fieldnames=rows[0].keys())
        writer.writeheader()
        writer.writerows(rows)
    temporary.replace(destination)
print(f"Wrote {len(included)} cases to gateway-tasks.csv")
