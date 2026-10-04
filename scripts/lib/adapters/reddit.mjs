// Reddit: OAuth(있으면) → 게시물 RSS → oEmbed 순서로 내려가며 정보를 받습니다.
import { request, getJson, getText } from '../http.mjs';
import { stripHtml, decodeEntities } from '../util.mjs';

let tokenCache = null;
async function token(env) {
  if (!env.REDDIT_CLIENT_ID || !env.REDDIT_CLIENT_SECRET) return null;
  if (tokenCache && tokenCache.exp > Date.now() + 60_000) return tokenCache.value;
  const res = await request('https://www.reddit.com/api/v1/access_token', {
    method: 'POST', body: 'grant_type=client_credentials', retries: 1,
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${env.REDDIT_CLIENT_ID}:${env.REDDIT_CLIENT_SECRET}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });
  if (!res.ok) throw new Error(`Reddit 토큰 발급 실패 ${res.status}`);
  const j = await res.json();
  tokenCache = { value: j.access_token, exp: Date.now() + j.expires_in * 1000 };
  return tokenCache.value;
}

const postId = (canon) => canon.split('/comments/')[1];

function fromApi(d) {
  const img = d.preview?.images?.[0]?.source?.url || (d.thumbnail?.startsWith('http') ? d.thumbnail : null);
  return {
    url: `https://www.reddit.com${d.permalink}`,
    author: d.author, authorUrl: `https://www.reddit.com/user/${d.author}`,
    publishedAt: new Date(d.created_utc * 1000).toISOString(),
    title: d.title, text: d.selftext || '', where: `r/${d.subreddit}`,
    media: img ? { kind: d.is_video ? 'video' : 'image', thumb: decodeEntities(img) } : null,
    metrics: { score: d.score, comments: d.num_comments },
  };
}

function parseAtomEntries(xml) {
  return xml.split('<entry>').slice(1).map((e) => {
    const g = (re) => e.match(re)?.[1];
    const content = decodeEntities(g(/<content[^>]*>([\s\S]*?)<\/content>/) || '');
    const md = content.match(/<div class="md">([\s\S]*?)<\/div>/)?.[1];
    return {
      id: g(/<id>([^<]+)<\/id>/),
      url: decodeEntities(g(/<link href="([^"]+)"/) || ''),
      author: g(/<name>\/u\/([^<]+)<\/name>/),
      publishedAt: g(/<published>([^<]+)<\/published>/) || g(/<updated>([^<]+)<\/updated>/),
      title: decodeEntities(g(/<title>([\s\S]*?)<\/title>/) || ''),
      text: md ? stripHtml(md) : '',
      where: g(/<category term="([^"]+)"/) ? 'r/' + g(/<category term="([^"]+)"/) : null,
      thumb: decodeEntities(g(/<media:thumbnail url="([^"]+)"/) || content.match(/<img src="([^"]+)"/)?.[1] || '') || null,
    };
  });
}

export async function resolve(canon, sourceUrl, { env }) {
  const id = postId(canon);
  const tok = await token(env).catch(() => null);
  if (tok) {
    const j = await getJson(`https://oauth.reddit.com/by_id/t3_${id}?raw_json=1`, { headers: { Authorization: `Bearer ${tok}` } });
    const d = j.data?.children?.[0]?.data;
    if (d) return { ...fromApi(d), status: 'ok' };
  }
  try {
    const xml = await getText(`https://www.reddit.com/comments/${id}/.rss`, { accept: 'application/atom+xml' });
    const e = parseAtomEntries(xml).find((x) => x.id === `t3_${id}`);
    if (e && e.title) {
      return {
        url: e.url || sourceUrl, author: e.author, authorUrl: e.author && `https://www.reddit.com/user/${e.author}`,
        publishedAt: e.publishedAt, title: e.title, text: e.text, where: e.where,
        media: e.thumb ? { kind: 'image', thumb: e.thumb } : null, status: 'ok',
      };
    }
  } catch { /* RSS 가 막히면 oEmbed 로 */ }
  const o = await getJson(`https://www.reddit.com/oembed?url=${encodeURIComponent(sourceUrl || canon)}`);
  return { url: sourceUrl || canon, author: o.author_name, title: o.title ? decodeEntities(o.title) : '', status: 'partial' };
}

export async function discover(cfg, { env, accept, log }) {
  const out = [];
  const tok = await token(env).catch((e) => { log(`reddit: ${e.message}`); return null; });
  for (const sub of cfg.subreddits || []) {
    try {
      if (tok && cfg.searchQuery) {
        const q = encodeURIComponent(cfg.searchQuery);
        const j = await getJson(`https://oauth.reddit.com/r/${sub}/search?q=${q}&restrict_sr=1&sort=new&t=week&limit=50&raw_json=1`, { headers: { Authorization: `Bearer ${tok}` } });
        for (const { data: d } of j.data?.children || []) {
          if (d.score >= (cfg.minScore || 0) && accept(`${d.title}\n${d.selftext}`)) out.push({ url: `https://www.reddit.com${d.permalink}`, prefetched: { ...fromApi(d), status: 'ok' } });
        }
      } else {
        const xml = await getText(`https://www.reddit.com/r/${sub}/new/.rss?limit=50`, { accept: 'application/atom+xml' });
        for (const e of parseAtomEntries(xml)) {
          if (!e.url || !accept(`${e.title}\n${e.text}`)) continue;
          out.push({ url: e.url, prefetched: {
            url: e.url, author: e.author, authorUrl: e.author && `https://www.reddit.com/user/${e.author}`, publishedAt: e.publishedAt,
            title: e.title, text: e.text, where: e.where, media: e.thumb ? { kind: 'image', thumb: e.thumb } : null, status: 'ok',
          } });
        }
      }
    } catch (e) { log(`reddit r/${sub}: ${e.message}`); }
  }
  return out;
}
