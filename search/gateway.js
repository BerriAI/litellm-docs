const MODEL = 'anthropic/claude-haiku-5-5';
const FALLBACKS = ['openai/gpt-6-luna', 'openai/gpt-6.1-sol'];
const BASE_URL = 'https://gateway.litellm-sandbox.ai';
const {getTracing} = require('./tracing');

function createModelCaller({config, signal, fetchImpl = fetch}) {
  const endpoint = new URL(`${(config.baseUrl || BASE_URL).replace(/\/$/, '')}/chat/completions`);
  if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password || endpoint.search || endpoint.hash) {
    throw new Error('Invalid gateway configuration');
  }
  const tracing = getTracing(config);
  return async (system, data, maxTokens, timeout, stage = 'model') => tracing.span(`chat ${stage}`, {
    'openinference.span.kind': 'LLM', 'gen_ai.operation.name': 'chat',
    'gen_ai.request.model': MODEL, 'gen_ai.request.max_tokens': maxTokens,
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
        {model: FALLBACKS[1], reasoning_effort: 'low', max_tokens: maxTokens + 1024},
      ], num_retries: 0, max_fallbacks: 2,
        timeout: Math.max(1, Math.floor((timeout / 1000 - 1) / 3)),
        reasoning_effort: 'none', max_tokens: maxTokens, cache: {'no-cache': true, 'no-store': true}, messages}),
    });
    span.setAttribute('http.response.status_code', response.status);
    if (!response.ok) throw new Error('Gateway request failed');
    const reader = response.body.getReader();
    const chunks = [];
    let size = 0;
    try {
      while (true) {
        const {done, value} = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 131072) throw new Error('Gateway response too large');
        chunks.push(value);
      }
    } finally { await reader.cancel(); }
    const result = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    const message = result.choices?.[0]?.message;
    if (typeof message?.content !== 'string' || message.content.length > 16000 || message.tool_calls?.length ||
        result.choices[0].finish_reason === 'length' || message.content.includes(config.apiKey)) {
      throw new Error('Invalid gateway response');
    }
    span.setAttributes({
      'gen_ai.response.model': result.model,
      'llm.model_name': result.model || MODEL,
      'gen_ai.response.id': result.id,
      'gen_ai.usage.input_tokens': result.usage?.prompt_tokens,
      'gen_ai.usage.output_tokens': result.usage?.completion_tokens,
      'gen_ai.usage.cache_read.input_tokens': result.usage?.prompt_tokens_details?.cached_tokens ?? result.usage?.cache_read_input_tokens,
      'gen_ai.usage.cache_creation.input_tokens': result.usage?.cache_creation_input_tokens,
      'output.value': message.content,
      'output.mime_type': 'text/plain',
    });
    return message.content;
  }, {client: true});
}

module.exports = {MODEL, FALLBACKS, BASE_URL, createModelCaller};
