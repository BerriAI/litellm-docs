const {loadIndex, search} = require('../../../search/engine');
let indexPromise;
self.onmessage = async ({data: {id, query, indexUrl, type = 'all'}}) => {
  try {
    if (!indexPromise) indexPromise = fetch(indexUrl, {cache: 'no-cache'})
      .then(response => {if (!response.ok) throw new Error('Index unavailable'); return response.text();})
      .then(loadIndex).catch(error => {indexPromise = null; throw error;});
    const index = await indexPromise;
    self.postMessage({id, query, type, results: search(index, query, {type})});
  } catch (_) {
    self.postMessage({id, query, error: 'Search could not load. Please try again.'});
  }
};
