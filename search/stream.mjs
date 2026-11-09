// SSE framing shared by the upstream gateway reader and the browser client.
// A network chunk can end anywhere, including inside a UTF-8 character or CRLF.
export async function* readEvents(body, signal) {
  if (!body) throw new Error('Missing response stream');
  const reader = body.getReader(), decoder = new TextDecoder();
  let buffer = '', event = 'message', data = [];
  const abort = () => {reader.cancel().catch(() => {});};
  signal?.addEventListener('abort', abort, {once: true});
  function line(value) {
    if (!value) {
      const message = data.length ? {event, data: data.join('\n')} : null;
      event = 'message'; data = [];
      return message;
    }
    if (value.startsWith(':')) return;
    const colon = value.indexOf(':'), field = colon < 0 ? value : value.slice(0, colon);
    const content = colon < 0 ? '' : value.slice(colon + 1).replace(/^ /, '');
    if (field === 'event') event = content;
    if (field === 'data') data.push(content);
  }
  try {
    signal?.throwIfAborted();
    while (true) {
      const {value, done} = await reader.read();
      signal?.throwIfAborted();
      buffer += done ? decoder.decode() : decoder.decode(value, {stream: true});
      let newline;
      while ((newline = buffer.search(/[\r\n]/)) >= 0) {
        if (!done && buffer[newline] === '\r' && newline === buffer.length - 1) break;
        const width = buffer[newline] === '\r' && buffer[newline + 1] === '\n' ? 2 : 1;
        const message = line(buffer.slice(0, newline));
        buffer = buffer.slice(newline + width);
        if (message) yield message;
      }
      if (done) break;
    }
    // An unterminated frame is not a completed event. Callers require a terminal event.
  } finally {
    signal?.removeEventListener('abort', abort);
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

export async function readAnswer(response, onEvent, signal) {
  if (!response.ok || !response.headers.get('content-type')?.includes('text/event-stream')) {
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'Ask AI is unavailable.');
    if (typeof result.answer !== 'string' || !Array.isArray(result.sources)) throw new Error('Invalid answer response.');
    return result;
  }
  for await (const frame of readEvents(response.body, signal)) {
    let data;
    try {data = JSON.parse(frame.data);} catch {throw new Error('Invalid answer response. Please retry.');}
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Invalid answer response. Please retry.');
    if (frame.event === 'error') throw new Error(data.error || 'The answer was interrupted. Please retry.');
    if (frame.event === 'done') {
      if (typeof data.answer !== 'string' || !Array.isArray(data.sources)) throw new Error('Invalid answer response.');
      return data;
    }
    if ((frame.event === 'answer-delta' && typeof data.text !== 'string') ||
      (frame.event === 'sources' && !Array.isArray(data.sources)) ||
      (frame.event === 'status' && typeof data.message !== 'string')) throw new Error('Invalid answer response. Please retry.');
    await onEvent(frame.event, data);
  }
  throw new Error('The answer was interrupted. Please retry.');
}
