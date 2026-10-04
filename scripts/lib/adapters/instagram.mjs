// Instagram: Meta oEmbed(앱 토큰 필요). 토큰이 없으면 링크만 저장합니다.
import { getJson } from '../http.mjs';

export async function resolve(canon, sourceUrl, { env }) {
  const url = sourceUrl || canon;
  if (!env.INSTAGRAM_APP_TOKEN) return { url, status: 'link-only' };
  const o = await getJson(`https://graph.facebook.com/v21.0/instagram_oembed?url=${encodeURIComponent(url)}&access_token=${encodeURIComponent(env.INSTAGRAM_APP_TOKEN)}`);
  return {
    url, author: o.author_name || null, authorUrl: o.author_name ? `https://www.instagram.com/${o.author_name}/` : null,
    text: o.title || '', media: o.thumbnail_url ? { kind: 'image', thumb: o.thumbnail_url } : null,
    status: 'ok',
  };
}

// 공개 검색 경로가 없어 자동 발견은 하지 않습니다. (inbox 로 추가)
export async function discover() { return []; }
