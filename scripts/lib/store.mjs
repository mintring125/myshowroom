import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const P = {
  db: join(ROOT, 'data', 'cases.json'),
  dbJs: join(ROOT, 'data', 'cases.js'),
  log: join(ROOT, 'data', 'update-log.json'),
  inbox: join(ROOT, 'data', 'inbox.txt'),
  config: join(ROOT, 'config', 'sources.json'),
  env: join(ROOT, '.env'),
};

async function readJson(file, fallback) {
  try { return JSON.parse(await readFile(file, 'utf8')); } catch (e) { if (e.code === 'ENOENT') return fallback; throw e; }
}

// 중간에 끊겨도 파일이 깨지지 않도록 임시 파일에 쓰고 이름을 바꿉니다.
async function atomicWrite(file, text) {
  await mkdir(dirname(file), { recursive: true });
  const tmp = file + '.tmp';
  await writeFile(tmp, text, 'utf8');
  await rename(tmp, file);
}

export const loadConfig = () => readJson(P.config, {});
export const loadDb = () => readJson(P.db, { version: 1, updatedAt: null, cases: [] });

export async function saveDb(db) {
  db.updatedAt = new Date().toISOString();
  db.cases.sort((a, b) => (b.publishedAt || b.addedAt || '').localeCompare(a.publishedAt || a.addedAt || ''));
  const json = JSON.stringify(db, null, 1);
  await atomicWrite(P.db, json);
  // file:// 로 열어도 읽히도록 스크립트 형태로도 내보냅니다.
  await atomicWrite(P.dbJs, `// 자동 생성 파일입니다. 직접 고치지 말고 npm run update 를 실행하세요.\nwindow.CASES_DB = ${json};\n`);
}

export async function saveLog(entry) {
  const log = await readJson(P.log, { runs: [] });
  log.last = entry;
  log.runs = [entry, ...log.runs].slice(0, 30);
  await atomicWrite(P.log, JSON.stringify(log, null, 1));
}
export const loadLog = () => readJson(P.log, { runs: [] });

export async function loadEnv() {
  const env = { ...process.env };
  try {
    for (const line of (await readFile(P.env, 'utf8')).split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m && m[2] && !env[m[1]]) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch {}
  return env;
}

// ---------- inbox ----------
export async function readInbox() {
  try {
    return (await readFile(P.inbox, 'utf8')).split(/\r?\n/).map((s) => s.trim()).filter((s) => s && !s.startsWith('#'));
  } catch { return []; }
}
export async function appendInbox(url) {
  let text = '';
  try { text = await readFile(P.inbox, 'utf8'); } catch {}
  if (!text.split(/\r?\n/).some((l) => l.trim() === url)) await atomicWrite(P.inbox, text.replace(/\s*$/, '\n') + url + '\n');
}
// 처리에 성공한 URL 만 지우고 실패한 것은 남겨 다음 실행에 다시 시도합니다.
export async function removeFromInbox(urls) {
  const set = new Set(urls);
  let text = '';
  try { text = await readFile(P.inbox, 'utf8'); } catch { return; }
  await atomicWrite(P.inbox, text.split(/\r?\n/).filter((l) => !set.has(l.trim())).join('\n').replace(/\s*$/, '\n'));
}
