import React, {useState} from 'react';
import Link from '@docusaurus/Link';
import CodeBlock from '@theme/CodeBlock';
import styles from './post.module.css';

function Label({children}) { return <div className={styles.label}>{children}</div>; }
function Shot({name,alt,children}) { const src = '/img/ai-subscriptions/' + name + '.jpg'; return <figure className={styles.shot}><div className={styles.shotStage}><a href={src} aria-label={'Open full-size screenshot: '+alt}><div className={styles.screen}><img src={src} alt={alt} width="1600" height="1000" loading="lazy" /></div></a></div><figcaption>{children} <a href={src}>View full size ↗</a></figcaption></figure>; }

import {install, login, key, start, request} from './examples';

const combinedConfig = `model_list:
  - model_name: chatgpt-coding
    litellm_params:
      model: chatgpt/gpt-6-luna
      chatgpt_auth_file: ./auth/account-a/auth.json
  - model_name: chatgpt-coding
    litellm_params:
      model: chatgpt/gpt-6-luna
      chatgpt_auth_file: ./auth/account-b/auth.json
  - model_name: go-coding
    litellm_params:
      model: opencode_go/glm-5.3-flash
      api_key: os.environ/OPENCODE_API_KEY

router_settings:
  routing_strategy: simple-shuffle
  num_retries: 2
  allowed_fails: 1
  cooldown_time: 60

general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY`;

const clientConfig = `{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "subscriptions": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "My subscriptions",
      "options": {
        "baseURL": "http://localhost:4000/v1",
        "apiKey": "{env:LITELLM_MASTER_KEY}"
      },
      "models": {
        "chatgpt-coding": {"name": "ChatGPT · GPT-6 Luna"},
        "go-coding": {"name": "Go · GLM-5.3-Flash"}
      }
    }
  }
}`;

function ModelFlow() {
  const [alias,setAlias] = useState('chatgpt-coding');
  const isChatGPT = alias === 'chatgpt-coding';
  return <div>
    <div className={styles.choice} role="group" aria-label="Illustrated client model">{['chatgpt-coding','go-coding'].map(name=><button key={name} type="button" aria-pressed={alias===name} onClick={()=>setAlias(name)}>{name}</button>)}</div>
    <div className={styles.route} aria-live="polite"><div><span className={styles.routeLabel}>YOUR CLIENT</span><strong>{alias}</strong><code>localhost:4000/v1</code></div><span className={styles.arrow} aria-hidden="true">→</span><div className={styles.active}><span className={styles.routeLabel}>LITELLM</span><strong>{isChatGPT?'Choose an account':'Use Console key'}</strong><code>{isChatGPT?'account-a or account-b':'OPENCODE_API_KEY'}</code></div><span className={styles.arrow} aria-hidden="true">→</span><div><span className={styles.routeLabel}>{isChatGPT?'CHATGPT':'OPENCODE GO'}</span><strong>{isChatGPT?'GPT-6 Luna':'GLM-5.3-Flash'}</strong><code>{isChatGPT?'ChatGPT plan usage':'OpenCode Go plan usage'}</code></div></div>
    <p className={styles.caption}>Illustrated routing example. Model aliases select configured deployments; the diagram makes no API calls.</p>
  </div>;
}

const agentPrompt = `Set up LiteLLM on my computer so I can use two ChatGPT accounts and an OpenCode Go subscription from one endpoint in my coding tool.

Read https://docs.litellm.ai/blog/ai-subscriptions and the linked provider reference before acting. Inspect my existing setup and reuse compatible tools, logins, and configuration. Preserve unrelated settings. Work through installation, configuration, startup, and verification; ask me only for information you cannot infer, an account sign-in, a required permission, or a choice that changes the outcome.

Use a local loopback endpoint and one proxy process. For a new source installation, check for Git, uv, Rust with a C compiler, and Python 3.13, then use this verified source revision:

${install}

Run these sign-ins one at a time in an interactive terminal. Ask me to complete the browser login. For the second login, ask me to choose the other account in a private browser window. Confirm that the two files represent different accounts without printing their tokens or account identifiers. If I have one account, configure one deployment instead.

${login}

For OpenCode Go, use an existing OPENCODE_API_KEY environment variable or ask me to create a Console key and load it locally. Do not ask me to paste it into chat. Skip Go if I say I do not have that subscription.

Keep credentials out of chat, logs, screenshots, commits, and client configuration. Use local environment variables or my existing secret manager for keys. Give auth files restrictive permissions and keep their directory writable for refresh. Do not buy subscriptions or credits, change billing settings, expose the proxy publicly, or overwrite an existing deployment.

Use this as the starting config.yaml, adapting file paths to the chosen working directory. Verify that the selected model works on each account before pooling it; if it does not, find a model both accounts support or ask me to choose between the available options.

${combinedConfig}

Generate LITELLM_MASTER_KEY locally without displaying it, make it available to the proxy and client through the local environment or secret manager, and start:

${start}

First verify each account through its own temporary model alias. Then verify the pooled alias and a real greeting from the coding tool I use. If the tool is not clear from the project or existing configuration, ask which one to configure. Use http://localhost:4000/v1 as the OpenAI-compatible base URL and the LiteLLM key as the client credential. If a request fails, diagnose and repair it before calling setup complete. Do not add output-token caps.

Explain which aliases work, how to start and stop the proxy, and which sign-ins or model choices still need my attention. Keep provider error details sanitized. State that balancing does not track remaining subscription allowance or guarantee avoidance of credit charges. Configure cross-provider fallbacks only if I request them.`;

function AgentSetup() {
  const [copyState, setCopyState] = useState('idle');
  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(agentPrompt);
      setCopyState('copied');
    } catch {
      setCopyState('error');
    }
  }
  return <div className={`${styles.inner} ${styles.agentSetup}`}>
    <details className={styles.agentDetails}>
      <summary><strong>Set up with your agent</strong><span>View the setup prompt <span className={styles.disclosure} aria-hidden="true">⌄</span></span></summary>
      <p>Paste this into your coding agent. It handles setup and verification, and asks you to complete the sign-ins.</p>
      <CodeBlock language="text" title="Setup prompt">{agentPrompt}</CodeBlock>
    </details>
    <button className={styles.copyPrompt} type="button" onClick={copyPrompt} aria-label="Copy setup prompt">{copyState === 'copied' ? 'Copied ✓' : 'Copy prompt'}</button>
    <span className={styles.copyStatus} role="status">{copyState === 'copied' ? 'Setup prompt copied.' : ''}</span>
    {copyState === 'error' && <p className={styles.copyError} role="alert">Could not copy. Open the prompt and copy its text.</p>}
  </div>;
}

export default function SubscriptionPost() { return <div className={styles.root} data-full-width>
<header className={styles.hero}><div className={styles.inner}>
  <div className={styles.masthead}><Link to="/blog"><img src="/img/brand/litellm-logo-white.png" alt="LiteLLM" width="142" /></Link><span>AI SUBSCRIPTIONS / LOCAL SETUP</span></div>
  <h1>Your AI subscriptions.<br /><span>One LiteLLM endpoint.</span></h1>
  <p>Connect ChatGPT and OpenCode Go to a local proxy. Use the models from your coding tools, with credentials and routing in one configuration.</p>
  <nav className={styles.heroLinks} aria-label="Article sections"><a href="#connect">Connect subscriptions</a><a href="#run">Start LiteLLM</a><a href="#clients">Connect your tools</a><a href="#routing">Choose routing</a></nav>
</div></header>
<AgentSetup />
<section className={styles.section}>
  <Label>01 / CHOOSE A MODEL FROM YOUR TOOL</Label><div className={styles.prose}><h2>Keep your subscriptions in one configuration.</h2><p>You use ChatGPT for one task and a Go model for another. With LiteLLM, you can keep one endpoint in your coding tool and select the model alias you want. Provider credentials stay on the proxy.</p><p>This guide connects two ChatGPT accounts and one OpenCode Go subscription. You can remove the second ChatGPT deployment if you use one account. After setup, one command starts the proxy.</p></div><ModelFlow />
</section>
<section id="connect" className={styles.section}>
  <Label>02 / INSTALL AND CONNECT</Label><h2>Save a login for ChatGPT.<br />Add a Console key for Go.</h2>
  <div className={styles.prose}><p>Install <a href="https://docs.astral.sh/uv/getting-started/installation/">uv</a>, Git, and <a href="https://www.rust-lang.org/tools/install">Rust</a> with your platform’s C compiler. Use Python 3.13. Run the commands below, then stay in the checkout for the remaining steps.</p></div>
  <CodeBlock language="bash" title="Install LiteLLM from source">{install}</CodeBlock>
  <h3>ChatGPT</h3><p>Enable device-code login in ChatGPT’s security settings or your workspace permissions. Run each command and complete its browser sign-in. Use a private window for the second account so you can choose the intended login.</p>
  <CodeBlock language="bash" title="Sign in before starting the proxy">{login}</CodeBlock>
  <p>Keep the resulting auth files private and writable. LiteLLM updates them when it refreshes a login.</p>
  <h3>OpenCode Go</h3><p>With an active Go or Go Plus subscription, create an API key in <a href="https://opencode.ai/console">OpenCode Console</a>. Load it into the shell that will run LiteLLM:</p>
  <CodeBlock language="bash" title="Replace the placeholder with your Console key">{'export OPENCODE_API_KEY="replace-with-your-opencode-console-key"'}</CodeBlock>
  <p>On an existing database-backed LiteLLM gateway, you can add this provider through <strong>Models + Endpoints → Add Model</strong>. Choose <strong>OpenCode Go</strong>, select the model, and enter your Console key in <strong>API Key</strong>.</p>
  <Shot name="opencode-laptop" alt="LiteLLM Add Model form with OpenCode Go and GLM-5.3-Flash selected">Real product screenshot with sample model configuration. The example leaves the API key out of the image.</Shot>
</section>
<section id="run" className={styles.section}>
  <Label>03 / START YOUR LOCAL ENDPOINT</Label><div className={styles.split}><div><h2>Put your models in config.yaml.</h2><p>Both ChatGPT deployments use the same alias, <code>chatgpt-coding</code>. Requests to that alias can use either account. Requests to <code>go-coding</code> use the Go deployment.</p><p>Choose model IDs your subscriptions support. This example uses GPT-6 Luna and GLM-5.3-Flash. Separate aliases preserve that choice in your client.</p><p>The local configuration requires no database. Keep one proxy process to avoid concurrent refreshes of the same ChatGPT auth file.</p></div><CodeBlock language="yaml" title="config.yaml">{combinedConfig}</CodeBlock></div>
  <h3>Generate a gateway key, then start LiteLLM</h3><p>Clients use this key to call your proxy. Keep the generated value in your local secret manager and load it as <code>LITELLM_MASTER_KEY</code> in client shells.</p>
  <CodeBlock language="bash" title="Create the gateway key">{key}</CodeBlock><CodeBlock language="bash" title="One startup command after setup">{start}</CodeBlock>
  <p>In a second terminal with that key loaded, send this request. Expect a greeting in <code>choices[0].message.content</code>. Repeat it with <code>go-coding</code> to check the Go connection.</p><CodeBlock language="bash" title="Verify each subscription">{request}</CodeBlock>
</section>
<section id="docker" className={styles.section}>
  <Label>OPTIONAL / RUN IN DOCKER</Label><h2>Use the same configuration in a container.</h2>
  <p>After the terminal logins, you can run the proxy in Docker instead of the local process. Build the pinned checkout from tracked files so your auth files stay out of the image:</p>
  <CodeBlock language="bash" title="Build the image">{'git archive HEAD | docker build -t litellm-subscriptions:local -'}</CodeBlock>
  <p>From the checkout, run the command below with both environment variables loaded. The auth directory remains writable for token refresh. The published port accepts connections from your computer.</p>
  <CodeBlock language="bash" title="Start the container">{String.raw`docker run --rm --name litellm-subscriptions \
  -p 127.0.0.1:4000:4000 \
  -e LITELLM_MASTER_KEY -e OPENCODE_API_KEY \
  -v "$PWD/config.yaml:/app/config.yaml:ro" \
  -v "$PWD/auth:/app/auth" \
  litellm-subscriptions:local \
  --config /app/config.yaml --host 0.0.0.0 --port 4000 --num_workers 1`}</CodeBlock>
  <p>Run the same verification request against <code>http://localhost:4000/v1</code>. Stop the container before starting another process with the same account files.</p>
</section>
<section id="clients" className={styles.section}>
  <Label>04 / CONNECT YOUR CODING TOOLS</Label><h2>Use the proxy from OpenCode.</h2>
  <div className={styles.prose}><p>With <a href="https://opencode.ai/docs/">OpenCode installed</a>, save this as <code>opencode.json</code> in your project, or merge its provider entry into your existing configuration.</p><p>Start <code>opencode</code> from a shell with your LiteLLM key loaded. Run <code>/models</code>, choose a model under <strong>My subscriptions</strong>, and send a message.</p></div><CodeBlock language="json" title="opencode.json">{clientConfig}</CodeBlock>
  <p>For another client with custom OpenAI-compatible endpoint support, set its base URL to <code>http://localhost:4000/v1</code>, its API key to your LiteLLM key, and its model to one of the aliases. Check the client’s API route and required features; compatibility depends on the selected model.</p>
</section>
<section id="routing" className={styles.section}>
  <Label>05 / DECIDE HOW REQUESTS MOVE</Label><h2>Balance accounts. Choose fallbacks.</h2>
  <table className={styles.table}><thead><tr><th>Your choice</th><th>Configuration</th><th>Result</th></tr></thead><tbody><tr><td>Choose a model</td><td>Different aliases</td><td>The caller selects ChatGPT or Go</td></tr><tr><td>Distribute a model’s requests</td><td>Same alias, compatible deployments</td><td>The router chooses an eligible account</td></tr><tr><td>Try another model after a failure</td><td>Explicit fallback list</td><td>The router can change model and provider</td></tr></tbody></table>
  <div className={styles.prose}><p>The example uses <code>simple-shuffle</code> for account selection, plus retries and a cooldown after failures. To permit fallback from ChatGPT to Go, add the following under the existing <code>router_settings</code>. Skip this if you want a failed ChatGPT request to stay within its model group.</p></div>
  <CodeBlock language="yaml" title="Optional cross-model fallback">{'  fallbacks:\n    - chatgpt-coding: [go-coding]'}</CodeBlock>
  <p>Fallback changes the model serving the task. Check tool support, context size, and output behavior before using it in a coding workflow.</p>
  <h3>Keep provider allowance separate from gateway counters</h3><p>LiteLLM does not read the remaining ChatGPT or Go subscription allowance. Its token and estimated-cost records do not mirror the provider’s balance. If a provider accepts an overage through purchased credits, LiteLLM sees a successful request and continues.</p><p>Check each provider’s usage dashboard and spending settings. Do not treat account balancing as a guarantee that you will stay inside included usage or avoid credit charges.</p>
</section>
<section id="dashboard" className={styles.section}>
  <Label>06 / USE AN EXISTING ADMIN UI</Label><h2>Choose the saved ChatGPT login.</h2><div className={styles.prose}><p>On a database-backed gateway, a proxy administrator can choose <strong>ChatGPT Subscription</strong> in <strong>Add Model</strong>. Under <strong>Advanced Settings → LiteLLM Params</strong>, set the auth file’s path inside the proxy.</p><p>The file must exist there before you add the model. For a container, mount the auth directory as persistent writable storage; a read-only mount prevents token refresh.</p></div>
  <Shot name="chatgpt-laptop" alt="LiteLLM ChatGPT Subscription model form with a sample public model alias">Real product screenshot using sample data. Admins configure the account; clients choose an allowed model alias.</Shot>
  <CodeBlock language="json" title="LiteLLM Params for a container-mounted account">{'{"chatgpt_auth_file":"/app/auth/account-a/auth.json"}'}</CodeBlock>
</section>
<section className={styles.section}>
  <Label>07 / ADD PROVIDERS WITH SUPPORTED AUTHENTICATION</Label><h2>Check how each subscription connects.</h2><div className={styles.prose}><p>ChatGPT uses a saved login. OpenCode Go uses a Console API key. Other subscriptions can require a different integration, and a paid plan alone does not establish third-party access.</p><p>LiteLLM also documents <a href="/docs/providers/github_copilot">GitHub Copilot</a> and a <a href="/docs/tutorials/claude_code_max_subscription">Claude Code gateway flow</a>. Claude subscription credentials have provider restrictions; that flow is not a general login pool for other harnesses. Check <a href="https://code.claude.com/docs/en/legal-and-compliance#authentication-and-credential-use">Anthropic’s credential-use rules</a> before extending this setup.</p><p>For a failed connection, test that model alias on its own. Confirm model access and provider credentials first; add pooling or fallback after the direct request succeeds.</p></div>
</section>
<footer className={styles.footer}><Link to="/docs/providers/chatgpt">ChatGPT provider reference ↗</Link><Link to="/docs/providers/opencode_go">OpenCode Go provider reference ↗</Link><Link to="/docs/proxy/reliability">Retry and fallback reference ↗</Link></footer>
</div>; }
