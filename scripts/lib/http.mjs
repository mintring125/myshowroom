// 호스트별 간격을 두고 요청하는 fetch 래퍼. 429/5xx 는 지수 백오프로 재시도합니다.
const lastHit = new Map();
let opts = { userAgent: 'myshowroom-updater/1.0', hostDelayMs: 1500, timeoutMs: 20000 };

export function configureHttp(o) { opts = { ...opts, ...o }; }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForHost(host) {
  // 같은 호스트에 대한 요청을 직렬화해 간격을 지킵니다.
  const prev = lastHit.get(host) || Promise.resolve(0);
  let release;
  const next = new Promise((r) => (release = r));
  lastHit.set(host, prev.then(() => next));
  const t = await prev;
  const gap = opts.hostDelays?.[host] ?? opts.hostDelayMs;
  const wait = Math.max(0, (t || 0) + gap - Date.now());
  if (wait) await sleep(wait);
  return () => release(Date.now());
}

export async function request(url, { headers = {}, method = 'GET', body, retries = 2, accept } = {}) {
  const host = new URL(url).host;
  for (let attempt = 0; ; attempt++) {
    const done = await waitForHost(host);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs);
    let res;
    try {
      res = await fetch(url, {
        method, body, signal: ctrl.signal, redirect: 'follow',
        headers: { 'User-Agent': opts.userAgent, ...(accept ? { Accept: accept } : {}), ...headers },
      });
    } catch (e) {
      done(); clearTimeout(timer);
      if (attempt < retries) { await sleep(1000 * 2 ** attempt); continue; }
      throw new Error(`${host}: ${e.name === 'AbortError' ? 'timeout' : e.message}`);
    }
    done(); clearTimeout(timer);
    if ((res.status === 429 || res.status >= 500) && attempt < retries) {
      const ra = Number(res.headers.get('retry-after'));
      await sleep(ra ? ra * 1000 : 2000 * 2 ** attempt);
      continue;
    }
    return res;
  }
}

export async function getText(url, o) {
  const res = await request(url, o);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.text();
}

export async function getJson(url, o) {
  const res = await request(url, { accept: 'application/json', ...o });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  const t = await res.text();
  try { return JSON.parse(t); } catch { throw new Error(`JSON 아님(차단 페이지일 수 있음): ${url}`); }
}

// 브라우저처럼 보이는 UA 가 필요한 공개 페이지(og 태그 읽기)용
export const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36';
