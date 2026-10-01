const {loadIndex, search} = require('../../../search/engine');
let indexPromise;
self.onmessage = async ({data: {id, query, indexUrl, category}}) => {
  try {
    if (!indexPromise) indexPromise = fetch(indexUrl, {cache: 'no-cache'})
      .then(response => {if (!response.ok) throw new Error('Index unavailable'); return response.text();})
      .then(loadIndex).catch(error => {indexPromise = null; throw error;});
    const index = await indexPromise;
    self.postMessage({id, results: search(index, query, {category})});
  } catch (_) {
    self.postMessage({id, error: 'Search could not load. Please try again.'});
  }
};
