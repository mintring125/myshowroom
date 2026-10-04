import { createHash } from 'node:crypto';

// ---------- URL ----------
export function detectPlatform(u) {
  let h;
  try { h = new URL(u).hostname.replace(/^www\.|^old\.|^m\.|^mobile\./, ''); } catch { return null; }
  if (h === 'reddit.com' || h === 'redd.it') return 'reddit';
  if (h === 'x.com' || h === 'twitter.com' || h === 'fxtwitter.com' || h === 'vxtwitter.com' || h === 'fixupx.com') return 'x';
  if (h === 'threads.net' || h === 'threads.com') return 'threads';
  if (h === 'instagram.com') return 'instagram';
  return null;
}

// 같은 게시물을 가리키는 여러 형태의 주소를 하나로 맞춥니다. (중복 제거 기준)
export function canonicalUrl(u) {
  const p = detectPlatform(u);
  const url = new URL(u);
  const seg = url.pathname.split('/').filter(Boolean);
  if (p === 'reddit') {
    const i = seg.indexOf('comments');
    if (i >= 0 && seg[i + 1]) return `https://www.reddit.com/comments/${seg[i + 1]}`;
    if (url.hostname.endsWith('redd.it') && seg[0]) return `https://www.reddit.com/comments/${seg[0]}`;
  }
  if (p === 'x') {
    const i = seg.indexOf('status');
    if (i >= 0 && seg[i + 1]) return `https://x.com/i/status/${seg[i + 1]}`;
  }
  if (p === 'threads') {
    const i = seg.findIndex((s) => s === 'post' || s === 't');
    if (i >= 0 && seg[i + 1]) return `https://www.threads.com/t/${seg[i + 1]}`;
  }
  if (p === 'instagram') {
    const i = seg.findIndex((s) => s === 'p' || s === 'reel' || s === 'reels' || s === 'tv');
    if (i >= 0 && seg[i + 1]) return `https://www.instagram.com/p/${seg[i + 1]}/`;
  }
  return null; // 지원하지 않는 형태 (프로필 링크 등)
}

export const idOf = (canon) => createHash('sha1').update(canon).digest('hex').slice(0, 12);

// ---------- 텍스트 ----------
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" };
export function decodeEntities(s = '') {
  return s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e) => {
    if (e[0] === '#') return String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : +e.slice(1));
    return ENT[e.toLowerCase()] ?? m;
  });
}
export function stripHtml(s = '') {
  return decodeEntities(s.replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n').replace(/<[^>]+>/g, ''))
    .replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}
export function excerpt(s = '', n = 280) {
  s = s.trim();
  if (s.length <= n) return s;
  const cut = s.slice(0, n);
  const sp = cut.lastIndexOf(' ');
  return (sp > n * 0.7 ? cut.slice(0, sp) : cut).trimEnd() + '…';
}
export function metaTag(html, prop) {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${prop.replace('.', '\\.')}["'][^>]*>`, 'i');
  const tag = html.match(re)?.[0];
  const c = tag?.match(/content=["']([^"']*)["']/i)?.[1];
  return c ? decodeEntities(c) : null;
}

export function detectLang(s = '') {
  const ko = (s.match(/[가-힣]/g) || []).length;
  const ja = (s.match(/[぀-ヿ]/g) || []).length;
  if (ja > 3 && ja >= ko / 3) return 'ja';
  if (ko > 3) return 'ko';
  return 'en';
}

export function detectModel(s = '') {
  const out = [];
  if (/opus\s*5\.5|오퍼스\s*5\.5/i.test(s)) out.push('Opus 5.5');
  if (/sonnet\s*5\.5|소넷\s*5\.5/i.test(s)) out.push('Sonnet 5.5');
  return out.join(' · ') || null;
}

export function applyTags(c, rules) {
  const hay = `${c.title || ''}\n${c.text || ''}`;
  const tags = new Set(c.tags || []);
  // 규칙은 문자열(대소문자 무시) 또는 { i: "...", cs: "..." } (cs 는 대소문자 구분: AR, VR, MR 같은 약어용)
  for (const [tag, rule] of Object.entries(rules)) {
    if (tag.startsWith('_')) continue;
    const r = typeof rule === 'string' ? { i: rule } : rule;
    if ((r.i && new RegExp(r.i, 'i').test(hay)) || (r.cs && new RegExp(r.cs).test(hay))) tags.add(tag);
  }
  if (c.lang === 'ko' || c.lang === 'ja') tags.add('region');
  return [...tags];
}

// 동시 실행 개수를 제한한 map
export async function pool(items, n, fn) {
  const out = []; let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); }
  }));
  return out;
}
