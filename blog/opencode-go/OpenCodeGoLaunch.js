import React, {useState} from 'react';
import Link from '@docusaurus/Link';
import CodeBlock from '@theme/CodeBlock';
import styles from './launch.module.css';

const models = [
  {name: 'GLM-5.3-Flash', id: 'glm-5.3-flash', format: 'Chat Completions', path: '/chat/completions'},
  {name: 'GPT 6 Luna', id: 'gpt-6-luna', format: 'Responses', path: '/responses'},
  {name: 'Claude Haiku 5.5', id: 'claude-haiku-5-5', format: 'Anthropic Messages', path: '/messages'},
  {name: 'Gemini 4 Argon', id: 'gemini-4-argon', format: 'Google Gemini', path: ':generateContent'},
];

const gatewayConfig = `model_list:
  - model_name: go
    litellm_params:
      model: opencode_go/glm-5.3-flash
      api_key: os.environ/OPENCODE_API_KEY

general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY`;

const request = `curl http://localhost:4000/v1/chat/completions \\
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \\
  -H 'Content-Type: application/json' \\
  -H 'x-litellm-session-id: go-demo' \\
  -d '{
    "model": "go",
    "messages": [{"role": "user", "content": "Say hello."}]
  }'`;

const openCodeConfig = `{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "litellm-go": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "LiteLLM Go",
      "options": {
        "baseURL": "http://localhost:4000/v1",
        "apiKey": "{env:LITELLM_MASTER_KEY}"
      },
      "models": {
        "go": {"name": "Go · GLM-5.3-Flash"}
      }
    }
  }
}`;

const sdk = `from litellm import completion, completion_cost

response = completion(
    model="opencode_go/glm-5.3-flash",
    messages=[{"role": "user", "content": "Say hello."}],
    litellm_session_id="go-demo",
)

print(response.choices[0].message.content)
print(response.usage)
print(completion_cost(completion_response=response))`;

function SectionLabel({number, children}) {
  return <div className={styles.sectionLabel}><span>{number}</span>{children}</div>;
}

function RouteExplorer() {
  const [selected, setSelected] = useState(0);
  const model = models[selected];
  return (
    <div className={styles.explorer}>
      <div className={styles.explorerHeading}>
        <h3>Choose the model. Keep your client.</h3>
        <span>ILLUSTRATED REQUEST FLOW</span>
      </div>
      <div className={styles.modelChoices} role="group" aria-label="Example Go model">
        {models.map((item, index) => (
          <button key={item.id} type="button" aria-pressed={selected === index} onClick={() => setSelected(index)}>{item.name}</button>
        ))}
      </div>
      <div className={styles.route} aria-live="polite" aria-atomic="true">
        <div><span>YOUR CLIENT</span><strong>Chat Completions</strong><code>/v1/chat/completions</code></div>
        <span className={styles.arrow} aria-hidden="true">→</span>
        <div className={styles.gateway}><span>LITELLM</span><strong>opencode_go/</strong><code>{model.id}</code></div>
        <span className={styles.arrow} aria-hidden="true">→</span>
        <div><span>OPENCODE GO</span><strong>{model.format}</strong><code>{model.path}</code></div>
      </div>
      <p className={styles.caption}>The selected model determines the upstream format. Your client can also send native Responses or Anthropic Messages requests. This illustration makes no API calls.</p>
    </div>
  );
}

function Setup() {
  const [mode, setMode] = useState('gateway');
  return (
    <section id="setup" className={styles.section} aria-labelledby="setup-title">
      <SectionLabel number="02">GET STARTED</SectionLabel>
      <h2 id="setup-title">From a Go account to a first reply.</h2>
      <p className={styles.intro}>You need an active Go or Go Plus subscription and an API key from <a href="https://opencode.ai/console">OpenCode Console</a>. The Console key authenticates LiteLLM to Go; signing in to the OpenCode app alone does not authenticate your gateway.</p>
      <div className={styles.tabs} role="group" aria-label="Setup method">
        <button type="button" aria-pressed={mode === 'gateway'} onClick={() => setMode('gateway')}>AI Gateway + OpenCode</button>
        <button type="button" aria-pressed={mode === 'sdk'} onClick={() => setMode('sdk')}>Python SDK</button>
      </div>
      {mode === 'gateway' ? (
        <div className={styles.steps}>
          <div className={styles.step}>
            <div><span className={styles.stepNumber}>01</span><h3>Install and set your keys</h3><p>Run these commands in the shell that will host LiteLLM. Replace the placeholders with your Console key and a long, random gateway key.</p><p>The OpenCode key stays on the gateway. Clients use the LiteLLM key.</p></div>
            <CodeBlock language="bash" title="Terminal">{`pip install --upgrade 'litellm[proxy]'
export OPENCODE_API_KEY="your-opencode-api-key"
export LITELLM_MASTER_KEY="your-litellm-gateway-key"`}</CodeBlock>
          </div>
          <div className={styles.step}>
            <div><span className={styles.stepNumber}>02</span><h3>Add a Go model</h3><p>Save this as <code>config.yaml</code>. The client calls the alias <code>go</code>; LiteLLM calls the configured Go model. You do not need to set an upstream base URL.</p><p>For an existing gateway, add the model entry to your current configuration and keep your existing authentication settings.</p></div>
            <div><CodeBlock language="yaml" title="config.yaml">{gatewayConfig}</CodeBlock><CodeBlock language="bash" title="Start the local gateway">{'litellm --config config.yaml --host 127.0.0.1 --port 4000'}</CodeBlock></div>
          </div>
          <div className={styles.step}>
            <div><span className={styles.stepNumber}>03</span><h3>Send a request</h3><p>In another terminal, set the same <code>LITELLM_MASTER_KEY</code> and run this request.</p><p>A successful response contains a greeting in <code>choices[0].message.content</code> and token counts in <code>usage</code>. Reuse the session ID for later turns in this conversation.</p></div>
            <CodeBlock language="bash" title="First request">{request}</CodeBlock>
          </div>
          <div className={styles.step}>
            <div><span className={styles.stepNumber}>04</span><h3>Connect the OpenCode app</h3><p>With <a href="https://opencode.ai/docs/">OpenCode installed</a>, add this to your project’s <code>opencode.json</code>, or merge the entry into its existing <code>provider</code> object.</p><p>Start <code>opencode</code> from that project in a shell with your gateway key set. Run <code>/models</code>, choose <strong>Go · GLM-5.3-Flash</strong> under <strong>LiteLLM Go</strong>, and send a message.</p><p>OpenCode talks to your local LiteLLM gateway. LiteLLM sends the request to Go.</p></div>
            <CodeBlock language="json" title="opencode.json">{openCodeConfig}</CodeBlock>
          </div>
        </div>
      ) : (
        <div className={styles.sdk}>
          <p>For a direct Python call, install LiteLLM and set your Console key. You do not need a gateway key or a running proxy.</p>
          <CodeBlock language="bash" title="Terminal">{`pip install --upgrade litellm
export OPENCODE_API_KEY="your-opencode-api-key"`}</CodeBlock>
          <CodeBlock language="python" title="hello_go.py">{sdk}</CodeBlock>
          <p>Run <code>python hello_go.py</code>. It prints the reply, token usage, and estimated usage cost. Reuse <code>litellm_session_id</code> for subsequent turns in the same conversation.</p>
        </div>
      )}
    </section>
  );
}

export default function OpenCodeGoLaunch() {
  return (
    <div className={styles.root} data-full-width>
      <header className={styles.hero}>
        <div className={styles.inner}>
          <div className={styles.masthead}><Link to="/blog" aria-label="Back to the LiteLLM blog"><img src="/img/brand/litellm-logo-white.png" alt="LiteLLM" width="136" /></Link><span>NEW PROVIDER / OCTOBER 2026</span></div>
          <div className={styles.heroTitle}><h1>OpenCode Go.<br /><span>Now in LiteLLM.</span></h1><img className={styles.goMark} src="/img/integrations/opencode.svg" alt="" width="148" height="148" /></div>
          <p className={styles.heroIntro}>Your Go subscription, through one gateway. Choose a model, keep your client, and let LiteLLM handle the API format and session.</p>
          <div className={styles.heroFlow} aria-label="Your coding agent connects to LiteLLM, which connects to OpenCode Go"><span>Your coding agent</span><span aria-hidden="true">→</span><strong>LiteLLM</strong><span aria-hidden="true">→</span><span>OpenCode Go</span></div>
          <div className={styles.heroFooter}><a href="#setup">Start using Go <span aria-hidden="true">↗</span></a><a href="#provider">See what’s new <span aria-hidden="true">↓</span></a><code>opencode_go/&lt;model&gt;</code></div>
        </div>
      </header>

      <section id="provider" className={styles.section} aria-labelledby="provider-title">
        <SectionLabel number="01">THE PROVIDER</SectionLabel>
        <div className={styles.overview}>
          <div><h2 id="provider-title">One connection to your Go models.</h2><p>OpenCode Go is a hosted model service available through Go and Go Plus subscriptions. It gives you access to models from multiple providers. The OpenCode app is a coding agent that can use Go, or connect to other providers.</p><p>The new <code>opencode_go/</code> provider brings Go into LiteLLM’s SDK and AI Gateway. Use your Console key and a Go model ID. LiteLLM selects the right upstream API, preserves the conversation’s session, and records estimated usage under OpenCode Go.</p></div>
          <dl className={styles.features}>
            <div><dt>Model routing</dt><dd>Chat Completions, Responses, Messages, and Gemini formats, selected from model metadata.</dd></div>
            <div><dt>Model discovery</dt><dd>Fetch available model IDs from Go, with support for a configured gateway endpoint.</dd></div>
            <div><dt>Usage visibility</dt><dd>Published token and cache rates in LiteLLM’s catalog, including supported context tiers.</dd></div>
          </dl>
        </div>
        <RouteExplorer />
      </section>

      <Setup />

      <section id="sessions" className={styles.section} aria-labelledby="sessions-title">
        <SectionLabel number="03">THE SESSION FIX</SectionLabel>
        <div className={styles.twoColumns}>
          <div><h2 id="sessions-title">Keep the conversation together.</h2><p>Go uses a stable session ID to route a conversation efficiently and support prompt caching. Losing that ID at the gateway can cause a missing-session error.</p><p>Alongside the provider, we added automatic forwarding of a supplied session ID as <code>x-opencode-session</code>. This also covers existing OpenAI and Anthropic configurations that point to supported OpenCode endpoints.</p></div>
          <div className={styles.sessionPanel}><span>YOUR REQUEST</span><code>x-litellm-session-id: go-demo</code><span className={styles.downArrow} aria-hidden="true">↓</span><span>REQUEST TO OPENCODE GO</span><code>x-opencode-session: go-demo</code><p>An explicit OpenCode session header takes precedence. LiteLLM does not invent a session ID when none is supplied.</p></div>
        </div>
        <p className={styles.caption}>Use <code>litellm_session_id</code> in the SDK or <code>x-litellm-session-id</code> at the gateway. Keep it stable within a conversation and use a different ID for a new conversation. <a href="https://github.com/BerriAI/litellm/pull/48121">Read the session fix ↗</a></p>
      </section>

      <section id="usage" className={styles.section} aria-labelledby="usage-title">
        <SectionLabel number="04">USAGE AND LIMITS</SectionLabel>
        <div className={styles.twoColumns}>
          <div><h2 id="usage-title">Track usage.<br />Understand your allowance.</h2><p>LiteLLM estimates request cost using Go’s published token rates. That gives you a consistent value for logs and gateway budgets.</p><p>Your Go subscription, remaining allowance, rolling limits, and resets stay with OpenCode. A LiteLLM cost estimate is not an extra invoice charge, and its budget counter does not mirror your plan’s remaining allowance.</p></div>
          <div className={styles.usageSummary}><div><span>LiteLLM</span><strong>Tokens + estimated usage cost</strong></div><div><span>OpenCode Console</span><strong>Subscription + actual allowance</strong></div><p>Rates and model availability can change. DeepSeek estimates use the published peak rate, so off-peak requests can cost less in Console. Check the <a href="https://opencode.ai/v2/docs/console/go/">current Go rate card</a> for plan details.</p></div>
        </div>
      </section>

      <section className={`${styles.section} ${styles.proof}`} aria-labelledby="proof-title">
        <div><SectionLabel number="05">TESTED END TO END</SectionLabel><h2 id="proof-title">Real models.<br />Real tool calls.</h2><p>We tested all three incoming APIs against four upstream formats, including Gemini: 12 combinations returning responses and token usage.</p><p>We also ran streamed tool calls, tool-result follow-ups, and file reads in OpenCode. The screenshot shows a recorded file-read test through the gateway.</p><a href="https://github.com/BerriAI/litellm/pull/48140">See the implementation and test evidence ↗</a></div>
        <figure><img src="/img/opencode-go/file-read.png" alt="Recorded OpenCode test: the read tool opens proof.txt and returns OpenCode Go works through LiteLLM using the Go Messages model." width="1280" height="720" loading="lazy" /><figcaption>Recorded October 24, 2026. The test file contains only the sentence shown.</figcaption></figure>
      </section>

      <footer className={styles.footer}><div><span>OPENCODE GO × LITELLM</span><h2>Pick a model.<br />Build with the client you use.</h2></div><Link to="/docs/providers/opencode_go">Open the provider guide <span aria-hidden="true">↗</span></Link></footer>
    </div>
  );
}
