// Decode records independently of network chunk and UTF-8 character boundaries.
export async function* readLines(body) {
  const reader = body.getReader(), decoder = new TextDecoder();
  let pending = '';
  try {
    while (true) {
      const {value, done} = await reader.read();
      pending += done ? decoder.decode() : decoder.decode(value, {stream: true});
      if (pending.length > 262144) throw new Error('Stream record too large');
      let end;
      while ((end = pending.indexOf('\n')) !== -1) {
        yield pending.slice(0, end).replace(/\r$/, '');
        pending = pending.slice(end + 1);
      }
      if (done) {if (pending) yield pending; break;}
    }
  } finally { await reader.cancel(); reader.releaseLock(); }
}

export async function* readEvents(body) {
  let data = [];
  for await (const line of readLines(body)) {
    if (!line) {
      if (data.length) yield data.join('\n');
      data = [];
    } else if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''));
  }
  if (data.length) yield data.join('\n');
}

export async function readAnswer(response, onDelta) {
  if (!response.ok || !response.headers.get('content-type')?.includes('application/x-ndjson')) {
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Ask AI is unavailable.');
    return data;
  }
  for await (const line of readLines(response.body)) {
    if (!line) continue;
    const event = JSON.parse(line);
    if (event.type === 'delta' && typeof event.text === 'string') onDelta(event.text);
    else if (event.type === 'done') return event;
    else if (event.type === 'error') throw new Error(event.error);
    else throw new Error('Invalid answer stream.');
  }
  throw new Error('The answer was interrupted. Please try again.');
}
