const MODEL = 'openai/gpt-6.1-sol';
const FALLBACKS = ['anthropic/claude-haiku-5-5', 'openai/gpt-6-luna'];
const BASE_URL = 'https://gateway.litellm-sandbox.ai';

function gatewayError(name, message) {
  const error = new Error(message);
  error.name = name;
  error.safeMessage = message;
  return error;
}

function createModelCaller({config, signal, fetchImpl = fetch}) {
  const cloudflareConfigured = config.cfAccessClientId !== undefined || config.cfAccessClientSecret !== undefined;
  const validCredential = value => typeof value === 'string' && /^[\x21-\x7e]+$/.test(value);
  let endpoint;
  try {
    endpoint = new URL(`${config.baseUrl.replace(/\/$/, '')}/chat/completions`);
    if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password || endpoint.search || endpoint.hash ||
        !validCredential(config.apiKey) || (cloudflareConfigured &&
        (!validCredential(config.cfAccessClientId) || !validCredential(config.cfAccessClientSecret)))) throw new Error();
  } catch {
    throw gatewayError('GatewayConfigurationError', 'Invalid gateway configuration');
  }
  const headers = {'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}`,
    ...(cloudflareConfigured ? {
      'CF-Access-Client-Id': config.cfAccessClientId,
      'CF-Access-Client-Secret': config.cfAccessClientSecret,
    } : {}),
  };
  const secrets = [config.apiKey, config.cfAccessClientId, config.cfAccessClientSecret].filter(Boolean);
  const assertSafe = text => {
    if (secrets.some(secret => text.includes(secret))) throw gatewayError('GatewayInvalidResponse', 'Invalid gateway response');
  };
  async function turn(messages, {toolDefinitions, toolChoice = 'auto', onDelta, timeout = 25000} = {}) {
    const requestSignal = signal ? AbortSignal.any([signal, AbortSignal.timeout(timeout)]) : AbortSignal.timeout(timeout);
    requestSignal.throwIfAborted();
    const response = await fetchImpl(endpoint.href, {
      method: 'POST', redirect: 'error', signal: requestSignal,
      headers,
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
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      const codes = [body?.error?.code, body?.error?.type];
      if (codes.some(code => typeof code === 'string' && /context[_ -]?(?:length|window)[_ -]?exceeded/i.test(code))) {
        throw gatewayError('GatewayContextWindowExceeded', 'Conversation exceeds the model context window');
      }
      throw gatewayError('GatewayHTTPError', 'Gateway request failed');
    }
    let message, finish, pending = '';
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
      message = {role: 'assistant', content: ''};
      let completed = false;
      for await (const frame of readEvents(response.body, requestSignal)) {
        if (frame.data === '[DONE]') {completed = true; break;}
        let chunk;
        try {chunk = JSON.parse(frame.data);} catch {throw gatewayError('GatewayInvalidJSON', 'Gateway returned invalid JSON');}
        if (chunk.error) throw gatewayError('GatewayStreamError', 'Gateway interrupted the response');
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
      if (!completed || !finish) throw gatewayError('GatewayStreamInterrupted', 'Gateway response stream ended early');
    } else {
      let result;
      try {result = await response.json();}
      catch {throw gatewayError('GatewayInvalidJSON', 'Gateway returned invalid JSON');}
      const choice = result?.choices?.[0]; message = choice?.message; finish = choice?.finish_reason;
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
  }
  // Non-tool callers retain the same validated completion contract.
  const call = async (system, data, timeout, onDelta) => {
    const {documentation, ...questionData} = data;
    const messages = [
      {role: 'system', content: [{type: 'text', text: system, cache_control: {type: 'ephemeral'}}]},
      ...(documentation ? [{role: 'user', content: [{type: 'text', text: JSON.stringify({documentation}), cache_control: {type: 'ephemeral'}}]}] : []),
      {role: 'user', content: JSON.stringify(questionData)},
    ];
    return (await turn(messages, {timeout, onDelta})).content;
  };
  call.turn = turn;
  return call;
}

module.exports = {MODEL, FALLBACKS, BASE_URL, createModelCaller};
