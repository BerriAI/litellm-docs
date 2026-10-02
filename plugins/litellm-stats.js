// GitHub and PyPI figures for the "LiteLLM at a glance" facts, fetched once
// per build so llms.txt, /index.md, and Agent resources stay current. Both
// requests run in parallel with a short timeout; if either source is slow,
// rate-limited, or the build is offline, the saved figures below are used and
// the build carries on. Set LITELLM_DOCS_OFFLINE=1 to skip the requests.

const FALLBACK = {stars: 59800, forks: 11900, downloadsMonth: 89400000, contributors: 1758, imagePulls: 511200000, asOf: '2026-09-28'};
const TIMEOUT_MS = 4000;

async function getJson(url, headers = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {headers: {'User-Agent': 'litellm-docs-build', ...headers}, signal: ctrl.signal});
    if (!res.ok) throw new Error(`${url} returned ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// GitHub has no contributor total; with one contributor per page, the page
// number of the "last" link is the count. anon=true counts commits from
// emails not linked to an account too, as the GitHub insights page does.
async function getContributors(headers = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch('https://api.github.com/repos/BerriAI/litellm/contributors?per_page=1&anon=true', {
      headers: {'User-Agent': 'litellm-docs-build', ...headers},
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`contributors returned ${res.status}`);
    const last = /[?&]page=(\d+)>; rel="last"/.exec(res.headers.get('link') || '');
    if (!last) throw new Error('contributors: no last page link');
    return Number(last[1]);
  } finally {
    clearTimeout(timer);
  }
}

// Container image pulls: ghcr.io/berriai/litellm plus Docker Hub's
// litellm/litellm. GitHub has no API for package downloads, so the ghcr figure
// is read from the "Total downloads" on the package page. Docker Hub adds only
// about 1M, so without the ghcr figure the saved total is kept.
async function getText(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {headers: {'User-Agent': 'litellm-docs-build'}, signal: ctrl.signal});
    if (!res.ok) throw new Error(`${url} returned ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

async function getImagePulls() {
  const [ghcr, hub] = await Promise.allSettled([
    getText('https://github.com/BerriAI/litellm/pkgs/container/litellm'),
    getJson('https://hub.docker.com/v2/repositories/litellm/litellm/'),
  ]);
  const m = ghcr.status === 'fulfilled' && /Total downloads<\/span>\s*<h3 title="(\d+)"/.exec(ghcr.value);
  if (!m) throw new Error('ghcr: total downloads not found on the package page');
  const dockerHub = hub.status === 'fulfilled' && Number.isFinite(hub.value?.pull_count) ? hub.value.pull_count : 0;
  return Number(m[1]) + dockerHub;
}

let pending;

// One fetch per build, shared by every caller.
function getStats() {
  if (!pending) {
    pending = (async () => {
      if (process.env.LITELLM_DOCS_OFFLINE) return {...FALLBACK, live: false};
      const gh = process.env.GITHUB_TOKEN ? {Authorization: `Bearer ${process.env.GITHUB_TOKEN}`} : {};
      const [repo, pypi, people, pulls] = await Promise.allSettled([
        getJson('https://api.github.com/repos/BerriAI/litellm', gh),
        getJson('https://pypistats.org/api/packages/litellm/recent'),
        getContributors(gh),
        getImagePulls(),
      ]);
      const stats = {...FALLBACK};
      const ghOk = repo.status === 'fulfilled' && Number.isFinite(repo.value?.stargazers_count);
      const pypiOk = pypi.status === 'fulfilled' && Number.isFinite(pypi.value?.data?.last_month);
      if (ghOk) {
        stats.stars = repo.value.stargazers_count;
        stats.forks = repo.value.forks_count;
      }
      if (pypiOk) stats.downloadsMonth = pypi.value.data.last_month;
      // The contributor count only feeds a rounded "1,700+", so a failed
      // request quietly keeps the saved figure.
      if (people.status === 'fulfilled' && Number.isFinite(people.value)) stats.contributors = people.value;
      if (pulls.status === 'fulfilled' && Number.isFinite(pulls.value)) stats.imagePulls = pulls.value;
      // Only claim today's date when every figure is from today.
      if (ghOk && pypiOk) stats.asOf = new Date().toISOString().slice(0, 10);
      stats.live = ghOk || pypiOk;
      if (!ghOk || !pypiOk) {
        const why = [repo, pypi].filter((r) => r.status === 'rejected').map((r) => r.reason?.message || String(r.reason));
        console.warn(`[litellm-stats] using saved figures for ${!ghOk && !pypiOk ? 'GitHub and PyPI' : !ghOk ? 'GitHub' : 'PyPI'}${why.length ? `: ${why.join('; ')}` : ''}`);
      }
      return stats;
    })();
  }
  return pending;
}

const thousands = (n) => `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
const millions = (n) => `${(n / 1e6).toFixed(1).replace(/\.0$/, '')} million`;
const longDate = (iso) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', {year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC'});

// The strings pages and markdown print, e.g. {stars: '59.8k', downloads: '89.4 million'}.
function formatStats(s) {
  return {
    stars: thousands(s.stars),
    forks: thousands(s.forks),
    downloads: millions(s.downloadsMonth),
    downloadsShort: `${(s.downloadsMonth / 1e6).toFixed(1).replace(/\.0$/, '')}M`,
    contributors: `${(Math.floor(s.contributors / 100) * 100).toLocaleString('en-US')}+`,
    imagePulls: `${Math.round(s.imagePulls / 1e6)}M`,
    asOf: s.asOf,
    asOfLong: longDate(s.asOf),
  };
}

module.exports = function litellmStatsPlugin() {
  return {
    name: 'litellm-stats',
    async loadContent() {
      return getStats();
    },
    async contentLoaded({content, actions}) {
      actions.setGlobalData(formatStats(content));
    },
  };
};

module.exports.getStats = getStats;
module.exports.formatStats = formatStats;
module.exports.FALLBACK = FALLBACK;
