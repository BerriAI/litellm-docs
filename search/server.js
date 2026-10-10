const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const {createReadStream} = require('node:fs');
const {createAskHandler, allowAI, send} = require('./api');
const {readConfig, loadCorpus} = require('./runtime');

function createHandler(options) {
  const ask = createAskHandler(options);
  const buildDir = path.resolve(options.config.buildDir || 'build');
  return async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Frame-Options', 'DENY');
    let pathname;
    try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
    catch { return send(res, 400, {error: 'Invalid URL'}); }
    if (pathname === '/api/docs/ask') return ask(req, res);
    if (!['GET', 'HEAD'].includes(req.method)) return send(res, 405, {error: 'Method not allowed'});
    if (pathname.split('/').some(part => part.startsWith('.'))) return send(res, 404, {error: 'Not found'});
    const requested = path.resolve(buildDir, `.${pathname}`);
    if (requested !== buildDir && !requested.startsWith(buildDir + path.sep)) return send(res, 404, {error: 'Not found'});
    for (const file of [requested, `${requested}.html`, path.join(requested, 'index.html')]) {
      try {
        const [realBuild, realFile] = await Promise.all([fs.realpath(buildDir), fs.realpath(file)]);
        if (!realFile.startsWith(realBuild + path.sep)) continue;
        const stat = await fs.stat(realFile);
        if (!stat.isFile()) continue;
        const types = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2'};
        res.writeHead(200, {'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Content-Length': stat.size, 'Cache-Control': 'no-cache'});
        if (req.method === 'HEAD') return res.end();
        createReadStream(file).on('error', () => res.destroy()).pipe(res);
        return;
      } catch (error) { if (error.code !== 'ENOENT' && error.code !== 'ENOTDIR') break; }
    }
    send(res, 404, {error: 'Not found'});
  };
}

async function start() {
  require('dotenv').config({path: '.env.local'});
  const port = Number(process.env.PORT || 3333);
  const buildDir = path.resolve(process.env.DOCS_BUILD_DIR || 'build');
  const config = readConfig(process.env, {buildDir, host: process.env.HOST || '127.0.0.1', origin: `http://localhost:${port}`});
  const corpus = await loadCorpus(buildDir);
  const server = http.createServer(createHandler({...corpus, config}));
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  server.listen(port, config.host, () => console.log(`Docs search ready at http://localhost:${port}`));
}
if (require.main === module) start().catch(() => {console.error('Cannot start docs search. Build the docs and check the server configuration.'); process.exitCode = 1;});
module.exports = {createHandler, allowAI};
