import React from 'react';
import Link from '@docusaurus/Link';
import CodeBlock from '@theme/CodeBlock';
import {useBlogPost} from '@docusaurus/plugin-content-blog/client';
import {PostByline} from '@theme/BlogPostPage';
import styles from './styles.module.css';

const example = `from litellm import completion

response = completion(
    model="openai/gpt-luna-latest",
    messages=[{"role": "user", "content": "Say hello."}],
)`;

const providers = [
  ['OpenAI', 'openai/', ['gpt-luna-latest', 'gpt-sol-latest', 'gpt-terra-latest', 'gpt-astra-latest', 'gpt-mini-latest']],
  ['Anthropic', 'anthropic/', ['claude-opus-latest', 'claude-sonnet-latest', 'claude-haiku-latest', 'claude-fable-latest']],
  ['xAI', 'xai/', ['grok-latest']],
  ['Moonshot', 'moonshot/', ['kimi-latest']],
  ['Z.AI', 'zai/', ['glm-latest', 'glm-flash-latest']],
  ['DeepSeek', 'deepseek/', ['deepseek-pro-latest', 'deepseek-flash-latest']],
  ['DashScope', 'dashscope/', ['qwen-max-latest', 'qwen-flash-latest']],
  ['MiniMax', 'minimax/', ['minimax-latest']],
];

export default function LatestAliasesPost() {
  const {metadata} = useBlogPost();
  return (
    <div data-full-width className={styles.root}>
      <header className={styles.hero}>
        <div className={styles.meta}>
          <Link to="/blog">← Blog</Link>
          <span>PYTHON SDK / AI GATEWAY</span>
        </div>
        <h1 aria-label={metadata.title}>
          <span className={styles.introducing}>LiteLLM now supports</span>{' '}
          <span className={styles.latest}>-latest</span>{' '}
          <span className={styles.subtitle}>model aliases</span>
        </h1>
        <div className={styles.heroBottom}>
          <p>Same model name.<br />Newer models.</p>
          <a href="#try-it">Try it <span aria-hidden="true">↓</span></a>
        </div>
      </header>

      <div className={styles.article}>
        <div className={styles.byline}><PostByline horizontal /></div>
        <div className={styles.reading}>
          <p className={styles.lead}>As providers release smarter, faster, cheaper models, you shouldn't have to update every app by hand.</p>
          <p>LiteLLM now supports <code>-latest</code> aliases. Pick a model family once. We update the model behind the alias as newer versions arrive, so you can keep the same name in your code.</p>

          <div id="try-it" className={styles.example}>
            <p>With <code>litellm</code> installed and <code>OPENAI_API_KEY</code> set:</p>
            <CodeBlock language="python">{example}</CodeBlock>
            <p>The same aliases work in the Python SDK and AI Gateway.</p>
          </div>

          <section id="supported-models" className={styles.models} aria-labelledby="supported-models-title">
            <h2 id="supported-models-title">Supported models</h2>
            <p>Use the provider prefix with any of its aliases below, as in <code>openai/gpt-luna-latest</code>.</p>
            <dl className={styles.providers}>
              {providers.map(([name, prefix, aliases]) => (
                <div key={prefix} className={styles.provider}>
                  <dt>{name}<code>{prefix}</code></dt>
                  <dd>{aliases.map((alias, index) => (
                    <React.Fragment key={alias}>{index > 0 && ', '}<code>{alias}</code></React.Fragment>
                  ))}</dd>
                </div>
              ))}
            </dl>
            <p className={styles.note}>These aliases call each provider's own API. Gemini and Mistral already offer provider-managed latest names, which LiteLLM passes through.</p>
          </section>

          <div className={styles.end}><Link to="/docs/model_latest_aliases">Get started with latest aliases <span aria-hidden="true">↗</span></Link></div>
        </div>
      </div>
    </div>
  );
}
