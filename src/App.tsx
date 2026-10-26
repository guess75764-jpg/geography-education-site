import { useEffect, useMemo, useRef, useState } from 'react';
import WorldMap, { type MapClick, type MapFocus, type MapMarker } from './components/WorldMap';
import LearnPanel from './components/LearnPanel';
import GamePanel from './components/GamePanel';
import GameHud, { type FloatingPoint } from './components/GameHud';
import ReviewList from './components/ReviewList';
import RankingPage from './components/RankingPage';
import HomePage from './components/HomePage';
import Celebration, { usePreloadCharacters } from './components/Celebration';
import { useWorldData } from './hooks/useWorldData';
import { useGame, type QuizType } from './game/useGame';
import { comboMultiplier } from './game/scoring';
import { fireComboLevelUp, fireCorrect } from './game/fx';
import { CITIES } from './data/cities';
import { colorAt } from './data/palette';
import type { RankingFilter } from './lib/scores';
import type { HighlightMap, LearnView, Mode } from './types';

const CITY_BY_ID = new Map(CITIES.map((c) => [c.id, c]));
const WORLD: MapFocus = { countryIds: [], points: [] };

/** 목록에 있으면 빼고, 없으면 끝에 추가 */
const toggleIn = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

const NAV: [Mode, string][] = [
  ['home', '🏠 홈'],
  ['learn', '📖 학습'],
  ['game', '🎯 게임'],
  ['ranking', '🏆 명예의 전당'],
];

export default function App() {
  const countries = useWorldData();
  const countryById = useMemo(() => new Map(countries.map((c) => [c.id, c])), [countries]);

  const [mode, setMode] = useState<Mode>('home');

  // ── 학습 모드: 국가 지도 / 도시 지도 각각 여러 개 선택 ──
  const [learnView, setLearnView] = useState<LearnView>('country');
  const [selCountries, setSelCountries] = useState<string[]>([]);
  const [selCities, setSelCities] = useState<string[]>([]);
  // 지도별 확대 요청 (패널에서 고를 때만 이동하고, 지도를 직접 클릭할 때는 그대로 둔다)
  const [countryFocus, setCountryFocus] = useState<MapFocus | null>(null);
  const [cityFocus, setCityFocus] = useState<MapFocus | null>(null);

  const fitCountries = (ids: string[]) => setCountryFocus(ids.length ? { countryIds: ids, points: [] } : WORLD);
  const fitCities = (ids: string[]) =>
    setCityFocus(
      ids.length
        ? {
            countryIds: [],
            points: ids.flatMap((id) => {
              const c = CITY_BY_ID.get(id);
              return c ? [[c.lon, c.lat] as [number, number]] : [];
            }),
          }
        : WORLD,
    );

  const toggleCountry = (id: string, zoomToFit: boolean) => {
    const next = toggleIn(selCountries, id);
    setSelCountries(next);
    if (zoomToFit) fitCountries(next);
  };
  const toggleCity = (id: string, zoomToFit: boolean) => {
    const next = toggleIn(selCities, id);
    setSelCities(next);
    if (zoomToFit) fitCities(next);
  };

  // ── 게임 모드 ──
  const game = useGame(countries, CITIES);
  usePreloadCharacters();

  // ── 명예의 전당 ──
  const [rankingFilter, setRankingFilter] = useState<RankingFilter>({ kind: 'all', period: 'all' });

  const switchMode = (m: Mode) => {
    setMode(m);
    game.reset();
  };
  const startFromHome = (t: QuizType) => {
    setMode('game');
    game.start(t, 'timeattack');
  };
  const openRankingFromGame = () => {
    setRankingFilter({ kind: game.type, period: 'all' });
    switchMode('ranking');
  };

  // ── 정답/오답 연출: 폭죽, 점수 팝업, 캐릭터 ──
  const mapAreaRef = useRef<HTMLElement>(null);
  const lastClick = useRef({ clientX: 0, clientY: 0, x: 0, y: 0 });
  const [floats, setFloats] = useState<FloatingPoint[]>([]);
  const [cheer, setCheer] = useState<{ id: number; combo: number } | null>(null);

  useEffect(() => {
    const r = game.lastResult;
    if (!r) return;
    const { clientX, clientY, x, y } = lastClick.current;
    const id = Date.now();
    setFloats((fs) => [...fs, { id, x, y, text: r.correct ? `+${r.points}` : 'MISS', good: r.correct }]);
    // 팝업마다 1초 뒤 사라짐 (다음 문제로 넘어가도 취소하지 않음)
    setTimeout(() => setFloats((fs) => fs.filter((f) => f.id !== id)), 1000);
    if (!r.correct) return;
    fireCorrect(clientX, clientY, r.combo);
    if (comboMultiplier(r.combo) > comboMultiplier(r.combo - 1)) fireComboLevelUp();
    setCheer({ id, combo: r.combo });
  }, [game.lastResult]);

  // 캐릭터는 다음 문제로 넘어가도 1.7초 동안 보였다가 사라진다 (새 정답이 나오면 교체)
  useEffect(() => {
    if (!cheer) return;
    const id = setTimeout(() => setCheer(null), 1700);
    return () => clearTimeout(id);
  }, [cheer]);
  // 새 게임을 시작하거나 화면을 바꾸면 남은 연출을 정리
  useEffect(() => {
    if (game.phase === 'ready' || game.phase === 'countdown' || mode !== 'game') {
      setCheer(null);
      setFloats([]);
    }
  }, [game.phase, mode]);

  // ── 지도 클릭 처리 ──
  const handleMapClick = ({ country, lonLat, markerId }: MapClick) => {
    if (mode === 'learn') {
      if (learnView === 'country' && country && !country.id.startsWith('x-')) toggleCountry(country.id, false);
      if (learnView === 'city' && markerId) toggleCity(markerId, false);
    } else if (mode === 'game') {
      game.submit(country?.id ?? null, lonLat);
    }
  };
  // 폭죽·점수 팝업 위치를 위해 클릭 좌표를 기억 (지도 클릭 처리보다 먼저 실행됨)
  const rememberClick = (e: React.MouseEvent) => {
    const rect = mapAreaRef.current?.getBoundingClientRect();
    lastClick.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      x: e.clientX - (rect?.left ?? 0),
      y: e.clientY - (rect?.top ?? 0),
    };
  };

  // ── 학습 모드 지도 색/점 ──
  const countryFills = useMemo(() => Object.fromEntries(selCountries.map((id, i) => [id, colorAt(i)])), [selCountries]);
  const cityMarkers = useMemo<MapMarker[]>(() => {
    const unselected: MapMarker[] = [];
    const selected: MapMarker[] = [];
    for (const c of CITIES) {
      const idx = selCities.indexOf(c.id);
      const country = countryById.get(c.countryId)?.nameKo;
      const name = country ? `${c.nameKo} (${country})` : c.nameKo;
      if (idx >= 0) selected.push({ ...c, name, tone: 'selected', color: colorAt(idx), label: c.nameKo });
      else unselected.push({ ...c, name, tone: 'city' });
    }
    return [...unselected, ...selected]; // 선택한 점이 위에 그려지도록
  }, [selCities, countryById]);

  // ── 게임 모드 지도 색/점: 답한 직후 정답(초록)과 내가 고른 곳(빨강) ──
  const gameView = useMemo(() => {
    const highlights: HighlightMap = {};
    const markers: MapMarker[] = [];
    const q = game.current;
    const a = game.lastResult;
    if (q && a) {
      if (q.target.type === 'country') {
        highlights[q.target.countryId] = 'correct';
        if (!a.correct && a.clickedCountryId) highlights[a.clickedCountryId] = 'wrong';
      } else {
        markers.push({ id: 'answer', lon: q.target.lon, lat: q.target.lat, tone: 'correct', label: q.answerName });
        if (!a.correct && a.clickedLonLat) {
          markers.push({ id: 'clicked', lon: a.clickedLonLat[0], lat: a.clickedLonLat[1], tone: 'wrong' });
        }
      }
    }
    return { highlights, markers };
  }, [game.current, game.lastResult]);

  return (
    <div className="app">
      <header className="topbar">
        <h1>
          <span className="logo">🌏</span> 세계지도 퀴즈
        </h1>
        <nav className="tabs">
          {NAV.map(([m, label]) => (
            <button key={m} className={mode === m ? 'active' : ''} onClick={() => switchMode(m)}>
              {label}
            </button>
          ))}
        </nav>
      </header>

      {mode === 'home' ? (
        <main className="page">
          <HomePage onStart={startFromHome} onLearn={() => switchMode('learn')} />
        </main>
      ) : mode === 'ranking' ? (
        <main className="page narrow">
          <RankingPage initial={rankingFilter} />
        </main>
      ) : (
        <main className="layout">
          <div className="map-column">
            <section className="map-area" ref={mapAreaRef} onClickCapture={rememberClick}>
              {mode === 'learn' && learnView === 'country' && (
                <WorldMap key="learn-country" countries={countries} fillColors={countryFills} focus={countryFocus} onMapClick={handleMapClick} />
              )}
              {mode === 'learn' && learnView === 'city' && (
                <WorldMap
                  key="learn-city"
                  countries={countries}
                  markers={cityMarkers}
                  markerScale={1.3}
                  focus={cityFocus}
                  onMapClick={handleMapClick}
                />
              )}
              {mode === 'game' && (
                <>
                  <WorldMap
                    key="game"
                    countries={countries}
                    highlights={gameView.highlights}
                    markers={gameView.markers}
                    onMapClick={handleMapClick}
                    showTooltip={false}
                  />
                  <GameHud game={game} floats={floats} />
                  {cheer && <Celebration key={cheer.id} combo={cheer.combo} />}
                </>
              )}
            </section>
            {mode === 'game' && game.phase === 'finished' && <ReviewList results={game.results} />}
          </div>

          {mode === 'learn' ? (
            <LearnPanel
              view={learnView}
              onViewChange={setLearnView}
              countries={countries}
              cities={CITIES}
              countryById={countryById}
              selectedCountryIds={selCountries}
              selectedCityIds={selCities}
              onToggleCountry={(id) => toggleCountry(id, true)}
              onToggleCity={(id) => toggleCity(id, true)}
              onClear={() => {
                if (learnView === 'country') {
                  setSelCountries([]);
                  fitCountries([]);
                } else {
                  setSelCities([]);
                  fitCities([]);
                }
              }}
              onShowAll={() => (learnView === 'country' ? fitCountries(selCountries) : fitCities(selCities))}
            />
          ) : (
            <GamePanel game={game} countryById={countryById} onOpenRanking={openRankingFromGame} />
          )}
        </main>
      )}
    </div>
  );
}
