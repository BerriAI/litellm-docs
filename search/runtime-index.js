const {serialize, deserialize} = require('node:v8');
const {createIndex} = require('./engine');

// This adapter is deliberately tied to MiniSearch 7.2.0's in-memory layout.
// Preserve its Maps and radix tree at build time instead of reconstructing them
// from JSON in the first request. Keep the portable JSON index for other clients.
const format = 'minisearch-7.2.0-runtime-v1';
const fields = ['_index', '_documentCount', '_documentIds', '_idToShortId', '_fieldIds',
  '_fieldLength', '_avgFieldLength', '_nextId', '_storedFields', '_dirtCount'];

function serializeRuntimeIndex(index) {
  if (require('../package.json').dependencies.minisearch !== '7.2.0') {
    throw new Error('Review the runtime index adapter before upgrading MiniSearch');
  }
  const collections = {};
  for (const [type, collection] of Object.entries(index.collections)) {
    collections[type] = {};
    for (const [name, search] of Object.entries(collection)) {
      if (!(search._index?._tree instanceof Map) || search._dirtCount !== 0 || search._currentVacuum) {
        throw new Error('Only a fresh MiniSearch index can be snapshotted');
      }
      collections[type][name] = Object.fromEntries(fields.map(field => [field, search[field]]));
    }
  }
  return serialize({format, collections});
}

function loadRuntimeIndex(buffer) {
  const data = deserialize(buffer);
  if (data.format !== format) throw new Error('Rebuild the runtime search index');
  const index = createIndex([]);
  for (const [type, collection] of Object.entries(index.collections)) {
    for (const [name, search] of Object.entries(collection)) {
      const saved = data.collections?.[type]?.[name];
      if (!saved || fields.some(field => !Object.hasOwn(saved, field)) || !(saved._index?._tree instanceof Map)) {
        throw new Error('Invalid runtime search index');
      }
      // V8 restores Maps natively but not user-defined prototypes. The empty
      // index supplies the current tokenizer/options and the two prototypes.
      Object.setPrototypeOf(saved._index, Object.getPrototypeOf(search._index));
      Object.assign(search, saved);
    }
  }
  return index;
}

module.exports = {serializeRuntimeIndex, loadRuntimeIndex};
