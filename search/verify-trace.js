const fs = require('node:fs/promises');
const path = require('node:path');
const {setTimeout: delay} = require('node:timers/promises');
const {answerQuestion} = require('./answer');
const {readConfig, loadCorpus} = require('./runtime');
const {AGENT_NAME, getTracing} = require('./tracing');

async function waitForReceipt(endpoint, key, record) {
  const deadline = Date.now() + 60000;
  let lastStatus = 'no response';
  for (let attempt = 1; attempt <= 30 && Date.now() < deadline; attempt++) {
    let retryAfter = 1000;
    try {
      const response = await fetch(`${endpoint.replace(/\/$/, '')}/receipt`, {
        method: 'POST', redirect: 'error',
        headers: {'Content-Type': 'application/json', Authorization: `Bearer ${key}`},
        body: JSON.stringify({trace_id: record.trace_id, span_ids: record.span_ids}),
        signal: AbortSignal.timeout(Math.max(1, Math.min(5000, deadline - Date.now()))),
      });
      lastStatus = `HTTP ${response.status}`;
      if (response.status === 401 || response.status === 403) {
        throw new Error('Lens rejected the dedicated tracing key or its permissions. Receipt verification stopped.');
      }
      if (response.ok) {
        const receipt = await response.json();
        if (receipt.received === true) return receipt;
        lastStatus = 'Lens has not confirmed all exported spans';
      } else if (response.status !== 429 && response.status < 500) {
        throw new Error(`Lens receipt verification failed with HTTP ${response.status}.`);
      }
      const header = response.headers.get('retry-after');
      if (header) {
        const seconds = Number(header);
        const requested = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(header) - Date.now();
        if (Number.isFinite(requested)) retryAfter = Math.max(1000, requested);
      }
    } catch (error) {
      // Credential and permanent HTTP failures must not be retried.
      if (error.message.startsWith('Lens ')) throw error;
      lastStatus = 'Lens receipt request could not be completed';
    }
    if (attempt === 30 || Date.now() + retryAfter >= deadline) break;
    await delay(retryAfter);
  }
  throw new Error(`Trace receipt is unconfirmed: ${lastStatus}.`);
}

async function main() {
  require('dotenv').config({path: '.env.local'});
  const questions = process.argv.slice(2).map(question => question.trim());
  if (!questions.length || questions.some(question => !question || question.length > 500)) {
    throw new Error('Pass each real docs question in quotes, with 1 to 500 characters per question.');
  }
  const config = readConfig(process.env);
  const tracing = getTracing(config);
  if (!tracing.enabled) throw new Error('Configure LITELLM_TRACING_KEY and OTEL_EXPORTER_OTLP_TRACES_ENDPOINT in .env.local first.');
  if (!config.apiKey) throw new Error('The existing DOCS_AI_API_KEY is missing.');
  const traces = new Map();
  const unsubscribe = tracing.subscribeExports(spans => {
    for (const {trace_id, span_id} of spans) {
      if (!traces.has(trace_id)) traces.set(trace_id, new Set());
      traces.get(trace_id).add(span_id);
    }
  });
  try {
    const corpus = await loadCorpus(path.resolve(process.env.DOCS_BUILD_DIR || 'build'));
    let traceContext;
    const history = [];
    for (const question of questions) {
      const result = await answerQuestion({question, history: history.slice(-4), ...corpus, config, traceContext,
        onTraceContext: value => {traceContext = value;}});
      if (result.status !== 200) throw new Error(`The docs assistant returned HTTP ${result.status}.`);
      history.push({question});
    }
    if (tracing.exportState.failedExports || tracing.exportState.endedSpans !== tracing.exportState.exportedSpans) {
      throw new Error('The exporter did not confirm every span. Check Lens connectivity and the dedicated tracing key.');
    }
    if (traces.size !== 1) throw new Error('The exporter did not confirm exactly one real agent trace.');
    const [[trace_id, spanIds]] = traces;
    const record = {agent: AGENT_NAME, trace_id, span_ids: [...spanIds], received: false};
    if (!/^[a-f0-9]{32}$/.test(trace_id) || !record.span_ids.length || record.span_ids.some(id => !/^[a-f0-9]{16}$/.test(id))) {
      throw new Error('The exporter returned invalid trace or span identifiers.');
    }
    const file = path.resolve('.cache-loader/docs-trace-receipt.json');
    await fs.mkdir(path.dirname(file), {recursive: true});
    await fs.writeFile(file, JSON.stringify(record, null, 2) + '\n', {mode: 0o600});
    console.log(JSON.stringify({agent: record.agent, trace_id, span_ids: record.span_ids, received: false}));
    await waitForReceipt(config.tracing.endpoint, config.tracing.key, record);
    record.received = true;
    record.verified_at = new Date().toISOString();
    if (process.env.LENS_UI_URL) {
      const ui = new URL(process.env.LENS_UI_URL);
      if (ui.protocol !== 'https:' || ui.username || ui.password || ui.search || ui.hash) throw new Error('Invalid LENS_UI_URL.');
      ui.searchParams.set('trace', trace_id);
      record.url = ui.href;
    }
    await fs.writeFile(file, JSON.stringify(record, null, 2) + '\n', {mode: 0o600});
    console.log(JSON.stringify(record, null, 2));
  } finally {
    unsubscribe();
    await tracing.shutdown();
  }
}

if (require.main === module) main().catch(error => {
  // Deliberately avoid dumping upstream errors or configuration objects.
  const message = /^(Pass |Configure |The existing |The docs |The exporter |Lens |Trace receipt |Invalid LENS_UI_URL)/.test(error.message)
    ? error.message : 'Could not verify a real docs trace. Check model access and Lens connectivity.';
  console.error(message);
  process.exitCode = 1;
});
module.exports = {waitForReceipt};
