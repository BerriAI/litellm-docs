"""Run with python scripts/test_hex_templates.py; HEX_TEST_DSN enables Postgres checks."""

import json
import os
from pathlib import Path
import unittest
from urllib.request import urlopen

import jsonschema
import pandas as pd
import yaml

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "static" / "hex"


def template(mode):
    return yaml.safe_load((ASSETS / f"litellm_roi_{mode}.hex.yaml").read_text())


def run_board(frame=None, project_filter="", entity_filter="", values=None):
    cells = {cell["cellLabel"]: cell for cell in template("demo")["cells"]}
    scope = {"project_filter": project_filter, "entity_filter": entity_filter}
    for name in ["Settings", "Source"]:
        exec(cells[name]["config"]["source"], scope)
    if frame is not None:
        scope["spend_daily"] = frame
    if values is not None:
        scope["value_data"] = values(scope)
    exec(cells["Calculate board"]["config"]["source"], scope)
    return scope


class HexTemplateTests(unittest.TestCase):
    def test_native_schema_and_app_references(self):
        schema_path = os.environ.get("HEX_SCHEMA_FILE")
        if schema_path:
            schema = json.loads(Path(schema_path).read_text())
        else:
            with urlopen(
                "https://static.hex.site/hex-file-schema.json", timeout=30
            ) as response:
                schema = json.load(response)
        for mode in ["demo", "postgres"]:
            document = template(mode)
            jsonschema.validate(document, schema)
            ids = [cell["cellId"] for cell in document["cells"]]
            self.assertEqual(len(ids), len(set(ids)))
            for tab in document["appLayout"]["tabs"]:
                for row in tab["rows"]:
                    for column in row["columns"]:
                        for element in column["elements"]:
                            self.assertIn(element["cellId"], ids)

    def test_demo_and_postgres_use_identical_analysis(self):
        demo = {cell["cellLabel"]: cell for cell in template("demo")["cells"]}
        live = {cell["cellLabel"]: cell for cell in template("postgres")["cells"]}
        for label in demo.keys() - {"Read me", "Source"}:
            self.assertEqual(demo[label], live[label])
        self.assertIsNone(live["Source"]["config"]["dataConnectionId"])

    def test_weighted_metrics_and_cost_change(self):
        board = run_board()
        summary = board["summary"].iloc[0]
        self.assertEqual(summary.observed_days, 30)
        self.assertAlmostEqual(summary.response_cache_hit_rate, 0.1)
        self.assertAlmostEqual(summary.average_ttft_seconds, 0.7)
        flagged = board["change"].query("review == 'Review cost increase'")
        self.assertEqual(flagged.project_id.tolist(), ["document-review"])
        self.assertTrue(board["roi"].roi_pct.isna().all())
        self.assertAlmostEqual(board["project_spend"].spend_share_pct.sum(), 100)

    def test_empty_filter_and_missing_measurements(self):
        empty = run_board(project_filter="does-not-exist")
        self.assertEqual(empty["summary"].requests.iloc[0], 0)
        self.assertTrue(pd.isna(empty["summary"].spend_usd.iloc[0]))
        self.assertTrue(empty["project_spend"].empty)
        frame = run_board()["spend_daily"].copy()
        frame["spend_usd"] = float("nan")
        frame["unknown_cost_requests"] = frame.requests
        frame["latency_count"] = 0
        frame["ttft_count"] = 0
        frame["response_cache_known"] = 0
        missing = run_board(frame)["summary"].iloc[0]
        for name in [
            "spend_usd",
            "average_latency_seconds",
            "average_ttft_seconds",
            "response_cache_hit_rate",
        ]:
            self.assertTrue(pd.isna(missing[name]), name)

    def test_filters_and_chart_outputs(self):
        board = run_board(project_filter="document-review", entity_filter="legal")
        self.assertEqual(
            board["project_spend"].project_id.tolist(), ["document-review"]
        )
        for cell in template("demo")["cells"]:
            if cell["cellLabel"] in ["daily_chart", "model_chart"]:
                exec(cell["config"]["source"], board)
                self.assertTrue(board[cell["cellLabel"]].to_json())
        self.assertFalse(board["daily_chart"].data[0].connectgaps)

    def test_roi_requires_matching_period_and_unique_values(self):
        def values(scope):
            return pd.DataFrame(
                [
                    dict(
                        project_id="internal-search",
                        value_usd=500,
                        other_cost_usd=50,
                        coverage_start=scope["report_start"],
                        coverage_end=scope["report_end"],
                    )
                ]
            )

        board = run_board(values=values)
        row = board["roi"].query("project_id == 'internal-search'").iloc[0]
        self.assertAlmostEqual(row.net_value_usd, 500 - row.spend_usd - 50)
        self.assertAlmostEqual(
            row.roi_pct, 100 * row.net_value_usd / (row.spend_usd + 50)
        )

        def wrong_period(scope):
            result = values(scope)
            result["coverage_end"] -= pd.Timedelta(days=1)
            return result

        self.assertTrue(run_board(values=wrong_period)["roi"].roi_pct.isna().all())
        with self.assertRaisesRegex(ValueError, "one business-value row"):
            run_board(values=lambda scope: pd.concat([values(scope), values(scope)]))

    def test_roi_excludes_incomplete_or_entity_filtered_spend(self):
        def values(scope):
            return pd.DataFrame(
                [
                    dict(
                        project_id="internal-search",
                        value_usd=500,
                        other_cost_usd=50,
                        coverage_start=scope["report_start"],
                        coverage_end=scope["report_end"],
                    )
                ]
            )

        scoped = run_board(entity_filter="engineering", values=values)
        self.assertTrue(scoped["roi"].roi_pct.isna().all())
        frame = run_board()["spend_daily"].copy()
        frame.loc[frame.index[-1], "unknown_cost_requests"] = 1
        incomplete = run_board(frame, values=values)
        self.assertTrue(incomplete["roi"].roi_pct.isna().all())
        frame = frame[frame.day != frame.day.max()]
        self.assertTrue(run_board(frame, values=values)["roi"].roi_pct.isna().all())

    @unittest.skipUnless(
        os.environ.get("HEX_TEST_DSN"),
        "Set HEX_TEST_DSN for the Postgres contract test",
    )
    def test_postgres_view_sanitizes_and_bounds_source(self):
        import psycopg

        # Use a disposable database. Never point this test at a gateway database.
        with psycopg.connect(os.environ["HEX_TEST_DSN"], autocommit=True) as connection:
            connection.execute(
                """CREATE TABLE public."LiteLLM_SpendLogs" (
                request_id text, "startTime" timestamp, "endTime" timestamp,
                "completionStartTime" timestamp, metadata jsonb, team_id text,
                model_group text, model text, spend double precision, total_tokens integer,
                status text, cache_hit text, messages jsonb, api_key text)"""
            )
            connection.execute("CREATE ROLE hex_reader NOLOGIN")
            connection.execute(
                """INSERT INTO public."LiteLLM_SpendLogs" VALUES
                ('one', CURRENT_DATE-1+TIME '12:00', CURRENT_DATE-1+TIME '12:00:02',
                CURRENT_DATE-1+TIME '12:00:00.5', '{"project_id":"example"}', 'team-a', '',
                'demo-model', 0.1, 100, 'success', 'True', '{"private":"excluded"}', 'excluded'),
                ('today', CURRENT_DATE+TIME '01:00', CURRENT_DATE+TIME '01:00:02', NULL,
                '{}', NULL, '', 'demo-model', 9, 100, NULL, NULL, '{}', ''),
                ('old', CURRENT_DATE-61+TIME '12:00', CURRENT_DATE-61+TIME '12:00:02', NULL,
                '{}', NULL, '', 'demo-model', 9, 100, NULL, NULL, '{}', '')"""
            )
            connection.execute((ASSETS / "setup-postgres.sql").read_text())
            query = next(
                c for c in template("postgres")["cells"] if c["cellLabel"] == "Source"
            )["config"]["source"]
            with connection.cursor() as cursor:
                cursor.execute(query)
                columns = [column.name for column in cursor.description]
                rows = cursor.fetchall()
            self.assertEqual(len(rows), 1)
            row = dict(zip(columns, rows[0]))
            self.assertEqual(row["project_id"], "example")
            self.assertEqual(row["model"], "demo-model")
            self.assertEqual(row["requests"], 1)
            self.assertAlmostEqual(float(row["ttft_seconds_sum"]), 0.5)
            self.assertNotIn("api_key", columns)
            self.assertNotIn("messages", columns)
            connection.execute("SET ROLE hex_reader")
            self.assertEqual(connection.execute(query).fetchone(), rows[0])
            with self.assertRaises(psycopg.errors.InsufficientPrivilege):
                connection.execute('SELECT * FROM public."LiteLLM_SpendLogs"')


if __name__ == "__main__":
    unittest.main()
