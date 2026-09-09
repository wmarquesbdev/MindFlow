const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const HOST = '127.0.0.1';
const PORT = 3000;
const ROOT = __dirname;
const TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml'
};

function requestedFile(requestUrl = '/') {
  try {
    const pathname = decodeURIComponent(new URL(requestUrl, `http://${HOST}`).pathname);
    const relative = pathname === '/' ? 'index.html' : pathname.replace(/^[/\\]+/, '');
    const file = path.resolve(ROOT, relative);
    return file.startsWith(`${ROOT}${path.sep}`) ? file : null;
  } catch {
    return null;
  }
}

const server = http.createServer((request, response) => {
  if (!['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(405, { Allow: 'GET, HEAD' });
    response.end('Método não permitido.');
    return;
  }

  const file = requestedFile(request.url);
  if (!file) {
    response.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Caminho inválido.');
    return;
  }

  fs.readFile(file, (error, content) => {
    if (error) {
      const status = error.code === 'ENOENT' ? 404 : 500;
      response.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end(status === 404 ? 'Arquivo não encontrado.' : 'Erro ao carregar o arquivo.');
      return;
    }
    response.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    response.end(request.method === 'HEAD' ? undefined : content);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`MindFlow disponível em http://${HOST}:${PORT}`);
});
