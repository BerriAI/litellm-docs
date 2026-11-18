function parseToolAnswer(raw) {
  const value = JSON.parse(raw);
  if (!value || Array.isArray(value) || Object.keys(value).length !== 1 ||
      typeof value.answer !== 'string' || !value.answer.trim()) throw new Error('Invalid answer tool arguments');
  return value.answer;
}

// Decode only the answer string while tool arguments arrive. Final JSON validation
// still runs before completion; partial escapes wait for the next network chunk.
function createToolAnswerReader() {
  let buffer = '', offset = 0, opened = false, closed = false, decoded = '', sent = 0;
  const escapes = {'"': '"', '\\': '\\', '/': '/', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t'};
  return {
    push(part) {
      buffer += part;
      if (!opened) {
        const prefix = /^\s*\{\s*"answer"\s*:\s*"/.exec(buffer);
        if (!prefix) return '';
        offset = prefix[0].length; opened = true;
      }
      while (offset < buffer.length && !closed) {
        const char = buffer[offset];
        if (char === '"') {closed = true; offset++; break;}
        if (char === '\\') {
          if (offset + 1 === buffer.length) break;
          const escape = buffer[offset + 1];
          if (escape === 'u') {
            if (offset + 6 > buffer.length) break;
            const hex = buffer.slice(offset + 2, offset + 6);
            if (!/^[a-f\d]{4}$/i.test(hex)) throw new Error('Invalid answer escape');
            decoded += String.fromCharCode(parseInt(hex, 16)); offset += 6;
          } else {
            if (!Object.hasOwn(escapes, escape)) throw new Error('Invalid answer escape');
            decoded += escapes[escape]; offset += 2;
          }
        } else {
          if (char.charCodeAt(0) < 32) throw new Error('Invalid answer character');
          decoded += char; offset++;
        }
      }
      const end = /[\uD800-\uDBFF]$/.test(decoded) ? decoded.length - 1 : decoded.length;
      const text = decoded.slice(sent, end); sent = end;
      return text;
    },
    finish() {
      const answer = parseToolAnswer(buffer);
      if (opened && (!closed || !/^\s*}\s*$/.test(buffer.slice(offset)) || decoded !== answer)) {
        throw new Error('Invalid answer tool arguments');
      }
      return answer;
    },
    get emittedLength() {return sent;},
  };
}

module.exports = {createToolAnswerReader, parseToolAnswer};
