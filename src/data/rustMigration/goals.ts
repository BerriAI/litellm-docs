import type {AreaId} from './areas';
import type {IsoDay} from './days';

// Goals are milestones over the areas in areas.ts. `areas` is the goal's
// weighted scale: each area it covers and the points that area is worth, in
// the order the page lists them. A goal is done at 100% of those points. The
// optional `summary` describes the scope in the goal picker instead of listing it.
interface GoalDeclaration {
  id: string;
  text: string;
  endsOn: IsoDay;
  areas: Partial<Record<AreaId, number>>;
  summary?: string;
}

// The rust-core-team's scale of 100, plus 2 points each for making Rust fast
// and proving it correct, which the board left out.
const MAJOR_API_POINTS = {
  'scaffold': 4,
  'ocr': 2,
  'messages': 5,
  'responses': 4,
  'chat-completions': 10,
  'adapters': 4,
  'router': 6,
  'gateway': 8,
  'callbacks': 7,
  'caching': 5,
  'auth': 6,
  'endpoints': 6,
  'extensions': 8,
  'database': 15,
  'observability': 6,
  'performance': 2,
  'testing': 2,
  'long-tail': 4,
} as const satisfies Partial<Record<AreaId, number>>;

export const GOAL_DECLARATIONS: readonly GoalDeclaration[] = [
  {
    id: 'major-apis',
    text: 'Major APIs',
    endsOn: '2026-12-31',
    areas: MAJOR_API_POINTS,
    summary: 'Messages, Responses, Chat completions, and the gateway around them',
  },
  {
    id: 'all-apis',
    text: 'All APIs',
    endsOn: '2027-04-30',
    // The same scale with the long tail at its full size, the sum of the
    // weights of the APIs inside it.
    areas: {...MAJOR_API_POINTS, 'long-tail': 23},
    summary: 'Major APIs, plus Embeddings, Audio, Images, Batches, and more at full weight',
  },
];
