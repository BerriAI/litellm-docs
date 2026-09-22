// Fills in {{role}} placeholders from docs-models.json at build time.
//
// docs-models.json maps a role (openai_small, anthropic, gemini_flash,
// python_version, ...) to the value examples use today: a model id, or the
// Python version. Pages write `{{openai_small}}` inside code blocks and inline
// code (and, if needed, in prose) and the rendered site shows the real value,
// so moving the docs to a new model or Python version is one edit to that file.
// scripts/check-docs.py applies the same substitution before it parses YAML,
// JSON and Python blocks.

import fs from 'node:fs';
import path from 'node:path';
import type {Nodes, Parent, Root} from 'mdast';

const MODELS_PATH = path.join(__dirname, '..', '..', 'docs-models.json');
export const TOKEN_RE = /\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g;

let cached: Record<string, string> | undefined;
function roles(): Record<string, string> {
  cached ??= JSON.parse(fs.readFileSync(MODELS_PATH, 'utf8')) as Record<string, string>;
  return cached;
}

// Only roles from docs-models.json are replaced. Other {{name}} tokens are
// prompt-template placeholders in the pages themselves and pass through.
export function substitute(text: string): string {
  const map = roles();
  return text.replace(TOKEN_RE, (whole: string, role: string) =>
    Object.prototype.hasOwnProperty.call(map, role) ? map[role] : whole,
  );
}

// `{{openai_small}}` outside code is parsed by MDX as the JS expression
// `{openai_small}`; turn it back into plain text with the id filled in.
function expressionRole(value: string | undefined): string | null {
  const m = /^\s*\{?\s*([A-Za-z0-9_]+)\s*\}?\s*$/.exec(value || '');
  return m && Object.prototype.hasOwnProperty.call(roles(), m[1]) ? m[1] : null;
}

function walk(node: Nodes, parent: Parent | null, index: number): void {
  if (node.type === 'code' || node.type === 'inlineCode') {
    node.value = substitute(node.value);
    return;
  }
  if (node.type === 'mdxTextExpression' || node.type === 'mdxFlowExpression') {
    const role = expressionRole(node.value);
    if (role && parent) {
      const text = {type: 'text' as const, value: roles()[role]};
      parent.children[index] = node.type === 'mdxFlowExpression' ? {type: 'paragraph', children: [text]} : text;
    }
    return;
  }
  if ('children' in node) {
    for (let i = 0; i < node.children.length; i += 1) walk(node.children[i], node, i);
  }
}

export default function remarkDocsModels() {
  return (tree: Root): void => {
    walk(tree, null, 0);
  };
}

