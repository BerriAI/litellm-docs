// Shared copy for the conversion components: agent prompts, install commands,
// and sales links. CommonJS so plugins/llms.js can expand <AgentPrompt id="…"/>
// and <InstallBox variant="…"/> into the per-page markdown agents read.

const DOCS = 'https://docs.litellm.ai';

const SALES_URL = 'https://www.litellm.ai/enterprise#talk-to-sales';
const TRIAL_URL = 'https://www.litellm.ai/enterprise#trial';

// Set this to a frameable URL (a Webflow page holding only the talk-to-sales
// form) and every "Talk to sales" button opens it in a modal instead of a new
// tab. www.litellm.ai/enterprise sends X-Frame-Options: SAMEORIGIN today.
const SALES_EMBED_URL = null;

// Adds attribution so the Webflow form and PostHog can tell which docs page
// sent the lead. The hash stays last so the page still scrolls to the form.
function withUtm(url, content) {
  const [base, hash] = url.split('#');
  const sep = base.includes('?') ? '&' : '?';
  const params = `utm_source=docs&utm_medium=cta${content ? `&utm_content=${encodeURIComponent(content)}` : ''}`;
  return `${base}${sep}${params}${hash ? `#${hash}` : ''}`;
}

const PROMPTS = {
  sdk: {
    title: 'Add the LiteLLM SDK to this project',
    text: `Help me add the LiteLLM Python SDK to this project. First read ${DOCS}/llms.txt and ${DOCS}/docs/index.md. Then:
1. Detect the language, package manager, and framework. The SDK is Python only. If this is not a Python project, stop and tell me to run the LiteLLM Gateway and keep my existing OpenAI SDK instead (${DOCS}/docs/proxy/docker_quick_start.md).
2. Install litellm with the project's own tool (uv add litellm, poetry add litellm, or pin it in requirements.txt).
3. Replace direct OpenAI or Anthropic client calls with litellm.completion or litellm.acompletion, keeping the same model with a provider prefix (openai/..., anthropic/...). LiteLLM returns the OpenAI response shape, so update any Anthropic-style parsing to choices[0].message.content. Keep streaming and tool calls working.
4. Add the provider key names to .env.example and read them from the environment. Never write real keys to files.
5. Verify: run one real completion and print the reply, then run the existing tests. Show me the diff and both outputs.`,
  },
  gateway: {
    title: 'Run the LiteLLM Gateway locally',
    text: `Help me run the LiteLLM Gateway locally. First read ${DOCS}/docs/proxy/docker_quick_start.md. Then:
1. Check that Docker Compose v2 is installed and running, and that port 4000 is free.
2. In a new litellm-gateway directory, download https://github.com/BerriAI/litellm/raw/main/docker/docker-compose.quickstart.yml and create .env with LITELLM_MASTER_KEY and LITELLM_SALT_KEY, each "sk-" followed by the output of openssl rand -hex 32. Add .env to .gitignore and never print either key.
3. Run docker compose -f docker-compose.quickstart.yml up -d and poll http://localhost:4000/health/readiness until the database shows as connected.
4. Ask me which provider and model to add. Add it with POST /model/new using the master key, reading my provider API key from my shell environment without echoing it.
5. Verify: GET /v1/models lists the model and POST /v1/chat/completions returns a reply.
6. Tell me to open http://localhost:4000/ui and sign in as admin with the master key from .env.`,
  },
  clients: {
    title: 'Point my tools at my LiteLLM Gateway',
    text: `Help me route my tools through my LiteLLM Gateway. First read ${DOCS}/docs/proxy/client_setup/overview.md, then claude_code.md and codex_cli.md in the same folder. Ask me for the gateway URL (default http://localhost:4000) and a virtual key. If I only have the master key, create a scoped key with POST /key/generate and use that instead.
1. Call GET /v1/models with the key. Only the names it returns are valid models.
2. My app: point the existing OpenAI SDK at <url>/v1, or the Anthropic SDK at <url>, with the virtual key, and switch the model to a gateway model name.
3. Claude Code: follow claude_code.md to set ANTHROPIC_BASE_URL and ANTHROPIC_AUTH_TOKEN. Show me the change before writing it.
4. Codex: follow codex_cli.md to add a litellm provider to ~/.codex/config.toml. Show me the change before writing it.
5. Verify: send one request from each tool and confirm it appears under Logs at <url>/ui.`,
  },
};

const GATEWAY_COMPOSE = `curl -sSLO https://github.com/BerriAI/litellm/raw/main/docker/docker-compose.quickstart.yml
printf 'LITELLM_MASTER_KEY=sk-%s\\nLITELLM_SALT_KEY=sk-%s\\n' "$(openssl rand -hex 32)" "$(openssl rand -hex 32)" > .env
docker compose -f docker-compose.quickstart.yml up -d`;

const GATEWAY_DOCKER_RUN = `docker run \\
  -e LITELLM_MASTER_KEY=sk-<paste-a-long-random-key> \\
  -e DATABASE_URL=postgresql://<user>:<password>@<host>:5432/<dbname> \\
  -e STORE_MODEL_IN_DB=True \\
  -p 4000:4000 \\
  docker.litellm.ai/berriai/litellm:main-stable`;

const INSTALLER = `curl -fsSL https://raw.githubusercontent.com/BerriAI/litellm/main/scripts/install.sh | sh`;

const HELM = `helm install litellm oci://ghcr.io/berriai/litellm-helm -f values.yaml`;

// Each tab: what it is for (one line, shown as a shell comment), the command,
// and where to read more. `prompt` tabs render an agent prompt instead.
const INSTALLS = {
  gateway: [
    {
      id: 'compose',
      label: 'Docker Compose',
      note: 'Gateway + Postgres on :4000, admin UI at /ui. Keys are generated into .env.',
      code: GATEWAY_COMPOSE,
      more: '/docs/proxy/docker_quick_start',
    },
    {id: 'agent', label: 'Coding agent', prompt: 'gateway'},
    {
      id: 'installer',
      label: 'One-liner',
      note: 'macOS and Linux. Installs uv and litellm[proxy], then runs the setup wizard. Config-file mode: no database, so no virtual keys or admin UI.',
      code: INSTALLER,
      more: 'https://github.com/BerriAI/litellm/blob/main/scripts/install.sh',
      moreLabel: 'Read the script',
    },
    {
      id: 'docker',
      label: 'docker run',
      note: 'Bring your own Postgres.',
      code: GATEWAY_DOCKER_RUN,
      more: '/docs/proxy/deploy',
    },
    {
      id: 'helm',
      label: 'Helm',
      note: 'Kubernetes. See the deploy guide for values.yaml.',
      code: HELM,
      more: '/docs/proxy/deploy#deploy-with-helm',
    },
  ],
  sdk: [
    {id: 'uv', label: 'uv', note: 'Python 3.10+', code: 'uv add litellm', more: '/docs/'},
    {id: 'pip', label: 'pip', note: 'Python 3.10+', code: 'pip install litellm', more: '/docs/'},
    {id: 'agent', label: 'Coding agent', prompt: 'sdk'},
  ],
};

const ENTERPRISE_HERO = {
  title: 'Give every team access to AI. Keep control of who uses what, and what it costs.',
  text: 'LiteLLM Enterprise is the open-source AI Gateway plus single sign-on, audit logs, delegated admin roles, and support from the engineers who build it. It runs in your cloud, so prompts and responses never leave your environment.',
};

// What each tier adds, top to bottom. Each tier includes everything below it.
const TIERS = [
  {
    id: 'enterprise',
    name: 'Enterprise',
    how: 'License key on the same Gateway',
    items: [
      ['SSO and SCIM', '/docs/proxy/admin_ui_sso'],
      ['Audit logs', '/docs/proxy/multiple_admins'],
      ['Org and team admins', '/docs/proxy/access_control'],
      ['Secret managers', '/docs/secret_managers/overview'],
      ['IP allowlists', '/docs/proxy/ip_address'],
      ['Per-team logging', '/docs/proxy/team_logging'],
      ['Multi-region', '/docs/proxy/multi_region'],
      ['Support SLAs', '#professional-support'],
    ],
  },
  {
    id: 'gateway',
    name: 'AI Gateway',
    how: 'Open source, self-hosted',
    items: [
      ['Virtual keys', '/docs/proxy/virtual_keys'],
      ['Budgets and rate limits', '/docs/proxy/users'],
      ['Spend tracking', '/docs/proxy/cost_tracking'],
      ['Admin UI', '/docs/proxy/ui'],
      ['Load balancing', '/docs/proxy/load_balancing'],
      ['Guardrails', '/docs/proxy/guardrails/quick_start'],
      ['MCP gateway', '/docs/mcp'],
      ['Any language', '/docs/proxy/client_setup/overview'],
    ],
  },
  {
    id: 'sdk',
    name: 'Python SDK',
    how: 'Open source library',
    items: [
      ['100+ providers', '/docs/providers'],
      ['OpenAI format', '/docs/completion/output'],
      ['Router and fallbacks', '/docs/routing'],
      ['Cost per call', '/docs/completion/token_usage'],
      ['Logging callbacks', '/docs/observability/callbacks'],
    ],
  },
];

module.exports = {
  ENTERPRISE_HERO,
  TIERS,
  DOCS,
  SALES_URL,
  TRIAL_URL,
  SALES_EMBED_URL,
  withUtm,
  PROMPTS,
  INSTALLS,
  GATEWAY_COMPOSE,
  INSTALLER,
};
