import {caseById} from '../cases';

// The guided path through the docs cases. Each chapter has one core step that teaches the idea and
// optional variants that change one more setting. The core steps, in order, are the main path; the
// order follows what each case leans on (retries before order, cooldowns before fallbacks). measure
// names the number the chapter is about: where traffic went (split) or how much of it got an answer
// (success); the Before and After strip leads with it.

export const CHAPTERS = [
  {
    id: 'spread',
    measure: 'split',
    title: 'Spread traffic',
    why: 'A model group has several deployments. The router decides which one serves each request.',
    core: 'weights',
    variants: ['rpm-as-weight'],
  },
  {
    id: 'retry',
    measure: 'success',
    title: 'Retry a failed call',
    why: 'Providers fail now and then. A retry sends the call again before the client sees an error.',
    core: 'retries',
    variants: [],
  },
  {
    id: 'priority',
    measure: 'split',
    title: 'Prefer a primary',
    why: 'Sometimes one deployment should take all the traffic, with another standing by.',
    core: 'order',
    variants: [],
  },
  {
    id: 'cooldown',
    measure: 'success',
    title: 'Bench a bad deployment',
    why: 'A deployment that keeps failing is taken out for a while, so traffic stops hitting it.',
    core: 'cooldown',
    variants: ['cooldown-time', 'disable-cooldowns', 'allowed-fails-policy', 'retry-policy', 'weighted-failover'],
  },
  {
    id: 'fallback',
    measure: 'success',
    title: 'Fall back to another model',
    why: 'When a whole model group is down, or the request does not fit, the router can try a different model.',
    core: 'fallbacks',
    variants: ['context-window-fallbacks', 'default-fallbacks', 'max-fallbacks', 'client-fallbacks', 'content-policy-fallbacks'],
  },
  {
    id: 'timeout',
    measure: 'success',
    title: 'Handle slow providers',
    why: 'A slow call is a failed call once it passes the timeout. Timeouts, retries, cooldowns and fallbacks then work together.',
    core: 'timeout-fallback',
    variants: ['per-model-timeout'],
  },
  {
    id: 'names',
    measure: 'split',
    title: 'Names and teams',
    why: 'Optional. How aliases and team-only deployments decide which group a request lands in.',
    core: null,
    variants: ['alias', 'team-deployment'],
  },
];

export const CORE_PATH = CHAPTERS.map(chapter => chapter.core).filter(Boolean);

export const FIRST_STEP = CORE_PATH[0];

export function chapterOf(id) {
  return CHAPTERS.find(chapter => chapter.core === id || chapter.variants.includes(id)) ?? null;
}

export function isCore(id) {
  return CORE_PATH.includes(id);
}

// Where Back and Next go. On the core path they walk the core steps; on a variant they walk that
// chapter's variants and then rejoin the core path at the next chapter.
export function neighbours(id) {
  const chapter = chapterOf(id);
  if (!chapter) return {back: null, next: FIRST_STEP};
  const inChapter = [chapter.core, ...chapter.variants].filter(Boolean);
  const index = inChapter.indexOf(id);
  const chapterIndex = CHAPTERS.indexOf(chapter);
  const nextCore = CHAPTERS.slice(chapterIndex + 1).find(item => item.core)?.core ?? null;
  const previousCore = [...CHAPTERS.slice(0, chapterIndex)].reverse().find(item => item.core)?.core ?? null;
  if (isCore(id)) {
    return {back: previousCore, next: nextCore};
  }
  return {
    back: inChapter[index - 1] ?? previousCore,
    next: inChapter[index + 1] ?? nextCore,
  };
}

export function stepTitle(id) {
  return caseById(id)?.title ?? id;
}
