# myshowroom — 개인용 AI 사례 모음

Reddit · X · Threads · Instagram 게시물과 참고 사이트(ohmyopus 등)에서 AI 사례를 모아
쇼케이스(영상·이미지 타일)와 분류별 목록으로 보여 주는 개인용 사이트입니다.

## 바로 쓰기

```bash
npm run serve
```

`http://127.0.0.1:5180` 을 열면 됩니다. 이 방식으로 열면 화면 왼쪽에서 **지금 갱신**과 **URL 추가**를 바로 쓸 수 있고,
서버가 켜져 있는 동안 3시간마다 자동으로 갱신합니다. (`-- --every=60` 으로 간격 변경, `--every=0` 이면 끔)

`index.html` 을 더블클릭해서 열어도 보이지만, 그때는 갱신 버튼이 없고 터미널에서 갱신해야 합니다.

## 데이터 갱신

| 명령 | 하는 일 |
|---|---|
| `npm run update` | 참고 사이트 + 자동 발견 + inbox 전체 갱신 |
| `npm run add -- <URL> [URL…]` | 게시물 주소를 바로 추가 |
| `npm run update -- --only=refs,inbox` | 일부 단계만 (refs, reddit, x, threads, instagram, inbox) |
| `npm run update -- --refresh-all` | 저장된 원문을 모두 다시 받아 좋아요·조회수 갱신 |
| `npm run update -- --full` | 참고 사이트 사례 페이지를 처음부터 다시 확인 |
| `npm run update -- --max=400` | 한 번에 처리할 최대 개수 (기본 150) |

`data/inbox.txt` 에 URL 을 한 줄씩 붙여 넣고 `npm run update` 를 돌려도 됩니다. 처리된 줄은 자동으로 지워집니다.

### 흐름

```
참고 사이트 (sitemap → 사례 페이지 JSON-LD isBasedOn)  ┐
Reddit 서브레딧 / X 검색 / Threads 키워드 (자동 발견)   ├→ 원문 URL 정규화·중복 제거
data/inbox.txt · 화면의 URL 추가                         ┘          │
                                                                    ▼
                         플랫폼 어댑터가 원문에서 제목·본문 발췌·썸네일·영상·반응 수를 받음
                                                                    │
                         태그 규칙 + 참고 사이트 분류로 카테고리 지정 → data/cases.json, data/cases.js
```

- **참고 사이트에서는 사실 정보만** 가져옵니다: 원문 링크, 작성자, 날짜, 좋아요·조회수, 분류.
  운영자가 쓴 제목·해설과 그 사이트가 호스팅한 영상은 가져오지 않고, 각 사례에 **"ohmyopus에서 보기"** 링크로 연결합니다.
- 본문은 원문 게시물에서 받아 `general.excerptChars`(기본 280자)까지만 발췌해 저장합니다.

### 플랫폼별 동작

| 플랫폼 | 토큰 없이 | 토큰 있으면 (`.env`) |
|---|---|---|
| Reddit | 게시물 RSS → oEmbed, 서브레딧 새 글 RSS 로 자동 발견 (자주 부르면 속도 제한) | `REDDIT_CLIENT_ID/SECRET`: 점수·댓글 수, 검색 API, 넉넉한 한도 |
| X | fxtwitter 공개 API(비공식)로 본문·영상·좋아요·조회수 | `X_BEARER_TOKEN`: 공식 API, 최근 검색으로 자동 발견(유료 요금제) |
| Threads | 공개 페이지 og 태그. 못 받으면 화면에서 공식 임베드로 표시 | `THREADS_ACCESS_TOKEN`: 키워드 검색으로 자동 발견 |
| Instagram | 링크만 저장, 화면에서 공식 임베드로 표시 | `INSTAGRAM_APP_TOKEN`: oEmbed 로 작성자·캡션·썸네일 |

`.env.example` 을 `.env` 로 복사해 필요한 값만 채우세요.

## 설정 바꾸기 — `config/sources.json`

- `reddit.subreddits`, `x.searchQuery`, `threads.keywords`: 자동 발견 대상
- `filter`: 자동 발견 글을 거르는 정규식 (`include` 하나 이상 + `showcase` 하나 이상 맞고 `exclude` 는 안 맞아야 함)
- `references`: 참고 사이트 추가
  - `type: "jsonld-sitemap"`: 사례 페이지에 schema.org `isBasedOn` 이 있는 사이트
  - `type: "links"`: 아무 페이지에서나 Reddit/X/Threads/Instagram 링크를 주워 옴
- `tags`: 제목·본문 정규식 → 카테고리 태그
- `general.refreshHours`: 이 시간보다 오래된 기록은 다시 받아 수치 갱신

## 배포 (GitHub Pages + Actions)

- 사이트: https://mintring125.github.io/myshowroom/
- `.github/workflows/update.yml` 이 **3시간마다** `npm run update` 를 돌려 `data/` 를 커밋하고 Pages 로 다시 배포합니다.
- 게시물 하나를 바로 넣으려면 GitHub 저장소의 **Actions → update → Run workflow** 에 URL 을 넣거나:

  ```bash
  gh workflow run update.yml -R mintring125/myshowroom -f url=https://x.com/user/status/123
  ```
- 토큰은 `.env` 대신 저장소 Secrets 에 넣습니다. 예:

  ```bash
  gh secret set REDDIT_CLIENT_ID -R mintring125/myshowroom
  ```
- GitHub 는 데이터센터 IP 에서 오는 Reddit 비인증 요청을 자주 막으므로, Actions 에서는 Reddit 키를 넣는 것이 좋습니다.
- Pages 에 올라가는 것은 `index.html`, `css/`, `js/`, `data/cases.js` 뿐입니다.

## 자동 갱신 예약 (Windows)

서버를 켜 두지 않을 때는 작업 스케줄러에 등록하세요. 3시간마다 실행하는 예:

```bash
schtasks /Create /SC HOURLY /MO 3 /TN "myshowroom-update" /TR "cmd /c cd /d C:\Users\김형석일반대초등수학교육\Desktop\XR\showcase-clone && npm run update >> data\update.out.log 2>&1"
```

(폴더를 옮기면 경로를 바꿔 다시 등록하세요. 지우려면 `schtasks /Delete /TN myshowroom-update`)

## 파일

```
index.html, css/, js/          화면 (app.js: 쇼케이스·뷰어·목록, data.js: 카테고리 정의)
data/cases.json                모은 사례 (원본) — cases.js 는 화면용 자동 생성 파일
data/update-log.json           최근 30회 갱신 기록
data/inbox.txt                 추가할 URL 대기열
config/sources.json            수집 설정
scripts/update.mjs             CLI, scripts/serve.mjs 로컬 서버
scripts/lib/adapters/*.mjs     reddit, x, threads, instagram, reference
```

저장(북마크)은 브라우저 localStorage 에만 남습니다.
