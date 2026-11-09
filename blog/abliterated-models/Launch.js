import React, {useEffect, useRef} from 'react';
import Link from '@docusaurus/Link';
import CodeBlock from '@theme/CodeBlock';
import {PostByline} from '@theme/BlogPostPage';
import drawArtwork from './artwork';
import styles from './launch.module.css';

const config = `model_list:
  - model_name: refuseless-chat
    litellm_params:
      model: refuseless/glm-5.3-abliterated
      api_key: os.environ/REFUSELESS_API_KEY

  - model_name: abliteration-chat
    litellm_params:
      model: abliteration/abliterated-model-large-v2
      api_key: os.environ/ABLITERATION_API_KEY`;

const request = `curl "$LITELLM_BASE_URL/v1/chat/completions" \\
  -H "Authorization: Bearer $LITELLM_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "refuseless-chat",
    "messages": [{"role": "user", "content": "Explain how DNS works."}],
    "reasoning_effort": "low"
  }'`;

function Section({id, number, label, title, children}) {
  return <section id={id} className={styles.section} aria-labelledby={`${id}-title`}>
    <div className={styles.sectionLabel}><span>{number}</span>{label}</div>
    <div className={styles.sectionBody}><h2 id={`${id}-title`}>{title}</h2>{children}</div>
  </section>;
}

function Prices({name, href, children, rows}) {
  return <div className={styles.provider}>
    <h3><Link to={href}>{name}<span aria-hidden="true"> ↗</span></Link></h3>
    <p>{children}</p>
    <div className={styles.tableScroll} role="region" aria-label={`${name} model prices`} tabIndex={0}>
      <table><caption>USD per million tokens</caption>
        <thead><tr><th scope="col">Model</th><th scope="col">Input</th><th scope="col">Cached input</th><th scope="col">Output</th></tr></thead>
        <tbody>{rows.map(([model, input, cached, output, name, note]) => <tr key={model}>
          <th scope="row"><strong>{name}</strong>{note && <span className={styles.modelNote}>{note}</span>}<code>{model}</code></th><td data-label="Input">{input}</td><td data-label="Cached input">{cached}</td><td data-label="Output">{output}</td>
        </tr>)}</tbody>
      </table>
    </div>
  </div>;
}

export default function Launch() {
  const canvas = useRef(null);
  useEffect(() => drawArtwork(canvas.current), []);
  return <div className={styles.root} data-full-width>
    <header className={styles.hero}>
      <div className={styles.heroMeta}><Link to="/blog">← Blog</Link><span>REFUSELESS / ABLITERATION</span></div>
      <div className={styles.art} aria-hidden="true"><canvas ref={canvas} /></div>
      <h1><span className={styles.title}>Abliterated</span><span className={styles.subtitle}>models on LiteLLM<span aria-hidden="true">↘</span></span></h1>
      <div className={styles.heroBottom}><p>Refuseless and Abliteration.<br />Through your LiteLLM gateway.</p><a href="#get-started">Try a model <span aria-hidden="true">↓</span></a></div>
    </header>

    <div className={styles.article}>
      <div className={styles.byline}><PostByline horizontal /></div>
      <div className={styles.intro}>
        <p>Abliterated models from Refuseless and Abliteration are now available through LiteLLM.</p>
        <p>Call them through the same gateway as your other models, with streaming, tool calls, structured output, and cached-token pricing. Your configured access controls, budgets, and rate limits still apply.</p>
      </div>
      <nav className={styles.contents} aria-label="In this post">
        <a href="#abliteration">01 / The models</a><a href="#providers">02 / Providers</a><a href="#get-started">03 / Try it</a>
      </nav>

      <Section id="abliteration" number="01" label="THE MODELS" title="What is an abliterated model?">
        <p>Abliteration modifies the weights of an open-weight model to reduce its learned refusal behavior. Developers identify directions in the model's internal representations associated with refusal, then suppress those directions.</p>
        <p><a href="https://arxiv.org/abs/2406.11717">Arditi and colleagues demonstrated this in 13 chat models</a> in 2024. Hosted providers may use different methods. Reducing refusals can also change answer quality, so evaluate the modified model on the tasks you want it to perform.</p>
        <p>You can use these models for security research, red-teaming, and other workflows where a standard chat model refuses prompts you need to explore. The provider hosts the modified weights; LiteLLM connects your application to its API.</p>
      </Section>

      <Section id="providers" number="02" label="PROVIDERS" title="Supported providers">
        <Prices name="Refuseless" href="/docs/providers/refuseless" rows={[
          ['glm-5.3-abliterated', '$1.25', '$0.25', '$2.25', 'GLM 5.3'],
          ['glm-5.3-flash-abliterated', '$0.25', '$0.15', '$0.80', 'GLM 5.3 Flash'],
          ['deepseek-v4.1-flash-abliterated', '$0.22', '$0.045', '$0.75', 'DeepSeek V4.1 Flash'],
          ['deepseek-v4.1-flash-fast', '$0.05', '$0.003', '$0.15', 'DeepSeek V4.1 Flash Fast', 'Original weights'],
          ['minimax-m3.1-flash', '$0.05', '$0.002', '$0.25', 'MiniMax M3.1 Flash', 'Original weights'],
        ]}>Refuseless serves three abliterated GLM and DeepSeek models, plus two models with original weights. Use the <code>refuseless/</code> prefix in LiteLLM.</Prices>
        <Prices name="Abliteration" href="/docs/providers/abliteration" rows={[
          ['abliterated-model', '$1.00', '$0.10', '$3.00', 'Base'],
          ['abliterated-model-large-v2', '$3.00', '$0.30', '$5.00', 'Large v2'],
          ['abliterated-model-large-flash', '$1.00', '$0.10', '$2.00', 'Large Flash'],
        ]}>Use the <code>abliteration/</code> prefix. Large v2 is the recommended text model and always uses reasoning. The base and Large Flash models also accept images.</Prices>
        <p className={styles.caption}>Published rates as of October 26, 2026, before account discounts or separate charges such as web search. See the <Link to="/docs/providers/refuseless">Refuseless</Link> and <Link to="/docs/providers/abliteration">Abliteration</Link> guides for context limits, reasoning options, and the full model catalogs.</p>
      </Section>

      <Section id="get-started" number="03" label="TRY IT" title="Add a model to your gateway">
        <p>Create a key with <a href="https://refuseless.com/">Refuseless</a> or <a href="https://abliteration.ai/">Abliteration</a>. Set the matching <code>REFUSELESS_API_KEY</code> or <code>ABLITERATION_API_KEY</code> environment variable on your LiteLLM gateway.</p>
        <figure className={styles.route}>
          <div><strong>Your application</strong><small>LiteLLM virtual key</small></div><span aria-hidden="true">→</span>
          <div><strong>LiteLLM</strong><small>Access, budgets, routing</small></div><span aria-hidden="true">→</span>
          <div><strong>Provider</strong><small>Refuseless or Abliteration</small></div>
          <figcaption>Your provider key stays on the gateway.</figcaption>
        </figure>
        <p>Add either or both deployments to your existing <code>model_list</code>, keeping your gateway's authentication settings.</p>
        <CodeBlock language="yaml" title="config.yaml">{config}</CodeBlock>
        <p>Restart the gateway. Set <code>LITELLM_BASE_URL</code> to its base URL without a trailing slash and <code>LITELLM_API_KEY</code> to a key with access to the deployment. Then send a request:</p>
        <CodeBlock language="bash" title="Chat completion">{request}</CodeBlock>
        <p>The response includes the answer in <code>choices[0].message.content</code> and token counts in <code>usage</code>. To call Abliteration, change <code>model</code> to <code>abliteration-chat</code>.</p>
        <p className={styles.caption}>Starting a new gateway or using the Python SDK? Follow the <Link to="/docs/providers/refuseless">Refuseless guide</Link> or <Link to="/docs/providers/abliteration">Abliteration guide</Link>.</p>
      </Section>

      <footer className={styles.end}><p>Choose your provider.</p><div><Link to="/docs/providers/refuseless">Refuseless docs ↗</Link><Link to="/docs/providers/abliteration">Abliteration docs ↗</Link></div></footer>
    </div>
  </div>;
}
