import { useMemo, useState } from 'react';
import WorldMap, { type MapClick, type MapFocus, type MapMarker } from './components/WorldMap';
import LearnPanel from './components/LearnPanel';
import GamePanel from './components/GamePanel';
import RankingPage from './components/RankingPage';
import { useWorldData } from './hooks/useWorldData';
import { useGame } from './game/useGame';
import { CITIES } from './data/cities';
import { colorAt } from './data/palette';
import type { RankingFilter } from './lib/scores';
import type { HighlightMap, LearnView, Mode } from './types';

const CITY_BY_ID = new Map(CITIES.map((c) => [c.id, c]));
const WORLD: MapFocus = { countryIds: [], points: [] };

/** 목록에 있으면 빼고, 없으면 끝에 추가 */
const toggleIn = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

export default function App() {
  const countries = useWorldData();
  const countryById = useMemo(() => new Map(countries.map((c) => [c.id, c])), [countries]);

  const [mode, setMode] = useState<Mode>('learn');

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
        ? { countryIds: [], points: ids.flatMap((id) => {
            const c = CITY_BY_ID.get(id);
            return c ? [[c.lon, c.lat] as [number, number]] : [];
          }) }
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

  // ── 랭킹 ──
  const [rankingFilter, setRankingFilter] = useState<RankingFilter>({ kind: 'country', total: 10, period: 'all' });

  const switchMode = (m: Mode) => {
    setMode(m);
    game.reset();
  };
  const openRankingFromGame = () => {
    setRankingFilter({ kind: game.kind, total: game.total, period: 'all' });
    switchMode('ranking');
  };

  // ── 지도 클릭 처리 ──
  const handleMapClick = ({ country, lonLat, markerId }: MapClick) => {
    if (mode === 'learn') {
      if (learnView === 'country' && country && !country.id.startsWith('x-')) toggleCountry(country.id, false);
      if (learnView === 'city' && markerId) toggleCity(markerId, false);
    } else if (mode === 'game') {
      game.submit(country?.id ?? null, lonLat);
    }
  };

  // ── 학습 모드 지도 색/점 ──
  const countryFills = useMemo(
    () => Object.fromEntries(selCountries.map((id, i) => [id, colorAt(i)])),
    [selCountries],
  );
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

  // ── 게임 모드 지도 색/점 ──
  const gameView = useMemo(() => {
    const highlights: HighlightMap = {};
    const markers: MapMarker[] = [];
    if (game.current && game.answer) {
      const q = game.current;
      const a = game.answer;
      if (q.kind === 'country') {
        highlights[q.country.id] = 'correct';
        if (!a.correct && a.clickedCountryId) highlights[a.clickedCountryId] = 'wrong';
      } else {
        markers.push({ ...q.city, tone: 'correct', label: q.city.nameKo });
        if (!a.correct && a.clickedLonLat) {
          markers.push({ id: 'clicked', lon: a.clickedLonLat[0], lat: a.clickedLonLat[1], tone: 'wrong' });
        }
      }
    }
    return { highlights, markers };
  }, [game.current, game.answer]);

  return (
    <div className="app">
      <header className="topbar">
        <h1>🌏 세계지도 퀴즈</h1>
        <nav className="tabs">
          <button className={mode === 'learn' ? 'active' : ''} onClick={() => switchMode('learn')}>
            📖 학습 모드
          </button>
          <button className={mode === 'game' ? 'active' : ''} onClick={() => switchMode('game')}>
            🎯 게임 모드
          </button>
          <button className={mode === 'ranking' ? 'active' : ''} onClick={() => switchMode('ranking')}>
            🏆 랭킹
          </button>
        </nav>
      </header>

      {mode === 'ranking' ? (
        <main className="layout single">
          <RankingPage initial={rankingFilter} />
        </main>
      ) : (
        <main className="layout">
          <section className="map-area">
            {mode === 'learn' && learnView === 'country' && (
              <WorldMap
                key="learn-country"
                countries={countries}
                fillColors={countryFills}
                focus={countryFocus}
                onMapClick={handleMapClick}
              />
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
              <WorldMap
                key="game"
                countries={countries}
                highlights={gameView.highlights}
                markers={gameView.markers}
                onMapClick={handleMapClick}
                showTooltip={false}
              />
            )}
          </section>

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
