# 🌏 세계지도 퀴즈

학생용 세계지도 국가/도시 맞추기 교육용 게임.

## 실행

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # 배포용 정적 파일 → dist/
```

## 점수 저장 (Supabase) 설정

1. **표 만들기** — Supabase 대시보드 → SQL Editor 에 `supabase/migrations/001_create_scores.sql` 내용을 붙여넣고 Run.
2. **키 설정** — `cp .env.example .env` 후 값 채우기
   - `VITE_SUPABASE_URL`: 프로젝트 URL
   - `VITE_SUPABASE_PUBLISHABLE_KEY`: Project Settings → API Keys 의 **Publishable key** (`sb_publishable_…`)
3. `npm run dev` 재시작.

> 🔐 **키 보안 규칙**
> - `VITE_` 로 시작하는 값은 사이트 코드에 그대로 들어가 **누구나 볼 수 있습니다.** 여기엔 공개용 키만 넣으세요.
> - `sb_secret_…` 비밀 키는 모든 보안 규칙을 무시하는 관리자 키입니다. 브라우저 코드에 넣지 마세요.
>   실수로 `VITE_` 변수에 넣으면 빌드가 에러로 멈추도록 `vite.config.ts` 에 안전장치를 두었습니다.
> - `.env` 는 `.gitignore` 에 등록되어 GitHub 에 올라가지 않습니다.
> - 배포(Vercel/Netlify 등) 시에는 `.env` 대신 호스팅 서비스의 환경 변수 설정에 같은 값을 넣으세요.
>
> 공개용 키로는 RLS 정책에 따라 점수 **읽기·추가만** 가능하고, 수정·삭제는 불가능합니다.
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
  game/useGame.ts         출제·채점 로직 (국가: 클릭한 영역 비교, 도시: 거리 500km 이내)
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
