// X: 공식 API v2(토큰 있으면) → fxtwitter 공개 API(비공식) 순서.
import { getJson } from '../http.mjs';

const statusId = (canon) => canon.split('/status/')[1];

async function viaApi(id, env) {
  const f = 'tweet.fields=created_at,public_metrics,note_tweet&expansions=author_id,attachments.media_keys&user.fields=username&media.fields=type,url,preview_image_url,variants';
  const j = await getJson(`https://api.x.com/2/tweets/${id}?${f}`, { headers: { Authorization: `Bearer ${env.X_BEARER_TOKEN}` } });
  const t = j.data; if (!t) throw new Error('X API: 게시물 없음');
  const u = j.includes?.users?.[0];
  const m = j.includes?.media?.[0];
  const mp4 = m?.variants?.filter((v) => v.content_type === 'video/mp4').sort((a, b) => (b.bit_rate || 0) - (a.bit_rate || 0))[0]?.url;
  return {
    url: `https://x.com/${u?.username || 'i'}/status/${id}`,
    author: u?.username, authorUrl: u && `https://x.com/${u.username}`,
    publishedAt: t.created_at, text: t.note_tweet?.text || t.text,
    media: m ? { kind: m.type === 'photo' ? 'image' : 'video', thumb: m.url || m.preview_image_url, video: mp4 || null } : null,
    metrics: { likes: t.public_metrics?.like_count, views: t.public_metrics?.impression_count, comments: t.public_metrics?.reply_count },
    status: 'ok',
  };
}

async function viaFx(id) {
  const j = await getJson(`https://api.fxtwitter.com/i/status/${id}`);
  const t = j.tweet; if (!t) throw new Error(`fxtwitter: ${j.message || '게시물 없음'}`);
  const v = t.media?.videos?.[0];
  const p = t.media?.photos?.[0];
  const thumb = v?.thumbnail_url || p?.url || t.media?.all?.[0]?.thumbnail_url || null;
  return {
    url: t.url || `https://x.com/${t.author?.screen_name}/status/${id}`,
    author: t.author?.screen_name, authorUrl: t.author?.url,
    publishedAt: t.created_timestamp ? new Date(t.created_timestamp * 1000).toISOString() : null,
    text: t.raw_text?.text || t.text || '',
    media: thumb ? { kind: v ? 'video' : 'image', thumb, video: v?.url || null } : null,
    metrics: { likes: t.likes, views: t.views, comments: t.replies },
    status: 'ok',
  };
}

export async function resolve(canon, sourceUrl, { env, cfg }) {
  const id = statusId(canon);
  if (env.X_BEARER_TOKEN) { try { return await viaApi(id, env); } catch { /* fx 로 */ } }
  if (cfg.useFxtwitter !== false) return viaFx(id);
  return { url: sourceUrl || canon, status: 'link-only' };
}

export async function discover(cfg, { env, accept, log }) {
  if (!env.X_BEARER_TOKEN || !cfg.searchQuery) return [];
  try {
    const q = encodeURIComponent(cfg.searchQuery);
    const j = await getJson(`https://api.x.com/2/tweets/search/recent?query=${q}&max_results=50&tweet.fields=public_metrics,created_at&expansions=author_id&user.fields=username`,
      { headers: { Authorization: `Bearer ${env.X_BEARER_TOKEN}` } });
    const users = Object.fromEntries((j.includes?.users || []).map((u) => [u.id, u.username]));
    return (j.data || [])
      .filter((t) => (t.public_metrics?.like_count || 0) >= (cfg.minLikes || 0) && accept(t.text))
      .map((t) => ({ url: `https://x.com/${users[t.author_id] || 'i'}/status/${t.id}` }));
  } catch (e) { log(`x 검색: ${e.message}`); return []; }
}
