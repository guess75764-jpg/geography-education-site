# 🌏 세계지도 퀴즈

학생용 세계지도 국가/도시 맞추기 교육용 게임.

## 실행

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # 배포용 정적 파일 → dist/
```

## 스택

| 역할 | 선택 | 이유 |
| --- | --- | --- |
| 언어 | TypeScript | 지도 데이터(GeoJSON) 구조가 복잡해 타입이 실수를 많이 막아줌 |
| UI | React 18 + Vite | 모드 전환·점수·피드백 같은 상태 관리가 쉽고, 개발 서버가 빠름 |
| 지도 | D3 (`d3-geo`, `d3-zoom`) + SVG | 타일 없는 **백지도**, 국가별 색칠, 클릭 판정에 최적. Leaflet은 타일 지도용이라 이 용도엔 과함 |
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
```

## 다음 단계 아이디어

- 대륙별 출제 / 난이도(작은 나라 포함 여부)
- 제한 시간, 연속 정답 보너스, 최고 점수 저장(localStorage)
- 도시 데이터 확장 (예: Natural Earth populated places)
- 오답 노트: 틀린 문제만 다시 풀기
