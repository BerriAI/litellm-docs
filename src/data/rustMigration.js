import * as semver from 'semver';
import releaseSnapshot from './rustMigrationReleases.json';

// Rollout stages in order, matching `Rollout` in litellm/rust_bridge/configuration.py.
export const STAGES = [
  {id: 'pythonOnly', label: 'Python'},
  {id: 'rustOptIn', label: 'Opt-in'},
  {id: 'rustOptOut', label: 'Rust default'},
  {id: 'rustRequired', label: 'Rust only'},
];

// Goals are milestones over the work below. `scope` lists the top-level work a
// goal covers, and may name an earlier goal to include all of its scope. The
// optional `summary` describes the scope in the goal picker instead of listing it.
const GOAL_DECLARATIONS = [
  {id: 'major-apis', text: 'Major APIs', endsOn: '2026-12-31', scope: ['messages', 'responses', 'chat-completions']},
  {
    id: 'all-apis',
    text: 'All APIs',
    endsOn: '2027-04-30',
    summary: 'Major APIs, MCP, OCR, and many more',
    scope: ['major-apis', 'token-counter', 'mcp', 'ocr'],
  },
];

// The work is a dependency graph, declared flat. `parent` names the node, or
// nodes, that need this work; top-level work has none and belongs to a goal's
// scope instead. A node with `rollout` is a feature, mapping each release to the
// stage the feature entered there; `{}` means it is still Python only. Every
// other node groups its children.
const NODES = [
  {id: 'messages', text: 'Messages'},
  {id: 'messages-anthropic', text: 'Anthropic', parent: 'messages', rollout: {'v1.103.0-rc.2': 'rustOptIn'}},
  {id: 'messages-bedrock', text: 'Bedrock', parent: 'messages', rollout: {}},
  {id: 'messages-vertex', text: 'Vertex AI', parent: 'messages', rollout: {}},
  {id: 'messages-azure-ai', text: 'Azure AI', parent: 'messages', rollout: {'v1.94.0-rc.1': 'rustOptIn'}},
  {id: 'messages-compatible', text: 'Compatible endpoints', parent: 'messages', rollout: {}},
  {id: 'messages-github-copilot', text: 'GitHub Copilot', parent: 'messages', rollout: {}},
  {id: 'messages-via-responses', text: 'Via Responses', parent: 'messages', rollout: {}},
  {id: 'messages-via-chat', text: 'Via Chat', parent: 'messages', rollout: {}},

  {id: 'responses', text: 'Responses'},
  {id: 'responses-openai', text: 'OpenAI', parent: 'responses', rollout: {}},

  {id: 'chat-completions', text: 'Chat completions'},
  {id: 'chat-openai', text: 'OpenAI', parent: 'chat-completions', rollout: {}},
  {id: 'chat-via-messages', text: 'Via Messages', parent: 'chat-completions', rollout: {}},

  {id: 'token-counter', text: 'Token counter'},
  {id: 'tokens-tiktoken', text: 'Tiktoken', parent: 'token-counter', rollout: {'v1.103.0-rc.2': 'rustOptIn'}},
  {id: 'tokens-hugging-face', text: 'Hugging Face', parent: 'token-counter', rollout: {}},

  {id: 'mcp', text: 'MCP'},
  {id: 'mcp-gateway', text: 'MCP gateway', parent: 'mcp', rollout: {}},

  {id: 'ocr', text: 'OCR'},
  {id: 'ocr-mistral', text: 'Mistral', parent: 'ocr', rollout: {'v1.102.0-rc.1': 'rustOptOut'}},
  {id: 'ocr-azure-ai', text: 'Azure AI', parent: 'ocr', rollout: {}},
  {id: 'ocr-azure-document-intelligence', text: 'Azure Document Intelligence', parent: 'ocr', rollout: {}},
  {id: 'ocr-vertex', text: 'Vertex AI', parent: 'ocr', rollout: {}},
  {id: 'ocr-cohere', text: 'Cohere', parent: 'ocr', rollout: {}},

  // Shared by features across several APIs.
  {id: 'auth-aws', text: 'AWS auth', parent: 'messages-bedrock', rollout: {}},
  {id: 'auth-gcp', text: 'GCP auth', parent: ['messages-vertex', 'ocr-vertex'], rollout: {}},
];

// Releases worth calling out next to the blog posts; only add ones that changed
// what runs on Rust. The date is kept here because the release snapshot only
// holds the latest releases.
export const RELEASE_NOTES = [
  {
    version: 'v1.102.0-rc.1',
    releasedOn: '2026-09-13',
    changes: ['Mistral OCR runs on Rust by default, with the Python implementation kept as a fallback.'],
  },
];

// Everything below derives the page model from the declarations above and
// fails the build when they drift out of shape.

function fail(message) {
  throw new Error(`Rust migration: ${message}`);
}

// Every release on the timeline, oldest first, ending with the upcoming one on main.
export const RELEASES = [
  ...releaseSnapshot.published.map(release => ({version: release.version, date: release.releasedAt, isMain: false})),
  {version: releaseSnapshot.main.version, date: releaseSnapshot.main.plannedFor, isMain: true},
].sort((left, right) => semver.compare(left.version, right.version));

export const MAIN_VERSION = releaseSnapshot.main.version;

function checkVersion(version) {
  if (semver.valid(version) === null || semver.prerelease(version)?.[0] !== 'rc') {
    fail(`versions must be RC semver versions: ${version}`);
  }
  if (semver.gt(version, MAIN_VERSION)) {
    fail(`${version} is newer than main (${MAIN_VERSION})`);
  }
}

if (RELEASES.length < 10) {
  fail('the timeline needs at least 10 RC versions');
}
RELEASES.forEach(release => checkVersion(release.version));
if (!RELEASES.at(-1).isMain) {
  fail(`main (${MAIN_VERSION}) must be newer than every published release`);
}

RELEASE_NOTES.forEach(note => checkVersion(note.version));

const STAGE_INDEX = new Map(STAGES.map((stage, index) => [stage.id, index]));

// Normalized nodes: `children` holds node objects in declaration order, and a
// feature's `rollout` becomes `{version, stage}` steps, oldest first, where
// `stage` indexes STAGES.
const nodesById = new Map();
for (const {parent, rollout, ...node} of NODES) {
  if (nodesById.has(node.id)) {
    fail(`duplicate node id: ${node.id}`);
  }
  nodesById.set(node.id, {
    ...node,
    children: [],
    rollout: rollout && Object.entries(rollout)
      .map(([version, stage]) => {
        checkVersion(version);
        if (!STAGE_INDEX.has(stage)) {
          fail(`${node.id} has unknown rollout stage: ${stage}`);
        }
        return {version, stage: STAGE_INDEX.get(stage)};
      })
      .sort((left, right) => semver.compare(left.version, right.version)),
  });
}
for (const {id, parent} of NODES) {
  for (const parentId of [parent ?? []].flat()) {
    if (!nodesById.has(parentId)) {
      fail(`${id} has unknown parent: ${parentId}`);
    }
    nodesById.get(parentId).children.push(nodesById.get(id));
  }
}

// Every node beneath `node`, counted once even when several paths reach it.
function descendantsOf(node, found = new Set()) {
  for (const child of node.children) {
    if (!found.has(child)) {
      found.add(child);
      descendantsOf(child, found);
    }
  }
  return found;
}

// `features` lists the features at or beneath each node; only they count toward progress.
for (const node of nodesById.values()) {
  const descendants = descendantsOf(node);
  if (descendants.has(node)) {
    fail(`${node.id} depends on itself`);
  }
  if (!node.rollout && node.children.length === 0) {
    fail(`${node.id} has no children, so it must be a feature with rollout`);
  }
  node.features = [node, ...descendants].filter(item => item.rollout);
}

// Goals in declaration order, each with the same `children` and `features` a
// node has, so the page treats a goal as the root of its own tree.
const goalsById = new Map();
for (const {scope, ...goal} of GOAL_DECLARATIONS) {
  const children = new Set(scope.flatMap(id => {
    if (goalsById.has(id)) {
      return goalsById.get(id).children;
    }
    if (!nodesById.has(id)) {
      fail(`goal ${goal.id} has unknown scope: ${id}`);
    }
    return [nodesById.get(id)];
  }));
  const features = new Set([...children].flatMap(child => child.features));
  goalsById.set(goal.id, {...goal, children: [...children], features: [...features]});
}
export const GOALS = [...goalsById.values()];

for (const {id, parent} of NODES) {
  if (!parent && !GOALS.some(goal => goal.children.includes(nodesById.get(id)))) {
    fail(`${id} has no parent, so a goal's scope must include it`);
  }
}

// The stage a feature was at in `version`, as an index into STAGES.
export function stageAt(feature, version) {
  return feature.rollout.findLast(step => semver.lte(step.version, version))?.stage ?? 0;
}

// How far a node's features had climbed the rollout stages at `version`, as a
// percent. Rust only everywhere is 100%.
export function progressAt(node, version) {
  const score = node.features.reduce((sum, feature) => sum + stageAt(feature, version), 0);
  return Math.round((score / (node.features.length * (STAGES.length - 1))) * 100);
}
