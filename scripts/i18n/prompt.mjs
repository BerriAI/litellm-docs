// Prompt, response schema, and identity inputs for the translation cache.
// Bump PROMPT_VERSION whenever the prompt or schema changes so every cached
// chunk is regenerated.

export const PROMPT_VERSION = '2026-09-24.1';

export const LOCALE_NAMES = Object.freeze({
  'zh-Hans': 'Simplified Chinese (简体中文)',
});

export function systemPrompt(locale, glossary) {
  const language = LOCALE_NAMES[locale];
  if (!language) throw new Error(`Unsupported locale ${locale}`);
  const glossaryLines = Object.entries(glossary)
    .map(([term, rule]) => `- "${term}": ${rule}`)
    .join('\n');
  return `You translate technical documentation for LiteLLM (an LLM gateway and Python SDK) from English into ${language}.

You receive a JSON array of Markdown/MDX fragments. Return a JSON object {"translations": [{"id": ..., "text": ...}]} with exactly one entry per input id, in the same order.

Rules for every fragment:
1. Translate only natural-language prose. Output fluent, precise ${language} that a Chinese developer would write. Use full-width Chinese punctuation in prose (，。：；！？) and keep half-width punctuation inside code, URLs, and identifiers.
2. Keep all Markdown and MDX syntax exactly as is: heading markers, list markers, emphasis, tables, blockquotes, admonition markers (":::note", ":::tip", etc.), HTML/JSX tags and their attributes, and MDX expressions in braces.
3. Never change anything inside backticks (inline code), fenced code blocks, URLs, link targets, image paths, file paths, environment variable names, API parameter names, JSON/YAML keys, CLI flags, or version numbers. Copy them byte for byte.
4. Never change placeholders of the form {{name}} and never change heading id suffixes of the form {#anchor}. Keep them in the same place.
5. Do not translate product, company, model, or provider names (LiteLLM, OpenAI, Anthropic, Azure, Bedrock, Vertex AI, Gemini, GPT-4o, Claude, Docker, Kubernetes, Helm, Prometheus, Redis, PostgreSQL, Langfuse, and similar). Keep them in English.
6. Keep English terms in parentheses on first use when a Chinese rendering could be ambiguous, for example 虚拟密钥 (virtual key).
7. Keep link text translated but link targets unchanged. Keep the number of links, images, code spans, and lines of a table identical.
8. Do not add, drop, merge, or reorder sentences, list items, table rows, or paragraphs. Do not add explanations or notes.
9. If a fragment contains nothing translatable, return it unchanged.

Glossary (use these renderings consistently):
${glossaryLines}`;
}

export const RESPONSE_SCHEMA = Object.freeze({
  name: 'translations',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['translations'],
    properties: {
      translations: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['id', 'text'],
          properties: {
            id: {type: 'string'},
            text: {type: 'string'},
          },
        },
      },
    },
  },
});
