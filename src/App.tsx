import { useMemo, useState } from 'react';
import WorldMap, { type MapClick, type MapMarker } from './components/WorldMap';
import LearnPanel from './components/LearnPanel';
import GamePanel from './components/GamePanel';
import { useWorldData } from './hooks/useWorldData';
import { useGame } from './game/useGame';
import { CITIES } from './data/cities';
import type { City, Country, HighlightMap, Mode } from './types';

export default function App() {
  const countries = useWorldData();
  const countryById = useMemo(() => new Map(countries.map((c) => [c.id, c])), [countries]);

  const [mode, setMode] = useState<Mode>('learn');

  // ── 학습 모드 상태 ──
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(null);
  const [selectedCity, setSelectedCity] = useState<City | null>(null);

  const selectCountry = (c: Country | null) => {
    setSelectedCountry(c);
    if (!c || selectedCity?.countryId !== c.id) setSelectedCity(null);
  };
  const selectCity = (city: City) => {
    setSelectedCity(city);
    setSelectedCountry(countryById.get(city.countryId) ?? null);
  };

  // ── 게임 모드 상태 ──
  const game = useGame(countries, CITIES);

  const switchMode = (m: Mode) => {
    setMode(m);
    setSelectedCountry(null);
    setSelectedCity(null);
    game.reset();
  };

  // ── 지도 클릭 처리 ──
  const handleMapClick = ({ country, lonLat, markerId }: MapClick) => {
    if (mode === 'learn') {
      const city = markerId ? CITIES.find((c) => c.id === markerId) : undefined;
      if (city) selectCity(city);
      else if (country) selectCountry(country);
    } else {
      game.submit(country?.id ?? null, lonLat);
    }
  };

  // ── 지도에 칠할 색 / 찍을 점 계산 ──
  const { highlights, markers } = useMemo(() => {
    const highlights: HighlightMap = {};
    const markers: MapMarker[] = [];

    if (mode === 'learn') {
      if (selectedCountry) highlights[selectedCountry.id] = 'selected';
      for (const c of CITIES) {
        const isSel = selectedCity?.id === c.id;
        // 선택한 나라의 도시는 이름까지 보여준다
        const showLabel = isSel || c.countryId === selectedCountry?.id;
        markers.push({ ...c, tone: isSel ? 'selected' : 'city', label: showLabel ? c.nameKo : undefined });
      }
    } else if (game.current && game.answer) {
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
  }, [mode, selectedCountry, selectedCity, game.current, game.answer]);

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
        </nav>
      </header>

      <main className="layout">
        <section className="map-area">
          <WorldMap
            countries={countries}
            highlights={highlights}
            markers={markers}
            focusCountryId={mode === 'learn' ? selectedCountry?.id ?? null : null}
            onMapClick={handleMapClick}
            showTooltip={mode === 'learn'}
          />
        </section>

        {mode === 'learn' ? (
          <LearnPanel
            countries={countries}
            cities={CITIES}
            selectedCountry={selectedCountry}
            selectedCity={selectedCity}
            onSelectCountry={selectCountry}
            onSelectCity={selectCity}
          />
        ) : (
          <GamePanel game={game} countryById={countryById} />
        )}
      </main>
    </div>
  );
}
