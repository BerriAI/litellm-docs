require('dotenv').config({path: '.env.local'});
const {answerQuestion, refusal} = require('./answer');
const {loadCorpus, readConfig} = require('./runtime');
const cases = require('./answer-cases.json');

async function main() {
  const config = readConfig(process.env);
  if (!config.apiKey) throw new Error('Set DOCS_AI_API_KEY in .env.local before running live checks');
  const corpus = await loadCorpus('build');
  let failures = 0;
  for (const {question, history = [], expect, contains} of cases) {
    const start = Date.now();
    try {
      const {status, body} = await answerQuestion({question, history, ...corpus, config, signal: AbortSignal.timeout(50000)});
      const passed = status === 200 && (expect === 'refuse'
        ? body.answer === refusal && body.sources.length === 0
        : body.sources.length > 0 && body.answer !== refusal && (!contains || new RegExp(contains, 'i').test(body.answer)));
      if (!passed) failures++;
      console.log(JSON.stringify({passed, expect, question, ms: Date.now() - start, ...body}));
    } catch {
      failures++;
      console.log(JSON.stringify({passed: false, expect, question, error: 'Request failed'}));
    }
  }
  console.log(`${cases.length - failures}/${cases.length} live answer checks passed`);
  if (failures) process.exitCode = 1;
}
main().catch(error => {console.error(error.message); process.exitCode = 1;});
