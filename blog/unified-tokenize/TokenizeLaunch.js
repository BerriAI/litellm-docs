import React, { useState } from "react";
import Link from "@docusaurus/Link";
import CodeWindow from "./CodeWindow";
import HeroDemo from "./HeroDemo";
import ProviderLabel from "./ProviderLabel";
import TokenizeScene from "./TokenizeScene";
import RustBenchmark from "./RustBenchmark";
import styles from "./launch.module.css";

const implementation = "https://github.com/BerriAI/litellm/pull/48079";

const providers = {
  vllm: {
    name: "vLLM",
    prefix: "hosted_vllm",
    modelEnv: "VLLM_MODEL",
    baseEnv: "HOSTED_VLLM_API_BASE",
    key: 'api_key=os.environ.get("HOSTED_VLLM_API_KEY"),',
    config: `model_list:
  - model_name: tokenizer
    litellm_params:
      model: hosted_vllm/your-served-model
      api_base: os.environ/HOSTED_VLLM_API_BASE
      api_key: os.environ/HOSTED_VLLM_API_KEY

general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY`,
  },
  watsonx: {
    name: "Watsonx",
    prefix: "watsonx",
    modelEnv: "WATSONX_MODEL",
    baseEnv: "WATSONX_API_BASE",
    key: 'api_key=os.environ["WATSONX_APIKEY"],',
    config: `model_list:
  - model_name: tokenizer
    litellm_params:
      model: watsonx/your-model-id
      api_base: os.environ/WATSONX_API_BASE
      api_key: os.environ/WATSONX_APIKEY
      project_id: your-project-id

general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY`,
  },
};

const request = `curl http://localhost:4000/tokenize \\
  --fail-with-body \\
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "tokenizer",
    "prompt": "Hello world"
  }'`;

function sdkExample(provider, asynchronous) {
  const item = providers[provider];
  const indent = asynchronous ? "    " : "";
  const params = [
    `model=f"${item.prefix}/{os.environ['${item.modelEnv}']}",`,
    'prompt="Hello world",',
    `api_base=os.environ["${item.baseEnv}"],`,
    item.key,
    ...(provider === "watsonx"
      ? ['project_id=os.environ["WATSONX_PROJECT_ID"],']
      : []),
  ];
  return `${asynchronous ? "import asyncio\n" : ""}import os
import litellm

${asynchronous ? "async def main():\n" : ""}${indent}result = ${asynchronous ? "await litellm.atokenize" : "litellm.tokenize"}(
${params.map((param) => `${indent}    ${param}`).join("\n")}
${indent})
${indent}print(result.model_dump())${asynchronous ? "\n\nasyncio.run(main())" : ""}`;
}

function SectionLabel({ number, children }) {
  return (
    <div className={styles.sectionLabel}>
      <span>{number}</span>
      {children}
    </div>
  );
}

function Setup({ provider, onProviderChange }) {
  const [surface, setSurface] = useState("gateway");
  const item = providers[provider];
  return (
    <section
      id="setup"
      className={styles.section}
      aria-labelledby="setup-title"
    >
      <SectionLabel number="03">MAKE YOUR FIRST CALL</SectionLabel>
      <div className={styles.sectionHeading}>
        <h2 id="setup-title">Call /tokenize</h2>
        <p>
          Choose a provider and copy the setup. Use a gateway alias to keep
          provider configuration out of your client.
        </p>
      </div>
      <div className={styles.setupPanel}>
        <div className={styles.controls}>
          <div
            role="group"
            aria-label="Example provider"
            className={styles.buttonGroup}
          >
            {Object.keys(providers).map((key) => (
              <button
                type="button"
                key={key}
                aria-pressed={provider === key}
                onClick={() => onProviderChange(key)}
              >
                <ProviderLabel provider={key} />
              </button>
            ))}
          </div>
          <div
            role="group"
            aria-label="Example interface"
            className={styles.buttonGroup}
          >
            {[
              ["gateway", "Gateway + curl"],
              ["sync", "Python SDK"],
              ["async", "Async SDK"],
            ].map(([key, label]) => (
              <button
                type="button"
                key={key}
                aria-pressed={surface === key}
                onClick={() => setSurface(key)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className={styles.setupContent}>
          {surface === "gateway" ? (
            <>
              <p>
                Replace the model{" "}
                {provider === "watsonx"
                  ? "and project placeholders"
                  : "placeholder"}{" "}
                with your {item.name} values. Set the environment variables used
                below
                {provider === "vllm"
                  ? "; omit api_key if your vLLM server does not require it"
                  : ""}
                .
              </p>
              <div className={styles.codeGrid}>
                <div>
                  <div className={styles.codeLabel}>PROVIDER CONFIGURATION</div>
                  <CodeWindow language="yaml" title="config.yaml">
                    {item.config}
                  </CodeWindow>
                </div>
                <div>
                  <div className={styles.codeLabel}>SAME CLIENT REQUEST</div>
                  <CodeWindow language="bash" title="request.sh">
                    {request}
                  </CodeWindow>
                  <p className={styles.caption}>
                    Start with{" "}
                    <code>litellm --config config.yaml --port 4000</code>.
                    Change the provider configuration and restart to use the
                    same alias with another provider.
                  </p>
                </div>
              </div>
            </>
          ) : (
            <>
              <p>
                Set <code>{item.modelEnv}</code> and <code>{item.baseEnv}</code>{" "}
                to your model ID and provider base URL.{" "}
                {provider === "watsonx" ? (
                  <>
                    Set <code>WATSONX_APIKEY</code> and{" "}
                    <code>WATSONX_PROJECT_ID</code> for your account.
                  </>
                ) : (
                  <>
                    Set <code>HOSTED_VLLM_API_KEY</code> if your server requires
                    authentication.
                  </>
                )}
              </p>
              <CodeWindow
                language="python"
                title={
                  surface === "async" ? "tokenize_async.py" : "tokenize.py"
                }
              >
                {sdkExample(provider, surface === "async")}
              </CodeWindow>
              <p className={styles.caption}>
                These SDK examples call the provider. Choose Gateway + curl to
                move provider configuration behind a stable client-facing alias.
              </p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

export default function TokenizeLaunch() {
  const [provider, setProvider] = useState("vllm");
  return (
    <div className={styles.root}>
      <header className={styles.hero}>
        <div className={styles.heroInner}>
          <div className={styles.heroTop}>
            <Link to="/blog" aria-label="Back to the LiteLLM blog">
              <img
                src="/img/brand/litellm-logo-white.png"
                width="136"
                height="27"
                alt="LiteLLM"
              />
            </Link>
            <span>DEVELOPER PREVIEW / OCTOBER 2026</span>
          </div>
          <div className={styles.heroTitle}>
            <h1>/tokenize</h1>
            <p className={styles.heroSubtitle}>
              One API for
              <br /> vLLM + Watsonx
            </p>
          </div>
          <p className={styles.heroIntro}>
            Send a prompt. Get a token count, plus IDs and text where supported.
            Switch providers in gateway config without changing your client.
          </p>
          <TokenizeScene />
          <div className={styles.heroActions}>
            <a href="#setup">
              SDK and curl examples <span aria-hidden="true">↗</span>
            </a>
            <a href="#performance">
              See the Rust benchmark <span aria-hidden="true">↓</span>
            </a>
            <span>PROMPT → TOKEN COUNT, IDS + TEXT</span>
          </div>
        </div>
      </header>

      <aside className={styles.preview} aria-label="Preview availability">
        <strong>Developer preview</strong>
        <p>
          Use a build containing <a href={implementation}>PR #48079</a> and its
          compiled Rust extension. This page documents the preview interface.
        </p>
      </aside>

      <section
        id="interface"
        className={styles.section}
        aria-labelledby="interface-title"
      >
        <SectionLabel number="01">ONE REQUEST ACROSS PROVIDERS</SectionLabel>
        <div className={styles.sectionHeading}>
          <h2 id="interface-title">Send a prompt and read the tokens</h2>
          <p>
            A tokenizer splits text into the pieces a model reads. Your app
            sends a prompt and a model alias. LiteLLM resolves the provider,
            translates the request and returns the same response fields.
          </p>
        </div>
        <div className={styles.requestDemo}>
          <HeroDemo provider={provider} onProviderChange={setProvider} />
        </div>
        <div className={styles.valueGrid}>
          <div>
            <span>APPLICATION CODE</span>
            <h3>Inspect tokens before inference</h3>
            <p>
              Check a text chunk’s size with your model’s tokenizer, inspect
              token boundaries, or store token IDs when the provider returns
              them. Read count, token_ids and tokens from one response shape.
            </p>
          </div>
          <div>
            <span>GATEWAY CONFIGURATION</span>
            <h3>Change providers without a client release</h3>
            <p>
              Point the tokenizer alias at vLLM or Watsonx. App developers keep
              POST /tokenize and the same JSON body. Your platform team
              maintains the provider URL, credentials and model ID.
            </p>
          </div>
        </div>
      </section>

      <section
        id="performance"
        className={styles.rustSection}
        aria-labelledby="rust-title"
      >
        <SectionLabel number="02">RUST PERFORMANCE</SectionLabel>
        <div className={styles.sectionHeading}>
          <h2 id="rust-title">Built in Rust</h2>
          <p>
            Rust handles authentication, provider requests and response
            translation. We measured the SDK’s native request path against a
            local test server.
          </p>
        </div>
        <RustBenchmark />
      </section>

      <Setup provider={provider} onProviderChange={setProvider} />

      <section className={styles.section} aria-labelledby="response-title">
        <SectionLabel number="04">RESPONSE FORMAT</SectionLabel>
        <div className={styles.sectionHeading}>
          <h2 id="response-title">Supported providers and output fields</h2>
          <p>
            Keep your parsing code when you switch providers. Token values and
            counts still depend on the model; numeric IDs do not transfer
            between tokenizers.
          </p>
        </div>
        <div className={styles.tableWrap}>
          <table>
            <caption>Provider support in the preview</caption>
            <thead>
              <tr>
                <th scope="col">Provider</th>
                <th scope="col">Count</th>
                <th scope="col">Numeric token IDs</th>
                <th scope="col">Token strings</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">vLLM</th>
                <td>Returned</td>
                <td>Returned</td>
                <td>When supplied by the server</td>
              </tr>
              <tr>
                <th scope="row">Watsonx</th>
                <td>Returned</td>
                <td>
                  <code>null</code>
                </td>
                <td>Returned by default</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className={styles.caption}>
          Both <code>/tokenize</code> and <code>/v1/tokenize</code> return{" "}
          <code>model</code>, <code>count</code>, <code>token_ids</code> and{" "}
          <code>tokens</code>. The preview accepts text prompts. For count-only
          workflows, see <Link to="/docs/count_tokens">token counting</Link>.
        </p>
      </section>

      <footer className={styles.footer}>
        <div>
          <span className={styles.codeLabel}>BUILD WITH /tokenize</span>
          <h2>Configure your first provider</h2>
        </div>
        <div>
          <Link className={styles.footerPrimary} to="/docs/tokenize">
            Explore the API guide <span aria-hidden="true">↗</span>
          </Link>
          <a className={styles.footerSecondary} href={implementation}>
            Review the implementation ↗
          </a>
        </div>
      </footer>
    </div>
  );
}
