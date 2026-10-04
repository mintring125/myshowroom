// 화면 설정과 카테고리 정의. 사례 데이터는 data/cases.js (npm run update 로 생성)에서 옵니다.
window.SITE = {
  name: 'myshowroom',
  repo: 'mintring125/myshowroom', // GitHub 저장소 (Pages 에서 Actions 링크에 사용)
  ko: { title: 'AI 사례 모음', tagline: '개인 참고용 AI 사례 모음입니다.' },
  en: { title: 'AI case notes', tagline: 'A personal collection of AI cases for reference.' },
};

const DAY = 86400000;
const hasTag = (t) => (c) => (c.tags || []).includes(t);
const fromPlatform = (p) => (c) => c.platform === p;

// group: field(분야별) / tool(도구별) / source(출처별)
window.CATEGORIES = [
  { id: 'saved', group: 'field', pick: (c) => window.isSaved(c.id),
    ko: { t: '저장한 사례', d: '저장 버튼을 누른 사례입니다.' }, en: { t: 'Saved', d: 'Cases you saved.' } },
  { id: 'new', group: 'field', pick: (c, ctx) => Date.parse(c.addedAt) >= ctx.latestAdded - 3 * DAY,
    ko: { t: '새로 들어온 사례', d: '최근 갱신에서 새로 들어온 사례입니다.' }, en: { t: 'Recently added', d: 'Added in the latest updates.' } },
  { id: 'long', group: 'field', pick: hasTag('long'),
    ko: { t: '몇 시간짜리 일을 맡긴 사례', d: '긴 작업을 끝까지 맡긴 사례입니다.' }, en: { t: 'Long-running tasks', d: 'Hours of work handed off.' } },
  { id: 'three', group: 'field', pick: hasTag('three'),
    ko: { t: '3D·시뮬레이션', d: 'Blender, Three.js, 셰이더로 만든 3D입니다.' }, en: { t: '3D & simulation', d: 'Blender, Three.js, shaders.' } },
  { id: 'game', group: 'field', pick: hasTag('game'),
    ko: { t: '게임', d: '프롬프트로 만든 게임입니다.' }, en: { t: 'Games', d: 'Games made with prompts.' } },
  { id: 'motion', group: 'field', pick: hasTag('motion'),
    ko: { t: '코드로 만든 영상·그림', d: '코드로 만든 영상, 애니메이션, 그림입니다.' }, en: { t: 'Video & art from code', d: 'Video, animation and images in code.' } },
  { id: 'app', group: 'field', pick: hasTag('app'),
    ko: { t: '앱·디자인·웹', d: '웹앱, 랜딩 페이지, 대시보드입니다.' }, en: { t: 'Apps, design & web', d: 'Web apps, landing pages, dashboards.' } },

  { id: 'blender', group: 'tool', pick: hasTag('blender'),
    ko: { t: 'Blender', d: 'Blender를 직접 다룬 사례입니다.' }, en: { t: 'Blender', d: 'The model drove Blender.' } },
  { id: 'threejs', group: 'tool', pick: hasTag('threejs'),
    ko: { t: 'Three.js·WebGL', d: '브라우저에서 도는 3D 장면입니다.' }, en: { t: 'Three.js & WebGL', d: '3D scenes in the browser.' } },
  { id: 'voxel', group: 'tool', pick: hasTag('voxel'),
    ko: { t: '마인크래프트·복셀', d: '블록으로 지은 것과 복셀풍 게임입니다.' }, en: { t: 'Minecraft & voxels', d: 'Block builds and voxel games.' } },

  { id: 'reddit', group: 'source', pick: fromPlatform('reddit'), ko: { t: 'Reddit', d: 'Reddit 게시물입니다.' }, en: { t: 'Reddit', d: 'Posts from Reddit.' } },
  { id: 'x', group: 'source', pick: fromPlatform('x'), ko: { t: 'X', d: 'X(트위터) 게시물입니다.' }, en: { t: 'X', d: 'Posts from X.' } },
  { id: 'threads', group: 'source', pick: fromPlatform('threads'), ko: { t: 'Threads', d: 'Threads 게시물입니다.' }, en: { t: 'Threads', d: 'Posts from Threads.' } },
  { id: 'instagram', group: 'source', pick: fromPlatform('instagram'), ko: { t: 'Instagram', d: 'Instagram 게시물입니다.' }, en: { t: 'Instagram', d: 'Posts from Instagram.' } },
  { id: 'region', group: 'source', pick: hasTag('region'),
    ko: { t: '한국·일본 사례', d: '한국어·일본어로 쓰인 게시물입니다.' }, en: { t: 'Korea & Japan', d: 'Posts in Korean or Japanese.' } },
];

window.GROUPS = {
  field: { ko: '분야별', en: 'By field' },
  tool: { ko: '도구별', en: 'By tool' },
  source: { ko: '출처별', en: 'By source' },
};

window.PLATFORM_LABEL = { reddit: 'Reddit', x: 'X', threads: 'Threads', instagram: 'Instagram' };
