const {AsyncLocalStorage} = require('node:async_hooks');
const {createHmac, timingSafeEqual} = require('node:crypto');

const AGENT_NAME = 'litellm-docs-search';
const instances = new WeakMap();
const emptySpan = {setAttribute() {}, setAttributes() {}, setError() {}};
const disabled = {
  enabled: false,
  span: async (_name, _attributes, work) => work(emptySpan),
  conversation: async (_context, work) => work(),
  flush: async () => {},
  shutdown: async () => {},
};

function getTracing(config) {
  if (instances.has(config)) return instances.get(config);
  let tracing = disabled;
  if (config.tracing?.key && config.tracing?.endpoint) {
    try { tracing = createTracing(config); }
    catch { console.warn('Lens tracing is disabled. Check the tracing endpoint, protocol, and dedicated key configuration.'); }
  }
  instances.set(config, tracing);
  return tracing;
}

function createTracing(config) {
  const endpoint = new URL(config.tracing.endpoint);
  if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password || endpoint.search || endpoint.hash ||
      config.tracing.key === config.apiKey ||
      (config.tracing.protocol && config.tracing.protocol !== 'http/protobuf')) {
    throw new Error('Invalid tracing configuration');
  }
  const {ROOT_CONTEXT, trace, SpanKind, SpanStatusCode} = require('@opentelemetry/api');
  const {NodeTracerProvider, BatchSpanProcessor} = require('@opentelemetry/sdk-trace-node');
  const {OTLPTraceExporter} = require('@opentelemetry/exporter-trace-otlp-proto');
  const {resourceFromAttributes} = require('@opentelemetry/resources');
  const exporter = new OTLPTraceExporter({
    url: endpoint.href,
    headers: {Authorization: `Bearer ${config.tracing.key}`},
    timeoutMillis: 2000,
  });
  const listeners = new Set();
  const exportState = {endedSpans: 0, exportedSpans: 0, failedExports: 0};
  const observedExporter = {
    export(spans, callback) {
      exporter.export(spans, result => {
        if (result.code === 0) {
          exportState.exportedSpans += spans.length;
          const ids = spans.map(span => ({trace_id: span.spanContext().traceId, span_id: span.spanContext().spanId}));
          for (const listener of listeners) {
            try { listener(ids); } catch { /* Observers must not affect the exporter. */ }
          }
        } else {
          exportState.failedExports += 1;
          console.warn('Lens trace export failed. Check Lens connectivity and the dedicated tracing key.');
        }
        callback(result);
      });
    },
    shutdown: () => exporter.shutdown(),
  };
  const provider = new NodeTracerProvider({
    resource: resourceFromAttributes({'service.name': AGENT_NAME}),
    spanProcessors: [new BatchSpanProcessor(observedExporter, {
      maxQueueSize: 256, maxExportBatchSize: 32, scheduledDelayMillis: 5000, exportTimeoutMillis: 3000,
    })],
    forceFlushTimeoutMillis: 3500,
  });
  const tracer = provider.getTracer(AGENT_NAME);
  const active = new AsyncLocalStorage();
  const secrets = [config.apiKey, config.tracing.key].filter(Boolean);
  const clean = value => typeof value === 'string'
    ? secrets.reduce((text, secret) => text.replaceAll(secret, '[REDACTED]'), value)
    : Array.isArray(value) ? value.map(clean) : value;
  const attributes = values => Object.fromEntries(Object.entries(values)
    .filter(([, value]) => value !== undefined && value !== null).map(([key, value]) => [key, clean(value)]));
  const signature = value => createHmac('sha256', config.tracing.key)
    .update(`${AGENT_NAME}:conversation:v1:${value}`).digest('base64url');
  const encodeContext = ({traceId, spanId}) => {
    const value = `${traceId}.${spanId}`;
    return `${value}.${signature(value)}`;
  };
  const decodeContext = value => {
    if (typeof value !== 'string' || !/^[a-f0-9]{32}\.[a-f0-9]{16}\.[A-Za-z0-9_-]{43}$/.test(value)) return;
    const [traceId, spanId, mac] = value.split('.');
    if (/^0+$/.test(traceId) || /^0+$/.test(spanId) ||
        !timingSafeEqual(Buffer.from(mac), Buffer.from(signature(`${traceId}.${spanId}`)))) return;
    return {traceId, spanId, traceFlags: 1, isRemote: true};
  };

  return {
    enabled: true,
    exportState,
    subscribeExports(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    async conversation({context, question, onContext = () => {}}, work) {
      const parent = decodeContext(context);
      if (parent) {
        onContext(context);
        return active.run(trace.wrapSpanContext(parent), work);
      }
      return this.span(AGENT_NAME, {
        'gen_ai.agent.name': AGENT_NAME,
        'agent.name': AGENT_NAME,
        'gen_ai.operation.name': 'invoke_agent',
        'openinference.span.kind': 'AGENT',
        'input.value': question,
        'input.mime_type': 'text/plain',
      }, async () => {
        // Carry only a signed parent reference across requests, never a server-side session or a key.
        onContext(encodeContext(active.getStore().spanContext()));
        return work();
      }, {root: true});
    },
    async span(name, values, work, {root = false, client = false} = {}) {
      const parent = root ? undefined : active.getStore();
      const span = tracer.startSpan(name, {attributes: attributes(values), kind: client ? SpanKind.CLIENT : SpanKind.INTERNAL},
        parent ? trace.setSpan(ROOT_CONTEXT, parent) : ROOT_CONTEXT);
      let failed = false;
      const handle = {
        setAttribute: (key, value) => span.setAttributes(attributes({[key]: value})),
        setAttributes: values => span.setAttributes(attributes(values)),
        setError(type) { failed = true; span.setAttribute('error.type', clean(type)); },
      };
      try {
        const result = await active.run(span, () => work(handle));
        span.setStatus({code: failed ? SpanStatusCode.ERROR : SpanStatusCode.OK});
        return result;
      } catch (error) {
        span.setStatus({code: SpanStatusCode.ERROR});
        span.setAttribute('error.type', clean(error?.name || 'Error'));
        throw error;
      } finally { span.end(); exportState.endedSpans += 1; }
    },
    async flush() {
      try { await provider.forceFlush(); }
      catch { console.warn('Lens trace flush did not complete. The docs answer is still available.'); }
    },
    shutdown: () => provider.shutdown(),
  };
}

module.exports = {AGENT_NAME, getTracing};
