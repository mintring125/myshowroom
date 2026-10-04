(function () {
  const { SITE, CATEGORIES, GROUPS, PLATFORM_LABEL, TOPICS, Media } = window;

  // ---------- 저장소 (실패해도 동작하도록 감쌈) ----------
  const store = {
    get(k, d) { try { const v = localStorage.getItem('msr:' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem('msr:' + k, JSON.stringify(v)); } catch {} },
  };
  const state = {
    lang: store.get('lang', 'ko'),
    saves: store.get('saves2', {}),
    sort: store.get('sort', 'recent'),
    topic: store.get('topic', 'all'),
    query: '',
  };
  window.isSaved = (id) => !!state.saves[id];
  // 로컬 서버(npm run serve)의 API 가 응답할 때만 갱신 버튼을 켭니다. GitHub Pages 에서는 꺼짐.
  let SERVED = false;
  const ON_WEB = location.protocol === 'https:';

  const UI = {
    ko: { showcase: '쇼케이스', allTopics: '전체', recent: '최신순', popular: '반응순', unit: '건', search: '제목·본문·작성자 검색',
      caseOf: '사례', save: '저장', saved: '저장됨', open: '사례 열기', source: '원문 보기', refAt: '에서 보기', listView: '목록에서 보기',
      play: '재생', pause: '일시정지', close: '닫기', prev: '이전', next: '다음', home: '쇼케이스로', notFound: '찾는 페이지가 없습니다.',
      emptySaved: '아직 저장한 사례가 없습니다. 사례의 저장 버튼을 누르면 여기에 모입니다.', noResult: '조건에 맞는 사례가 없습니다.',
      lastUpdate: '마지막 갱신', never: '아직 갱신 전', updateNow: '지금 갱신', updating: '갱신 중…', addUrl: '게시물 URL 붙여넣기', add: '추가',
      added: '추가 요청을 보냈습니다. 잠시 뒤 목록에 나타납니다.', updDone: '갱신이 끝났습니다.', badUrl: 'Reddit / X / Threads / Instagram 게시물 주소를 넣어 주세요.',
      emptyTitle: '아직 모은 사례가 없습니다', likes: '좋아요', views: '조회', comments: '댓글', score: '점수',
      fileHint: '갱신 버튼과 URL 추가는 npm run serve 로 열었을 때 화면에서 바로 쓸 수 있습니다.',
      webHint: 'GitHub Actions 가 3시간마다 자동으로 갱신합니다.', webAdd: 'URL 추가·지금 갱신', postBy: '의 게시물', linkOnly: '본문을 받지 못해 원문 임베드로 보여 줍니다.' },
    en: { showcase: 'Showcase', allTopics: 'All', recent: 'Newest', popular: 'Most liked', unit: '', search: 'Search title, text, author',
      caseOf: 'case', save: 'Save', saved: 'Saved', open: 'Open case', source: 'View original', refAt: '', listView: 'Show in list',
      play: 'Play', pause: 'Pause', close: 'Close', prev: 'Previous', next: 'Next', home: 'Showcase', notFound: 'Page not found.',
      emptySaved: 'Nothing saved yet. Press Save on a case to collect it here.', noResult: 'No cases match.',
      lastUpdate: 'Last update', never: 'Never updated', updateNow: 'Update now', updating: 'Updating…', addUrl: 'Paste a post URL', add: 'Add',
      added: 'Queued. It will appear shortly.', updDone: 'Update finished.', badUrl: 'Use a Reddit / X / Threads / Instagram post URL.',
      emptyTitle: 'No cases collected yet', likes: 'likes', views: 'views', comments: 'comments', score: 'score',
      fileHint: 'Update and Add URL work in the page when opened with npm run serve.',
      webHint: 'GitHub Actions refreshes this every 3 hours.', webAdd: 'Add URL / update now', postBy: "'s post", linkOnly: 'Text unavailable; showing the original embed.' },
  };
  const ui = (k) => UI[state.lang][k];
  const L = (o) => o[state.lang] || o.ko;
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const count = (n) => state.lang === 'ko' ? `${n}${ui('unit')}` : `${n}`;
  const fmtNum = (n) => n >= 1e6 ? (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M' : n >= 1e4 ? (n / 1e3).toFixed(0) + 'K' : n >= 1e3 ? (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K' : String(n);
  const fmtDate = (iso) => iso ? iso.slice(0, 10) : '';
  const fmtTime = (iso) => { if (!iso) return ui('never'); const d = new Date(iso); return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };

  // ---------- 아이콘 ----------
  const ICON = {
    play: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M21.4 9.35c2.13 1.16 2.13 4.14 0 5.3L8.6 21.6C6.53 22.74 4 21.28 4 18.97V5.03c0-2.31 2.53-3.77 4.6-2.65z"/></svg>',
    pause: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="3" width="5" height="18" rx="1.5"/><rect x="14" y="3" width="5" height="18" rx="1.5"/></svg>',
    bookmark: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 3.5h12v17l-6-4-6 4z" stroke-linejoin="round"/></svg>',
    arrow: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M7 17 17 7M9 7h8v8"/></svg>',
    back: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
    fwd: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>',
    close: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    refresh: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6"/></svg>',
    video: '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M4 5h11a2 2 0 0 1 2 2v2.5l4-2.5v10l-4-2.5V17a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"/></svg>',
  };

  // ---------- 데이터 ----------
  let CASES = [], DB = { cases: [] }, ctx = {};
  function loadData() {
    DB = window.CASES_DB || { cases: [], updatedAt: null };
    const asc = [...DB.cases].sort((a, b) => (a.publishedAt || a.addedAt || '').localeCompare(b.publishedAt || b.addedAt || ''));
    asc.forEach((c, i) => { c.n = i + 1; });
    CASES = asc.reverse();
    ctx = { latestAdded: Math.max(0, ...CASES.map((c) => Date.parse(c.addedAt) || 0)) };
  }
  const caseById = (id) => CASES.find((c) => c.id === id);
  const catById = (id) => CATEGORIES.find((c) => c.id === id);
  const casesOf = (cat) => CASES.filter((c) => cat.pick(c, ctx));
  const engagement = (c) => { const m = c.metrics || {}; return m.likes ?? m.score ?? 0; };
  const primaryCat = (c) => CATEGORIES.find((cat) => (cat.group === 'field' || cat.group === 'tool') && !['saved', 'new'].includes(cat.id) && cat.pick(c, ctx)) || catById(c.platform);
  const titleOf = (c) => {
    if (c.title) return c.title;
    const first = (c.text || '').split('\n').find((l) => l.trim());
    if (first) return first.length > 110 ? first.slice(0, 108) + '…' : first;
    return `@${c.author || '?'}${ui('postBy')} · ${PLATFORM_LABEL[c.platform]}`;
  };
  // 제목이 없는 게시물은 본문 첫 줄을 제목으로 쓰고, 본문에서는 그 줄을 뺍니다.
  const bodyOf = (c) => {
    const t = (c.text || '').trim();
    if (c.title || !t) return t === c.title ? '' : t;
    const lines = t.split('\n');
    const i = lines.findIndex((l) => l.trim());
    const first = lines[i].trim();
    return first.length > 110 ? t : lines.slice(i + 1).join('\n').trim();
  };
  const matches = (c) => {
    if (!state.query) return true;
    const q = state.query.toLowerCase();
    return `${c.title} ${c.text} ${c.author}`.toLowerCase().includes(q);
  };
  const hash = (s) => { let h = 0; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) | 0; return Math.abs(h); };
  const SCENES = Object.keys(Media.SCENES);

  // ---------- 미디어 조각 ----------
  // 썸네일 이미지가 있으면 이미지, 없거나 깨지면 코드로 그린 대체 그림
  const fallbackAttrs = (c) => `data-scene="${SCENES[hash(c.id) % SCENES.length]}" data-hue="${hash(c.id + 'h') % 360}"`;
  const mediaThumb = (c, { playBtn } = {}) => {
    const m = c.media;
    const vid = m?.video;
    return `
    <div class="media ${m?.thumb ? '' : 'is-fallback'}" ${fallbackAttrs(c)} ${vid ? `data-video="${esc(vid)}"` : ''}>
      ${m?.thumb ? `<img src="${esc(m.thumb)}" alt="" loading="lazy" decoding="async">` : '<canvas></canvas>'}
      ${vid && playBtn ? `<button class="play top" data-act="tile-play" aria-label="${ui('play')}">${ICON.play}</button>` : ''}
      ${m?.kind === 'video' && !vid ? `<span class="kind-badge">${ICON.video}</span>` : ''}
    </div>`;
  };

  const EMBED = {
    threads: (c) => `<blockquote class="text-post-media" data-text-post-permalink="${esc(c.url)}"><a href="${esc(c.url)}">${esc(c.url)}</a></blockquote>`,
    instagram: (c) => `<blockquote class="instagram-media" data-instgrm-permalink="${esc(c.url)}" data-instgrm-version="14"><a href="${esc(c.url)}">${esc(c.url)}</a></blockquote>`,
  };
  const needsEmbed = (c) => (c.platform === 'threads' || c.platform === 'instagram') && !c.text && !c.media;

  // 상세·뷰어용 큰 미디어
  const mediaLarge = (c) => {
    if (c.media?.video) return `<div class="media-large"><video src="${esc(c.media.video)}" poster="${esc(c.media.thumb || '')}" controls playsinline preload="none"></video></div>`;
    if (c.media?.thumb) return `<div class="media-large"><img src="${esc(c.media.thumb)}" alt="" loading="lazy" decoding="async"></div>`;
    if (needsEmbed(c)) return `<div class="embed-box">${EMBED[c.platform](c)}</div>`;
    return `<div class="media-large">${mediaThumb(c)}</div>`;
  };

  let embedScripts = {};
  function loadEmbeds(root) {
    // Threads embed.js 는 불러올 때 한 번만 블록을 바꾸므로, 새 블록이 생기면 다시 불러옵니다.
    if (root.querySelector('blockquote.text-post-media')) addScript('https://www.threads.com/embed.js');
    if (root.querySelector('.instagram-media')) {
      if (!embedScripts.ig) { embedScripts.ig = 1; addScript('https://www.instagram.com/embed.js'); }
      else window.instgrm?.Embeds.process();
    }
  }
  const addScript = (src) => { const s = document.createElement('script'); s.async = true; s.src = src; document.body.appendChild(s); };

  const metricsLine = (c) => {
    const m = c.metrics || {}, out = [];
    if (m.likes != null) out.push(`${fmtNum(m.likes)} ${ui('likes')}`);
    else if (m.score != null) out.push(`${fmtNum(m.score)} ${ui('score')}`);
    if (m.views != null) out.push(`${fmtNum(m.views)} ${ui('views')}`);
    if (m.comments != null) out.push(`${fmtNum(m.comments)} ${ui('comments')}`);
    return out.join(' · ');
  };

  const saveBtn = (id) => {
    const on = !!state.saves[id];
    return `<button class="act ${on ? 'is-on' : ''}" data-act="save" data-id="${id}" aria-pressed="${on}">${ICON.bookmark}<span>${on ? ui('saved') : ui('save')}</span></button>`;
  };
  const linkButtons = (c) => `
    <a href="${esc(c.url)}" target="_blank" rel="noopener noreferrer" class="source">${PLATFORM_LABEL[c.platform]} ${ui('source')} ${ICON.arrow}</a>
    ${(c.refs || []).map((r) => `<a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer" class="source source-ref">${esc(r.name || r.site)}${ui('refAt')} ${ICON.arrow}</a>`).join('')}
    ${saveBtn(c.id)}`;

  const metaLine = (c) => [
    `#${c.n}`, PLATFORM_LABEL[c.platform], c.where, c.author ? '@' + c.author : null, fmtDate(c.publishedAt), c.model,
  ].filter(Boolean).map(esc).join(' · ');

  // ---------- 공통 조각 ----------
  const langBtn = () => `<button class="lang" data-act="lang" aria-label="Language">${state.lang === 'ko' ? 'EN' : 'KO'}</button>`;
  const header = (back) => `
    <header class="bar">
      ${back ? `<a href="#/" class="back">${ICON.back}<span>${ui('home')}</span></a>` : `<a href="#/" class="logo">${SITE.name}</a>`}
      ${langBtn()}
    </header>`;

  const updatePanel = () => `
    <div class="upd">
      <div class="upd-row">
        <span class="upd-time">${ui('lastUpdate')} <b>${fmtTime(DB.updatedAt)}</b> · ${count(CASES.length)}</span>
        ${SERVED ? `<button class="mini" data-act="update" ${updState.running ? 'disabled' : ''}>${ICON.refresh}<span>${updState.running ? ui('updating') : ui('updateNow')}</span></button>` : ''}
      </div>
      ${SERVED ? `
      <form class="add-form" data-form="add">
        <input type="url" name="url" placeholder="${ui('addUrl')}" aria-label="${ui('addUrl')}" required>
        <button class="mini" type="submit">${ui('add')}</button>
      </form>
      ${updState.live.length ? `<pre class="upd-log">${esc(updState.live.slice(-6).join('\n'))}</pre>` : ''}` : ON_WEB && SITE.repo
        ? `<p class="upd-hint">${ui('webHint')} <a class="u" href="https://github.com/${esc(SITE.repo)}/actions/workflows/update.yml" target="_blank" rel="noopener noreferrer">${ui('webAdd')} ↗</a></p>`
        : `<p class="upd-hint">${ui('fileHint')}</p>`}
    </div>`;

  const catThumb = (cat, lg) => {
    const first = casesOf(cat).find((c) => c.media?.thumb) || casesOf(cat)[0];
    const cls = `thumb${lg ? ' thumb-lg' : ''}`;
    if (!first) return `<div class="${cls} thumb-glyph">${ICON.bookmark}</div>`;
    return `<div class="${cls}">${mediaThumb(first)}</div>`;
  };
  const catCard = (cat) => {
    const n = casesOf(cat).length;
    if (!n && cat.group === 'source') return '';
    return `
    <a href="#/s/${cat.id}" class="card-link">
      <article class="card">
        ${catThumb(cat)}
        <div class="card-body"><h3>${esc(L(cat).t)}</h3><p>${esc(L(cat).d)}</p><span class="chip">${count(n)}</span></div>
      </article>
    </a>`;
  };

  // ---------- 쇼케이스 ----------
  function showcaseList() {
    const list = CASES.filter((c) => matches(c) && (state.topic === 'all' || (c.tags || []).includes(state.topic)));
    if (state.sort === 'popular') list.sort((a, b) => engagement(b) - engagement(a));
    return list;
  }
  let viewerList = [];

  const tile = (c, big) => `
    <article class="tile ${big ? 'is-big' : ''}" data-id="${c.id}">
      ${mediaThumb(c, { playBtn: true })}
      <a href="#/c/${c.id}" class="tile-link" data-act="view" data-id="${c.id}" aria-label="${ui('open')}: ${esc(titleOf(c))}">
        <span class="caption"><span class="num">#${c.n}</span><span class="cap-t">${esc(titleOf(c))}</span></span>
      </a>
      <span class="tile-badges">
        <span class="badge">${PLATFORM_LABEL[c.platform]}</span>
        ${TOPICS.filter((t) => t.id !== 'ai' && (c.tags || []).includes(t.id)).map((t) => `<span class="badge badge-topic">${t.short}</span>`).join('')}
        ${state.saves[c.id] ? `<span class="badge badge-saved">${ICON.bookmark}</span>` : ''}
      </span>
    </article>`;

  function viewHome() {
    const groups = Object.keys(GROUPS).map((g) => `
      <h2 class="group-h">${GROUPS[g][state.lang]}</h2>
      ${CATEGORIES.filter((c) => c.group === g).map(catCard).join('')}`).join('');
    const list = showcaseList();
    viewerList = list;
    // 반응이 큰 상위 20% 는 큰 타일
    const cut = [...CASES].sort((a, b) => engagement(b) - engagement(a))[Math.floor(CASES.length * 0.2)];
    const bigMin = cut ? engagement(cut) : Infinity;
    const grid = !CASES.length ? emptyDb()
      : !list.length ? `<div class="empty">${ui('noResult')}</div>`
      : `<div class="grid">${list.map((c) => tile(c, engagement(c) > bigMin && (c.media?.thumb))).join('')}</div>`;
    return {
      title: `${SITE.name} · ${L(SITE).title}`,
      left: `${header(false)}
        <div class="left-scroll">
          ${updatePanel()}
          <div class="cards">${groups}</div>
        </div>`,
      right: `
        <div class="bar bar-right">
          <h1 class="bar-title">${ui('showcase')}</h1>
          <div class="seg seg-topic" role="group" aria-label="topic">
            ${[{ id: 'all', label: ui('allTopics') }, ...TOPICS.map((t) => ({ id: t.id, label: t.short }))].map((t) => {
              const n = t.id === 'all' ? CASES.length : CASES.filter((c) => (c.tags || []).includes(t.id)).length;
              return `<button class="${state.topic === t.id ? 'is-on' : ''}" data-act="topic" data-v="${t.id}" aria-pressed="${state.topic === t.id}">${esc(t.label)} <span class="seg-n">${n}</span></button>`;
            }).join('')}
          </div>
          <div class="bar-tools">
            <input class="search" type="search" placeholder="${ui('search')}" value="${esc(state.query)}" data-input="search" aria-label="${ui('search')}">
            <div class="seg" role="group">
              <button class="${state.sort === 'recent' ? 'is-on' : ''}" data-act="sort" data-v="recent">${ui('recent')}</button>
              <button class="${state.sort === 'popular' ? 'is-on' : ''}" data-act="sort" data-v="popular">${ui('popular')}</button>
            </div>
            <span class="mono-count">${count(list.length)}</span>
          </div>
        </div>
        <div class="right-scroll">${grid}</div>`,
    };
  }

  const emptyDb = () => `
    <div class="empty onboarding">
      <h2>${ui('emptyTitle')}</h2>
      <ol>
        <li>터미널에서 <code>npm run update</code> 를 실행하면 참고 사이트와 Reddit·X·Threads 에서 사례를 모아 옵니다.</li>
        <li>또는 <code>npm run serve</code> 로 열고 왼쪽의 <b>지금 갱신</b> 버튼을 누르세요.</li>
        <li>게시물 하나만 넣으려면 <code>npm run add -- &lt;URL&gt;</code> 또는 <code>data/inbox.txt</code> 에 붙여 넣으세요.</li>
      </ol>
    </div>`;

  // ---------- 목록·상세 ----------
  const feedItem = (c, cat) => `
    <article class="feed-item" id="case-${c.id}">
      ${mediaLarge(c)}
      <div class="feed-text">
        <p class="meta">${metaLine(c)}</p>
        <h3><a href="#/c/${c.id}">${esc(titleOf(c))}</a></h3>
        ${bodyOf(c) ? `<p class="body">${esc(bodyOf(c))}</p>` : ''}
        ${needsEmbed(c) ? `<p class="note">${ui('linkOnly')}</p>` : ''}
        ${metricsLine(c) ? `<p class="metrics">${metricsLine(c)}</p>` : ''}
        <div class="actions">${linkButtons(c)}</div>
      </div>
    </article>`;

  function viewList(cat, focusId) {
    const items = casesOf(cat).filter(matches);
    const c = focusId && caseById(focusId);
    const info = c ? `
      <div class="info">
        <div class="thumb thumb-lg">${mediaThumb(c)}</div>
        <div class="card-body">
          <p class="meta">${PLATFORM_LABEL[c.platform]} · #${c.n}</p>
          <h1>${esc(titleOf(c))}</h1>
          <p class="sub">${esc(c.author ? '@' + c.author : '')} · ${fmtDate(c.publishedAt)}</p>
        </div>
      </div>` : `
      <div class="info">
        ${catThumb(cat, true)}
        <div class="card-body">
          <p class="meta">${GROUPS[cat.group][state.lang]}</p>
          <h1>${esc(L(cat).t)}</h1>
          <p class="sub">${esc(L(cat).d)}</p>
        </div>
      </div>`;
    const list = items.map((it) => `<li><a href="#/c/${it.id}" class="list-a ${it.id === focusId ? 'is-on' : ''}"><span class="num">#${it.n}</span>${esc(titleOf(it))}</a></li>`).join('');
    const feed = items.length ? items.map((it) => feedItem(it, cat)).join('')
      : `<div class="empty">${cat.id === 'saved' ? ui('emptySaved') : ui('noResult')}</div>`;
    return {
      title: `${c ? titleOf(c) : L(cat).t} · ${SITE.name}`,
      left: `${header(true)}
        <div class="left-scroll">
          ${info}
          <h2 class="list-h"><a href="#/s/${cat.id}">${esc(L(cat).t)}</a> <span class="mono-count">${count(items.length)}</span></h2>
          <ol class="list">${list}</ol>
        </div>`,
      right: `<div class="bar bar-right"><h2 class="bar-title">${esc(L(cat).t)}</h2><span class="mono-count">${count(items.length)}</span></div>
        <div class="right-scroll feed">${feed}</div>`,
      focus: c ? `case-${c.id}` : null,
    };
  }

  function viewNotFound() {
    return {
      title: SITE.name,
      left: `${header(true)}<div class="info"><div class="card-body"><h1>404</h1><p class="sub">${ui('notFound')}</p></div></div>`,
      right: `<div class="bar bar-right"><h2 class="bar-title">404</h2></div>`,
    };
  }

  // ---------- 뷰어 (쇼케이스에서 크게 보기) ----------
  const $viewer = document.getElementById('viewer');
  let viewerIdx = -1, lastFocus = null;
  function openViewer(id) {
    viewerIdx = viewerList.findIndex((c) => c.id === id);
    if (viewerIdx < 0) { viewerList = CASES; viewerIdx = CASES.findIndex((c) => c.id === id); }
    if (viewerIdx < 0) return;
    lastFocus = document.activeElement;
    renderViewer();
    $viewer.hidden = false;
    document.body.classList.add('no-scroll');
    $viewer.querySelector('.vw-close').focus();
  }
  function renderViewer() {
    const c = viewerList[viewerIdx];
    const cat = primaryCat(c);
    $viewer.innerHTML = `
      <div class="vw-backdrop" data-act="vw-close"></div>
      <div class="vw" role="dialog" aria-modal="true" aria-label="${esc(titleOf(c))}">
        <div class="vw-media">${mediaLarge(c)}</div>
        <aside class="vw-side">
          <div class="vw-top">
            <span class="mono-count">${viewerIdx + 1} / ${viewerList.length}</span>
            <span class="vw-nav">
              <button class="icon-btn" data-act="vw-prev" aria-label="${ui('prev')}" ${viewerIdx === 0 ? 'disabled' : ''}>${ICON.back}</button>
              <button class="icon-btn" data-act="vw-next" aria-label="${ui('next')}" ${viewerIdx === viewerList.length - 1 ? 'disabled' : ''}>${ICON.fwd}</button>
              <button class="icon-btn vw-close" data-act="vw-close" aria-label="${ui('close')}">${ICON.close}</button>
            </span>
          </div>
          <p class="meta">${metaLine(c)}</p>
          <h2 class="vw-title">${esc(titleOf(c))}</h2>
          ${bodyOf(c) ? `<p class="body">${esc(bodyOf(c))}</p>` : ''}
          ${needsEmbed(c) ? `<p class="note">${ui('linkOnly')}</p>` : ''}
          ${metricsLine(c) ? `<p class="metrics">${metricsLine(c)}</p>` : ''}
          <div class="actions">${linkButtons(c)}</div>
          ${cat ? `<a class="u vw-list" href="#/c/${c.id}" data-act="vw-goto">${ui('listView')} · ${esc(L(cat).t)}</a>` : ''}
        </aside>
      </div>`;
    const v = $viewer.querySelector('video');
    if (v) { v.muted = true; v.play().catch(() => {}); }
    loadEmbeds($viewer);
  }
  function closeViewer() {
    $viewer.hidden = true; $viewer.innerHTML = '';
    document.body.classList.remove('no-scroll');
    lastFocus?.focus?.();
  }
  function stepViewer(d) {
    const n = viewerIdx + d;
    if (n < 0 || n >= viewerList.length) return;
    viewerIdx = n; renderViewer();
    $viewer.querySelector('.vw-close').focus();
  }

  // ---------- 미디어 수명 관리 ----------
  let mounted = [];
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      const el = e.target;
      if (e.isIntersecting) el._media?.render();
      else stopTileVideo(el);
    });
  });
  function mountMedia(root) {
    mounted.forEach((el) => { stopTileVideo(el); io.unobserve(el); });
    mounted = [...root.querySelectorAll('.media')];
    mounted.forEach((el) => {
      const cv = el.querySelector('canvas');
      if (cv) el._media = Media.mount(cv, el.dataset.scene, +el.dataset.hue);
      io.observe(el);
    });
  }
  // 이미지가 깨지면(만료된 CDN 주소 등) 코드 그림으로 바꿉니다.
  document.addEventListener('error', (e) => {
    const img = e.target;
    if (img.tagName !== 'IMG') return;
    const box = img.closest('.media, .media-large');
    if (!box) return;
    const host = box.classList.contains('media') ? box : null;
    const cv = document.createElement('canvas');
    if (host) {
      img.replaceWith(cv); host.classList.add('is-fallback');
      host._media = Media.mount(cv, host.dataset.scene, +host.dataset.hue); host._media.render();
    } else img.remove();
  }, true);

  // 타일 영상: 마우스를 올리거나 재생 버튼을 누를 때만 불러와 재생
  function startTileVideo(box) {
    if (!box?.dataset.video || box._video) return;
    const v = document.createElement('video');
    Object.assign(v, { src: box.dataset.video, muted: true, loop: true, playsInline: true, preload: 'auto' });
    v.className = 'tile-video';
    box.appendChild(v); box._video = v;
    v.play().then(() => box.classList.add('is-playing')).catch(() => {});
    const b = box.querySelector('.play'); if (b) { b.innerHTML = ICON.pause; b.setAttribute('aria-label', ui('pause')); }
  }
  function stopTileVideo(box) {
    if (!box?._video) return;
    box._video.pause(); box._video.remove(); box._video = null;
    box.classList.remove('is-playing');
    const b = box.querySelector('.play'); if (b) { b.innerHTML = ICON.play; b.setAttribute('aria-label', ui('play')); }
  }

  // ---------- 렌더 ----------
  const $left = document.getElementById('left');
  const $right = document.getElementById('right');
  const isMobile = () => window.matchMedia('(max-width: 767px)').matches;

  function route() {
    const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
    let v;
    if (!parts.length) v = viewHome();
    else if (parts[0] === 's' && catById(parts[1])) v = viewList(catById(parts[1]));
    else if (parts[0] === 'c' && caseById(parts[1])) { const c = caseById(parts[1]); v = viewList(primaryCat(c), c.id); }
    else v = viewNotFound();

    document.documentElement.lang = state.lang;
    document.title = v.title;
    $left.innerHTML = v.left;
    $right.innerHTML = v.right;
    mountMedia(document.getElementById('app'));
    loadEmbeds($right);
    const rs = $right.querySelector('.right-scroll');
    if (v.focus) {
      const target = document.getElementById(v.focus);
      if (target && rs && !isMobile()) rs.scrollTop = target.offsetTop - rs.offsetTop - 8;
      if (target && isMobile()) target.scrollIntoView();
      const on = $left.querySelector('.list-a.is-on'); if (on && !isMobile()) on.scrollIntoView({ block: 'center' });
    } else if (isMobile()) window.scrollTo(0, 0);
  }

  // 검색 입력은 오른쪽 그리드만 다시 그려 입력 포커스를 유지합니다.
  function rerenderGrid() {
    const v = viewHome();
    const tmp = document.createElement('div'); tmp.innerHTML = v.right;
    $right.querySelector('.right-scroll').replaceWith(tmp.querySelector('.right-scroll'));
    $right.querySelector('.bar-tools .mono-count').textContent = tmp.querySelector('.bar-tools .mono-count').textContent;
    mountMedia($right);
  }

  // ---------- 토스트 ----------
  const $toast = document.getElementById('toast');
  let toastTimer;
  function toast(msg) {
    $toast.textContent = msg; $toast.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => $toast.classList.remove('show'), 2400);
  }

  // ---------- 서버 갱신 (npm run serve 로 열었을 때) ----------
  const updState = { running: false, live: [] };
  let pollTimer = null;
  async function api(path, body) {
    const r = await fetch(path, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {});
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || r.status);
    return j;
  }
  async function poll() {
    try {
      const s = await api('api/status');
      if (!s || typeof s.running !== 'boolean') throw new Error('no api');
      if (!SERVED) { SERVED = true; route(); }
      const was = updState.running;
      updState.running = s.running; updState.live = s.live || [];
      const panel = $left.querySelector('.upd');
      if (panel) panel.outerHTML = updatePanel();
      if (s.running) { pollTimer = setTimeout(poll, 1500); return; }
      if (was) { await reloadData(); toast(ui('updDone')); }
    } catch { /* 서버가 꺼졌으면 조용히 */ }
    pollTimer = null;
  }
  const startPoll = () => { if (!pollTimer) pollTimer = setTimeout(poll, 600); };
  function reloadData() {
    return new Promise((resolve) => {
      const s = document.createElement('script');
      s.src = `data/cases.js?t=${Date.now()}`;
      s.onload = s.onerror = () => { s.remove(); loadData(); route(); resolve(); };
      document.body.appendChild(s);
    });
  }

  // ---------- 이벤트 ----------
  document.addEventListener('click', async (e) => {
    const el = e.target.closest('[data-act]'); if (!el) return;
    const act = el.dataset.act;
    if (act === 'lang') { state.lang = state.lang === 'ko' ? 'en' : 'ko'; store.set('lang', state.lang); route(); }
    else if (act === 'sort') { state.sort = el.dataset.v; store.set('sort', state.sort); route(); }
    else if (act === 'topic') { state.topic = el.dataset.v; store.set('topic', state.topic); route(); }
    else if (act === 'view') {
      if (e.metaKey || e.ctrlKey || e.shiftKey) return;
      e.preventDefault(); openViewer(el.dataset.id);
    }
    else if (act === 'tile-play') {
      e.preventDefault(); e.stopPropagation();
      const box = el.closest('.media');
      box._video ? stopTileVideo(box) : startTileVideo(box);
      box._pinned = !!box._video;
    }
    else if (act === 'save') {
      const id = el.dataset.id;
      state.saves[id] ? delete state.saves[id] : (state.saves[id] = Date.now());
      store.set('saves2', state.saves);
      const on = !!state.saves[id];
      document.querySelectorAll(`[data-act="save"][data-id="${id}"]`).forEach((b) => {
        b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', on);
        b.querySelector('span').textContent = on ? ui('saved') : ui('save');
      });
    }
    else if (act === 'vw-close') closeViewer();
    else if (act === 'vw-prev') stepViewer(-1);
    else if (act === 'vw-next') stepViewer(1);
    else if (act === 'vw-goto') closeViewer();
    else if (act === 'update') {
      try { await api('api/update', {}); updState.running = true; startPoll(); route(); } catch (err) { toast(err.message); }
    }
  });

  document.addEventListener('submit', async (e) => {
    const f = e.target.closest('[data-form="add"]'); if (!f) return;
    e.preventDefault();
    const url = f.url.value.trim();
    try { await api('api/add', { url }); f.reset(); toast(ui('added')); updState.running = true; startPoll(); }
    catch (err) { toast(err.message || ui('badUrl')); }
  });

  let searchTimer;
  document.addEventListener('input', (e) => {
    if (e.target.dataset.input !== 'search') return;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { state.query = e.target.value.trim(); rerenderGrid(); }, 150);
  });

  document.addEventListener('keydown', (e) => {
    if ($viewer.hidden) return;
    if (e.key === 'Escape') closeViewer();
    else if (e.key === 'ArrowLeft') stepViewer(-1);
    else if (e.key === 'ArrowRight') stepViewer(1);
    else if (e.key === 'Tab') {
      // 뷰어 안에서만 포커스가 돌도록
      const f = [...$viewer.querySelectorAll('a[href], button:not([disabled]), video[controls]')];
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  // 타일에 마우스를 올리면 영상 미리보기 (마우스 환경에서만)
  const canHover = window.matchMedia('(hover: hover)').matches;
  document.addEventListener('pointerover', (e) => {
    if (!canHover) return;
    const t = e.target.closest('.tile'); if (!t || t.contains(e.relatedTarget)) return;
    startTileVideo(t.querySelector('.media'));
  });
  document.addEventListener('pointerout', (e) => {
    if (!canHover) return;
    const t = e.target.closest('.tile'); if (!t || t.contains(e.relatedTarget)) return;
    const box = t.querySelector('.media'); if (box && !box._pinned) stopTileVideo(box);
  });

  window.addEventListener('hashchange', () => { if (!$viewer.hidden) closeViewer(); route(); });
  loadData();
  route();
  if (location.protocol.startsWith('http')) poll();
})();
