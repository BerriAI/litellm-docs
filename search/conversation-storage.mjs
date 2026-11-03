import {isContentUrl} from './content.js';

const legacyKey = 'litellm-docs-ask-ai';
const idKey = `${legacyKey}-id`;
let database, sessionId, current;

function getSessionId() {
  if (sessionId) return sessionId;
  try { sessionId = window.sessionStorage.getItem(idKey); } catch {}
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    try { window.sessionStorage.setItem(idKey, sessionId); } catch {}
  }
  return sessionId;
}

function openDatabase() {
  if (!database) database = new Promise(resolve => {
    try {
      const request = window.indexedDB.open(legacyKey, 1);
      request.onupgradeneeded = () => request.result.createObjectStore('conversations');
      request.onsuccess = () => {
        request.result.onversionchange = () => {request.result.close(); database = undefined;};
        resolve(request.result);
      };
      request.onerror = request.onblocked = () => resolve(null);
    } catch { resolve(null); }
  });
  return database;
}

async function transaction(mode, operation) {
  const db = await openDatabase();
  if (!db) return null;
  return new Promise(resolve => {
    try {
      const tx = db.transaction('conversations', mode);
      const request = operation(tx.objectStore('conversations'));
      tx.oncomplete = () => resolve({value: request.result});
      tx.onerror = tx.onabort = () => resolve(null);
    } catch { resolve(null); }
  });
}

export async function readConversation() {
  const id = getSessionId();
  const stored = await transaction('readonly', store => store.get(id));
  let legacy;
  try { legacy = JSON.parse(window.sessionStorage.getItem(legacyKey) || 'null'); } catch {}
  const value = [stored?.value, legacy, current].filter(value => value && typeof value === 'object')
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0];
  if (!value || typeof value !== 'object') return null;
  current = value;
  return {
    open: value.open === true,
    turns: (Array.isArray(value.turns) ? value.turns : []).filter(turn =>
      turn && typeof turn.question === 'string' && typeof turn.answer === 'string' && Array.isArray(turn.sources) &&
      turn.sources.every(source => source && isContentUrl(source.url))),
    traceContext: typeof value.traceContext === 'string' ? value.traceContext : undefined,
  };
}

export async function saveConversation(value) {
  const record = {...value, updatedAt: Math.max(Date.now(), (current?.updatedAt || 0) + 1)};
  current = record;
  const id = getSessionId();
  const saved = await transaction('readwrite', store => store.put(record, id));
  try {
    if (saved) {
      window.sessionStorage.removeItem(legacyKey);
      window.sessionStorage.setItem(idKey, id);
    } else window.sessionStorage.setItem(legacyKey, JSON.stringify(record));
  } catch { /* Keep the current chat usable when browser storage is unavailable. */ }
}
