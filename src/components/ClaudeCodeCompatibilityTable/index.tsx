import React from "react";
import matrix from "@site/src/data/compatibility-matrix.json";
import styles from "./styles.module.css";

/**
 * Claude Code compatibility matrix table.
 *
 * Renders the JSON published daily by the populator
 * (`tests/claude_code/cron_vm/run_daily.sh` in BerriAI/litellm) into a
 * features-by-providers grid. Each cell shows pass / fail / not_tested /
 * not_applicable; failure cells expose the upstream error on hover.
 *
 * The JSON is bundled at build time (no fetch), so the docs page works
 * offline and the matrix value at any commit is whatever the JSON
 * checked into that commit said.
 */

type CellStatus = "pass" | "fail" | "not_tested" | "not_applicable";

interface Cell {
  status: CellStatus;
  error?: string;
  reason?: string;
}

interface Feature {
  id: string;
  name: string;
  providers: Record<string, Cell>;
}

interface Matrix {
  schema_version: string;
  generated_at: string;
  litellm_version: string;
  claude_code_version: string;
  providers: string[];
  features: Feature[];
}

const PROVIDER_LABELS: Record<string, string> = {
  anthropic: "Anthropic",
  bedrock_invoke: "Bedrock (Invoke)",
  bedrock_converse: "Bedrock (Converse)",
  vertex_ai: "Vertex AI",
  azure: "Azure (Foundry)",
};

const STATUS_GLYPH: Record<CellStatus, string> = {
  pass: "✅",
  fail: "❌",
  not_tested: "—",
  not_applicable: "n/a",
};

function cellTitle(cell: Cell): string {
  if (cell.status === "fail" && cell.error) return cell.error;
  if (cell.status === "not_applicable" && cell.reason) return cell.reason;
  if (cell.status === "not_tested") return "no test ran for this combination";
  return "passing";
}

export default function ClaudeCodeCompatibilityTable(): JSX.Element {
  const m = matrix as Matrix;
  return (
    <div className={styles.wrapper}>
      <div className={styles.meta}>
        <span>
          litellm <code>{m.litellm_version}</code>
        </span>
        <span>
          claude code <code>{m.claude_code_version}</code>
        </span>
        <span>
          generated <code>{m.generated_at}</code>
        </span>
      </div>
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.featureCol}>Feature</th>
            {m.providers.map((p) => (
              <th key={p}>{PROVIDER_LABELS[p] ?? p}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {m.features.map((feature) => (
            <tr key={feature.id}>
              <th scope="row" className={styles.featureCol}>
                {feature.name}
              </th>
              {m.providers.map((p) => {
                const cell = feature.providers[p] ?? { status: "not_tested" as const };
                return (
                  <td
                    key={p}
                    className={styles[`status_${cell.status}`]}
                    title={cellTitle(cell)}
                  >
                    {STATUS_GLYPH[cell.status]}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
