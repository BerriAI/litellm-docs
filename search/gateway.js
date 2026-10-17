const MODEL = 'openai/gpt-6.1-sol';
const FALLBACKS = ['anthropic/claude-haiku-5-5', 'openai/gpt-6-luna'];
const BASE_URL = 'https://gateway.litellm-sandbox.ai';
const {getTracing} = require('./tracing');

function gatewayError(name, message) {
  const error = new Error(message);
  error.name = name;
  error.safeMessage = message;
  return error;
}

function createModelCaller({config, signal, fetchImpl = fetch}) {
  const endpoint = new URL(`${(config.baseUrl || BASE_URL).replace(/\/$/, '')}/chat/completions`);
  if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password || endpoint.search || endpoint.hash) {
    throw new Error('Invalid gateway configuration');
  }
  const tracing = getTracing(config);
  const secrets = [config.apiKey, config.tracing?.key].filter(Boolean);
  const assertSafe = text => {
    if (secrets.some(secret => text.includes(secret))) throw gatewayError('GatewayInvalidResponse', 'Invalid gateway response');
  };
  async function turn(messages, {toolDefinitions, toolChoice = 'auto', onDelta, timeout = 25000, stage = 'agent'} = {}) {
    return tracing.span(`chat ${stage}`, {
      'openinference.span.kind': 'LLM', 'gen_ai.operation.name': 'chat',
      'gen_ai.request.model': MODEL, 'docs.search.stage': stage,
    }, async span => {
      span.setAttribute('input.value', JSON.stringify(messages));
      span.setAttribute('input.mime_type', 'application/json');
      span.setAttribute('llm.model_name', MODEL);
      const requestSignal = signal ? AbortSignal.any([signal, AbortSignal.timeout(timeout)]) : AbortSignal.timeout(timeout);
      requestSignal.throwIfAborted();
      const response = await fetchImpl(endpoint.href, {
        method: 'POST', redirect: 'error', signal: requestSignal,
        headers: {'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}`},
        body: JSON.stringify({model: MODEL, fallbacks: [
          {model: FALLBACKS[0], reasoning_effort: 'none'},
          {model: FALLBACKS[1], reasoning_effort: 'none'},
        ], num_retries: 0, max_fallbacks: 2,
          timeout: Math.max(1, Math.floor(timeout / 1000 - 1)), reasoning_effort: 'low',
          cache: {'no-cache': true, 'no-store': true}, messages,
          ...(toolDefinitions ? {tools: toolDefinitions, tool_choice: toolChoice} : {}),
          ...(onDelta ? {stream: true, stream_options: {include_usage: true}} : {}),
        }),
      });
      span.setAttribute('http.response.status_code', response.status);
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        const codes = [body?.error?.code, body?.error?.type];
        if (codes.some(code => typeof code === 'string' && /context[_ -]?(?:length|window)[_ -]?exceeded/i.test(code))) {
          throw gatewayError('GatewayContextWindowExceeded', 'Conversation exceeds the model context window');
        }
        throw gatewayError('GatewayHTTPError', 'Gateway request failed');
      }
      let result, message, finish, pending = '';
      const capture = () => {
        record(span, result, message, finish);
        const output = message?.tool_calls?.length ? JSON.stringify(message) : message?.content;
        if (typeof output === 'string' && !secrets.some(secret => output.includes(secret))) {
          span.setAttribute('output.value', output);
          span.setAttribute('output.mime_type', message?.tool_calls?.length ? 'application/json' : 'text/plain');
        }
      };
      const deliver = async text => {
        pending += text; assertSafe(pending);
        // Retain enough suffix to detect a configured credential split across deltas.
        const keep = Math.max(0, ...secrets.map(secret => secret.length - 1));
        if (pending.length > keep) {
          const ready = pending.slice(0, pending.length - keep); pending = pending.slice(pending.length - keep);
          await onDelta?.(ready);
        }
      };
      if (response.headers.get('content-type')?.includes('text/event-stream')) {
        const {readEvents} = await import('./stream.mjs');
        result = {}; message = {role: 'assistant', content: ''};
        let completed = false;
        try {
          for await (const frame of readEvents(response.body, requestSignal)) {
            if (frame.data === '[DONE]') {completed = true; break;}
            let chunk;
            try {chunk = JSON.parse(frame.data);} catch {throw gatewayError('GatewayInvalidJSON', 'Gateway returned invalid JSON');}
            if (chunk.error) throw gatewayError('GatewayStreamError', 'Gateway interrupted the response');
            if (chunk.id) result.id = chunk.id;
            if (chunk.model) result.model = chunk.model;
            if (chunk.usage) result.usage = chunk.usage;
            const choice = chunk.choices?.find(choice => choice.index === 0 || choice.index === undefined);
            if (!choice) continue;
            if (choice.finish_reason) finish = choice.finish_reason;
            const delta = choice.delta || {};
            if (typeof delta.content === 'string') {
              message.content += delta.content;
              await deliver(delta.content);
            }
            if (delta.tool_calls?.length) throw gatewayError('GatewayInvalidResponse', 'Invalid gateway response');
          }
        } finally {
          capture();
        }
        if (!completed || !finish) throw gatewayError('GatewayStreamInterrupted', 'Gateway response stream ended early');
      } else {
        try {result = await response.json();}
        catch {throw gatewayError('GatewayInvalidJSON', 'Gateway returned invalid JSON');}
        const choice = result?.choices?.[0]; message = choice?.message; finish = choice?.finish_reason;
        capture();
      }
      requestSignal.throwIfAborted();
      assertSafe(JSON.stringify(message || {}));
      if (finish === 'length') throw gatewayError('GatewayResponseTruncated', 'Gateway response reached its token limit');
      if (message?.tool_calls?.length) {
        const allowed = new Set((toolDefinitions || []).map(tool => tool.function.name));
        if (finish !== 'tool_calls' || message.tool_calls.length > 4 || new Set(message.tool_calls.map(call => call.id)).size !== message.tool_calls.length ||
          message.tool_calls.some(call => !call.id || call.type !== 'function' || !allowed.has(call.function?.name) || typeof call.function.arguments !== 'string')) {
          throw gatewayError('GatewayInvalidResponse', 'Invalid gateway response');
        }
        return {role: 'assistant', content: message.content || null, tool_calls: message.tool_calls};
      }
      if (finish !== 'stop' || typeof message?.content !== 'string' || !message.content.trim()) {
        throw gatewayError('GatewayEmptyResponse', 'Gateway returned no complete answer text');
      }
      if (onDelta) {
        if (!response.headers.get('content-type')?.includes('text/event-stream')) await deliver(message.content);
        if (pending) await onDelta(pending);
      }
      return {role: 'assistant', content: message.content};
    }, {client: true});
  }
  // Non-tool callers retain the same validated completion contract.
  const call = async (system, data, timeout, stage, onDelta) => {
    const {documentation, ...questionData} = data;
    const messages = [
      {role: 'system', content: [{type: 'text', text: system, cache_control: {type: 'ephemeral'}}]},
      ...(documentation ? [{role: 'user', content: [{type: 'text', text: JSON.stringify({documentation}), cache_control: {type: 'ephemeral'}}]}] : []),
      {role: 'user', content: JSON.stringify(questionData)},
    ];
    return (await turn(messages, {timeout, stage, onDelta})).content;
  };
  call.turn = turn;
  return call;
}

function record(span, result, message, finish) {
  span.setAttributes({
    'gen_ai.response.model': result?.model, 'llm.model_name': result?.model,
    'gen_ai.response.id': result?.id,
    'gen_ai.usage.input_tokens': result?.usage?.prompt_tokens,
    'gen_ai.usage.output_tokens': result?.usage?.completion_tokens,
    'gen_ai.usage.cache_read.input_tokens': result?.usage?.prompt_tokens_details?.cached_tokens ?? result?.usage?.cache_read_input_tokens,
    'gen_ai.usage.cache_creation.input_tokens': result?.usage?.cache_creation_input_tokens,
    'gen_ai.usage.reasoning.output_tokens': result?.usage?.completion_tokens_details?.reasoning_tokens,
    'gen_ai.response.finish_reasons': finish ? [finish] : undefined,
    'docs.search.response.content_length': typeof message?.content === 'string' ? message.content.length : undefined,
  });
}
module.exports = {MODEL, FALLBACKS, BASE_URL, createModelCaller};
