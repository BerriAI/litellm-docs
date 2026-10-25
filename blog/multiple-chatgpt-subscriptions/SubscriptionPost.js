import React, {useState} from 'react';
import Link from '@docusaurus/Link';
import CodeBlock from '@theme/CodeBlock';
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';
import styles from './post.module.css';

function Label({children}) { return <div className={styles.label}>{children}</div>; }
function Shot({name,alt,children}) { const src = '/img/multiple-chatgpt-subscriptions/' + name + '.jpg'; return <figure className={styles.shot}><div className={styles.shotStage}><a href={src} aria-label={'Open full-size screenshot: '+alt}><div className={styles.screen}><img src={src} alt={alt} width="1600" height="1000" loading="lazy" /></div></a></div><figcaption>{children} <a href={src}>View full size ↗</a></figcaption></figure>; }

import {install, login, dockerLogin, authMount, config, request} from './examples';

function AccountFlow() {
  const [selected,setSelected] = useState('account-a');
  return <div>
    <div className={styles.choice} role="group" aria-label="Illustrated account selection">{['account-a','account-b'].map(account=><button type="button" key={account} aria-pressed={selected===account} onClick={()=>setSelected(account)}>{account}</button>)}</div>
    <div className={styles.route} aria-live="polite"><div><span className={styles.routeLabel}>YOUR CODING TOOL</span><strong>chatgpt-coding</strong><code>localhost:4000/v1</code></div><span className={styles.arrow} aria-hidden="true">→</span><div className={styles.active}><span className={styles.routeLabel}>LITELLM DEPLOYMENT</span><strong>{selected}</strong><code>auth/{selected}/auth.json</code></div><span className={styles.arrow} aria-hidden="true">→</span><div><span className={styles.routeLabel}>CHATGPT</span><strong>GPT-6 Luna</strong><code>{selected}’s allowance</code></div></div>
    <p className={styles.caption}>Illustrated request flow. Select an account to trace its credentials; this diagram makes no API calls and shows no live allowance data.</p>
  </div>;
}

const agentPrompt = `Connect two ChatGPT accounts to my LiteLLM proxy so I can use them from one endpoint in my coding tool.

Read https://docs.litellm.ai/blog/multiple-chatgpt-subscriptions and its provider reference. First inspect my existing setup: proxy endpoint, deployment method, installed version, configuration, credentials, and saved account logins. Reuse a working proxy. Do not reinstall it, create a second proxy, change its endpoint, regenerate its keys, or overwrite unrelated configuration. A connection failure alone does not mean the proxy is absent. Ask me only for missing information you cannot infer, sign-in, required permission, or a choice that changes the outcome.

Only if I do not have a proxy, check that Docker with Compose is available and use the official gateway quickstart:

${install}

Read the installer before running it. Keep its generated secrets private. Use the resulting deployment directory, endpoint, and credentials for the remaining steps. New local installations should listen on loopback. If Docker is unavailable, use the documented installation choices or ask which supported option I want; do not default to a source checkout or require Rust.

Confirm that the deployed version supports per-deployment chatgpt_auth_file. If it does not, identify a published release containing that feature and upgrade through the existing deployment method while preserving its data, keys, configuration, and mounts. If no such release exists, report that blocker rather than claiming the setup works.

Reuse each account's valid saved login. For missing logins, run authentication in the proxy's own Python environment or container, one account at a time. Ask me to complete browser sign-in; for the second login, ask me to select the other account in a private window. Confirm distinct accounts without printing tokens or account identifiers. If I have one account, configure one deployment.

For the Docker quickstart, work in its installation directory, prepare a private auth directory, and add this writable mount to the existing litellm service without replacing other settings:

${authMount}

Apply the mount using the deployment's normal restart process, then run:

${dockerLogin}

For an existing Python installation, activate its environment and run these from the proxy's working directory instead:

${login}

Use persistent writable auth storage for refresh. Do not put credentials in chat, logs, screenshots, commits, or client configuration. Do not buy subscriptions or credits, change billing, or expose a local proxy publicly. Avoid multiple processes refreshing the same account file.

Add the two deployments through the existing Admin UI or merge the entries below into the existing model_list and router_settings. Preserve existing models and routing policies. Adapt file paths to the host or container. Use the same alias only for models both accounts support:

${config}

Keep the existing gateway key, salt key, endpoint, and startup method. On a database-backed gateway, use a virtual key with access to the new alias for the coding tool. Only create a missing client key; do not rotate existing credentials. Apply changes using the existing deployment's normal reload or restart procedure.

Verify each account through a temporary separate alias before pooling. Then verify the pooled alias and a real greeting from my coding tool. Infer the tool from existing configuration or ask which one to use. Point it at the existing proxy's OpenAI-compatible base URL and use the LiteLLM client key. Diagnose failures before calling setup complete. Do not add output-token caps.

Summarize what changed, which aliases work, and how to start and stop this deployment. Keep diagnostics sanitized. State that balancing does not track remaining subscription allowance or guarantee avoidance of credit charges. Configure cross-provider fallbacks only if I request them.`;

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
      <p>Paste this into your coding agent. It reuses your proxy, sets one up only if needed, and asks you to complete the sign-ins.</p>
      <CodeBlock language="text" title="Setup prompt">{agentPrompt}</CodeBlock>
    </details>
    <button className={styles.copyPrompt} type="button" onClick={copyPrompt} aria-label="Copy setup prompt">{copyState === 'copied' ? 'Copied ✓' : 'Copy prompt'}</button>
    <span className={styles.copyStatus} role="status">{copyState === 'copied' ? 'Setup prompt copied.' : ''}</span>
    {copyState === 'error' && <p className={styles.copyError} role="alert">Could not copy. Open the prompt and copy its text.</p>}
  </div>;
}

export default function SubscriptionPost() { return <div className={styles.root} data-full-width>
<header className={styles.hero}><div className={styles.inner}>
  <div className={styles.masthead}><Link to="/blog"><img src="/img/brand/litellm-logo-white.png" alt="LiteLLM" width="142" /></Link><span>CHATGPT / DEVELOPER GUIDE</span></div>
  <h1>Use multiple ChatGPT<br /><span>subscriptions with LiteLLM.</span></h1>
  <p>Connect your accounts to one endpoint. Route coding requests across them without switching logins in your tools.</p>
  <nav className={styles.heroLinks} aria-label="Article sections"><a href="#accounts">How it works</a><a href="#proxy">Set up your proxy</a><a href="#setup">Connect your accounts</a><a href="#limits">Usage and limits</a></nav>
</div></header>
<AgentSetup />
<section id="accounts" className={styles.section}>
  <Label>HOW IT WORKS</Label>
  <div className={styles.prose}><h2>Keep coding across your ChatGPT accounts.</h2>
  <p>You hit your Codex limit halfway through a task. You can wait for the reset or buy more credits. If you have another ChatGPT subscription with available usage, you can connect both accounts to LiteLLM and use them from the same coding tool.</p>
  <p>You sign in once per account and give LiteLLM a separate auth file for each deployment. Your client sends a model alias, such as <code>chatgpt-coding</code>. LiteLLM selects a deployment and sends that account’s credentials to ChatGPT.</p>
  <p>You keep each account’s plan, model access, and usage limits. You can give accounts separate aliases or put compatible deployments under one alias to distribute requests.</p></div>
  <AccountFlow />
</section>
<section id="proxy" className={styles.section}>
  <Label>01 / SET UP A PROXY IF YOU NEED ONE</Label>
  <h2>Already have LiteLLM? Skip to your accounts.</h2>
  <div className={styles.prose}><p>If your proxy is running, <a href="#setup">go to step 2</a>. Keep your existing endpoint, keys, and deployment. You will add ChatGPT accounts to it.</p><p>If you have not set up a proxy, start Docker with Compose and run this command in a terminal on macOS or Linux. The quickstart sets up the gateway, database, and Admin UI, and generates the credentials.</p></div>
  <CodeBlock language="bash" title="Only if you do not have a proxy">{install}</CodeBlock>
  <p>Follow the prompts and open the Admin UI at the address the installer shows. Keep its installation directory, which defaults to <code>~/litellm-gateway</code>. For Windows or other deployment methods, use the <Link to="/docs/proxy/docker_quick_start">proxy quickstart</Link>. Continue below once your proxy is running.</p>
</section>
<section id="setup" className={styles.section}>
  <Label>02 / CONNECT YOUR CHATGPT ACCOUNTS</Label>
  <h2>Save a login for each account.</h2>
  <div className={styles.prose}><p>Reuse a valid saved login if you already have one. For each missing login, enable device-code login in ChatGPT’s security settings or ask your workspace administrator to enable it. Run authentication in your proxy’s environment and complete the browser sign-in. Choose the other account in a private browser window for the second login.</p><p>The auth files must be available to the proxy. Choose the instructions for your existing deployment:</p></div>
  <Tabs>
    <TabItem value="docker" label="Docker / quickstart" default>
      <p>Open a terminal in your quickstart installation directory, usually <code>~/litellm-gateway</code>. Create a private directory for the saved logins:</p>
      <CodeBlock language="bash" title="In the gateway installation directory">{'umask 077\nmkdir -p auth\nchmod 700 auth'}</CodeBlock>
      <p>In <code>docker-compose.quickstart.yml</code>, add this volume under the existing <code>litellm</code> service. Preserve its other settings and any existing volumes.</p>
      <CodeBlock language="yaml" title="Add a writable auth mount">{authMount}</CodeBlock>
      <p>Apply the mount, then sign in to each account. Applying a new mount recreates the gateway container.</p>
      <CodeBlock language="bash" title="Apply the mount">{'docker compose -f docker-compose.quickstart.yml up -d litellm'}</CodeBlock>
      <CodeBlock language="bash" title="Sign in inside the gateway container">{dockerLogin}</CodeBlock>
      <p>For another Docker deployment, use its Compose file or container name and mount the same persistent writable directory at <code>/app/auth</code>.</p>
    </TabItem>
    <TabItem value="python" label="Existing Python installation">
      <p>Activate the Python environment that runs your proxy. From the proxy’s working directory, run:</p>
      <CodeBlock language="bash" title="Two accounts, two auth files">{login}</CodeBlock>
      <p>The authenticator creates the directories. Keep these paths relative to the proxy’s working directory, or use absolute paths in your model configuration.</p>
    </TabItem>
  </Tabs>
  <p className={styles.caption}>Keep auth files private and writable for refresh. Read OpenAI’s <a href="https://learn.chatgpt.com/docs/auth">authentication guide</a> for account and workspace requirements.</p>
</section>
<section id="dashboard" className={styles.section}>
  <Label>03 / ADD YOUR ACCOUNTS AS MODELS</Label><h2>The same setup in Models + Endpoints.</h2>
  <div className={styles.prose}><p>On a database-backed gateway, sign in as a proxy administrator. Open <strong>Models + Endpoints → Add Model</strong>, choose <strong>ChatGPT Subscription</strong>, and select your model.</p><p>Use <code>chatgpt-coding</code> as the public model name for both deployments to pool them, or use separate aliases to select accounts yourself. In <strong>Advanced Settings → LiteLLM Params</strong>, add <code>chatgpt_auth_file</code> with the file’s path inside the proxy host or container. Choose <strong>Add Model</strong>, then repeat with the second account’s file.</p></div>
  <Shot name="chatgpt-laptop" alt="LiteLLM Add Model form with ChatGPT Subscription and GPT-6 Luna selected">Real dashboard with sample account data. No account credentials appear in the screenshot.</Shot>
  <CodeBlock language="json" title="Advanced Settings → LiteLLM Params">{'{"chatgpt_auth_file":"/app/auth/account-a/auth.json"}'}</CodeBlock>
  <p>Proxy administrators choose the stored account. API callers select an allowed model alias; they cannot submit a path to another login file. If you manage models through a config file, use the example below instead.</p>
</section>
<section id="routing" className={styles.section}>
  <Label>ALTERNATIVE / ADD MODELS IN YOUR CONFIG FILE</Label>
  <div className={styles.split}><div><h2>One alias.<br />Two account deployments.</h2><p>If you manage models in a config file, add these deployments to it. Both entries share <code>chatgpt-coding</code>, so the router can select either account for that alias.</p><p>Choose a model available to both accounts. We verified GPT-6 Luna with two distinct logins. One of those accounts could not use GPT-6.1 Sol.</p><p>The example distributes requests among eligible deployments using <code>simple-shuffle</code>. Retry and cooldown settings handle eligible failures; they do not measure an account’s remaining subscription allowance.</p><p>For explicit account selection, give the deployments different aliases and choose the alias in your client.</p></div><CodeBlock language="yaml" title="config.yaml">{config}</CodeBlock></div>
  <p>Merge these entries into your existing <code>model_list</code> and <code>router_settings</code>; preserve other models, routing policies, keys, and database settings. For the Docker mount above, use <code>/app/auth/account-a/auth.json</code> and <code>/app/auth/account-b/auth.json</code>. Apply the change using your deployment’s normal reload or restart process.</p>
  <p>Keep one proxy process for a local setup. Separate processes that refresh the same account can race on its auth file.</p>
</section>
<section id="client" className={styles.section}>
  <Label>04 / CONNECT YOUR CLIENT</Label><h2>Keep the endpoint. Choose the alias.</h2>
  <p>Use your existing proxy address and a LiteLLM key allowed to call <code>chatgpt-coding</code>. On a database-backed proxy, create or reuse a virtual key in <strong>Virtual Keys</strong>. Load it locally as <code>LITELLM_API_KEY</code>, set <code>LITELLM_BASE_URL</code> to your proxy’s OpenAI-compatible base URL (for example <code>http://localhost:4000/v1</code>), and send a request. A successful reply includes a greeting in <code>choices[0].message.content</code>.</p>
  <CodeBlock language="bash" title="Use your existing proxy address">{'export LITELLM_BASE_URL="http://localhost:4000/v1"'}</CodeBlock>
  <CodeBlock language="bash" title="Check the model group">{request}</CodeBlock>
  <table className={styles.table}><thead><tr><th>Client setting</th><th>Value</th></tr></thead><tbody><tr><td>OpenAI-compatible base URL</td><td>Your proxy URL with <code>/v1</code>, such as <code>http://localhost:4000/v1</code></td></tr><tr><td>API key</td><td>Your LiteLLM client key</td></tr><tr><td>Model</td><td><code>chatgpt-coding</code></td></tr></tbody></table>
  <p>Use these settings in a client that supports a custom OpenAI-compatible endpoint, such as OpenCode. The proxy supports Chat Completions and Responses for these deployments. Client features still depend on the model and API route.</p>
</section>
<section id="limits" className={styles.section}>
  <Label>05 / UNDERSTAND THE ALLOWANCES</Label><h2>Each subscription keeps its own limits.</h2>
  <div className={styles.prose}><p>Two accounts give you access to two accounts’ allowances. They do not form one shared OpenAI quota. Usage varies with the model, context, task, and plan; this guide does not promise twice as many completed tasks or a fixed saving over credits.</p><p>LiteLLM does not query remaining ChatGPT allowance or switch accounts before credit charges begin. If an account keeps accepting requests through purchased credits, the router does not treat that as a failure. Check the account’s usage and credit settings.</p><p>A rejected model usually needs a different model choice for that account. An expired or revoked login needs a new terminal sign-in. Complete login before restarting the proxy, and keep auth files on persistent writable storage.</p><p>OpenAI explains <a href="https://help.openai.com/en/articles/11369540-using-codex-with-your-chatgpt-plan">Codex plan usage</a> and <a href="https://help.openai.com/en/articles/12642688">credit top-ups</a>. Compare your own workload and current plan prices before buying another subscription.</p></div>
</section>
<footer className={styles.footer}><a href="https://github.com/BerriAI/litellm/pull/41928">Implementation and live test evidence ↗</a><Link to="/docs/providers/chatgpt">ChatGPT provider reference ↗</Link></footer>
</div>; }
