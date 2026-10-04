// 참고 사이트에서 "어떤 원문 게시물이 소개됐는지"만 가져옵니다.
// 운영자가 쓴 제목·해설·미디어는 읽지 않고, 원문 URL·작성자·날짜·반응 수·분류 같은 사실 정보만 씁니다.
import { getText } from '../http.mjs';
import { canonicalUrl, decodeEntities } from '../util.mjs';

const MODEL_IDS = { 'claude-opus-5-5': 'Opus 5.5', 'claude-sonnet-5-5': 'Sonnet 5.5' };

function locs(xml) {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => decodeEntities(m[1].trim()));
}

function jsonLdNodes(html) {
  const out = [];
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try {
      const j = JSON.parse(m[1]);
      out.push(...(j['@graph'] || [j]));
    } catch { /* 깨진 JSON-LD 는 건너뜀 */ }
  }
  return out;
}

function countOf(stats = [], type) {
  const s = [].concat(stats).find((x) => String(x.interactionType || '').endsWith(type));
  return s ? Number(s.userInteractionCount) : undefined;
}

async function jsonldSitemap(site, { seenRefs, full, log, max = Infinity }) {
  const xml = await getText(site.sitemap);
  const all = locs(xml);
  const caseRe = new RegExp(site.casePattern), catRe = new RegExp(site.categoryPattern);
  const caseUrls = all.filter((u) => caseRe.test(u));
  const slugOf = (u) => u.split('/').filter(Boolean).pop();

  // 분류 페이지에서 사례별 소속 분류를 모읍니다. (페이지 수가 적어 매번 갱신)
  const cats = new Map();
  for (const u of all) {
    const id = u.match(catRe)?.[1];
    const mapped = id && site.categoryMap?.[id];
    if (!mapped) continue;
    try {
      const html = await getText(u);
      for (const m of html.matchAll(/data-case="([^"]+)"/g)) {
        if (!cats.has(m[1])) cats.set(m[1], new Set());
        cats.get(m[1]).add(mapped);
      }
    } catch (e) { log(`${site.name} 분류 ${id}: ${e.message}`); }
  }

  // 아직 모르는 사례 페이지만 열어 원문 링크를 찾습니다.
  const items = [];
  const pending = caseUrls.filter((u) => full || !seenRefs.has(u));
  const todo = pending.slice(0, max);
  if (pending.length > todo.length) log(`  ${site.name}: ${pending.length - todo.length}건은 다음 실행에서 확인`);
  for (const u of todo) {
    try {
      const html = await getText(u);
      const art = jsonLdNodes(html).find((n) => n.isBasedOn?.url);
      if (!art) { log(`${site.name}: 원문 링크 없음 ${u}`); continue; }
      const b = art.isBasedOn;
      const aboutId = String(art.about?.['@id'] || '').split('#')[1];
      items.push({
        url: b.url,
        ref: {
          site: site.id, name: site.name, url: u,
          categories: [...(cats.get(slugOf(u)) || [])],
          date: b.datePublished || art.datePublished || null,
          credit: (b.creditText || '').replace(/^@/, '') || null,
          metrics: { likes: countOf(b.interactionStatistic, 'LikeAction'), views: countOf(b.interactionStatistic, 'ViewAction') },
          model: MODEL_IDS[aboutId] || null,
        },
      });
    } catch (e) { log(`${site.name} ${u}: ${e.message}`); }
  }
  // 이미 아는 사례의 분류 변화도 돌려줍니다.
  const categoryUpdates = new Map(caseUrls.map((u) => [u, [...(cats.get(slugOf(u)) || [])]]));
  return { items, categoryUpdates };
}

async function linksPages(site, { log }) {
  const items = [];
  for (const page of site.pages || []) {
    try {
      const html = await getText(page);
      const urls = new Set([...html.matchAll(/href="(https?:\/\/[^"]+)"/g)].map((m) => decodeEntities(m[1])).filter((u) => canonicalUrl(u)));
      for (const url of urls) items.push({ url, ref: { site: site.id, name: site.name, url: page, categories: [] } });
    } catch (e) { log(`${site.name} ${page}: ${e.message}`); }
  }
  return { items, categoryUpdates: new Map() };
}

export async function collect(site, ctx) {
  if (site.type === 'jsonld-sitemap') return jsonldSitemap(site, ctx);
  if (site.type === 'links') return linksPages(site, ctx);
  throw new Error(`알 수 없는 참고 사이트 type: ${site.type}`);
}
