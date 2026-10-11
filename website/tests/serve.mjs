// A tiny static file server for the tests (no dependencies): node tests/serve.mjs [port]
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const port = Number(process.argv[2]) || 4791
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' }

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost')
  let file = path.normalize(path.join(root, decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname)))
  if (!file.startsWith(root) || file.includes(`${path.sep}node_modules${path.sep}`) || file.includes(`${path.sep}tests${path.sep}`)) { res.writeHead(403).end(); return }
  fs.readFile(file, (error, data) => {
    if (error) { res.writeHead(404, { 'content-type': types['.html'] }); res.end(fs.readFileSync(path.join(root, '404.html'))); return }
    res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' })
    res.end(data)
  })
}).listen(port, '127.0.0.1', () => console.log(`serving ${root} on http://127.0.0.1:${port}`))
