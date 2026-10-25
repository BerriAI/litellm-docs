import React, {useState} from 'react';
import Link from '@docusaurus/Link';
import CodeBlock from '@theme/CodeBlock';
import styles from './post.module.css';

function Label({children}) { return <div className={styles.label}>{children}</div>; }
function Shot({name,alt,children}) { const src = '/img/multiple-chatgpt-subscriptions/' + name + '.jpg'; return <figure className={styles.shot}><div className={styles.shotStage}><a href={src} aria-label={'Open full-size screenshot: '+alt}><div className={styles.screen}><img src={src} alt={alt} width="1600" height="1000" loading="lazy" /></div></a></div><figcaption>{children} <a href={src}>View full size ↗</a></figcaption></figure>; }

import {install, login, config, key, start, request} from './examples';

function AccountFlow() {
  const [selected,setSelected] = useState('account-a');
  return <div>
    <div className={styles.choice} role="group" aria-label="Illustrated account selection">{['account-a','account-b'].map(account=><button type="button" key={account} aria-pressed={selected===account} onClick={()=>setSelected(account)}>{account}</button>)}</div>
    <div className={styles.route} aria-live="polite"><div><span className={styles.routeLabel}>YOUR CODING TOOL</span><strong>chatgpt-coding</strong><code>localhost:4000/v1</code></div><span className={styles.arrow} aria-hidden="true">→</span><div className={styles.active}><span className={styles.routeLabel}>LITELLM DEPLOYMENT</span><strong>{selected}</strong><code>auth/{selected}/auth.json</code></div><span className={styles.arrow} aria-hidden="true">→</span><div><span className={styles.routeLabel}>CHATGPT</span><strong>GPT-6 Luna</strong><code>{selected}’s allowance</code></div></div>
    <p className={styles.caption}>Illustrated request flow. Select an account to trace its credentials; this diagram makes no API calls and shows no live allowance data.</p>
  </div>;
}

const agentPrompt = `Set up LiteLLM on my computer so I can use two ChatGPT accounts from one endpoint in my coding tool.

Read https://docs.litellm.ai/blog/multiple-chatgpt-subscriptions and the linked provider reference before acting. Inspect my existing setup and reuse compatible tools, logins, and configuration. Preserve unrelated settings. Work through installation, configuration, startup, and verification; ask me only for information you cannot infer, an account sign-in, a required permission, or a choice that changes the outcome.

Use a local loopback endpoint and one proxy process. For a new source installation, check for Git, uv, Rust with a C compiler, and Python 3.13, then use this verified source revision:

${install}

Run these sign-ins one at a time in an interactive terminal. Ask me to complete the browser login. For the second login, ask me to choose the other account in a private browser window. Confirm that the two files represent different accounts without printing their tokens or account identifiers. If I have one account, configure one deployment instead.

${login}

Keep credentials out of chat, logs, screenshots, commits, and client configuration. Use local environment variables or my existing secret manager for keys. Give auth files restrictive permissions and keep their directory writable for refresh. Do not buy subscriptions or credits, change billing settings, expose the proxy publicly, or overwrite an existing deployment.

Use this as the starting config.yaml, adapting file paths to the chosen working directory. Verify that the selected model works on each account before pooling it; if it does not, find a model both accounts support or ask me to choose between the available options.

${config}

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
  <div className={styles.masthead}><Link to="/blog"><img src="/img/brand/litellm-logo-white.png" alt="LiteLLM" width="142" /></Link><span>CHATGPT / DEVELOPER GUIDE</span></div>
  <h1>Use multiple ChatGPT<br /><span>subscriptions with LiteLLM.</span></h1>
  <p>Connect your accounts to one endpoint. Route coding requests across them without switching logins in your tools.</p>
  <nav className={styles.heroLinks} aria-label="Article sections"><a href="#accounts">How it works</a><a href="#setup">Set up your accounts</a><a href="#limits">Usage and limits</a></nav>
</div></header>
<AgentSetup />
<section id="accounts" className={styles.section}>
  <Label>01 / KEEP YOUR CODING WORKFLOW</Label>
  <div className={styles.prose}><h2>Keep coding across your ChatGPT accounts.</h2>
  <p>You hit your Codex limit halfway through a task. You can wait for the reset or buy more credits. If you have another ChatGPT subscription with available usage, you can connect both accounts to LiteLLM and use them from the same coding tool.</p>
  <p>You sign in once per account and give LiteLLM a separate auth file for each deployment. Your client sends a model alias, such as <code>chatgpt-coding</code>. LiteLLM selects a deployment and sends that account’s credentials to ChatGPT.</p>
  <p>You keep each account’s plan, model access, and usage limits. You can give accounts separate aliases or put compatible deployments under one alias to distribute requests.</p></div>
  <AccountFlow />
</section>
<section id="setup" className={styles.section}>
  <Label>02 / SIGN IN TO EACH ACCOUNT</Label>
  <h2>Start with two saved logins.</h2>
  <div className={styles.prose}><p>Install <a href="https://docs.astral.sh/uv/getting-started/installation/">uv</a>, Git, and the <a href="https://www.rust-lang.org/tools/install">Rust toolchain</a>, including your platform’s C compiler. Use Python 3.13. Run the following commands in a terminal; stay in the new checkout for the rest of this guide.</p></div>
  <CodeBlock language="bash" title="Install LiteLLM from source">{install}</CodeBlock>
  <div className={styles.prose}><p>Enable device-code login in your ChatGPT account’s security settings, or ask your workspace administrator to enable it. Run each command below and complete the browser sign-in. For the second command, use a private browser window and choose the second account.</p><p>The login process writes the files. Keep their contents private. The proxy needs write access to refresh them.</p></div>
  <CodeBlock language="bash" title="Two accounts, two auth files">{login}</CodeBlock>
  <p className={styles.caption}>Read OpenAI’s <a href="https://learn.chatgpt.com/docs/auth">authentication guide</a> for account and workspace requirements.</p>
</section>
<section id="routing" className={styles.section}>
  <Label>03 / CONFIGURE THE MODEL GROUP</Label>
  <div className={styles.split}><div><h2>One alias.<br />Two account deployments.</h2><p>Save this as <code>config.yaml</code>. Both entries share <code>chatgpt-coding</code>, so the router can select either account for that alias.</p><p>Choose a model available to both accounts. We verified GPT-6 Luna with two distinct logins. One of those accounts could not use GPT-6.1 Sol.</p><p>The example distributes requests among eligible deployments using <code>simple-shuffle</code>. Retry and cooldown settings handle eligible failures; they do not measure an account’s remaining subscription allowance.</p><p>For explicit account selection, give the deployments different aliases and choose the alias in your client.</p></div><CodeBlock language="yaml" title="config.yaml">{config}</CodeBlock></div>
  <h3>Start the local proxy</h3><p>Generate a gateway key in the same shell. Keep it in your local secret manager for later sessions; use it as the API key in clients that connect to this proxy.</p>
  <CodeBlock language="bash" title="Generate a local gateway key">{key}</CodeBlock>
  <CodeBlock language="bash" title="Start after setup">{start}</CodeBlock>
  <p>Keep one proxy process for this local setup. Separate processes that refresh the same account can race on its auth file.</p>
</section>
<section id="client" className={styles.section}>
  <Label>04 / CONNECT YOUR CLIENT</Label><h2>Keep the endpoint. Choose the alias.</h2>
  <p>In a second terminal, load the same gateway key as <code>LITELLM_MASTER_KEY</code> and send a request. A successful reply includes a greeting in <code>choices[0].message.content</code>.</p>
  <CodeBlock language="bash" title="Check the model group">{request}</CodeBlock>
  <table className={styles.table}><thead><tr><th>Client setting</th><th>Value</th></tr></thead><tbody><tr><td>OpenAI-compatible base URL</td><td><code>http://localhost:4000/v1</code></td></tr><tr><td>API key</td><td>Your LiteLLM gateway key</td></tr><tr><td>Model</td><td><code>chatgpt-coding</code></td></tr></tbody></table>
  <p>Use these settings in a client that supports a custom OpenAI-compatible endpoint, such as OpenCode. The proxy supports Chat Completions and Responses for these deployments. Client features still depend on the model and API route.</p>
</section>
<section id="dashboard" className={styles.section}>
  <Label>05 / ADD ACCOUNTS IN AN EXISTING DASHBOARD</Label><h2>The same setup in Models + Endpoints.</h2>
  <div className={styles.prose}><p>On a database-backed gateway, sign in as a proxy administrator. Open <strong>Models + Endpoints → Add Model</strong>, choose <strong>ChatGPT Subscription</strong>, and select your model.</p><p>Set the public model name to your alias. In <strong>Advanced Settings → LiteLLM Params</strong>, add <code>chatgpt_auth_file</code> with the file’s path inside the proxy host or container. Add a second deployment with its own file.</p></div>
  <Shot name="chatgpt-laptop" alt="LiteLLM Add Model form with ChatGPT Subscription and GPT-6 Luna selected">Real dashboard with sample account data. No account credentials appear in the screenshot.</Shot>
  <CodeBlock language="json" title="Advanced Settings → LiteLLM Params">{'{"chatgpt_auth_file":"/app/auth/account-a/auth.json"}'}</CodeBlock>
  <p>Proxy administrators choose the stored account. API callers select an allowed model alias; they cannot submit a path to another login file. The local configuration above works without a dashboard database.</p>
</section>
<section id="limits" className={styles.section}>
  <Label>06 / UNDERSTAND THE ALLOWANCES</Label><h2>Each subscription keeps its own limits.</h2>
  <div className={styles.prose}><p>Two accounts give you access to two accounts’ allowances. They do not form one shared OpenAI quota. Usage varies with the model, context, task, and plan; this guide does not promise twice as many completed tasks or a fixed saving over credits.</p><p>LiteLLM does not query remaining ChatGPT allowance or switch accounts before credit charges begin. If an account keeps accepting requests through purchased credits, the router does not treat that as a failure. Check the account’s usage and credit settings.</p><p>A rejected model usually needs a different model choice for that account. An expired or revoked login needs a new terminal sign-in. Complete login before restarting the proxy, and keep auth files on persistent writable storage.</p><p>OpenAI explains <a href="https://help.openai.com/en/articles/11369540-using-codex-with-your-chatgpt-plan">Codex plan usage</a> and <a href="https://help.openai.com/en/articles/12642688">credit top-ups</a>. Compare your own workload and current plan prices before buying another subscription.</p></div>
</section>
<footer className={styles.footer}><a href="https://github.com/BerriAI/litellm/pull/41928">Implementation and live test evidence ↗</a><Link to="/docs/providers/chatgpt">ChatGPT provider reference ↗</Link></footer>
</div>; }
