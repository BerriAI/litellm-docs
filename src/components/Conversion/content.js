// Shared copy for the conversion components: agent prompts, install commands,
// and sales links. CommonJS so plugins/llms.js can expand <AgentPrompt id="…"/>
// and <InstallBox variant="…"/> into the per-page markdown agents read.

const DOCS = 'https://docs.litellm.ai';

const SALES_URL = 'https://www.litellm.ai/enterprise#talk-to-sales';
const TRIAL_URL = 'https://www.litellm.ai/enterprise#trial';

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
2. In a new litellm-gateway directory, download https://github.com/BerriAI/litellm/raw/main/docker/docker-compose.quickstart.yml and create .env with LITELLM_MASTER_KEY and LITELLM_SALT_KEY, each "sk-" followed by the output of openssl rand -hex 32, and POSTGRES_PASSWORD set to the output of openssl rand -hex 24. Add .env to .gitignore and never print any of these values.
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
  enterprise: {
    title: 'Evaluate LiteLLM Enterprise on my gateway',
    text: `Help me evaluate LiteLLM Enterprise on my own LiteLLM Gateway. First read ${DOCS}/docs/enterprise.md and ${DOCS}/docs/learn/enterprise_quickstart.md. Then:
1. Check whether a gateway is already running (GET <url>/health/readiness). If not, set one up first by following ${DOCS}/docs/proxy/docker_quick_start.md.
2. Ask me for the trial license key. Add it as LITELLM_LICENSE in the gateway's environment (.env for Docker Compose) without printing it, and restart the gateway.
3. Ask which identity provider we use (Okta, Entra ID, Google, or another OIDC or SAML provider) and walk me through ${DOCS}/docs/proxy/admin_ui_sso.md for it. Show me every config change before writing it.
4. Verify: sign in to <url>/ui through SSO, then confirm the audit log records an admin action.
If I do not have a license yet, stop and point me to ${SALES_URL}.`,
  },
  mcp: {
    title: 'Put my MCP servers behind the LiteLLM Gateway',
    text: `Help me serve MCP tools through my LiteLLM Gateway. First read ${DOCS}/docs/mcp.md and ${DOCS}/docs/mcp_control.md. Ask me for the gateway URL and a key with admin rights, and which MCP servers I want to add.
1. Add each MCP server to the gateway the way mcp.md describes, keeping any server credentials in environment variables, never in files.
2. Limit which keys and teams can use each server, following mcp_control.md.
3. Connect one client (Claude Code, Cursor, or my app) to the gateway's MCP endpoint with a virtual key. Show me each config change before writing it.
4. Verify: list the tools through the gateway and call one of them.`,
  },
  agents: {
    title: 'Route my A2A agents through the LiteLLM Gateway',
    text: `Help me put my A2A agents behind my LiteLLM Gateway. First read ${DOCS}/docs/a2a.md, ${DOCS}/docs/a2a_agent_card.md, and ${DOCS}/docs/a2a_agent_permissions.md. Ask me for the gateway URL, a key with admin rights, and the agents I want to add.
1. Register each agent on the gateway as a2a.md describes.
2. Decide with me which teams and keys may call each agent, and set that up following a2a_agent_permissions.md.
3. Verify: invoke one agent through the gateway with a virtual key, then confirm the request shows up under Logs at <url>/ui.`,
  },
  autorouter: {
    title: 'Try the LiteLLM Auto Router',
    text: `Help me try the LiteLLM Auto Router, a paid add-on for the LiteLLM Gateway. First read ${DOCS}/docs/auto_router/index.md, then setup.md and recommended_configurations.md in the same folder.
1. Check that a gateway is running and ask me for its URL and an admin key.
2. Recommend a starting configuration from recommended_configurations.md for the models I already have, and explain the trade-off before changing anything.
3. Follow setup.md to add the router, showing me each config change before writing it.
4. Verify: send three requests of different difficulty and show me which model answered each and what each cost.`,
  },
  observability: {
    title: 'Send my gateway logs to my observability tool',
    text: `Help me send LiteLLM Gateway logs and spend to our observability tool. First read ${DOCS}/docs/proxy/logging.md. Ask me which tool we use (Langfuse, Datadog, OpenTelemetry, or another listed there) and for the gateway URL.
1. Follow the section for that tool in logging.md. Put every credential in environment variables, never in config files, and show me each change before writing it.
2. Restart the gateway if the change needs it.
3. Verify: send one request through the gateway and show me where it appears in the tool.`,
  },
  liteadmin: {
    title: 'Manage my LiteLLM Gateway from this agent with LiteAdmin MCP',
    text: `Help me connect LiteAdmin MCP so you can manage my LiteLLM Gateway. First read ${DOCS}/docs/proxy/liteadmin_mcp.md. Then:
1. Ask me for the gateway URL and a personal virtual key that belongs to a user with the proxy_admin role. Do not use the master key, and never print the key.
2. Add the LiteAdmin MCP server to this client the way the guide shows for it (Claude Code, Claude Desktop, or Codex). Show me the change before writing it.
3. Verify: list the gateway's models and my teams through the MCP tools, then stop and ask me what to change.`,
  },
  liteagents: {
    title: 'Try LiteAgents on one of my agents',
    text: `Help me try LiteAgents, a preview SDK for switching agent harnesses without rewriting the agent. First read https://github.com/BerriAI/liteagents/blob/main/docs/getting-started.md and the harness-switching recipe at https://github.com/BerriAI/liteagents/blob/main/cookbook/recipes/10_harness_switch.py. Then:
1. Install the preview release the getting-started guide names, in a separate virtual environment.
2. Ask me which agent to port and which model to use. If I run a LiteLLM Gateway, point the model at it with a virtual key read from the environment.
3. Port the agent to a LiteAgents profile, keeping its tools and MCP connections, and run one task.
4. Change only the harness field to a second harness, run the same task, and show me both results side by side.`,
  },
};

const GATEWAY_COMPOSE = `curl -sSLO https://github.com/BerriAI/litellm/raw/main/docker/docker-compose.quickstart.yml
printf 'LITELLM_MASTER_KEY=sk-%s\\nLITELLM_SALT_KEY=sk-%s\\nPOSTGRES_PASSWORD=%s\\n' "$(openssl rand -hex 32)" "$(openssl rand -hex 32)" "$(openssl rand -hex 24)" > .env
docker compose -f docker-compose.quickstart.yml up -d`;

const GATEWAY_DOCKER_RUN = `docker run \\
  -e LITELLM_MASTER_KEY=sk-<paste-a-long-random-key> \\
  -e DATABASE_URL=postgresql://<user>:<password>@<host>:5432/<dbname> \\
  -e STORE_MODEL_IN_DB=True \\
  -p 4000:4000 \\
  docker.litellm.ai/berriai/litellm:main-stable`;

// One-click hosted deploys, offered to phone visitors who cannot run Docker.
const ONE_CLICK = [
  ['Railway', 'https://railway.com/deploy/Lm9gxI?referralCode=7mRv9K&utm_medium=integration&utm_source=template&utm_campaign=generic', 'https://railway.com/button.svg'],
  ['Render', 'https://render.com/deploy?repo=https://github.com/BerriAI/litellm', 'https://render.com/images/deploy-to-render-button.svg'],
];

const INSTALLER = `curl -fsSL https://raw.githubusercontent.com/BerriAI/litellm/main/scripts/install.sh | sh`;

const HELM = `helm install litellm oci://ghcr.io/berriai/litellm-helm -f values.yaml`;

// Install options per path. The first entry is the recommended command and is
// the only one shown up front; the rest sit under "Other ways to install",
// each with a line on when to pick it. Agent prompts are never mixed in here;
// they get their own <AgentPrompt> box.
const INSTALLS = {
  gateway: {
    title: 'Start the Gateway',
    what: 'Runs the gateway and a Postgres database on port 4000, with the admin UI at /ui. The master key, salt key, and database password are generated into .env.',
    options: [
      {
        id: 'compose',
        label: 'Docker Compose',
        code: GATEWAY_COMPOSE,
        more: '/docs/proxy/docker_quick_start',
      },
      {
        id: 'docker',
        label: 'docker run',
        when: 'You already have a Postgres database to point it at.',
        code: GATEWAY_DOCKER_RUN,
        more: '/docs/proxy/deploy',
      },
      {
        id: 'helm',
        label: 'Helm',
        when: 'You deploy to Kubernetes. Pair it with a values.yaml from the deploy guide.',
        code: HELM,
        more: '/docs/proxy/deploy#deploy-with-helm',
      },
      {
        id: 'installer',
        label: 'One-line installer',
        when: 'You want the gateway as a local CLI without Docker (macOS and Linux). It runs from a config file with no database, so there are no virtual keys or admin UI.',
        code: INSTALLER,
        more: 'https://github.com/BerriAI/litellm/blob/main/scripts/install.sh',
        moreLabel: 'Read the script',
      },
    ],
  },
  sdk: {
    title: 'Install the SDK',
    what: 'Adds the litellm package to your Python project (Python 3.10 or newer).',
    options: [
      {id: 'uv', label: 'uv', code: 'uv add litellm', more: '/docs/#quick-start'},
      {id: 'pip', label: 'pip', when: 'Your project uses pip and requirements.txt.', code: 'pip install litellm'},
    ],
  },
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
    how: 'License key on the Gateway',
    plus: 'Everything in AI Gateway, plus',
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
    plus: 'Everything in the SDK, plus',
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
    plus: 'In your Python code',
    items: [
      ['100+ providers', '/docs/providers'],
      ['OpenAI format', '/docs/completion/output'],
      ['Router and fallbacks', '/docs/routing'],
      ['Cost per call', '/docs/completion/token_usage'],
      ['Logging callbacks', '/docs/observability/callbacks'],
    ],
  },
];

// The docs home, below the path picker: one section per product, each told
// as the problem a reader has and the product that solves it, with one small
// visual that is real text (code, a table, or log lines) so agents can read
// it too. Model names come from docs-models.json like the rest of the docs.
const M = require('../../../docs-models.json');
const USE_CASES = [
  {
    id: 'sdk',
    product: 'Python SDK',
    problem: 'Call 100+ LLM providers from Python with one function.',
    solution:
      'completion() takes the same arguments for OpenAI, Anthropic, Bedrock, and 100+ others, and always answers in the OpenAI format, so switching models is a string change. Streaming, retries, fallbacks, and cost per call come with it.',
    to: '/docs/',
    cta: 'Install the SDK',
    prompt: 'sdk',
    // On the docs home the hero already installs and holds the prompt, so the
    // row points to what comes next
    links: [
      ['SDK quickstart', '/docs/'],
      ['Supported providers', '/docs/providers'],
    ],
    visual: {
      type: 'code',
      lang: 'python',
      code: `from litellm import completion

messages = [{"role": "user", "content": "Hello"}]

completion(model="openai/${M.openai_large}", messages=messages)
completion(model="anthropic/${M.anthropic}", messages=messages)`,
    },
  },
  {
    id: 'gateway',
    product: 'AI Gateway',
    problem: 'One endpoint for every model, with keys, budgets, and spend tracking for each team.',
    solution:
      'Every app calls the gateway in the OpenAI format, in any language. Each app or teammate gets a virtual key with its own budget and rate limit, every request is logged with its cost, and your real provider keys never leave the gateway.',
    to: '/docs/proxy/docker_quick_start',
    cta: 'Start the Gateway',
    prompt: 'gateway',
    links: [
      ['Gateway quickstart', '/docs/proxy/docker_quick_start'],
      ['Virtual keys and budgets', '/docs/proxy/virtual_keys'],
    ],
    visual: {
      type: 'code',
      lang: 'bash',
      code: `curl http://localhost:4000/v1/chat/completions \\
  -H "Authorization: Bearer sk-<virtual-key>" \\
  -H "Content-Type: application/json" \\
  -d '{"model": "${M.openai_large}",
       "messages": [{"role": "user", "content": "Hello"}]}'`,
    },
  },
  {
    id: 'enterprise',
    product: 'Enterprise',
    problem: 'Single sign-on, audit logs, and admin roles for a company-wide rollout.',
    solution:
      'Enterprise adds them to the same gateway with a license key: SSO and SCIM, audit logs of every admin action, delegated admins per team, multi-region deployment, and support from the engineers who build LiteLLM.',
    to: '/docs/enterprise',
    cta: 'Talk to sales',
    sales: true,
    visual: {
      type: 'lines',
      lines: [
        ['jane@acme.com via Okta', 'created key', 'team: search'],
        ['raj@acme.com via Okta', 'raised budget', 'team: support'],
      ],
    },
  },
];

// After the SDK and gateway rows: what else runs on or with the gateway,
// in three themed pairs. Each card says what the product does, then shows
// it with one small text visual.
const CARD_GROUPS = [
  {title: 'Tools and agents', ids: ['mcp', 'agents']},
  {title: 'Choose models and harnesses', ids: ['autorouter', 'liteagents']},
  {title: 'Run it from your terminal or your agent', ids: ['tools', 'liteadmin']},
];

const PRODUCT_CARDS = [
  {
    id: 'mcp',
    product: 'MCP Gateway',
    problem: 'Serve every MCP tool from one endpoint.',
    text: 'Add MCP servers to the gateway once instead of wiring them into every app, and choose which keys and teams can use each server.',
    visual: {
      type: 'table',
      head: ['MCP server', 'Search team', 'Support team'],
      rows: [
        ['GitHub', 'allowed', 'no access'],
        ['Jira', 'allowed', 'allowed'],
      ],
    },
    to: '/docs/mcp',
    prompt: 'mcp',
  },
  {
    id: 'agents',
    product: 'Agent Gateway',
    problem: 'Route agent-to-agent calls through the gateway.',
    text: 'Register your A2A agents on the gateway, so every call to them uses a virtual key, shows up in your logs with its cost, and is limited to the teams you allow.',
    visual: {
      type: 'lines',
      lines: [
        ['POST /a2a/support-agent', 'search-team', 'logged'],
        ['POST /a2a/billing-agent', 'search-team', 'not allowed'],
      ],
    },
    to: '/docs/a2a',
    prompt: 'agents',
  },
  {
    id: 'autorouter',
    product: 'Auto Router (add-on)',
    problem: 'Send each request to the cheapest model that can answer it.',
    text: 'Easy prompts stop going to your most expensive model, with no change to your app.',
    visual: {
      type: 'table',
      head: ['Request', 'Routed to'],
      rows: [
        ['Fix the typo in this sentence', 'a small, cheap model'],
        ['Plan a zero-downtime migration', 'a frontier model'],
      ],
    },
    to: '/docs/auto_router/',
    prompt: 'autorouter',
  },
  {
    id: 'liteagents',
    product: 'LiteAgents (preview)',
    problem: 'Switch agent harnesses without rewriting your agent.',
    text: 'Move between Deep Agents, Pydantic AI, the Claude Agent SDK, Codex, and OpenCode by changing one field. Your tools and MCP connections stay.',
    visual: {
      type: 'code',
      lang: 'python',
      code: `ProfileOptions(
    harness="deepagents",  # or "claude-sdk", "codex", "pydantic-ai"
    model="my-model",
)`,
    },
    to: '/blog/liteagents-sdk',
    prompt: 'liteagents',
  },
  {
    id: 'tools',
    product: 'lite CLI',
    problem: 'Run Claude Code and Codex through your gateway.',
    text: 'Instead of personal API keys, the lite CLI signs in to your gateway and launches the tool through it, so budgets, logs, and guardrails apply per person.',
    visual: {
      type: 'code',
      lang: 'bash',
      code: `lite login    # sign in to your gateway
lite claude   # Claude Code, through the gateway`,
    },
    to: '/docs/proxy/management_cli',
    prompt: 'clients',
  },
  {
    id: 'liteadmin',
    product: 'LiteAdmin MCP',
    problem: 'Manage the gateway by asking your agent.',
    text: 'Connect Claude or Codex to your gateway and ask it to create keys, add models, manage teams and budgets, or look up a failing request.',
    visual: {
      type: 'chat',
      lines: [
        ['You', 'Create a key for the search team with a $200 monthly budget.'],
        ['Claude', 'Done. The key belongs to team search, with a $200 budget per month.'],
      ],
    },
    to: '/docs/proxy/liteadmin_mcp',
    prompt: 'liteadmin',
  },
];

// Every product, as the system map on the docs home draws it. Each has a
// guide and an agent prompt (PROMPTS above).
const PRODUCTS = [
  {id: 'gateway', name: 'AI Gateway', to: '/docs/simple_proxy', prompt: 'gateway', text: 'One OpenAI-compatible endpoint for every app, with virtual keys, budgets, spend logs, and guardrails.'},
  {id: 'tools', name: 'Your apps and AI tools', to: '/docs/proxy/client_setup/overview', prompt: 'clients', text: 'Any OpenAI or Anthropic SDK, plus Claude Code, Codex, and Cursor, point at the gateway.'},
  {id: 'sdk', name: 'Python SDK', to: '/docs/', prompt: 'sdk', text: 'A library for one Python app: completion() for 100+ providers, with routing, fallbacks, and cost per call.'},
  {id: 'mcp', name: 'MCP Gateway', to: '/docs/mcp', prompt: 'mcp', text: 'One endpoint for every MCP tool, with access set per key and team, and cost tracking.'},
  {id: 'agents', name: 'Agent Gateway (A2A)', to: '/docs/a2a', prompt: 'agents', text: 'Invoke A2A agents through the gateway, with logs and per-team access.'},
  {id: 'autorouter', name: 'Auto Router (add-on)', to: '/docs/auto_router/', prompt: 'autorouter', text: 'Routes each request to the cheapest model that can answer it well.'},
  {id: 'enterprise', name: 'Enterprise', to: '/docs/enterprise', prompt: 'enterprise', text: 'SSO, audit logs, delegated admins, and multi-region on the same gateway, with a license key.'},
];

module.exports = {
  PRODUCTS,
  USE_CASES,
  PRODUCT_CARDS,
  CARD_GROUPS,
  ENTERPRISE_HERO,
  TIERS,
  DOCS,
  SALES_URL,
  TRIAL_URL,
  withUtm,
  PROMPTS,
  INSTALLS,
  ONE_CLICK,
  GATEWAY_COMPOSE,
  INSTALLER,
};
