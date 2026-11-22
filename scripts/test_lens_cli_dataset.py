import csv
import json
from pathlib import Path
import subprocess
import sys
from tempfile import TemporaryDirectory
import unittest


CONVERTER = Path(__file__).resolve().parents[1] / "static/examples/lens-cli/dataset_to_csv.py"


class LensDatasetTests(unittest.TestCase):
    def run_converter(self, directory, cases):
        source = directory / "dataset.jsonl"
        source.write_text("\n".join(json.dumps(case) for case in cases), encoding="utf-8")
        return subprocess.run(
            [sys.executable, str(CONVERTER)],
            cwd=directory,
            capture_output=True,
            text=True,
        )

    def test_invalid_case_cannot_leave_a_partial_snapshot(self):
        graded = {"id": "graded", "messages": [{"role": "user", "content": "I was billed twice."}], "expected": "billing"}
        ungraded = {"id": "ungraded", "messages": [{"role": "user", "content": "The app crashes."}]}
        for expected in ({}, {"expected": ""}, {"expected": None}):
            for existing in (False, True):
                with self.subTest(expected=expected, existing=existing), TemporaryDirectory() as directory:
                    root = Path(directory)
                    destination = root / "gateway-tasks.csv"
                    previous = b"previous snapshot\n"
                    if existing:
                        destination.write_bytes(previous)
                    result = self.run_converter(root, [graded, {**ungraded, **expected}])
                    self.assertNotEqual(result.returncode, 0)
                    self.assertIn("needs an expected outcome", result.stderr)
                    if existing:
                        self.assertEqual(destination.read_bytes(), previous)
                    else:
                        self.assertFalse(destination.exists())

    def test_valid_export_preserves_context_and_filters_excluded_cases(self):
        included = {
            "id": "billing-conversation",
            "messages": [
                {"role": "system", "content": "Help classify support tickets."},
                {"role": "user", "content": "Please review the extra €10."},
                {"role": "assistant", "content": "What happened?"},
                {"role": "user", "content": "I was charged again, after cancellation."},
            ],
            "expected": "billing",
            "reply": "A historical reply is not the expected answer.",
            "included": True,
            "source": {"trace_id": "example-trace", "finding_id": "example-finding"},
            "agent_version": "example-version",
        }
        excluded = {"id": "excluded", "messages": [], "expected": "", "included": False}
        with TemporaryDirectory() as directory:
            root = Path(directory)
            destination = root / "gateway-tasks.csv"
            destination.write_text("previous snapshot\n", encoding="utf-8")
            result = self.run_converter(root, [included, excluded])
            self.assertEqual(result.returncode, 0, result.stderr)
            with destination.open(newline="", encoding="utf-8") as output:
                rows = list(csv.DictReader(output))
            self.assertEqual(len(rows), 1)
            self.assertEqual(rows[0]["id"], included["id"])
            self.assertEqual(rows[0]["prompt"], included["messages"][-1]["content"])
            self.assertEqual(rows[0]["expected"], included["expected"])
            self.assertEqual(json.loads(rows[0]["messages"]), included["messages"])
            self.assertEqual(json.loads(rows[0]["dataset_case"]), included)


if __name__ == "__main__":
    unittest.main()
