const MODEL = 'anthropic/claude-haiku-5-5';
const FALLBACKS = ['openai/gpt-6-luna', 'openai/gpt-6.1-sol'];
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
  return async (system, data, timeout, stage = 'model') => tracing.span(`chat ${stage}`, {
    'openinference.span.kind': 'LLM', 'gen_ai.operation.name': 'chat',
    'gen_ai.request.model': MODEL,
    'docs.search.stage': stage,
  }, async span => {
    const {documentation, ...questionData} = data;
    const messages = [
      {role: 'system', content: [{type: 'text', text: system, cache_control: {type: 'ephemeral'}}]},
      ...(documentation ? [{role: 'user', content: [{type: 'text', text: JSON.stringify({documentation}), cache_control: {type: 'ephemeral'}}]}] : []),
      {role: 'user', content: JSON.stringify(questionData)},
    ];
    span.setAttribute('input.value', JSON.stringify(messages));
    span.setAttribute('input.mime_type', 'application/json');
    span.setAttribute('llm.model_name', MODEL);
    const response = await fetchImpl(endpoint.href, {
      method: 'POST', redirect: 'error',
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(timeout)]) : AbortSignal.timeout(timeout),
      headers: {'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}`},
      body: JSON.stringify({model: MODEL, fallbacks: [
        {model: FALLBACKS[0], reasoning_effort: 'none'},
        {model: FALLBACKS[1], reasoning_effort: 'low'},
      ], num_retries: 0, max_fallbacks: 2,
        timeout: Math.max(1, Math.floor((timeout / 1000 - 1) / 3)),
        reasoning_effort: 'none', cache: {'no-cache': true, 'no-store': true}, messages}),
    });
    span.setAttribute('http.response.status_code', response.status);
    if (!response.ok) throw gatewayError('GatewayHTTPError', 'Gateway request failed');
    const text = await response.text();
    let result;
    try { result = JSON.parse(text); }
    catch { throw gatewayError('GatewayInvalidJSON', 'Gateway returned invalid JSON'); }
    const choice = result?.choices?.[0], message = choice?.message;
    // Preserve correlation and usage even when validation rejects the completion.
    span.setAttributes({
      'gen_ai.response.model': result?.model,
      'llm.model_name': result?.model || MODEL,
      'gen_ai.response.id': result?.id,
      'gen_ai.usage.input_tokens': result?.usage?.prompt_tokens,
      'gen_ai.usage.output_tokens': result?.usage?.completion_tokens,
      'gen_ai.usage.cache_read.input_tokens': result?.usage?.prompt_tokens_details?.cached_tokens ?? result?.usage?.cache_read_input_tokens,
      'gen_ai.usage.cache_creation.input_tokens': result?.usage?.cache_creation_input_tokens,
      'gen_ai.usage.reasoning.output_tokens': result?.usage?.completion_tokens_details?.reasoning_tokens,
      'gen_ai.response.finish_reasons': choice?.finish_reason ? [choice.finish_reason] : undefined,
      'docs.search.response.content_length': typeof message?.content === 'string' ? message.content.length : undefined,
    });
    if (message?.tool_calls?.length || (typeof message?.content === 'string' &&
        message.content.includes(config.apiKey))) {
      throw gatewayError('GatewayInvalidResponse', 'Invalid gateway response');
    }
    if (typeof message?.content === 'string') span.setAttributes({
      'output.value': message.content, 'output.mime_type': 'text/plain',
    });
    if (choice?.finish_reason === 'length') {
      throw gatewayError('GatewayResponseTruncated', 'Gateway response reached its token limit');
    }
    if (typeof message?.content !== 'string' || !message.content.trim()) {
      throw gatewayError('GatewayEmptyResponse', 'Gateway returned no answer text');
    }
    return message.content;
  }, {client: true});
}

module.exports = {MODEL, FALLBACKS, BASE_URL, createModelCaller};
