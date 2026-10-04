#!/usr/bin/env node
// 로컬 전용 서버: 사이트를 띄우고, 화면에서 "지금 갱신"·"URL 추가"를 쓸 수 있게 하며,
// 켜져 있는 동안 정해진 간격으로 자동 갱신합니다.
//   npm run serve                 → http://127.0.0.1:5180
//   npm run serve -- --port=8080 --every=60   (분 단위, 0 이면 자동 갱신 끔)
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, normalize, extname, sep } from 'node:path';
import { ROOT, loadLog, appendInbox } from './lib/store.mjs';
import { runUpdate, isRunning } from './lib/pipeline.mjs';
import { canonicalUrl } from './lib/util.mjs';

const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split('=')[1] ?? d;
const PORT = Number(arg('port', 5180));
const EVERY_MIN = Number(arg('every', 180));

const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
// 밖으로 보여도 되는 경로만 엽니다. (.env, config, scripts 는 막음)
const PUBLIC = ['index.html', 'css', 'js', 'data/cases.js'];

const send = (res, code, body, type = 'application/json; charset=utf-8') => {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
};

async function readBody(req, limit = 10_000) {
  let s = '';
  for await (const chunk of req) { s += chunk; if (s.length > limit) throw new Error('too large'); }
  return s ? JSON.parse(s) : {};
}

const lines = [];
const onLog = (s) => { lines.push(`${new Date().toLocaleTimeString()} ${s}`); if (lines.length > 200) lines.shift(); console.log(s); };

function startUpdate(opts) {
  if (isRunning()) return false;
  runUpdate({ ...opts, onLog }).catch((e) => onLog(`오류: ${e.message}`));
  return true;
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    // 다른 사이트가 브라우저를 통해 API 를 부르지 못하게 Origin 검사
    if (req.method !== 'GET' && req.headers.origin && req.headers.origin !== `http://${req.headers.host}`) return send(res, 403, { error: 'forbidden' });

    if (url.pathname === '/api/status') {
      const log = await loadLog();
      return send(res, 200, { running: isRunning(), last: log.last || null, live: lines.slice(-30), autoEveryMin: EVERY_MIN });
    }
    if (url.pathname === '/api/update' && req.method === 'POST') {
      const b = await readBody(req);
      return send(res, 202, { started: startUpdate({ only: Array.isArray(b.only) ? b.only : undefined, refreshAll: !!b.refreshAll }) });
    }
    if (url.pathname === '/api/add' && req.method === 'POST') {
      const { url: u } = await readBody(req);
      if (typeof u !== 'string' || !/^https?:\/\//.test(u) || !canonicalUrl(u)) return send(res, 400, { error: 'Reddit / X / Threads / Instagram 게시물 주소만 받을 수 있습니다.' });
      await appendInbox(u.trim());
      const started = startUpdate({ only: ['inbox'] });
      return send(res, 202, { queued: true, started });
    }
    if (url.pathname.startsWith('/api/')) return send(res, 404, { error: 'not found' });

    // 정적 파일
    let rel = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html';
    rel = normalize(rel).split(sep).join('/');
    if (rel.startsWith('..') || !PUBLIC.some((p) => rel === p || rel.startsWith(p + '/'))) return send(res, 404, 'not found', 'text/plain');
    const file = join(ROOT, rel);
    if (!(await stat(file).catch(() => null))?.isFile()) return send(res, 404, 'not found', 'text/plain');
    return send(res, 200, await readFile(file), TYPES[extname(file)] || 'application/octet-stream');
  } catch (e) {
    return send(res, 500, { error: e.message });
  }
});

// 로컬에서만 접속되도록 127.0.0.1 에만 엽니다.
server.listen(PORT, '127.0.0.1', () => {
  console.log(`myshowroom → http://127.0.0.1:${PORT}`);
  if (EVERY_MIN > 0) {
    console.log(`켜져 있는 동안 ${EVERY_MIN}분마다 자동 갱신합니다.`);
    setInterval(() => startUpdate({}), EVERY_MIN * 60_000);
  }
});
