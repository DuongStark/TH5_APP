// HTTP server local bằng Node, không cần cài thêm thư viện hay chạy Metro.
const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs/promises');
const publicRoot = __dirname;
const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
};

function createWebServer() {
  return http.createServer(async (request, response) => {
    if (!['GET', 'HEAD'].includes(request.method)) {
      response.writeHead(405, { Allow: 'GET, HEAD' }).end('Method not allowed');
      return;
    }
    try {
      const url = new URL(request.url, 'http://localhost');
      const pathname = decodeURIComponent(url.pathname);
      if (pathname.includes('\0')) {
        response.writeHead(400).end('Bad request');
        return;
      }
      const filename = path.resolve(
        publicRoot,
        '.' + (pathname === '/' ? '/index.html' : pathname),
      );
      // Chỉ phục vụ thư mục web, không cho đọc docs-local hoặc file ngoài dự án.
      if (!filename.startsWith(publicRoot + path.sep)) {
        response.writeHead(403).end('Forbidden');
        return;
      }
      const actualPath = await fs.realpath(filename);
      if (!actualPath.startsWith(publicRoot + path.sep)) {
        response.writeHead(403).end('Forbidden');
        return;
      }
      const stats = await fs.stat(actualPath);
      if (!stats.isFile()) {
        response.writeHead(404).end('Not found');
        return;
      }
      const data = await fs.readFile(actualPath);
      response.writeHead(200, {
        'Content-Type':
          contentTypes[path.extname(filename)] || 'application/octet-stream',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'same-origin',
      });
      response.end(request.method === 'HEAD' ? undefined : data);
    } catch (error) {
      response
        .writeHead(error instanceof URIError ? 400 : 404)
        .end('Not found');
    }
  });
}
module.exports = { createWebServer };
if (require.main === module) {
  const server = createWebServer();
  const port = Number(process.env.PORT || 4173);
  server.on('error', error => {
    console.error(
      error.code === 'EADDRINUSE'
        ? `Cổng ${port} đang được sử dụng. Mở trang đang chạy hoặc đổi PORT.`
        : error.message,
    );
    process.exitCode = 1;
  });
  server.listen(port, '127.0.0.1', () => {
    console.log(`Mây — một điện thoại: http://localhost:${port}/`);
    console.log(`Mây — hai điện thoại: http://localhost:${port}/dual.html`);
  });
}
