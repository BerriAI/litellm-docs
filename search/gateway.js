const MODEL = 'anthropic/claude-haiku-5-5';
const FALLBACKS = ['openai/gpt-6-luna', 'openai/gpt-6.1-sol'];
const BASE_URL = 'https://gateway.litellm-sandbox.ai';

function createModelCaller({config, signal, fetchImpl = fetch}) {
  const endpoint = new URL(`${(config.baseUrl || BASE_URL).replace(/\/$/, '')}/chat/completions`);
  if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password || endpoint.search || endpoint.hash) {
    throw new Error('Invalid gateway configuration');
  }
  return async (system, data, maxTokens, timeout) => {
    const {documentation, ...questionData} = data;
    const messages = [
      {role: 'system', content: [{type: 'text', text: system, cache_control: {type: 'ephemeral'}}]},
      ...(documentation ? [{role: 'user', content: [{type: 'text', text: JSON.stringify({documentation}), cache_control: {type: 'ephemeral'}}]}] : []),
      {role: 'user', content: JSON.stringify(questionData)},
    ];
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
    return message.content;
  };
}

module.exports = {MODEL, FALLBACKS, BASE_URL, createModelCaller};
