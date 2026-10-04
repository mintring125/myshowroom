#!/usr/bin/env node
// 사용법
//   npm run update                      전체 갱신 (참고 사이트 + 자동 발견 + inbox)
//   npm run update -- --only=refs,inbox 일부 단계만
//   npm run add -- <URL> [URL...]       게시물 주소를 바로 추가
//   npm run update -- --full            참고 사이트 사례 페이지를 전부 다시 확인
//   npm run update -- --refresh-all     저장된 모든 원문을 다시 받아 수치 갱신
//   npm run update -- --max=400         이번 실행에서 해석할 최대 개수
import { runUpdate } from './lib/pipeline.mjs';

const args = process.argv.slice(2);
const flag = (name) => args.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
const val = (name) => flag(name)?.split('=').slice(1).join('=');

const opts = {
  full: !!flag('full'),
  refreshAll: !!flag('refresh-all'),
  max: val('max') ? Number(val('max')) : undefined,
  only: val('only')?.split(',').map((s) => s.trim()).filter(Boolean),
};
if (flag('add')) {
  opts.urls = args.filter((a) => !a.startsWith('--'));
  if (!opts.urls.length) { console.error('추가할 URL 을 적어 주세요. 예) npm run add -- https://x.com/user/status/123'); process.exit(1); }
}

try {
  const r = await runUpdate(opts);
  process.exitCode = r.failed && !r.added && !r.updated ? 1 : 0;
} catch (e) {
  console.error('갱신 중 오류:', e);
  process.exitCode = 1;
}
