const MARKER = '<!-- preview-links -->';
const PAGE_STATUSES = new Set(['added', 'modified', 'renamed', 'changed']);

function buildComment({files, routeMap, previewUrl, sha, prodUrl = 'https://docs.litellm.ai'}) {
  const previewRoot = previewUrl.replace(/\/+$/, '');
  const changedPages = [];
  const removedPages = [];
  const represented = new Set();

  for (const file of files) {
    if (PAGE_STATUSES.has(file.status) && Object.prototype.hasOwnProperty.call(routeMap, file.filename)) {
      changedPages.push(file);
      represented.add(file);
    }
    if (file.status === 'removed' && /\.(md|mdx)$/i.test(file.filename)) {
      removedPages.push(file.filename);
      represented.add(file);
    }
    if (file.status === 'renamed' && file.previous_filename && /\.(md|mdx)$/i.test(file.previous_filename)) {
      removedPages.push(file.previous_filename);
      represented.add(file);
    }
  }

  const lines = [MARKER, `## Preview for [${sha.slice(0, 7)}](${previewRoot})`];
  if (changedPages.length) {
    lines.push('', '### Changed pages');
    for (const file of changedPages.slice(0, 100)) {
      const permalink = routeMap[file.filename];
      const previewLink = `[${permalink}](${previewRoot}${permalink})`;
      lines.push(
        `- ${previewLink}${file.status === 'added' ? ' (new)' : ` ([prod](${prodUrl.replace(/\/+$/, '')}${permalink}))`}`,
      );
    }
    if (changedPages.length > 100) lines.push(`- and ${changedPages.length - 100} more`);
  } else {
    lines.push('', 'No changed pages are available on this preview.');
  }

  if (removedPages.length) {
    lines.push('', '### Removed pages', ...removedPages.map((filename) => `- ${filename}`));
  }

  const otherFiles = files.length - represented.size;
  if (otherFiles > 0) {
    lines.push(
      '',
      `${otherFiles} other changed files are not pages; shared files such as components, sidebars or config can affect many pages`,
    );
  }

  return lines.join('\n');
}

async function run({github, context, core, fetch}) {
  const {owner, repo} = context.repo;
  const deployment = context.payload.deployment;
  const status = context.payload.deployment_status;
  const sha = deployment?.sha;
  const previewUrl = status?.environment_url;

  if (!sha || !previewUrl) {
    core.info('Deployment is missing its commit SHA or preview URL');
    return;
  }

  const associatedPulls = await github.paginate(github.rest.repos.listPullRequestsAssociatedWithCommit, {
    owner,
    repo,
    commit_sha: sha,
  });
  const pull = associatedPulls.find((candidate) => candidate.state === 'open' && candidate.head.sha === sha);
  if (!pull) {
    core.info(`No open pull request has head SHA ${sha}; skipping this deployment`);
    return;
  }

  const secret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  if (!secret) {
    core.setFailed('The VERCEL_AUTOMATION_BYPASS_SECRET repository secret is required to fetch the protected preview route map');
    return;
  }

  let response;
  try {
    response = await fetch(`${previewUrl.replace(/\/+$/, '')}/route-map.json`, {
      headers: {'x-vercel-protection-bypass': secret},
    });
  } catch (error) {
    core.setFailed(`Could not fetch the preview route map using VERCEL_AUTOMATION_BYPASS_SECRET: ${error.message}`);
    return;
  }
  if (!response.ok) {
    core.setFailed(
      `Fetching the preview route map returned HTTP ${response.status}; check the VERCEL_AUTOMATION_BYPASS_SECRET repository secret`,
    );
    return;
  }

  let routeMap;
  try {
    routeMap = await response.json();
  } catch (error) {
    core.setFailed(`Could not parse the preview route map: ${error.message}`);
    return;
  }

  const files = await github.paginate(github.rest.pulls.listFiles, {
    owner,
    repo,
    pull_number: pull.number,
  });
  const body = buildComment({files, routeMap, previewUrl, sha});
  const comments = await github.paginate(github.rest.issues.listComments, {
    owner,
    repo,
    issue_number: pull.number,
  });
  const existing = comments.find((comment) => comment.body?.includes(MARKER));

  if (existing) {
    await github.rest.issues.updateComment({
      owner,
      repo,
      comment_id: existing.id,
      body,
    });
  } else {
    await github.rest.issues.createComment({
      owner,
      repo,
      issue_number: pull.number,
      body,
    });
  }
}

module.exports = {buildComment, run};
