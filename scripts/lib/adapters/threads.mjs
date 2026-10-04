// Threads: 공개 페이지 og 태그 + 공개 oEmbed. 키워드 검색은 액세스 토큰이 있을 때만.
import { getJson, getText, BROWSER_UA } from '../http.mjs';
import { metaTag, stripHtml } from '../util.mjs';

export async function resolve(canon, sourceUrl, { log }) {
  const url = sourceUrl || canon;
  const out = { url, status: 'partial' };
  try {
    const html = await getText(url, { headers: { 'User-Agent': BROWSER_UA, 'Accept-Language': 'ko,en;q=0.8' } });
    const title = metaTag(html, 'og:title') || '';
    out.author = title.match(/\(@([^)]+)\)/)?.[1] || null;
    out.text = metaTag(html, 'og:description') || '';
    const img = metaTag(html, 'og:image');
    if (img) out.media = { kind: 'image', thumb: img };
    const ts = html.match(/"taken_at":(\d{10})/)?.[1];
    if (ts) out.publishedAt = new Date(+ts * 1000).toISOString();
    if (out.text) out.status = 'ok';
  } catch (e) { log(`threads 페이지: ${e.message}`); }
  if (!out.author || !out.text) {
    try {
      const o = await getJson(`https://graph.threads.net/v1.0/oembed?url=${encodeURIComponent(url)}`);
      out.author ||= o.author_name || null;
      out.text ||= stripHtml(o.html || '').replace(/View on Threads|Threads에서 보기/g, '').trim();
      if (out.text) out.status = 'ok';
    } catch (e) { log(`threads oEmbed: ${e.message}`); }
  }
  if (out.author) out.authorUrl = `https://www.threads.com/@${out.author}`;
  return out;
}

export async function discover(cfg, { env, accept, log }) {
  if (!env.THREADS_ACCESS_TOKEN) return [];
  const out = [];
  for (const kw of cfg.keywords || []) {
    try {
      const f = 'id,text,media_type,permalink,timestamp,username,thumbnail_url,media_url';
      const j = await getJson(`https://graph.threads.net/v1.0/keyword_search?q=${encodeURIComponent(kw)}&search_type=TOP&fields=${f}&access_token=${env.THREADS_ACCESS_TOKEN}`);
      for (const p of j.data || []) {
        const thumb = p.thumbnail_url || (p.media_type === 'IMAGE' ? p.media_url : null);
        if (!p.permalink || !accept(p.text || '', { media: thumb || (p.media_type === 'VIDEO' ? p.media_url : null) })) continue;
        out.push({ url: p.permalink, prefetched: {
          url: p.permalink, author: p.username, authorUrl: `https://www.threads.com/@${p.username}`,
          publishedAt: p.timestamp, text: p.text || '',
          media: thumb ? { kind: p.media_type === 'VIDEO' ? 'video' : 'image', thumb, video: p.media_type === 'VIDEO' ? p.media_url : null } : null,
          status: 'ok',
        } });
      }
    } catch (e) { log(`threads 검색 "${kw}": ${e.message}`); }
  }
  return out;
}
