import React, {useState} from 'react';
import Link from '@docusaurus/Link';
import CodeBlock from '@theme/CodeBlock';
import examples from '@site/static/benchmarks/jevrank/query-examples.json';
import styles from './launch.module.css';
import {
  QualityCostChart,
  MeasuredQualityChart,
  CostQualityChart,
} from './JevRankBenchmarks';
import RerankFlow from './RerankFlow';

const money = (amount) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: amount < 10 ? 2 : 0,
  }).format(amount);

function Eyebrow({number, children}) {
  return (
    <div className={styles.eyebrow}>
      <span>{number}</span>
      {children}
    </div>
  );
}

function BenchmarkStory() {
  return (
    <section
      id="benchmark"
      className={styles.staticBenchmark}
      aria-labelledby="benchmark-title"
    >
      <Eyebrow number="01">BENCHMARK</Eyebrow>
      <h2 id="benchmark-title">Benchmark results</h2>
      <p className={styles.sectionIntro}>
        In a SciFact reference benchmark, Perplexity Flash and Cohere Rerank 4
        Pro both scored <strong>0.775 nDCG@10</strong>. Their projected costs
        were <strong>$73 versus $2,500 per million queries</strong>, about 34×
        lower for Flash.
      </p>

      <QualityCostChart />

      <div className={styles.staticCopy}>
        <h2>Our SciFact benchmark</h2>
        <p>
          We ran 6,000 document decisions through LiteLLM with Jev 1.13.0. On
          the same BM25 candidates, nDCG@10 improved from{' '}
          <strong>0.686 to 0.768</strong>, at an estimated{' '}
          <strong>$0.575 per 1,000 queries</strong>.
        </p>
        <p>
          All 300 queries completed. We measured{' '}
          <strong>0.50 s median latency</strong> and{' '}
          <strong>1.15 s at p95</strong>, with eight calls in flight per query.
          Jev placed a relevant document first for 68% of queries, compared with{' '}
          <a href="/benchmarks/jevrank/independent-audit.json">55% for BM25</a>.
        </p>
      </div>
      <MeasuredQualityChart />
      <CostQualityChart />
    </section>
  );
}

function RecordedDemo() {
  const [exampleId, setExampleId] = useState(examples.examples[0].id);
  const [reranked, setReranked] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const example = examples.examples.find((item) => item.id === exampleId);
  const documents = [...example.documents].sort((a, b) =>
    reranked ? a.jevRank - b.jevRank : a.bm25Rank - b.bm25Rank,
  );
  const chooseExample = (id) => {
    setExampleId(id);
    setReranked(false);
    setExpanded(false);
  };
  return (
    <section
      id="recorded-demo"
      className={styles.demo}
      aria-labelledby="demo-title"
    >
      <div className={styles.sectionHeading}>
        <div>
          <Eyebrow number="02">EXAMPLES</Eyebrow>
          <h2 id="demo-title">Recorded examples</h2>
        </div>
        <span className={styles.recordedBadge}>
          <span />
          Recorded · Jev 1.13.0
        </span>
      </div>
      <p className={styles.sectionIntro}>
        Explore three saved queries, including an improvement, an unchanged
        first result and a regression. The scores come from our benchmark. These
        controls make no model calls.
      </p>
      <div className={styles.demoPanel}>
        <div
          className={styles.exampleButtons}
          role="group"
          aria-label="Recorded query example"
        >
          {examples.examples.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={item.id === exampleId}
              onClick={() => chooseExample(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className={styles.query}>
          <span>QUERY {example.id}</span>
          <p>{example.query}</p>
        </div>
        <div className={styles.rankingToolbar}>
          <div
            className={styles.switch}
            role="group"
            aria-label="Document ranking"
          >
            <button
              type="button"
              aria-pressed={!reranked}
              onClick={() => setReranked(false)}
            >
              BM25 retrieval
            </button>
            <button
              type="button"
              aria-pressed={reranked}
              onClick={() => setReranked(true)}
            >
              After JevRank
            </button>
          </div>
          <span aria-live="polite">
            First relevant result:{' '}
            <strong>
              #
              {reranked
                ? example.firstRelevantAfter
                : example.firstRelevantBefore}
            </strong>
          </span>
        </div>
        <ol className={styles.documentList}>
          {documents.slice(0, expanded ? 20 : 5).map((document) => (
            <li
              key={document.id}
              className={document.relevant ? styles.relevantDocument : ''}
            >
              <span className={styles.rank}>
                {reranked ? document.jevRank : document.bm25Rank}
              </span>
              <div className={styles.documentCopy}>
                <div>
                  <strong>{document.title}</strong>
                  {document.relevant && (
                    <span className={styles.relevantBadge}>
                      Judged relevant · SciFact
                    </span>
                  )}
                </div>
                <p>{document.excerpt}</p>
                <span className={styles.documentMeta}>
                  Document {document.id}
                  {reranked && <> · BM25 rank {document.bm25Rank}</>}
                </span>
              </div>
              {reranked && (
                <span className={styles.documentScore}>
                  <strong>{document.relevanceScore.toFixed(2)}</strong>
                  <small>P(relevant)</small>
                </span>
              )}
            </li>
          ))}
        </ol>
        <div className={styles.demoFooter}>
          <button type="button" onClick={() => setExpanded(!expanded)}>
            {expanded ? 'Show top 5' : 'Show all 20 candidates'}{' '}
            <span aria-hidden="true">{expanded ? '↑' : '↓'}</span>
          </button>
          <span>
            {example.latencySeconds.toFixed(2)} s ·{' '}
            {money(example.estimatedCostUsd * 1000)} estimated / 1K queries at
            this query’s length
          </span>
        </div>
      </div>
      <p className={styles.caption}>
        SciFact labels evidence relevance, including supporting and refuting
        evidence. The model’s scores can disagree with those judgments.{' '}
        <a href="/benchmarks/jevrank/query-examples.json">
          Download these examples ↗
        </a>
      </p>
    </section>
  );
}

function MethodExplanation() {
  return (
    <section className={styles.methodSection} aria-labelledby="method-title">
      <div>
        <Eyebrow number="03">SCORING</Eyebrow>
        <h2 id="method-title">How JevRank works</h2>
        <p>
          Send a query and documents to LiteLLM’s rerank API. LiteLLM recognizes
          supported decision models and chooses the scoring method for the
          model.
        </p>
        <p>
          Decision models return probabilities for fixed answers. JevRank uses
          those probabilities as relevance scores, sorts the documents and
          preserves their original indexes.
        </p>
      </div>
      <div className={styles.methodVisual}>
        <div className={styles.methodInput}>
          <span>INPUT</span>
          <div>
            <span>query</span>
            <span>documents[]</span>
          </div>
        </div>
        <span className={styles.flowArrow} aria-hidden="true">
          ↓
        </span>
        <div className={styles.methodQuestion}>
          <span>DECISION MODEL</span>
          <strong>Probabilities for the supplied passages</strong>
        </div>
        <span className={styles.flowArrow} aria-hidden="true">
          ↓
        </span>
        <div className={styles.methodOutput}>
          <strong>Ranked documents</strong>
          <span>Original index + relevance score</span>
        </div>
      </div>
      <details className={styles.methodDetails}>
        <summary>Score meaning and failures</summary>
        <p>
          A model can compare candidates in one choice question or assess each
          document against the query. Choice probabilities belong to the
          supplied candidate set; scores from separate batches do not share a
          scale.
        </p>
        <p>
          Provider errors and refusals fail the request. LiteLLM sends the full
          input and returns an error if it exceeds provider limits. Perplexity
          accepts 2 to 255 documents in one choice question. TypeSafe assesses
          documents in parallel; the rerank response reports their combined
          token usage.
        </p>
      </details>
    </section>
  );
}

const configs = {
  perplexity: `model_list:
  - model_name: jevrank-flash
    litellm_params:
      model: perplexity/pplx-decider-flash-v1.2
      api_key: os.environ/PERPLEXITY_API_KEY`,
  typesafe: `model_list:
  - model_name: jevrank
    litellm_params:
      model: typesafe/jev-1.14.0
      api_key: os.environ/TYPESAFE_API_KEY`,
};

function Setup() {
  const [mode, setMode] = useState('gateway');
  const [provider, setProvider] = useState('perplexity');
  const alias = provider === 'perplexity' ? 'jevrank-flash' : 'jevrank';
  const model =
    provider === 'perplexity'
      ? 'perplexity/pplx-decider-flash-v1.2'
      : 'typesafe/jev-1.14.0';
  const providerKey =
    provider === 'perplexity' ? 'PERPLEXITY_API_KEY' : 'TYPESAFE_API_KEY';
  const sdk = `import os

from litellm import rerank

result = rerank(
    model="${model}",
    api_key=os.environ["${providerKey}"],
    query="How long is the warranty?",
    documents=[
        "Shipping takes three days.",
        "Warranty coverage lasts two years.",
    ],
    top_n=1,
)

print(result.results)`;
  const request = `curl "$LITELLM_BASE_URL/rerank" \\
  -H "Authorization: Bearer $LITELLM_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${alias}",
    "query": "How long is the warranty?",
    "documents": [
      "Shipping takes three days.",
      "Warranty coverage lasts two years."
    ],
    "top_n": 1
  }'`;
  return (
    <section id="setup" className={styles.setup} aria-labelledby="setup-title">
      <div className={styles.sectionHeading}>
        <div>
          <Eyebrow number="04">PREVIEW</Eyebrow>
          <h2 id="setup-title">Setup and usage</h2>
        </div>
        <a
          className={styles.textLink}
          href="https://github.com/BerriAI/litellm/pull/47782"
        >
          Preview PR ↗
        </a>
      </div>
      <p className={styles.sectionIntro}>
        Use JevRank through your AI Gateway or call it from Python. These
        examples require the preview branch; no released version includes the
        adapter yet. For this preview, set{' '}
        <code>LITELLM_LOCAL_MODEL_COST_MAP=True</code> to load the branch’s
        model catalog.
      </p>
      <div
        className={styles.usageNav}
        role="group"
        aria-label="Usage interface"
      >
        <button
          type="button"
          aria-pressed={mode === 'gateway'}
          onClick={() => setMode('gateway')}
        >
          AI Gateway
        </button>
        <button
          type="button"
          aria-pressed={mode === 'sdk'}
          onClick={() => setMode('sdk')}
        >
          Python SDK
        </button>
      </div>
      <div
        className={styles.providerSelector}
        role="group"
        aria-label="Setup provider"
      >
        <button
          type="button"
          aria-pressed={provider === 'perplexity'}
          onClick={() => setProvider('perplexity')}
        >
          Perplexity
        </button>
        <button
          type="button"
          aria-pressed={provider === 'typesafe'}
          onClick={() => setProvider('typesafe')}
        >
          TypeSafe Jev
        </button>
      </div>
      <div className={styles.usageContent} key={`${mode}-${provider}`}>
        {mode === 'gateway' ? (
          <>
            <p className={styles.usageInstructions}>
              Set <code>{providerKey}</code> in your gateway environment. Add
              this deployment, then send a rerank request with your gateway URL
              and LiteLLM key.
            </p>
            <div className={styles.codeGrid}>
              <div>
                <span className={styles.codeLabel}>
                  01 / GATEWAY CONFIGURATION
                </span>
                <CodeBlock language="yaml" title="config.yaml">
                  {configs[provider]}
                </CodeBlock>
                <p className={styles.codeFootnote}>
                  Start the gateway with{' '}
                  <code>litellm --config config.yaml --port 4000</code>.
                </p>
              </div>
              <div>
                <span className={styles.codeLabel}>02 / RERANK REQUEST</span>
                <CodeBlock language="bash" title="request.sh">
                  {request}
                </CodeBlock>
                <p className={styles.codeFootnote}>
                  Set <code>LITELLM_BASE_URL</code> to your gateway URL and{' '}
                  <code>LITELLM_API_KEY</code> to your gateway key.
                </p>
              </div>
            </div>
          </>
        ) : (
          <>
            <p className={styles.usageInstructions}>
              Set <code>{providerKey}</code> in your Python environment, then
              call <code>rerank</code>.
            </p>
            <div className={styles.sdkExample}>
              <CodeBlock language="python" title="rerank.py">
                {sdk}
              </CodeBlock>
            </div>
          </>
        )}
      </div>
      <p className={styles.caption}>
        The TypeSafe preset pins Jev 1.14; our measured run used Jev 1.13.0.
        Evaluate the version you deploy.
      </p>
    </section>
  );
}

export default function JevRankLaunch() {
  return (
    <div className={styles.root}>
      <header className={styles.launchHero}>
        <div className={styles.launchInner}>
          <div className={styles.launchTop}>
            <Link to="/blog" aria-label="Back to the LiteLLM blog">
              <img
                src="/img/brand/litellm-logo-white.png"
                width="136"
                alt="LiteLLM"
              />
            </Link>
            <span>PREVIEW / OCTOBER 2026</span>
          </div>
          <div className={styles.launchTitle}>
            <h1>JevRank</h1>
            <p>
              Decision models
              <br /> for reranking
            </p>
          </div>
          <p className={styles.launchIntro}>
            Turn Perplexity and TypeSafe decision models into rerankers. Keep
            your query, your documents and your LiteLLM endpoint.
          </p>
          <p className={styles.researchCredit}>
            JevRank builds on the decision-model reranking research of Jakob
            Gruber at <a href="https://www.swietelsky.com/">Swietelsky AG</a>.
          </p>
          <RerankFlow />
          <div className={styles.launchFooter}>
            <a href="#benchmark">
              Read the benchmark <span aria-hidden="true">↓</span>
            </a>
            <a href="#setup">
              Try the preview <span aria-hidden="true">↗</span>
            </a>
            <span>QUERY + DOCUMENTS → RELEVANCE SCORES</span>
          </div>
        </div>
      </header>
      <BenchmarkStory />
      <details className={styles.recordedSupplement}>
        <summary>
          Recorded examples{' '}
          <span>Improvement, unchanged ranking and regression</span>
        </summary>
        <RecordedDemo />
      </details>
      <MethodExplanation />
      <Setup />
      <section
        id="methodology"
        className={styles.methodology}
        aria-labelledby="methodology-title"
      >
        <Eyebrow number="05">METHODOLOGY</Eyebrow>
        <h2 id="methodology-title">Benchmark methodology</h2>
        <div className={styles.methodologyGrid}>
          <div>
            <h3>LiteLLM run</h3>
            <p>
              We ran all 300 SciFact test queries with 20 fixed BM25 candidates
              per query through SDK{' '}
              <a href="https://github.com/BerriAI/litellm/commit/5aa0a8304c">
                commit 5aa0a8304c
              </a>
              . All 6,000 judgments completed with returned version{' '}
              <code>jev-1.13.0</code>.
            </p>
            <p>
              BM25s 0.3.13 used Lucene BM25, k1=1.5, b=0.75, English stop words
              and Snowball stemming over titles and full abstracts. Median
              rerank latency was 0.50 s; p95 was 1.15 s with eight calls in
              flight. Returned tokens imply $0.172618 total at the configured
              gateway rate, an estimate rather than an invoice.
            </p>
          </div>
          <div>
            <h3>Reference experiment</h3>
            <p>
              Jakob Gruber’s October 2026 reference experiment at Swietelsky AG
              used the same SciFact split and candidate count, with calls
              through OpenRouter. Retrieval settings and candidate identity may
              differ from our run. We could not access Perplexity or Cohere for
              our benchmark.
            </p>
            <p>
              The 34× comparison belongs to reference Flash versus Cohere Pro:
              $73 versus $2,500 per million queries and 0.775 nDCG@10 for both.
              Its paired tests found no significant quality difference. Costs
              cover reranking and depend on model rates and input length.
            </p>
          </div>
        </div>
        <div className={styles.evidenceLinks}>
          <a href="/benchmarks/jevrank/README.md">Reproduction guide ↗</a>
          <a href="/benchmarks/jevrank/measured-run.json">Run manifest ↗</a>
          <a href="/benchmarks/jevrank/measured-per-query.csv">
            300-query data ↗
          </a>
          <a href="/benchmarks/jevrank/measured-responses.jsonl.gz">
            Provider responses ↗
          </a>
          <a href="/benchmarks/jevrank/independent-audit.json">
            Independent recalculation ↗
          </a>
        </div>
      </section>
      <footer className={styles.articleFooter}>
        <div className={styles.footerBrand}>
          JevRank <span>by LiteLLM</span>
        </div>
        <p>
          Try JevRank on your own queries and compare it with your current
          reranker.
        </p>
        <a
          href="https://github.com/BerriAI/litellm/pull/47782"
          className={styles.primaryAction}
        >
          Review the implementation ↗
        </a>
      </footer>
    </div>
  );
}
