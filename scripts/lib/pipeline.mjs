// 수집 파이프라인: 후보 모으기 → 중복 제거 → 원문 해석 → 병합 → 저장
import { configureHttp } from './http.mjs';
import { loadConfig, loadDb, saveDb, saveLog, loadEnv, readInbox, removeFromInbox } from './store.mjs';
import { canonicalUrl, detectPlatform, idOf, excerpt, detectLang, detectModel, applyTags, pool } from './util.mjs';
import * as reddit from './adapters/reddit.mjs';
import * as x from './adapters/x.mjs';
import * as threads from './adapters/threads.mjs';
import * as instagram from './adapters/instagram.mjs';
import * as reference from './adapters/reference.mjs';

const ADAPTERS = { reddit, x, threads, instagram };
const ALL_STAGES = ['refs', 'reddit', 'x', 'threads', 'instagram', 'inbox'];

let running = null;
export const isRunning = () => !!running;

/**
 * @param {object} o
 * @param {string[]} [o.only]   실행할 단계 (refs, reddit, x, threads, instagram, inbox)
 * @param {string[]} [o.urls]   이 URL 들만 처리 (--add)
 * @param {boolean} [o.full]    참고 사이트 사례 페이지를 전부 다시 읽기
 * @param {boolean} [o.refreshAll] 기존 기록을 모두 다시 해석
 * @param {number} [o.max]      이번 실행에서 해석할 최대 개수
 * @param {(s:string)=>void} [o.onLog]
 */
export function runUpdate(o = {}) {
  if (running) return running;
  running = doRun(o).finally(() => { running = null; });
  return running;
}

async function doRun({ only, urls, full = false, refreshAll = false, max, onLog = console.log } = {}) {
  const started = Date.now();
  const messages = [];
  const log = (s) => { messages.push(s); onLog(s); };
  const cfg = await loadConfig();
  const env = await loadEnv();
  const g = cfg.general || {};
  // Reddit 은 키가 없으면 요청 간격을 넓혀야 덜 막힙니다.
  const hostDelays = { ...(g.hostDelays || {}) };
  if (!env.REDDIT_CLIENT_ID) hostDelays['www.reddit.com'] ??= g.redditNoAuthDelayMs ?? 6000;
  configureHttp({ userAgent: g.userAgent, hostDelayMs: g.hostDelayMs, hostDelays, timeoutMs: g.timeoutMs });

  const db = await loadDb();
  const byCanon = new Map(db.cases.map((c) => [c.canon, c]));
  const stages = new Set(urls ? ['inbox'] : (only?.length ? only : ALL_STAGES));

  // 주제마다 "이 글을 받을지" 판단하는 함수를 만듭니다.
  //  match: 주제어 중 하나가 있어야 함 (전용 서브레딧처럼 출처 자체가 주제면 requireMatch:false)
  //  showcase: 결과물 소개 글처럼 보이는 단어가 하나 있어야 함 (showcaseOptional:true 면 생략)
  const re = (arr) => (arr || []).map((s) => new RegExp(s, 'i'));
  const exc = re(cfg.exclude);
  const showWords = re(cfg.showcaseWords);
  const topics = (cfg.topics || []).filter((t) => t.enabled !== false);
  const acceptFor = (topic, requireMatch = true) => {
    const inc = re(topic.match);
    return (t = '') => (!requireMatch || !inc.length || inc.some((r) => r.test(t)))
      && (topic.showcaseOptional || !showWords.length || showWords.some((r) => r.test(t)))
      && !exc.some((r) => r.test(t));
  };

  // ---------- 1. 후보 모으기 ----------
  const cand = new Map(); // canon → { url, refs, prefetched, via, topics }
  const add = (url, { ref, prefetched, via, topic }) => {
    const canon = canonicalUrl(url);
    if (!canon) return false;
    const c = cand.get(canon) || { url, refs: [], via: new Set(), topics: new Set() };
    if (ref) c.refs.push(ref);
    if (prefetched && !c.prefetched) c.prefetched = prefetched;
    if (topic) c.topics.add(topic);
    c.via.add(via);
    cand.set(canon, c);
    return true;
  };

  const limit = max ?? g.maxNewPerRun ?? 150;
  const counts = {};
  if (stages.has('refs')) {
    const seenRefs = new Set(db.cases.flatMap((c) => (c.refs || []).map((r) => r.url)));
    for (const site of (cfg.references || []).filter((s) => s.enabled)) {
      try {
        log(`참고 사이트 ${site.name} 확인 중…`);
        const { items, categoryUpdates } = await reference.collect(site, { seenRefs, full, log, max: limit });
        items.forEach((it) => add(it.url, { ref: it.ref, via: 'refs' }));
        // 기존 기록의 분류 갱신
        for (const c of db.cases) for (const r of c.refs || []) {
          if (r.site === site.id && categoryUpdates.has(r.url)) r.categories = categoryUpdates.get(r.url);
        }
        counts[site.id] = items.length;
        log(`  새 사례 ${items.length}건`);
      } catch (e) { log(`참고 사이트 ${site.name}: ${e.message}`); }
    }
  }

  const ctx = { env, log };
  for (const topic of topics) {
    for (const p of ['reddit', 'x', 'threads', 'instagram']) {
      if (!stages.has(p) || cfg[p]?.enabled === false || !topic[p]) continue;
      try {
        // 주제별 출처 설정을 플랫폼 공통 설정 위에 얹어 부릅니다.
        const found = await ADAPTERS[p].discover({ ...(cfg[p] || {}), ...topic[p] },
          { ...ctx, accept: acceptFor(topic, topic[p].requireMatch !== false) });
        found.forEach((it) => add(it.url, { prefetched: it.prefetched, via: p, topic: topic.id }));
        counts[`${topic.id}:${p}`] = found.length;
        if (found.length) log(`[${topic.id}] ${p} 자동 발견 ${found.length}건`);
      } catch (e) { log(`[${topic.id}] ${p} 발견 실패: ${e.message}`); }
    }
  }

  const inboxUrls = urls || (stages.has('inbox') ? await readInbox() : []);
  const badInbox = [];
  for (const u of inboxUrls) if (!add(u, { via: 'inbox' })) { badInbox.push(u); log(`지원하지 않는 주소: ${u}`); }

  // ---------- 2. 해석할 대상 고르기 ----------
  const staleMs = (g.refreshHours ?? 24) * 3600_000;
  const now = Date.now();
  const work = [];
  for (const [canon, c] of cand) {
    const old = byCanon.get(canon);
    const stale = !old || old.status !== 'ok' || refreshAll || c.via.has('inbox') || now - Date.parse(old.fetchedAt || 0) > staleMs;
    work.push({ canon, c, old, resolve: stale });
  }
  if (refreshAll) for (const [canon, old] of byCanon) if (!cand.has(canon)) work.push({ canon, c: { url: old.url, refs: [], via: new Set(['refresh']), topics: new Set() }, old, resolve: true });
  let budget = limit;

  // ---------- 3. 해석 + 병합 ----------
  let added = 0, updated = 0, failed = 0, deferred = 0;
  const okInbox = [];
  await pool(work, g.concurrency || 3, async ({ canon, c, old, resolve: need }) => {
    const platform = detectPlatform(canon);
    let fresh = null, error = null;
    if (need && c.prefetched) fresh = c.prefetched;
    else if (need && budget > 0) {
      budget--;
      try { fresh = await ADAPTERS[platform].resolve(canon, c.url, { ...ctx, cfg: cfg[platform] || {} }); }
      catch (e) { error = e.message; failed++; log(`해석 실패 ${c.url}: ${e.message}`); }
    } else if (need) deferred++;
    const rec = merge(old, { canon, platform, sourceUrl: c.url, refs: c.refs, topics: [...c.topics], fresh, error, cfg, now });
    if (!old) { db.cases.push(rec); byCanon.set(canon, rec); added++; }
    else if (fresh) updated++;
    if (c.via.has('inbox') && (fresh || old)) okInbox.push(...inboxUrls.filter((u) => canonicalUrl(u) === canon));
  });

  // 규칙이 바뀌었을 수 있으니 모든 기록의 태그를 다시 계산
  for (const c of db.cases) c.tags = tagsFor(c, cfg);

  await saveDb(db);
  if (!urls) await removeFromInbox([...okInbox, ...badInbox]);
  else await removeFromInbox(okInbox);

  const entry = {
    at: new Date().toISOString(), ms: Date.now() - started,
    added, updated, failed, deferred, total: db.cases.length, found: counts,
    messages: messages.slice(-40),
  };
  await saveLog(entry);
  log(`완료: 새로 ${added}건, 갱신 ${updated}건, 실패 ${failed}건, 다음으로 미룸 ${deferred}건, 전체 ${db.cases.length}건 (${(entry.ms / 1000).toFixed(1)}초)`);
  return entry;
}

// 태그 = 참고 사이트 분류 + 참고 사이트 주제 + 발견된 주제 + 제목·본문 규칙
function tagsFor(c, cfg) {
  const siteTopic = Object.fromEntries((cfg.references || []).map((s) => [s.id, s.topic]));
  const base = [
    ...(c.refs || []).flatMap((r) => [...(r.categories || []), siteTopic[r.site]]),
    ...(c.topics || []),
  ].filter(Boolean);
  return applyTags({ ...c, tags: base }, cfg.tags || {});
}

function mergeRefs(a = [], b = []) {
  const m = new Map(a.map((r) => [r.url, r]));
  for (const r of b) m.set(r.url, { ...m.get(r.url), ...r });
  return [...m.values()];
}

function merge(old, { canon, platform, sourceUrl, refs, topics = [], fresh, error, cfg, now }) {
  const n = cfg.general?.excerptChars ?? 280;
  const base = old || {
    id: idOf(canon), canon, platform, url: sourceUrl, addedAt: new Date(now).toISOString(),
    title: '', text: '', author: null, publishedAt: null, media: null, metrics: {}, refs: [], tags: [], status: 'link-only',
  };
  const r = { ...base, refs: mergeRefs(base.refs, refs), topics: [...new Set([...(base.topics || []), ...topics])] };
  if (fresh) {
    Object.assign(r, {
      url: fresh.url || r.url,
      author: fresh.author || r.author, authorUrl: fresh.authorUrl || r.authorUrl || null,
      publishedAt: fresh.publishedAt || r.publishedAt,
      title: (fresh.title ?? r.title ?? '').trim(),
      text: excerpt(fresh.text ?? r.text ?? '', n),
      where: fresh.where || r.where || null,
      media: fresh.media || r.media,
      metrics: { ...r.metrics, ...Object.fromEntries(Object.entries(fresh.metrics || {}).filter(([, v]) => v != null)) },
      status: fresh.status || 'ok', fetchedAt: new Date(now).toISOString(),
    });
    delete r.error;
  } else if (error) {
    r.error = error;
    r.fetchedAt = new Date(now).toISOString();
  }
  // 원문에서 못 받은 값은 참고 사이트의 사실 정보로 채움
  const ref = r.refs.find((x) => x.credit || x.date || x.metrics);
  if (ref) {
    r.author ||= ref.credit || null;
    r.publishedAt ||= ref.date ? new Date(ref.date).toISOString() : null;
    for (const k of ['likes', 'views']) if (r.metrics[k] == null && ref.metrics?.[k] != null) r.metrics[k] = ref.metrics[k];
  }
  r.lang = detectLang(`${r.title} ${r.text}`);
  r.model = detectModel(`${r.title} ${r.text}`) || r.refs.find((x) => x.model)?.model || null;
  return r;
}
