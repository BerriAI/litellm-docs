import React, { useState } from "react";
import Link from "@docusaurus/Link";
import CodeWindow from "./CodeWindow";
import HeroDemo from "./HeroDemo";
import ProviderLabel from "./ProviderLabel";
import { clientRequest, providerExamples } from "./exampleData";
import TokenizeScene from "./TokenizeScene";
import TokenIdExplainer from "./TokenIdExplainer";
import RustBenchmark from "./RustBenchmark";
import styles from "./launch.module.css";

const implementation = "https://github.com/BerriAI/litellm/pull/48079";

const providers = {
  vllm: {
    name: "vLLM",
    baseEnv: "HOSTED_VLLM_API_BASE",
    key: 'api_key=os.environ.get("HOSTED_VLLM_API_KEY"),',
    config: `model_list:
  - model_name: ${providerExamples.vllm.modelName}
    litellm_params:
      model: ${providerExamples.vllm.target}
      api_base: os.environ/HOSTED_VLLM_API_BASE
      api_key: os.environ/HOSTED_VLLM_API_KEY

general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY`,
  },
  watsonx: {
    name: "Watsonx",
    baseEnv: "WATSONX_API_BASE",
    key: 'api_key=os.environ["WATSONX_APIKEY"],',
    config: `model_list:
  - model_name: ${providerExamples.watsonx.modelName}
    litellm_params:
      model: ${providerExamples.watsonx.target}
      api_base: os.environ/WATSONX_API_BASE
      api_key: os.environ/WATSONX_APIKEY
      project_id: os.environ/WATSONX_PROJECT_ID

general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY`,
  },
};

const curlExample = (provider) => `curl http://localhost:4000/tokenize \\
  --fail-with-body \\
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${providerExamples[provider].modelName}",
    "prompt": "${clientRequest.prompt}"
  }'`;

function sdkExample(provider, asynchronous) {
  const item = providers[provider];
  const indent = asynchronous ? "    " : "";
  const params = [
    `model="${providerExamples[provider].target}",`,
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

function ChooseApi() {
  return (
    <section
      id="choose-api"
      className={styles.section}
      aria-labelledby="choose-api-title"
    >
      <SectionLabel number="01">CHOOSE AN API</SectionLabel>
      <h2 id="choose-api-title">/tokenize vs. token counting</h2>
      <ul className={styles.apiChoices}>
        <li>
          <strong>Check prompt size.</strong> Use{" "}
          <Link to="https://docs.litellm.ai/api-reference/#/llm%20utils/token_counter_utils_token_counter_post">
            <code>/utils/token_counter</code>
          </Link>{" "}
          to check context limits or estimate input cost.
        </li>
        <li>
          <strong>See how your text splits.</strong> Use{" "}
          <a href="#interface">
            <code>/tokenize</code>
          </a>{" "}
          to inspect token text and available IDs. Find why a URL takes so many
          tokens, or check for tokenizer changes after a vLLM rollout.
        </li>
      </ul>
    </section>
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
      <SectionLabel number="04">MAKE YOUR FIRST CALL</SectionLabel>
      <div className={styles.sectionHeading}>
        <h2 id="setup-title">Call /tokenize</h2>
        <p>
          Choose a provider and copy the setup. Use a gateway alias to keep
          provider configuration out of your client.
        </p>
      </div>
      <aside className={styles.requirement} aria-label="Build requirement">
        <strong>Build requirement</strong>
        <p>
          Use a build containing <a href={implementation}>PR #48079</a> and its
          compiled Rust extension to run these examples.
        </p>
      </aside>
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
                Use a model available on your {item.name} deployment and set the
                environment variables below
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
                  <div className={styles.codeLabel}>PASS YOUR MODEL</div>
                  <CodeWindow language="bash" title="request.sh">
                    {curlExample(provider)}
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
                Pass the provider and model in <code>model</code>. Set{" "}
                <code>{item.baseEnv}</code> to the provider base URL.{" "}
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
    <div className={styles.root} data-full-width>
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
            <span>OCTOBER 2026</span>
          </div>
          <div className={styles.heroTitle}>
            <h1>/tokenize</h1>
            <p className={styles.heroSubtitle}>
              One API for
              <br /> vLLM + Watsonx
            </p>
          </div>
          <p className={styles.heroIntro}>
            Choose a model. Inspect your prompt’s tokens through the same API
            for vLLM and Watsonx.
          </p>
          <TokenizeScene />
          <div className={styles.heroActions}>
            <a href="#choose-api">
              Tokenize vs. token counting <span aria-hidden="true">↓</span>
            </a>
            <a href="#setup">
              SDK and curl examples <span aria-hidden="true">↗</span>
            </a>
            <span>PROMPT → TOKEN COUNT, IDS + TEXT</span>
          </div>
        </div>
      </header>

      <ChooseApi />

      <section
        id="interface"
        className={styles.section}
        aria-labelledby="interface-title"
      >
        <SectionLabel number="02">ONE REQUEST ACROSS PROVIDERS</SectionLabel>
        <div className={styles.sectionHeading}>
          <h2 id="interface-title">Send a prompt and read the tokens</h2>
          <p>
            Pick a model below and watch the <code>model</code> field change.
            Send the same JSON fields to the same endpoint for either provider.
          </p>
        </div>
        <div className={styles.requestDemo}>
          <HeroDemo provider={provider} onProviderChange={setProvider} />
        </div>
        <p className={styles.routingNote}>
          To choose between models on each call, give each one a different{" "}
          <code>model_name</code> in your gateway config, then send that name in{" "}
          <code>model</code>. Use a name your API key can access. To change
          providers without a client update, keep the alias and change its
          provider configuration.
        </p>
        <TokenIdExplainer />
      </section>

      <section
        id="performance"
        className={styles.rustSection}
        aria-labelledby="rust-title"
      >
        <SectionLabel number="03">RUST PERFORMANCE</SectionLabel>
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
        <SectionLabel number="05">RESPONSE FORMAT</SectionLabel>
        <div className={styles.sectionHeading}>
          <h2 id="response-title">Supported providers and output fields</h2>
          <p>
            Keep your parsing code when you switch providers. Token values and
            counts depend on the model; numeric IDs do not transfer between
            tokenizers.
          </p>
        </div>
        <div className={styles.tableWrap}>
          <table>
            <caption>Provider support</caption>
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
          <code>tokens</code>. Send one text prompt per call. For count-only
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
