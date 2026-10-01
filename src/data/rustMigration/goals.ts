import type {AreaId} from './areas';

// Goals are milestones over the areas in areas.ts. `scope` lists the areas a goal
// covers, and may name an earlier goal to include all of its scope. The optional
// `summary` describes the scope in the goal picker instead of listing it.
interface GoalDeclaration {
  id: string;
  text: string;
  endsOn: string;
  scope: readonly string[];
  summary?: string;
}

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
] as const satisfies readonly GoalDeclaration[];

export type GoalId = (typeof GOAL_DECLARATIONS)[number]['id'];

// `scope` is loosely typed above because a goal may name another goal, and a
// goal's id comes from the very list being checked. This pins every name in it
// to a real area or goal, so a typo fails the type check.
type ScopeName = (typeof GOAL_DECLARATIONS)[number]['scope'][number];
type Assert<Condition extends true> = Condition;
export type ScopeNamesAreKnown = Assert<ScopeName extends AreaId | GoalId ? true : false>;
