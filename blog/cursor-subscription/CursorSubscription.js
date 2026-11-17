import React from 'react';
import Link from '@docusaurus/Link';
import CodeBlock from '@theme/CodeBlock';
import styles from './launch.module.css';

const launch = `agent \\
  --agent-endpoint "\${LITELLM_PROXY_API_BASE%/}/cursor-cli" \\
  --header "x-litellm-api-key: Bearer $LITELLM_PROXY_API_KEY" \\
  --model auto`;

export default function CursorSubscription() {
  return <div className={styles.root} data-full-width>
    <header className={styles.hero}>
      <div className={styles.inner}>
        <div className={styles.masthead}><Link to="/blog" aria-label="Back to the LiteLLM blog"><img src="/img/brand/litellm-logo-white.png" alt="LiteLLM" width="136" /></Link><span>CURSOR CLI / NOVEMBER 2026</span></div>
        <div className={styles.title}><h1>Use your Cursor<br />subscription<br /><span>through LiteLLM</span></h1><img src="/img/cursor-subscription/cursor-cube.svg" alt="Cursor" width="150" height="171" /></div>
        <p className={styles.heroIntro}>Use your Cursor subscription in Cursor CLI with LiteLLM authentication and request logging.</p>
        <div className={styles.heroFooter}><a href="#setup">Set up Cursor CLI</a><a href="#controls">See supported controls</a><code>/cursor-cli</code></div>
      </div>
    </header>

    <section className={`${styles.section} ${styles.overview}`} aria-labelledby="overview-title">
      <div><h2 id="overview-title">What LiteLLM adds</h2><p>Give each developer a LiteLLM key for Cursor CLI. You can revoke gateway access, limit request rates, and keep request logs alongside the other tools that use your gateway.</p></div>
      <div><h3>Keep using your Cursor account</h3><p>Sign in with Cursor and use the models available on your plan. Streaming replies, file reads, and tool follow-ups continue through the CLI. Cursor handles your subscription allowance and login refresh.</p><p>You do not need to add a model or save a Cursor credential on the proxy.</p></div>
    </section>

    <section id="setup" className={styles.section} aria-labelledby="setup-title">
      <h2 id="setup-title">How to set it up</h2>
      <p className={styles.intro}>Available in 1.112. You need <a href="https://cursor.com/docs/cli/installation">Cursor CLI</a>, a Cursor subscription, and your LiteLLM gateway URL and key.</p>
      <div className={styles.step}><div><span className={styles.stepNumber}>01</span><h3>Sign in to Cursor</h3><p>Run this once. Skip it if you are already signed in.</p></div><CodeBlock language="bash" title="Terminal">{'agent login'}</CodeBlock></div>
      <div className={styles.step}><div><span className={styles.stepNumber}>02</span><h3>Enable HTTP/1.1</h3><p>Add this setting to <code>~/.cursor/cli-config.json</code>. Merge it with your existing configuration and keep the other settings.</p></div><CodeBlock language="json" title="~/.cursor/cli-config.json">{`{
  "network": {
    "useHttp1ForAgent": true
  }
}`}</CodeBlock></div>
      <div className={styles.step}><div><span className={styles.stepNumber}>03</span><h3>Start Cursor through LiteLLM</h3><p>Set your gateway URL and virtual key, then run this command from your project directory. Use the gateway root URL without <code>/v1</code>.</p><p>The key must have no model restrictions, token limits, or spend budgets. Your administrator can issue a key that meets these requirements.</p><p>To save the command for daily use, see the <Link to="/docs/tutorials/cursor_cli_subscription#save-the-launch-command">shell function in the setup guide</Link>.</p></div><CodeBlock language="bash" title="Terminal">{`export LITELLM_PROXY_API_BASE="https://gateway.example.com"
export LITELLM_PROXY_API_KEY="sk-<your-litellm-virtual-key>"

${launch}`}</CodeBlock></div>
    </section>

    <section className={styles.section} aria-labelledby="verify-title">
      <h2 id="verify-title">Check that it works</h2>
      <p className={styles.intro}>Ask Cursor to read a file that exists in your project. For a project with a README, try this prompt.</p>
      <CodeBlock language="text">{'Read README.md with the read-file tool and summarize how to run this project. Do not change any files.'}</CodeBlock>
      <p>Confirm that the read tool completes and Cursor replies using the file’s contents. You can then ask a follow-up question in the same session.</p>
      <p>In your LiteLLM request logs, look for calls under <code>/cursor-cli</code>. These logs show request status. Check Cursor’s reply to confirm the task itself succeeded.</p>
    </section>

    <section id="controls" className={styles.section} aria-labelledby="controls-title">
      <h2 id="controls-title">Supported controls and limits</h2>
      <p>LiteLLM supports virtual keys, request logs, request-rate limits, and concurrency limits. Cursor manages your login, models, and subscription allowance.</p>
      <p>LiteLLM forwards the native session without inspecting its contents. Token and spend tracking, model restrictions, and content guardrails are not supported. Keys or gateway configurations that require these controls are rejected.</p>
      <p>Request-rate and concurrency limits apply to individual calls, rather than whole sessions. Allow overlapping requests so Cursor can send tool results while a response is streaming.</p>
      <p>This setup is for Cursor CLI. The <Link to="/docs/tutorials/cursor_integration">Cursor desktop integration</Link> uses models configured on your gateway. See the <Link to="/docs/tutorials/cursor_cli_subscription">setup guide</Link> for troubleshooting and the full list of limits.</p>
    </section>
    <footer className={styles.footer}><Link to="/docs/tutorials/cursor_cli_subscription">Cursor CLI setup guide</Link><Link to="/docs/subscriptions">Other subscriptions</Link></footer>
  </div>;
}
