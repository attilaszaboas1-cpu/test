'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { WorkfrontClient } = require('./lib/workfront');
const { MockWorkfront } = require('./lib/mock');

// Minimal .env loader so there are no dependencies to install.
function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

function createBackend(env = process.env) {
  if (env.WF_MODE === 'mock' || !env.WF_DOMAIN || !env.WF_API_KEY) return new MockWorkfront();
  return new WorkfrontClient({ domain: env.WF_DOMAIN, apiKey: env.WF_API_KEY, version: env.WF_API_VERSION || 'v15.0' });
}

const PUBLIC = path.join(__dirname, 'public');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml' };
const ID = '([A-Za-z0-9]+)';

function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(body === undefined ? '' : JSON.stringify(body));
}

function readJson(req, limit = 64 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        reject(Object.assign(new Error('Request body too large'), { status: 413 }));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => {
      try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); }
      catch { reject(Object.assign(new Error('Invalid JSON'), { status: 400 })); }
    });
    req.on('error', reject);
  });
}

function serveStatic(req, res) {
  const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const file = path.normalize(path.join(PUBLIC, rel === '/' ? 'index.html' : rel));
  if (!file.startsWith(PUBLIC + path.sep)) return send(res, 403, { error: 'Forbidden' });
  fs.readFile(file, (err, data) => {
    if (err) return send(res, 404, { error: 'Not found' });
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
}

function createApp(backend, { pollSeconds = 30 } = {}) {
  const routes = [
    ['GET', /^\/api\/config$/, async () => ({
      mode: backend.mode, domain: backend.domain, pollSeconds,
      me: await backend.me().catch(() => null),
    })],
    ['GET', /^\/api\/projects$/, () => backend.listProjects()],
    ['GET', new RegExp(`^/api/projects/${ID}/tasks$`), (m) => backend.listTasks(m[1])],
    ['POST', new RegExp(`^/api/projects/${ID}/tasks$`), async (m, req) => backend.createTask(m[1], await readJson(req))],
    ['GET', /^\/api\/my-tasks$/, () => backend.listMyTasks()],
    ['GET', /^\/api\/users$/, () => backend.listUsers()],
    ['GET', /^\/api\/statuses$/, () => backend.listStatuses()],
    ['PATCH', new RegExp(`^/api/tasks/${ID}$`), async (m, req) => backend.updateTask(m[1], await readJson(req))],
    ['DELETE', new RegExp(`^/api/tasks/${ID}$`), async (m) => { await backend.deleteTask(m[1]); return null; }],
  ];

  return async (req, res) => {
    const { pathname } = new URL(req.url, 'http://x');
    if (!pathname.startsWith('/api/')) {
      if (req.method !== 'GET') return send(res, 405, { error: 'Method not allowed' });
      return serveStatic(req, res);
    }
    for (const [method, re, handler] of routes) {
      const m = re.exec(pathname);
      if (!m || method !== req.method) continue;
      try {
        const result = await handler(m, req);
        return result === null ? send(res, 204) : send(res, 200, result);
      } catch (err) {
        const status = err.status || 500;
        if (status >= 500) console.error(err);
        return send(res, status, { error: err.message || 'Something went wrong' });
      }
    }
    return send(res, 404, { error: 'Not found' });
  };
}

if (require.main === module) {
  loadEnv(path.join(__dirname, '.env'));
  const backend = createBackend();
  const port = Number(process.env.PORT) || 3000;
  const pollSeconds = Number(process.env.POLL_SECONDS) || 30;
  // Bind to localhost only: the server holds your Workfront API key.
  http.createServer(createApp(backend, { pollSeconds })).listen(port, '127.0.0.1', () => {
    const where = backend.mode === 'live' ? `connected to ${backend.domain}` : 'DEMO MODE (sample data, no Workfront connection)';
    console.log(`Workfront Board running at http://localhost:${port} — ${where}`);
  });
}

module.exports = { createApp, createBackend };
