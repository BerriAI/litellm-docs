import {RESPONSE_SCHEMA, systemPrompt} from '../prompt.mjs';

const RETRYABLE_STATUS = new Set([408, 429]);

export class TranslateClient {
  constructor({baseUrl, apiKey, model, locale, glossary, fetchImpl, timeoutMs = 120000, backoffMs = [1000, 4000]}) {
    this.model = model;
    this.locale = locale;
    this.system = systemPrompt(locale, glossary);
    this.fetch = fetchImpl || globalThis.fetch;
    this.timeoutMs = timeoutMs;
    this.backoffMs = backoffMs;
    this.usage = {prompt_tokens: 0, completion_tokens: 0};
    let base = (baseUrl || '').replace(/\/+$/, '');
    if (!base.endsWith('/v1')) base += '/v1';
    this.url = `${base}/chat/completions`;
    this.apiKey = apiKey;
    this.callCount = 0;
  }

  // items: [{id, text}], extraUser: optional string appended for batch retry
  async translateBatch(items, extraUser) {
    const user = JSON.stringify(items.map(({id, text}) => ({id, text}))) + (extraUser ? `\n\n${extraUser}` : '');
    const body = {
      model: this.model,
      temperature: 0.2,
      response_format: {type: 'json_schema', json_schema: RESPONSE_SCHEMA},
      messages: [
        {role: 'system', content: this.system},
        {role: 'user', content: user},
      ],
    };
    const data = await this.#request(body);
    const content = data.choices?.[0]?.message?.content;
    if (data.usage) {
      this.usage.prompt_tokens += data.usage.prompt_tokens || 0;
      this.usage.completion_tokens += data.usage.completion_tokens || 0;
    }
    return {content, raw: data};
  }

  async #request(body) {
    let lastErr;
    for (let attempt = 0; attempt < 3; attempt++) {
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), this.timeoutMs);
      try {
        this.callCount++;
        const res = await this.fetch(this.url, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify(body),
          signal: ac.signal,
        });
        if (!res.ok) {
          const retryable = RETRYABLE_STATUS.has(res.status) || res.status >= 500;
          const text = await res.text().catch(() => '');
          const err = new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`);
          if (!retryable || attempt === 2) throw err;
          lastErr = err;
        } else {
          return await res.json();
        }
      } catch (e) {
        lastErr = e;
        if (attempt === 2) throw e;
        if (e && e.httpNonRetryable) throw e;
      } finally {
        clearTimeout(timer);
      }
      if (attempt < 2) await sleep(this.backoffMs[attempt] ?? 4000);
    }
    throw lastErr;
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
