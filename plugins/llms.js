// Emits the machine-readable layer of the docs at build time:
//
//   /llms.txt          index in the llmstxt.org format, built from the sidebars
//   /llms-full.txt     every docs page as markdown, concatenated
//   /docs/<page>.md    each docs page as plain markdown, next to its HTML, with
//                      YAML front matter (title, url, summary, last_updated,
//                      related) in the shape Vercel's docs use
//   /index.md          the docs home, for agents that start at the root
//   /release_notes/…md every release note
//   /agent.txt         alias of llms.txt
//   /sitemap.md        every page, one line each
//
// Pages are read from their MDX source, with {{role}} model ids filled in,
// imports dropped, and Tabs / TabItem / Image flattened into markdown, so an
// agent fetching `<any docs url>.md` gets the same content a reader sees.

const fs = require('fs');
const path = require('path');
const {execSync} = require('child_process');
const {substitute} = require('../src/remark/docs-models');
const {getStats, formatStats, FALLBACK: STATS_FALLBACK} = require('./litellm-stats');
const {categoryOf, CATEGORIES: BLOG_CATEGORIES} = require('../src/components/Blog/categories');
const {ONE_CLICK, PROMPTS, INSTALLS, SALES_URL, TRIAL_URL, GATEWAY_COMPOSE, ENTERPRISE_HERO, TIERS, USE_CASES, PRODUCT_CARDS, CARD_GROUPS} = require('../src/components/Conversion/content');

const SITE = 'https://docs.litellm.ai';

// Hand-picked entry points listed first in llms.txt. Everything else comes
// from the sidebars, so new pages show up without touching this file.
const START_HERE = [
  ['index', 'Python SDK quickstart', '`uv add litellm`, then call any provider with `completion()`'],
  ['proxy/docker_quick_start', 'AI Gateway quickstart', 'Run the gateway with Docker and Postgres, add a model, create a virtual key'],
  ['agent_resources', 'Agent resources', 'Copy-paste prompts, MCP, and skills for coding agents setting up LiteLLM'],
  ['proxy/client_setup/overview', 'Connect clients to the gateway', 'Point Claude Code, Codex, Cursor, or any OpenAI or Anthropic SDK at the gateway'],
  ['proxy/configs', 'Gateway config.yaml reference', 'Every setting the gateway config file supports'],
  ['proxy/deploy', 'Production deployment', 'Helm, Terraform, and Kubernetes on AWS, GCP, and Azure'],
  ['enterprise', 'LiteLLM Enterprise', 'What Enterprise adds on top of the open-source gateway: SSO, audit logs, admin roles, SLAs'],
];

// The main sidebar is split by its top-level categories; the others are small
// enough to list under one heading each.
const SIDEBAR_TITLES = {
  learnSidebar: 'Learn: guides and tutorials',
  integrationsSidebar: 'Integrations',
  autoRouterSidebar: 'Auto Router',
};

const SUMMARY = `LiteLLM is an open-source Python SDK and a self-hosted AI Gateway (proxy) that give 100+ LLM providers one OpenAI-compatible API, with virtual keys, spend tracking, budgets, routing and fallbacks, guardrails, and an MCP gateway.`;

const NOTES = `- Python SDK: \`uv add litellm\` (or \`pip install litellm\`), then \`litellm.completion(model="<provider>/<model>", messages=[...])\`. Responses always use the OpenAI Chat Completions shape.
- AI Gateway: Docker image \`docker.litellm.ai/berriai/litellm\`. Keys, the Admin UI (\`/ui\`), and spend tracking need Postgres (\`DATABASE_URL\`) and a \`LITELLM_MASTER_KEY\`. Any OpenAI or Anthropic SDK works against it by changing the base URL.
- Enterprise: a license key (\`LITELLM_LICENSE\`) on the same gateway image. Contact: https://www.litellm.ai/enterprise#talk-to-sales
- Every docs page is available as markdown by appending \`.md\` to its URL, for example ${SITE}/docs/proxy/docker_quick_start.md. The full docs are in ${SITE}/llms-full.txt.`;

// Public facts for agents. Each figure links its source so an agent can verify
// it. Stars, forks, and downloads come from GitHub and PyPI at build time
// (plugins/litellm-stats.js), with saved figures as the fallback.
let STATS = formatStats(STATS_FALLBACK);
const facts = () => `## LiteLLM at a glance

LiteLLM is the most widely used and most secure open-source AI gateway, trusted by teams at Netflix, Okta, Ramp, NASA, Zurich, Cloudera, AT&T, and Lemonade (https://www.litellm.ai/enterprise). Figures as of ${STATS.asOf}; each links to its source for current values.

- Adoption: ${STATS.stars} GitHub stars and ${STATS.forks} forks (https://github.com/BerriAI/litellm), with ${STATS.contributors} contributors.
- Usage: ${STATS.downloads} downloads of the \`litellm\` Python package in the last month (https://pypistats.org/packages/litellm).
- Container image: ${STATS.imagePulls} pulls of the LiteLLM Gateway image on GitHub Container Registry and Docker Hub (https://github.com/BerriAI/litellm/pkgs/container/litellm).
- Security: SOC 2 Type II audited (https://trust.litellm.ai/). Every Docker image on GHCR is signed with cosign and can be verified before it runs (${SITE}/docs/proxy/docker_image_security.md). Enterprise support includes a 72-hour security patch SLA (${SITE}/docs/enterprise.md).
- Deployment: self-hosted in your own cloud, so prompts, responses, and provider keys stay in your infrastructure (${SITE}/docs/data_security.md).
- License: open source under MIT; Enterprise features need a license key (https://github.com/BerriAI/litellm/blob/main/LICENSE).`;

// ---------------------------------------------------------------------------
// MDX -> markdown

const JSX_ATTR = (tag, name) => {
  const m = new RegExp(`${name}=(?:"([^"]*)"|'([^']*)'|\\{['"\`]([^'"\`]*)['"\`]\\})`).exec(tag);
  return m ? m[1] ?? m[2] ?? m[3] : null;
};

// The interactive conversion components hold real instructions (prompts,
// install commands), so they are written out in full for agents.
// The docs home's problem-to-solution sections, with their code and tables.
function useCasesMarkdown() {
  const docUrl = (to) => (to === '/docs/' ? `${SITE}/docs/index.md` : `${SITE}${to.replace(/\/$/, '/index')}.md`);
  const visual = (v) => {
    if (v.type === 'code') return ['```' + v.lang, v.code, '```'];
    if (v.type === 'table') return [`| ${v.head.join(' | ')} |`, `| ${v.head.map(() => '---').join(' | ')} |`, ...v.rows.map((r) => `| ${r.join(' | ')} |`)];
    if (v.type === 'chat') return v.lines.map(([who, text]) => `> **${who}:** ${text}`);
    return v.lines.map((l) => `- ${l.join(', ')}`);
  };
  const row = (u) => [
    `### ${u.product}: ${u.problem}`,
    '',
    u.solution,
    '',
    ...visual(u.visual),
    '',
    `Guide: ${docUrl(u.to)}.${u.prompt ? ` Agent prompt: "${PROMPTS[u.prompt].title}", in ${SITE}/docs/agent_resources.md` : ` Talk to sales: ${SALES_URL}`}`,
    '',
  ];
  const [sdk, gateway, ...rest] = USE_CASES;
  return [
    '## Why developers love LiteLLM',
    '',
    `${STATS.stars} GitHub stars, ${STATS.downloadsShort} PyPI downloads last month, ${STATS.contributors} contributors, and ${STATS.imagePulls} container image pulls.`,
    '',
    ...row(sdk),
    ...row(gateway),
    '### Built on the gateway',
    '',
    'Once your apps call the gateway, the same deployment can serve MCP tools and agents, pick the right model for each request, and be run from your terminal or by your coding agent.',
    '',
    ...CARD_GROUPS.flatMap((g) => [
      `#### ${g.title}`,
      '',
      ...g.ids.flatMap((id) => {
        const c = PRODUCT_CARDS.find((x) => x.id === id);
        const guide = c.to.startsWith('/blog/') ? SITE + c.to : docUrl(c.to);
        return [`**${c.product}: ${c.problem}** ${c.text}`, '', ...visual(c.visual), '', `Guide: ${guide}. Agent prompt: "${PROMPTS[c.prompt].title}", in ${SITE}/docs/agent_resources.md`, ''];
      }),
    ]),
    ...rest.flatMap(row),
  ].join('\n');
}

function expandComponent(tag) {
  // Signup forms have no meaning in markdown
  if (/^<Newsletter\b/.test(tag)) return '';
  let m = /^<AgentPrompt\b[^>]*\bid="([^"]+)"[^>]*\/>$/.exec(tag);
  if (m && PROMPTS[m[1]]) {
    const p = PROMPTS[m[1]];
    return `**Agent prompt: ${p.title}**\n\n\`\`\`text\n${p.text}\n\`\`\`\n`;
  }
  if (/^<InstallBox\b.*\/>$/.test(tag)) {
    const config = INSTALLS[JSX_ATTR(tag, 'variant') || 'gateway'];
    if (!config) return null;
    const [primary, ...others] = config.options;
    const block = (code) => `\`\`\`bash\n${code}\n\`\`\`\n`;
    return [
      `**${config.title}** (recommended: ${primary.label}). ${config.what}`,
      '',
      block(primary.code),
      ...others.flatMap((o) => [`Alternative, ${o.label}${o.when ? `: ${o.when}` : ''}`, '', block(o.code)]),
    ].join('\n');
  }
  if (/^<PathFinder\b/.test(tag)) {
    return [
      'Pick the path that matches who is calling the models:',
      '',
      `- **Just my code** (one Python app): the Python SDK. A library you import, nothing to deploy. One \`completion()\` call for 100+ providers with answers in the OpenAI format, retries and fallbacks, and cost per call. Install: ${SITE}/docs/index.md#installation`,
      `- **My team or several apps** (any language): the AI Gateway. A self-hosted OpenAI-compatible endpoint with virtual keys, budgets and rate limits per team, spend tracking, logs, guardrails, and an admin UI. Start it: ${SITE}/docs/proxy/docker_quick_start.md`,
      `- **My whole organization** (SSO, audit logs, security review): LiteLLM Enterprise, a license key on the same gateway. Details: ${SITE}/docs/enterprise.md. Talk to sales: ${SALES_URL}`,
      '',
    ].join('\n');
  }
  if (/^<Command\b/.test(tag)) return commandMarkdown(tag);
  if (/^<OneClickDeploy\b/.test(tag)) {
    return `Deploy to the cloud in one click: ${ONE_CLICK.map(([name, url]) => `[${name}](${url})`).join(' or ')}. Use your deployment's URL in place of http://localhost:4000.\n`;
  }
  if (/^<EnterpriseFeature\b/.test(tag)) {
    if (/\sfree\b/.test(tag)) {
      return '> **Free Enterprise feature.** Available in the `litellm[proxy]` package and every `litellm` Docker image; no Enterprise license is required.\n';
    }
    const feature = JSX_ATTR(tag, 'feature');
    return `> **LiteLLM Enterprise feature${feature ? `: ${feature}` : ''}.** Requires an Enterprise license (\`LITELLM_LICENSE\`). Talk to sales: ${SALES_URL}\n`;
  }
  if (/^<EnterpriseHero\b/.test(tag)) {
    return `**${ENTERPRISE_HERO.title}**\n\n${ENTERPRISE_HERO.text}\n\nTalk to sales: ${SALES_URL}. Start a 30-day trial: ${TRIAL_URL}. SOC 2 Type II report: https://trust.litellm.ai/\n`;
  }
  if (/^<TierStack\b/.test(tag)) {
    return TIERS.map((t) => {
      const items = t.items.map(([label, to]) => `[${label}](${to.startsWith('/') ? SITE + to : to})`).join(', ');
      return `- **${t.name}** (${t.how}): ${items}`;
    }).join('\n') + '\n';
  }
  if (/^<(SalesBand|SalesButton)\b/.test(tag)) {
    return `Talk to sales about LiteLLM Enterprise: ${SALES_URL}\n`;
  }
  return null;
}

// Card-style components written over several lines (NextSteps, Tiles,
// NavigationCards): keep their titles, one-liners, and links as a list.
function commandMarkdown(block) {
  const code =
    /\bcode=\{`([\s\S]*?)`\}/.exec(block)?.[1].replace(/\\\\/g, '\\') ??
    /\bcode="([^"]*)"/.exec(block)?.[1];
  if (code == null) return null;
  const note = JSX_ATTR(block, 'note');
  return `${note ? `${note}\n\n` : ''}\`\`\`bash\n${code}\n\`\`\`\n`;
}

function expandMultiline(block) {
  if (/^\s*<Command\b/.test(block)) return commandMarkdown(block) || '';
  const items = [];
  const re = /\{([^{}]*\btitle:[^{}]*)\}/g;
  let m;
  while ((m = re.exec(block))) {
    const field = (name) => {
      const f = new RegExp(`\\b${name}:\\s*(['"\`])((?:\\\\.|(?!\\1).)*)\\1`).exec(m[1]);
      return f ? f[2] : null;
    };
    const title = field('title');
    if (!title) continue;
    const to = field('to');
    const text = field('text') || field('description');
    const href = to ? (to.startsWith('/') ? SITE + to : to) : null;
    const more = field('more');
    const moreTo = field('moreTo');
    const moreHref = moreTo ? (moreTo.startsWith('/') ? SITE + moreTo : moreTo) : null;
    items.push(
      `- ${href ? `[${clean(title)}](${href})` : clean(title)}${text ? `: ${clean(text)}` : ''}${
        more && moreHref ? ` ([${clean(more)}](${moreHref}))` : ''
      }`,
    );
  }
  return items.length ? items.join('\n') + '\n' : '';
}

function mdxToMarkdown(raw) {
  let text = raw.replace(/^---\n[\s\S]*?\n---\n/, '');
  text = substitute(text);
  // Inline figures, e.g. a <Stat id="stars" /> inside a table cell
  text = text.replace(/<Stat\s+id="([a-zA-Z]+)"\s*\/>/g, (_, id) => STATS[id] ?? '');

  const out = [];
  let fence = null;
  let jsx = null; // lines of a multi-line <Component ... /> being collected
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (jsx) {
      jsx.push(line);
      if (/\/>\s*$/.test(trimmed)) {
        out.push(expandMultiline(jsx.join('\n')));
        jsx = null;
      }
      continue;
    }
    if (!fence && /^<[A-Z][A-Za-z]*\b/.test(trimmed) && !/>\s*$/.test(trimmed)) {
      jsx = [line];
      continue;
    }
    const fenceMatch = /^(```+|~~~+)/.exec(trimmed);
    if (fenceMatch) {
      if (!fence) fence = fenceMatch[1];
      else if (trimmed.startsWith(fence) && trimmed.replace(/[`~]/g, '') === '') fence = null;
      out.push(line);
      continue;
    }
    if (fence) {
      out.push(line);
      continue;
    }
    if (/^(import|export)\s/.test(trimmed)) continue;
    if (/^\{\/\*.*\*\/\}$/.test(trimmed)) continue;
    // Inline form: <EnterpriseFeature feature="SSO">note</EnterpriseFeature>
    if (/^<EnterpriseFeature\b[^/]*>/.test(trimmed)) {
      if (/\sfree\b/.test(trimmed.split('>')[0])) {
        out.push('> **Free Enterprise feature.** No Enterprise license is required.', '');
        continue;
      }
      const note = trimmed.replace(/^<EnterpriseFeature\b[^>]*>/, '').replace(/<\/EnterpriseFeature>$/, '').trim();
      out.push(`> **LiteLLM Enterprise feature.** ${note || 'Requires an Enterprise license.'} Talk to sales: ${SALES_URL}`, '');
      continue;
    }
    if (trimmed === '</EnterpriseFeature>') continue;
    if (/^<\/?Tabs\b[^>]*>$/.test(trimmed) || trimmed === '</TabItem>') continue;
    if (/^<TabItem\b/.test(trimmed)) {
      const label = JSX_ATTR(trimmed, 'label') || JSX_ATTR(trimmed, 'value');
      if (label) out.push(`**${label}**`, '');
      continue;
    }
    if (/^<(Image|img)\b/.test(trimmed)) {
      const alt = JSX_ATTR(trimmed, 'alt');
      if (alt) out.push(`[Image: ${alt}]`);
      continue;
    }
    const expanded = expandComponent(trimmed);
    if (expanded) {
      out.push(expanded);
      continue;
    }
    // Self-closing site components (cards, diagrams, pickers) carry no prose.
    if (/^<[A-Z][A-Za-z]*\b[^>]*\/>$/.test(trimmed)) continue;
    out.push(line);
  }
  return (
    out
      .join('\n')
      // Relative images point at hashed build assets that a .md reader cannot
      // resolve, so keep their description instead of a broken link.
      .replace(/!\[([^\]]*)\]\((?!https?:|\/)[^)]*\)/g, (m, alt) => (alt ? `[Image: ${alt}]` : ''))
      .replace(/\n{3,}/g, '\n\n')
      .trim() + '\n'
  );
}

// ---------------------------------------------------------------------------
// helpers

const clean = (s) =>
  String(s || '')
    .replace(/\p{Extended_Pictographic}️?/gu, '')
    .replace(/\s+/g, ' ')
    .trim();

// Docusaurus falls back to the first line of the page when a doc has no
// description, which is often a heading ("Overview", "Quick Start"). Those
// say nothing, so they are dropped.
const usefulDescription = (d) => {
  const t = clean(d);
  return t.split(' ').length >= 5 ? t : '';
};

const oneLine = (s, max = 180) => {
  const t = clean(s);
  return t.length > max ? t.slice(0, max - 1).replace(/\s+\S*$/, '') + '...' : t;
};

const mdUrl = (permalink) =>
  SITE + (permalink.endsWith('/') ? `${permalink}index.md` : `${permalink}.md`);

function mdPath(outDir, permalink) {
  const rel = permalink.endsWith('/') ? `${permalink}index.md` : `${permalink}.md`;
  return path.join(outDir, rel);
}

// Depth-first list of doc ids under a sidebar item, in sidebar order.
function collectDocIds(item, acc = []) {
  if (!item) return acc;
  if (item.type === 'doc' || item.type === 'ref') acc.push(item.id);
  if (item.type === 'category') {
    if (item.link && item.link.type === 'doc') acc.push(item.link.id);
    for (const child of item.items || []) collectDocIds(child, acc);
  }
  return acc;
}

// Last commit date per file, from one `git log` pass. Missing in shallow or
// non-git builds, in which case last_updated is simply left out.
function lastUpdatedDates(siteDir) {
  const dates = new Map();
  try {
    const out = execSync('git log --format=%x00%cs --name-only -- docs release_notes', {
      cwd: siteDir,
      maxBuffer: 64 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).toString();
    let date = null;
    for (const line of out.split('\n')) {
      if (line.startsWith('\0')) date = line.slice(1).trim();
      else if (line && date && !dates.has(line)) dates.set(line, date);
    }
  } catch {
    // not a git checkout
  }
  return dates;
}

const yamlString = (v) => JSON.stringify(String(v));

function frontMatter(fields) {
  const lines = ['---'];
  for (const [key, value] of Object.entries(fields)) {
    if (value == null || value === '' || (Array.isArray(value) && !value.length)) continue;
    if (Array.isArray(value)) lines.push(`${key}:`, ...value.map((v) => `  - ${yamlString(v)}`));
    else lines.push(`${key}: ${yamlString(value)}`);
  }
  lines.push('---', '');
  return lines.join('\n');
}

// ---------------------------------------------------------------------------

module.exports = function llmsPlugin(context) {
  let docs = [];
  let sidebars = {};
  let releaseNotes = [];
  let blogPosts = [];

  return {
    name: 'litellm-llms-txt',

    async allContentLoaded({allContent}) {
      const docsContent = allContent['docusaurus-plugin-content-docs']?.default;
      const version = docsContent?.loadedVersions?.[0];
      if (!version) return;
      docs = version.docs.filter((d) => !d.unlisted && !d.draft);
      sidebars = version.sidebars || {};
      const notes = allContent['docusaurus-plugin-content-docs']?.['release-notes']?.loadedVersions?.[0];
      releaseNotes = (notes?.docs || []).filter((d) => !d.unlisted && !d.draft);
      const blog = allContent['docusaurus-plugin-content-blog']?.blog;
      blogPosts = (blog?.blogPosts || [])
        .map((p) => p.metadata)
        .filter((m) => !m.unlisted && !m.frontMatter?.draft)
        .sort((a, b) => new Date(b.date) - new Date(a.date));
    },

    async postBuild({outDir}) {
      STATS = formatStats(await getStats());
      if (!docs.length) return;
      const byId = new Map(docs.map((d) => [d.id, d]));
      const markdown = new Map();

      const updated = lastUpdatedDates(context.siteDir);
      const writeMd = async (permalink, content) => {
        const target = mdPath(outDir, permalink);
        await fs.promises.mkdir(path.dirname(target), {recursive: true});
        await fs.promises.writeFile(target, content);
        // /docs/ is served as /docs/index.md; also answer /docs.md so a plain
        // "append .md" works for index pages too.
        if (permalink.endsWith('/') && permalink.length > 1) {
          await fs.promises.writeFile(path.join(outDir, `${permalink.slice(0, -1)}.md`), content);
        }
      };

      // Per-page markdown, for docs and release notes.
      const writeDoc = async (doc, kind) => {
        const relSource = doc.source.replace(/^@site\//, '');
        let body;
        try {
          body = mdxToMarkdown(await fs.promises.readFile(path.join(context.siteDir, relSource), 'utf8'));
        } catch {
          return null;
        }
        const title = clean(doc.title);
        const related = [doc.previous, doc.next].filter(Boolean);
        const meta = frontMatter({
          title,
          url: doc.permalink,
          canonical_url: `${SITE}${doc.permalink}`,
          type: kind,
          last_updated: updated.get(relSource),
          summary: usefulDescription(doc.description) ? oneLine(doc.description, 240) : null,
          related: related.map((r) => r.permalink),
        });
        const header = `# ${title}\n\n> Index of all LiteLLM docs: ${SITE}/llms.txt\n\n`;
        let content = body.startsWith('# ') ? body.replace(/^# .*\n/, header) : header + body;
        if (related.length) {
          content +=
            '\n## Related pages\n\n' +
            related.map((r) => `- [${clean(r.title)}](${mdUrl(r.permalink)})`).join('\n') +
            '\n';
        }
        await writeMd(doc.permalink, meta + content);
        return content;
      };

      await Promise.all(
        docs.map(async (doc) => {
          const content = await writeDoc(doc, 'docs');
          if (content) markdown.set(doc.id, content);
        }),
      );
      await Promise.all(releaseNotes.map((doc) => writeDoc(doc, 'release-notes')));

      // Category pages without a doc of their own (for example /docs/providers)
      // become a markdown list of what they contain.
      const indexWrites = [];
      const walkCategories = (items) => {
        for (const item of items || []) {
          if (item.type !== 'category') continue;
          const link = item.link;
          if (link?.type === 'generated-index' && link.permalink) {
            const ids = [...new Set(collectDocIds(item))].filter((id) => byId.has(id));
            const list = ids.map((id) => {
              const d = byId.get(id);
              const desc = usefulDescription(d.description);
              return `- [${clean(d.title)}](${mdUrl(d.permalink)})${desc ? `: ${oneLine(desc)}` : ''}`;
            });
            const title = clean(link.title || item.label);
            indexWrites.push(writeMd(
              link.permalink,
              frontMatter({title, url: link.permalink, canonical_url: `${SITE}${link.permalink}`, type: 'index', summary: link.description}) +
                `# ${title}\n\n${link.description ? `${clean(link.description)}\n\n` : ''}${list.join('\n')}\n`,
            ));
          }
          walkCategories(item.items);
        }
      };
      for (const name of Object.keys(sidebars)) walkCategories(sidebars[name]);
      await Promise.all(indexWrites);

      // The docs home.
      await fs.promises.writeFile(
        path.join(outDir, 'index.md'),
        frontMatter({title: 'LiteLLM documentation', url: '/', canonical_url: `${SITE}/`, type: 'home', summary: SUMMARY}) +
          `# LiteLLM documentation\n\n> ${SUMMARY}\n\n${expandComponent('<PathFinder />')}\n${useCasesMarkdown()}\n${NOTES}\n\n${facts()}\n\n## Start here\n\n` +
          START_HERE.filter(([id]) => byId.has(id))
            .map(([id, label, note]) => `- [${label}](${mdUrl(byId.get(id).permalink)}): ${note}`)
            .join('\n') +
          `\n\nEvery page: ${SITE}/sitemap.md. Agent prompts, MCP, and skills: ${SITE}/docs/agent_resources.md\n`,
      );

      // llms.txt
      const link = (doc, note, label) => {
        const desc = note || usefulDescription(doc.description);
        return `- [${label || clean(doc.title)}](${mdUrl(doc.permalink)})${desc ? `: ${oneLine(desc)}` : ''}`;
      };

      const listed = new Set();
      const lines = [`# LiteLLM`, '', `> ${SUMMARY}`, '', NOTES, '', facts(), '', '## Key pages', ''];
      for (const [id, label, note] of START_HERE) {
        const doc = byId.get(id);
        if (!doc) continue;
        lines.push(link(doc, note, label));
        listed.add(id);
      }

      const order = ['tutorialSidebar', 'learnSidebar', 'integrationsSidebar', 'autoRouterSidebar'];
      const sidebarNames = [...order.filter((n) => sidebars[n]), ...Object.keys(sidebars).filter((n) => !order.includes(n))];
      for (const name of sidebarNames) {
        if (SIDEBAR_TITLES[name]) {
          const ids = sidebars[name].flatMap((top) => collectDocIds(top)).filter((id) => byId.has(id) && !listed.has(id));
          if (!ids.length) continue;
          lines.push('', `## ${SIDEBAR_TITLES[name]}`, '');
          for (const id of [...new Set(ids)]) {
            lines.push(link(byId.get(id)));
            listed.add(id);
          }
          continue;
        }
        for (const top of sidebars[name]) {
          const ids = collectDocIds(top).filter((id) => byId.has(id) && !listed.has(id));
          if (!ids.length) continue;
          const heading = top.type === 'category' ? clean(top.label) : clean(byId.get(ids[0]).title);
          lines.push('', `## ${heading}`, '');
          for (const id of [...new Set(ids)]) {
            lines.push(link(byId.get(id)));
            listed.add(id);
          }
        }
      }

      // Blog: one markdown file per post, a /blog.md index grouped by
      // category, and the newest posts listed in llms.txt.
      const day = (d) => new Date(d).toISOString().slice(0, 10);
      const postLine = (m) =>
        `- [${clean(m.title)}](${mdUrl(m.permalink)}) (${day(m.date)})${m.description ? `: ${oneLine(m.description, 160)}` : ''}`;
      await Promise.all(
        blogPosts.map(async (m) => {
          let body;
          try {
            body = mdxToMarkdown(await fs.promises.readFile(path.join(context.siteDir, m.source.replace(/^@site\//, '')), 'utf8'));
          } catch {
            return;
          }
          body = body.replace(/<!--[\s\S]*?-->/g, '').replace(/\n{3,}/g, '\n\n');
          const authors = (m.authors || []).map((a) => a.name).filter(Boolean).join(', ');
          const header =
            `# ${clean(m.title)}\n\n> ${day(m.date)}${authors ? `, by ${authors}` : ''}. ${categoryOf(m.tags).label}. ` +
            `Source: ${SITE}${m.permalink}. All posts: ${SITE}/blog.md\n\n`;
          const meta = frontMatter({
            title: clean(m.title),
            url: m.permalink,
            canonical_url: `${SITE}${m.permalink}`,
            type: 'blog',
            date: day(m.date),
            category: categoryOf(m.tags).label,
            authors: (m.authors || []).map((a) => a.name).filter(Boolean),
            summary: m.description ? oneLine(m.description, 240) : null,
          });
          await writeMd(m.permalink, meta + (body.startsWith('# ') ? body.replace(/^# .*\n/, header) : header + body));
        }),
      );
      if (blogPosts.length) {
        const index = [
          '# LiteLLM blog',
          '',
          `> Every post on ${SITE}/blog, newest first within each category. Append \`.md\` to any post URL for its markdown. RSS: ${SITE}/blog/rss.xml`,
        ];
        for (const cat of BLOG_CATEGORIES) {
          const posts = blogPosts.filter((m) => categoryOf(m.tags).id === cat.id);
          if (!posts.length) continue;
          index.push('', `## ${cat.label}`, '', cat.blurb, '', ...posts.map(postLine));
        }
        await fs.promises.writeFile(path.join(outDir, 'blog.md'), index.join('\n') + '\n');
        lines.push('', '## Blog', '', `- [All blog posts by category](${SITE}/blog.md): Model launches, Auto Router, gateway features, engineering, and security`);
        lines.push(...blogPosts.slice(0, 15).map(postLine));
      }

      const orphans = docs.filter((d) => !listed.has(d.id));
      lines.push('', '## Optional', '');
      lines.push(`- [Release notes](${SITE}/release_notes): Changelog for every LiteLLM release`);
      for (const doc of orphans) lines.push(link(doc));

      await fs.promises.writeFile(path.join(outDir, 'llms.txt'), lines.join('\n') + '\n');

      // llms-full.txt, in the same order as llms.txt.
      const orderedIds = [...listed, ...orphans.map((d) => d.id)];
      const full = [`# LiteLLM documentation\n\n> ${SUMMARY}\n\n${NOTES}\n`];
      for (const id of new Set(orderedIds)) {
        if (markdown.has(id)) full.push(markdown.get(id));
      }
      await fs.promises.writeFile(path.join(outDir, 'llms-full.txt'), full.join('\n---\n\n'));

      await fs.promises.copyFile(path.join(outDir, 'llms.txt'), path.join(outDir, 'agent.txt'));

      const sitemap = ['# LiteLLM docs sitemap', '', `> Every page, as markdown. The curated index is ${SITE}/llms.txt.`, '', '## Docs', ''];
      for (const id of new Set(orderedIds)) {
        const d = byId.get(id);
        if (d) sitemap.push(`- [${clean(d.title)}](${mdUrl(d.permalink)})`);
      }
      sitemap.push('', '## Release notes', '');
      for (const d of [...releaseNotes].sort((a, b) => b.permalink.localeCompare(a.permalink, undefined, {numeric: true}))) {
        sitemap.push(`- [${clean(d.title)}](${mdUrl(d.permalink)})`);
      }
      if (blogPosts.length) {
        sitemap.push('', '## Blog', '');
        for (const m of blogPosts) sitemap.push(`- [${clean(m.title)}](${mdUrl(m.permalink)})`);
      }
      await fs.promises.writeFile(path.join(outDir, 'sitemap.md'), sitemap.join('\n') + '\n');
    },
  };
};

module.exports.mdxToMarkdown = mdxToMarkdown;
