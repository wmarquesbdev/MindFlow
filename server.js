const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { getNews } = require('./news');
const { createStateStore, MAX_STATE_BYTES } = require('./storage');
const { MAX_DOCUMENT_BYTES, saveDocument, readDocument } = require('./documents');
const JSZip = require('jszip');

const HOST = '127.0.0.1';
const PORT = Number(process.env.MINDFLOW_PORT) || 3000;
const ROOT = __dirname;
const store = createStateStore();
const TYPES = { '.css': 'text/css; charset=utf-8', '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp' };
const PUBLIC_FILES = new Set(['index.html', 'app.js', 'visuals.js', 'styles.css', 'manifest.webmanifest']);

function requestedFile(url = '/') {
  try {
    const pathname = decodeURIComponent(new URL(url, `http://${HOST}`).pathname);
    const relative = pathname === '/' ? 'index.html' : pathname.replace(/^[/\\]+/, '');
    if (!PUBLIC_FILES.has(relative) && !/^assets\/[a-z0-9_./-]+$/i.test(relative)) return null;
    if (relative.split(/[\\/]/).some(part => part === '..' || part.startsWith('.'))) return null;
    const file = path.resolve(ROOT, relative);
    return file.startsWith(`${ROOT}${path.sep}`) ? file : null;
  } catch { return null; }
}

function localOrigin(origin) { return /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin || ''); }
function sendJson(response, status, payload, head = false) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  response.end(head ? undefined : JSON.stringify(payload));
}
function readJson(request) {
  return new Promise((resolve, reject) => {
    let size = 0;
    let exceeded = false;
    const chunks = [];
    request.on('data', chunk => {
      if (exceeded) return;
      size += chunk.length;
      if (size > MAX_STATE_BYTES) { exceeded = true; reject(Object.assign(new Error('Backup grande demais.'), { status: 413 })); return; }
      chunks.push(chunk);
    });
    request.on('end', () => {
      if (exceeded) return;
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { reject(Object.assign(new Error('JSON inválido.'), { status: 400 })); }
    });
    request.on('error', reject);
  });
}
function readBinary(request) {
  return new Promise((resolve, reject) => {
    let size = 0, exceeded = false;
    const chunks = [];
    request.on('data', chunk => {
      if (exceeded) return;
      size += chunk.length;
      if (size > MAX_DOCUMENT_BYTES) { exceeded = true; reject(Object.assign(new Error('Documento maior que 12 MB.'), { status: 413 })); return; }
      chunks.push(chunk);
    });
    request.on('end', () => { if (!exceeded) resolve(Buffer.concat(chunks)); });
    request.on('error', reject);
  });
}

const server = http.createServer(async (request, response) => {
  const host = request.headers.host || '';
  if (!/^(localhost|127\.0\.0\.1):\d+$/.test(host)) { response.writeHead(403); response.end(); return; }
  let address;
  try { address = new URL(request.url, `http://${host}`); } catch { response.writeHead(400); response.end(); return; }

  if (address.pathname.startsWith('/api/')) {
    const origin = request.headers.origin;
    if (origin && !localOrigin(origin)) { sendJson(response, 403, { error: 'origin_not_allowed' }); return; }
    if (origin) { response.setHeader('Access-Control-Allow-Origin', origin); response.setHeader('Vary', 'Origin'); }
    if (request.method === 'OPTIONS') {
      response.writeHead(204, { 'Access-Control-Allow-Methods': 'GET, HEAD, POST, PUT, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, X-Document-Name', 'Access-Control-Max-Age': '600' });
      response.end(); return;
    }
    if (address.pathname === '/api/health' && ['GET', 'HEAD'].includes(request.method)) { sendJson(response, 200, { app: 'MindFlow', api: 1 }, request.method === 'HEAD'); return; }
    if (address.pathname === '/api/storage-info' && ['GET', 'HEAD'].includes(request.method)) {
      try { sendJson(response, 200, store.info(), request.method === 'HEAD'); }
      catch (error) { sendJson(response, 500, { error: 'storage_unavailable', message: error.message }); }
      return;
    }
    if (address.pathname === '/api/backup.zip' && ['GET', 'HEAD'].includes(request.method)) {
      try {
        const saved = store.read();
        if (!saved) { sendJson(response, 404, { error: 'no_saved_state' }); return; }
        const zip = new JSZip();
        zip.file('state.json', JSON.stringify(saved));
        zip.file('LEIA-ME.txt', 'Backup completo do MindFlow. Para restaurar, feche o aplicativo e copie state.json e a pasta documents para a pasta de dados indicada em Personalizar. Guarde este ZIP em local privado; não é criptografado.');
        let total = 0;
        for (const item of saved.state.finance?.documents || []) {
          const document = readDocument(item.id);
          if (!document) continue;
          total += fs.statSync(document.file).size;
          if (total > 80 * 1024 * 1024) { sendJson(response, 413, { error: 'backup_too_large', message: 'Documentos acima de 80 MB. Copie a pasta de dados manualmente.' }); return; }
          zip.file(`documents/${path.basename(document.file)}`, fs.readFileSync(document.file));
        }
        response.writeHead(200, { 'Content-Type': 'application/zip', 'Content-Disposition': 'attachment; filename="mindflow-backup-completo.zip"', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' });
        response.end(request.method === 'HEAD' ? undefined : await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 3 } }));
      } catch (error) { sendJson(response, 500, { error: 'backup_unavailable', message: error.message }); }
      return;
    }
    if (address.pathname === '/api/state') {
      try {
        if (['GET', 'HEAD'].includes(request.method)) { const saved = store.read(); sendJson(response, 200, saved || { revision: null, state: null }, request.method === 'HEAD'); return; }
        if (request.method === 'PUT') {
          if (!String(request.headers['content-type'] || '').startsWith('application/json')) { sendJson(response, 415, { error: 'json_required' }); return; }
          const body = await readJson(request);
          if (!body || (body.revision !== null && typeof body.revision !== 'string') || !body.state || typeof body.state !== 'object' || Array.isArray(body.state)) { sendJson(response, 400, { error: 'invalid_state' }); return; }
          const result = store.write(body.state, body.revision);
          sendJson(response, result.conflict ? 409 : 200, result.conflict ? { error: 'conflict', revision: result.current?.revision } : { revision: result.revision });
          return;
        }
        sendJson(response, 405, { error: 'method_not_allowed' }); return;
      } catch (error) { sendJson(response, error.status || 500, { error: 'storage_unavailable', message: error.message }); return; }
    }
    if (address.pathname === '/api/documents' && request.method === 'POST') {
      try {
        const type = String(request.headers['content-type'] || '').split(';')[0];
        const file = await saveDocument(await readBinary(request), type, decodeURIComponent(String(request.headers['x-document-name'] || 'Documento')));
        sendJson(response, 201, file);
      } catch (error) { sendJson(response, error.status || 500, { error: 'document_unavailable', message: error.message }); }
      return;
    }
    if (address.pathname.startsWith('/api/documents/') && ['GET', 'HEAD'].includes(request.method)) {
      const document = readDocument(address.pathname.slice('/api/documents/'.length));
      if (!document) { sendJson(response, 404, { error: 'not_found' }); return; }
      response.writeHead(200, { 'Content-Type': document.type, 'Content-Disposition': 'inline', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox" });
      if (request.method === 'HEAD') response.end(); else fs.createReadStream(document.file).pipe(response);
      return;
    }
    if (address.pathname === '/api/news' && ['GET', 'HEAD'].includes(request.method)) {
      try { const payload = await getNews(address.searchParams.get('topic')); sendJson(response, payload.error ? 503 : 200, payload, request.method === 'HEAD'); }
      catch { sendJson(response, 503, { error: 'news_unavailable', articles: [] }); }
      return;
    }
    sendJson(response, 404, { error: 'not_found' }); return;
  }

  if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405, { Allow: 'GET, HEAD' }); response.end(); return; }
  const file = requestedFile(request.url);
  if (!file) { response.writeHead(404); response.end('Arquivo não encontrado.'); return; }
  fs.readFile(file, (error, content) => {
    if (error) { response.writeHead(error.code === 'ENOENT' ? 404 : 500); response.end('Arquivo indisponível.'); return; }
    response.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: http:; connect-src 'self' http://127.0.0.1:3000; object-src 'none'; base-uri 'self'; frame-ancestors 'none'", 'Cache-Control': file.includes(`${path.sep}assets${path.sep}`) ? 'public, max-age=86400' : 'no-cache' });
    response.end(request.method === 'HEAD' ? undefined : content);
  });
});

if (require.main === module) {
  server.on('error', error => { console.error(error.code === 'EADDRINUSE' ? `A porta ${PORT} já está em uso. Feche o outro servidor ou defina MINDFLOW_PORT.` : error.message); process.exitCode = 1; });
  server.listen(PORT, HOST, () => console.log(`MindFlow disponível em http://${HOST}:${PORT}\nOs dados ficam salvos neste PC. Mantenha este terminal aberto.`));
}

module.exports = { server, requestedFile, store };
