// Goals are milestones over the areas in areas.js. `scope` lists the areas a goal
// covers, and may name an earlier goal to include all of its scope. The optional
// `summary` describes the scope in the goal picker instead of listing it.
export const GOAL_DECLARATIONS = [
  {
    id: 'major-apis',
    text: 'Major APIs',
    endsOn: '2026-12-31',
    scope: ['foundation', 'messages', 'responses', 'chat-completions'],
    summary: 'Messages, Responses, Chat completions',
  },
  {
    id: 'all-apis',
    text: 'All APIs',
    endsOn: '2027-04-30',
    scope: ['major-apis', 'embeddings', 'transcription', 'ocr', 'token-counter', 'mcp'],
    summary: 'Major APIs, Embeddings, OCR, MCP, and many more',
  },
];
