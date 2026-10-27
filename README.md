# 🌏 세계지도 퀴즈

고등학생 통합사회·수능 지리 학습용 세계지도 게임.

## 주요 기능

| 화면 | 내용 |
| --- | --- |
| 🏠 홈 | 모드 바로 시작 카드, **명예의 전당 Top 10**(시상대), 칭호 안내 |
| 📖 학습 | 국가 지도 / 도시 지도(여러 개 선택) / **개념 공부**(관리자 개념을 한 문항씩: 나라를 고르면 바로 정답 확인·해설) |
| 🎯 게임 | **개념+위치 타임어택 도전**(관리자 개념 무작위) 10·20·40·60문제 / 연습(국가·도시 이름, 기록 없음) |
| 🔐 관리자 | (화면 맨 아래 ‘관리자’ 또는 주소 끝 `#admin`) 로그인 후 **개념 관리**, **명예의 전당 기록 삭제** |
| 🏆 명예의 전당 | 문제 유형·기간별 Top 50, 칭호 표시 |

### 점수 규칙 (`src/game/scoring.ts` 에서 숫자만 바꾸면 밸런스 조정)
- 정답 100점 + **속도 보너스** 최대 100점 (8초 안에 맞힐수록 큼)
- **콤보 배수**: 연속 정답 3개 ×1.5 → 6개 ×2 → 9개 ×2.5 → 12개 ×3, 틀리면 초기화
- **타임어택 도전 단계** (`CHALLENGES`)

  | 도전 | 문제 수 | 제한 시간 | 성공하면 |
  |---|---|---|---|
  | 지리 실버 도전 | 10 | 1분 | 🥈 지리 실버 |
  | 지리 골드 도전 | 20 | 1분 30초 | 🥇 지리 골드 |
  | 수능 1등급 도전 | 40 | 2분 30초 | 💎 수능 1등급 |
  | 지리박사 도전 | 60 | 5분 | 🎓 지리박사 |

  성공 = 제한 시간 안에 모두 풀고 정답률 80% 이상 (`CLEAR_ACCURACY`). 실패하면 🥉 지리 브론즈.
- 명예의 전당은 도전 단계별 순위 (같은 점수면 빨리 끝낸 순)
- **내 기록 갱신**: 같은 브라우저 + 같은 별명으로 같은 도전 기록이 있으면 “이번 기록으로 갱신(이전 기록 자동 삭제)” 또는 “이번 기록 지우기”를 고름. 다른 학생은 남의 기록을 지울 수 없음 (DB 함수 `submit_score` 가 처리)

### 개념+위치 문제 추가하기
관리자로 로그인 → **개념 관리**에서 개념 문장과 정답(나라 검색·지도 클릭, 또는 도시 위치 클릭)을 넣으면 바로 출제됩니다.
여러 개는 ‘한꺼번에 추가’에 `개념 | 정답` 형식으로 한 줄씩 붙여 넣으면 됩니다. (예: `쌈바 축제로 유명한 나라는? | 브라질`)
출제 중인 개념이 도전 문제 수(10·20·40·60)보다 많으면 한 판에 중복 없이 나옵니다. (관리 화면에 단계별로 표시)
`src/data/hints.ts` 의 기본 개념은 인터넷이 없을 때만 쓰는 예비 문제입니다.

## 실행

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # 배포용 정적 파일 → dist/
npm run build:html  # HTML 파일 하나로 묶기 → dist-single/index.html
```

`build:html` 로 만든 파일은 지도·캐릭터 이미지까지 모두 들어 있어, 인터넷 없이 더블클릭만으로 실행됩니다
(점수 저장·랭킹만 인터넷이 필요). 학교 컴퓨터에 복사하거나 메신저로 나눠 주기 좋습니다.

## Vercel 배포

1. https://vercel.com/new 에서 GitHub 저장소 `geography-education-site` 를 **Import**
2. 설정은 자동 인식(Vite)되며 `vercel.json` 에도 적어 두었음 — 그대로 두면 됨
3. **Environment Variables** 에 두 개 추가 (점수 저장·명예의 전당용)
   - `VITE_SUPABASE_URL` = 프로젝트 URL
   - `VITE_SUPABASE_PUBLISHABLE_KEY` = 공개용 키 (`sb_publishable_…`)
   - ⚠️ 비밀 키(`sb_secret_…`)는 절대 넣지 말 것 (빌드가 에러로 멈춤)
4. **Deploy** → `https://<프로젝트이름>.vercel.app` 주소가 생김
5. 이후 `main` 브랜치에 올라가는 수정은 자동으로 다시 배포됨
   (환경 변수를 나중에 바꿨다면 Deployments → Redeploy 해야 반영)

## 점수 저장 (Supabase) 설정

1. **표 만들기** — Supabase 대시보드 → SQL Editor 에서 아래 파일을 **순서대로** 붙여넣고 Run (여러 번 실행해도 안전)
   - `supabase/migrations/001_create_scores.sql` (기록 표)
   - `supabase/migrations/002_admin_and_concepts.sql` (관리자·개념 표 + 시작용 개념 24개)
   - `supabase/migrations/003_challenges_and_my_records.sql` (도전 단계 + 내 기록 갱신)
2. **관리자 계정** — Authentication → Users → Add user → Create new user (이메일·비밀번호, **Auto Confirm User** 체크) 후 SQL Editor 에서
   `insert into public.admins (user_id) select id from auth.users where email = '선생님이메일';`
   - 권장: Authentication → Sign In / Providers 에서 **Allow new users to sign up** 끄기 (관리자 외 가입 차단)
3. **키 설정** — `cp .env.example .env` 후 값 채우기
   - `VITE_SUPABASE_URL`: 프로젝트 URL
   - `VITE_SUPABASE_PUBLISHABLE_KEY`: Project Settings → API Keys 의 **Publishable key** (`sb_publishable_…`)
4. `npm run dev` 재시작.

> 🔐 **키 보안 규칙**
> - `VITE_` 로 시작하는 값은 사이트 코드에 그대로 들어가 **누구나 볼 수 있습니다.** 여기엔 공개용 키만 넣으세요.
> - `sb_secret_…` 비밀 키는 모든 보안 규칙을 무시하는 관리자 키입니다. 브라우저 코드에 넣지 마세요.
>   실수로 `VITE_` 변수에 넣으면 빌드가 에러로 멈추도록 `vite.config.ts` 에 안전장치를 두었습니다.
> - `.env` 는 `.gitignore` 에 등록되어 GitHub 에 올라가지 않습니다.
> - 배포(Vercel/Netlify 등) 시에는 `.env` 대신 호스팅 서비스의 환경 변수 설정에 같은 값을 넣으세요.
>
> 공개용 키로는 RLS 정책에 따라 점수 **읽기·추가만** 가능하고, 수정·삭제는 불가능합니다.
> 기록 삭제와 개념 추가·수정·삭제는 관리자 명단(`admins`)에 있는 계정으로 로그인했을 때만 DB 가 허용합니다.
> 단, 점수는 브라우저에서 계산되므로 마음먹고 조작한 점수를 보내는 것까지는 막지 못합니다(교실용으로는 충분한 수준).

## 스택

| 역할 | 선택 | 이유 |
| --- | --- | --- |
| 언어 | TypeScript | 지도 데이터(GeoJSON) 구조가 복잡해 타입이 실수를 많이 막아줌 |
| UI | React 18 + Vite | 모드 전환·점수·피드백 같은 상태 관리가 쉽고, 개발 서버가 빠름 |
| 지도 | D3 (`d3-geo`, `d3-zoom`) + SVG, 이퀄 어스 도법 (네모난 바다 배경) | 타일 없는 **백지도**, 국가별 색칠, 클릭 판정에 최적. Leaflet은 타일 지도용이라 이 용도엔 과함 |
| 데이터 | `world-atlas` (Natural Earth 1:50m TopoJSON) | 241개 국가 경계, 오프라인 번들 |
| 국가명 | `Intl.DisplayNames` + `i18n-iso-countries` | 한국어 국가명 자동 |

서버가 필요 없는 정적 사이트라 GitHub Pages / Netlify / Vercel 에 그대로 올릴 수 있다.

## 구조

```
src/
  App.tsx                 모드 전환, 지도 색칠/마커 계산, 클릭 라우팅
  components/
    WorldMap.tsx          D3 투영 + SVG 렌더링, 확대/이동, 클릭 → 국가/경위도 변환
    LearnPanel.tsx        학습 모드: 검색, 선택 국가 정보, 도시 목록
    GamePanel.tsx         게임 모드: 설정, 문제, 정답/오답, 점수
  game/useGame.ts         출제·채점·타이머·콤보 로직 (국가: 클릭한 영역 비교, 도시: 거리 500km 이내)
  game/scoring.ts         점수·콤보 배수·칭호 규칙
  game/fx.ts              정답 폭죽 효과 (canvas-confetti)
  data/hints.ts           수능 힌트 문제 데이터 (기후·자원·해설)
  components/HomePage.tsx 메인 화면
  components/HallOfFame.tsx 명예의 전당 (시상대 + 목록)
  components/GameHud.tsx  지도 위 타이머·콤보·카운트다운·점수 팝업
  components/ReviewList.tsx 게임 후 문제 돌아보기(해설)
  hooks/useWorldData.ts   TopoJSON → GeoJSON + 한국어 이름
  data/cities.ts          도시 목록 (좌표) — 여기에 추가하면 바로 반영
  components/ScoreBoard.tsx  게임 종료 후 닉네임으로 점수 저장 + 순위표
  lib/supabase.ts         Supabase 연결 (.env 미설정 시 저장 기능만 숨김)
  lib/scores.ts           점수 저장/조회
supabase/migrations/      DB 테이블·보안 정책 SQL
```

## 다음 단계 아이디어

- 대륙별 출제 / 난이도(작은 나라 포함 여부)
- 제한 시간, 연속 정답 보너스
- 도시 데이터 확장 (예: Natural Earth populated places)
- 오답 노트: 틀린 문제만 다시 풀기

## 정답 축하 캐릭터

게임에서 정답을 맞히면 지역 브랜드 캐릭터(장소마케팅 사례) 20종 중 하나가 무작위로 등장합니다.
한 바퀴 동안은 같은 캐릭터가 다시 나오지 않습니다.

- 이미지: `src/assets/characters/` (배경 제거한 WebP, 최대 320px)
- 원본 출처: 경남교육청 수업 자료(PDF). 각 캐릭터의 저작권은 해당 지방자치단체 등 원저작자에게 있습니다.
- 교육 목적의 비상업적 사용을 전제로 합니다. 외부 배포 시 각 캐릭터의 이용 조건(공공누리 유형 등)을 확인하세요.
