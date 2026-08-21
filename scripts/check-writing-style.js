#!/usr/bin/env node
/**
 * Writing style check for LiteLLM docs.
 *
 * Errors (fail the build):
 *   - em dashes used as prose punctuation
 *
 * Warnings (informational, or errors with --strict):
 *   - inflated vocabulary that reads as AI-generated ("utilize", "seamless", ...)
 *
 * Usage:
 *   node scripts/check-writing-style.js [--strict] [--warnings] [paths...]
 *
 * Defaults to scanning `docs/`. Table cells, fenced code blocks, and
 * `- **Term** — description` list labels are exempt: there the dash is
 * typography, not a spliced sentence.
 */

const fs = require("fs");
const path = require("path");

const EM_DASH = "\u2014";

const WORD_PATTERNS = [
  [/\butiliz(e|es|ed|ing)\b/i, 'use "use"'],
  [/\bin order to\b/i, 'use "to"'],
  [/\bleverag(e|es|ed|ing)\b/i, 'use "use"'],
  [/\bseamless(ly)?\b/i, 'use "smooth", "easy", or drop it'],
  [/\bcomprehensive(ly)?\b/i, 'use "complete", "full", or drop it'],
  [/\bdelve[sd]?\b|\bdeep dive\b/i, 'use "examine" or "explore"'],
  [/\bit'?s important to note that\b|\bit is worth noting that\b/i, "state it directly"],
  [/\bcould potentially\b|\bmay potentially\b/i, 'use "may" or "can"'],
  [/\bgenuinely\b|\btruly\b/i, "drop the intensifier if it adds nothing"],
  [/\bgame-?changer\b|\brevolutioniz(e|es|ed|ing)\b|\bsupercharge[sd]?\b/i, "describe the actual effect"],
  [/\bunlock(s|ed|ing)? (the|your|its) (power|potential)\b/i, "say what it does"],
];

function collectFiles(target) {
  const stat = fs.statSync(target);
  if (!stat.isDirectory()) return /\.mdx?$/.test(target) ? [target] : [];
  const out = [];
  for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    out.push(...collectFiles(path.join(target, entry.name)));
  }
  return out;
}

// A dash that only labels a list item or table cell is typography, not prose.
const LIST_LABEL = new RegExp(
  `^([-*+]|\\d+\\.)\\s+(\\*\\*[^*]+\\*\\*|\\[[^\\]]+\\]\\([^)]+\\)|\`[^\`]+\`)\\s*${EM_DASH}`
);

function isExemptDashLine(line) {
  const trimmed = line.trim();
  if (trimmed.startsWith("|")) return true;
  const count = (line.match(new RegExp(EM_DASH, "g")) || []).length;
  return count === 1 && LIST_LABEL.test(trimmed);
}

function checkFile(file) {
  const lines = fs.readFileSync(file, "utf8").split("\n");
  const errors = [];
  const warnings = [];
  let inFence = false;
  let inFrontmatter = lines[0] === "---";

  lines.forEach((line, idx) => {
    const lineNo = idx + 1;
    if (inFrontmatter) {
      if (lineNo > 1 && line === "---") inFrontmatter = false;
      return;
    }
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      return;
    }
    if (inFence) return;

    if (line.includes(EM_DASH) && !isExemptDashLine(line)) {
      errors.push({ file, lineNo, line, message: "em dash in prose: use a comma, colon, semicolon, or two sentences" });
    }

    const prose = line.replace(/`[^`]*`/g, "").replace(/\]\([^)]*\)/g, "]");
    for (const [pattern, hint] of WORD_PATTERNS) {
      const match = prose.match(pattern);
      if (match) {
        warnings.push({ file, lineNo, line, message: `"${match[0]}": ${hint}` });
        break;
      }
    }
  });

  return { errors, warnings };
}

function report(items, label) {
  console.log(`\n${label} (${items.length}):`);
  for (const item of items) {
    console.log(`  ${item.file}:${item.lineNo}  ${item.message}`);
    console.log(`    ${item.line.trim().slice(0, 160)}`);
  }
}

function main() {
  const args = process.argv.slice(2);
  const strict = args.includes("--strict");
  const showWarnings = strict || args.includes("--warnings");
  const targets = args.filter((a) => !a.startsWith("--"));
  const roots = targets.length ? targets : ["docs"];

  const files = roots.flatMap(collectFiles);
  const errors = [];
  const warnings = [];
  for (const file of files) {
    const result = checkFile(file);
    errors.push(...result.errors);
    warnings.push(...result.warnings);
  }

  console.log(`Checked ${files.length} markdown files in: ${roots.join(", ")}`);
  if (showWarnings && warnings.length) report(warnings, "Vocabulary warnings");
  if (errors.length) report(errors, "Errors");

  const failed = errors.length > 0 || (strict && warnings.length > 0);
  if (failed) {
    console.log(
      "\nSee CLAUDE.md for the writing rules. Rewrite the flagged lines instead of adding exceptions."
    );
    process.exit(1);
  }
  console.log(
    `No prose em dashes found.${showWarnings ? "" : ` ${warnings.length} vocabulary warnings (run with --warnings to list).`}`
  );
}

main();
