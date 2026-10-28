import { useEffect, useMemo, useState } from 'react';
import { areaOf } from '../lib/geoCache';
import WorldMap, { type MapClick, type MapFocus, type MapLabel, type MapMarker } from './WorldMap';
import atlas from '../data/atlas.json';
import type { Country } from '../types';

// ───────────── 대륙 ─────────────
export type ContinentId = 'asia' | 'europe' | 'northAmerica' | 'latinAmerica' | 'africa' | 'oceania';

const CONTINENTS: { id: ContinentId; name: string; emoji: string; box: [[number, number], [number, number]] }[] = [
  { id: 'asia', name: '아시아', emoji: '🌏', box: [[25, -12], [150, 56]] },
  { id: 'europe', name: '유럽', emoji: '🏰', box: [[-25, 34], [45, 71]] },
  { id: 'northAmerica', name: '북아메리카', emoji: '🗽', box: [[-170, 18], [-15, 80]] },
  { id: 'latinAmerica', name: '중남미', emoji: '🌎', box: [[-118, -56], [-34, 33]] },
  { id: 'africa', name: '아프리카', emoji: '🦁', box: [[-20, -36], [55, 38]] },
  { id: 'oceania', name: '오세아니아', emoji: '🐨', box: [[110, -48], [180, 0]] },
];

interface AtlasCity {
  nameKo: string;
  nameEn: string;
  countryId: string;
  lon: number;
  lat: number;
  capital: boolean;
  rank: number;
  pop: number;
}

const COUNTRY_CONTINENTS = atlas.countryContinents as Record<string, ContinentId[]>;
const CITIES = atlas.cities as AtlasCity[];

/** 대륙 상자 → 확대 요청 (모서리와 변의 가운데 점) */
function boxFocus([[x0, y0], [x1, y1]]: [[number, number], [number, number]]): MapFocus {
  const mx = (x0 + x1) / 2;
  return { countryIds: [], points: [[x0, y0], [x1, y0], [x0, y1], [x1, y1], [mx, y0], [mx, y1]] };
}

type CityLevel = 'none' | 'capital' | 'all';

/** 백지도 학습: 대륙별로 나라·도시 이름을 지도에서 익힌다 */
export default function AtlasPage({ countries, countryById }: { countries: Country[]; countryById: Map<string, Country> }) {
  const [continent, setContinent] = useState<ContinentId>('asia');
  const [showCountries, setShowCountries] = useState(true);
  const [cityLevel, setCityLevel] = useState<CityLevel>('capital');
  const [hideMode, setHideMode] = useState(false); // 이름 가리기: 클릭하면 하나씩 공개
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<string | null>(null);
  const [focus, setFocus] = useState<MapFocus | null>(() => boxFocus(CONTINENTS[0].box));
  const [query, setQuery] = useState('');

  const cont = CONTINENTS.find((c) => c.id === continent)!;

  // 이 대륙의 나라·도시 (수도 정보가 없는 아주 작은 속령은 빼서 교과서 수준으로)
  const hasCapital = useMemo(() => new Set(CITIES.filter((c) => c.capital).map((c) => c.countryId)), []);
  const contCountries = useMemo(
    () =>
      countries
        .filter((c) => (COUNTRY_CONTINENTS[c.id] ?? []).includes(continent))
        .filter((c) => hasCapital.has(c.id) || areaOf(c) > 0.0003)
        .sort((a, b) => a.nameKo.localeCompare(b.nameKo, 'ko')),
    [countries, continent, hasCapital],
  );
  const contIds = useMemo(() => new Set(contCountries.map((c) => c.id)), [contCountries]);
  const contCities = useMemo(
    () => CITIES.map((c, i) => ({ ...c, key: `atlas-${i}` })).filter((c) => contIds.has(c.countryId)),
    [contIds],
  );
  // 수도 이름 (남아프리카 공화국·볼리비아처럼 수도가 여럿이면 모두)
  const capitalOf = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of contCities) if (c.capital) m.set(c.countryId, m.has(c.countryId) ? `${m.get(c.countryId)}·${c.nameKo}` : c.nameKo);
    return m;
  }, [contCities]);
  const area = useMemo(() => new Map(countries.map((c) => [c.id, areaOf(c)])), [countries]);

  const changeContinent = (id: ContinentId) => {
    setContinent(id);
    setSelected(null);
    setRevealed(new Set());
    setFocus(boxFocus(CONTINENTS.find((c) => c.id === id)!.box));
  };
  useEffect(() => setRevealed(new Set()), [hideMode]);

  const selectCountry = (id: string, zoom: boolean) => {
    setSelected(id);
    if (hideMode) setRevealed((r) => new Set(r).add(`c:${id}`));
    if (zoom) setFocus({ countryIds: [id], points: [] });
  };

  const onMapClick = ({ country, markerId }: MapClick) => {
    if (markerId?.startsWith('atlas-')) {
      const city = contCities.find((c) => c.key === markerId);
      if (city) {
        setRevealed((r) => new Set(r).add(`p:${markerId}`));
        setSelected(city.countryId);
      }
      return;
    }
    if (country && contIds.has(country.id)) selectCountry(country.id, false);
  };

  // ── 지도 색: 이 대륙은 흰색, 다른 대륙은 회색, 고른 나라는 파랑, 가리기 모드에서 맞힌(공개한) 나라는 연두 ──
  const fills = useMemo(() => {
    const f: Record<string, string> = {};
    for (const c of countries) if (!contIds.has(c.id)) f[c.id] = '#e2e8f0';
    if (hideMode) for (const k of revealed) if (k.startsWith('c:')) f[k.slice(2)] = '#bbf7d0';
    if (selected) f[selected] = '#93c5fd';
    return f;
  }, [countries, contIds, hideMode, revealed, selected]);

  // ── 도시 점과 이름표 ──
  const shownCities = cityLevel === 'none' ? [] : contCities.filter((c) => cityLevel === 'all' || c.capital);
  const markers = useMemo<MapMarker[]>(
    () =>
      shownCities.map((c) => ({
        id: c.key,
        lon: c.lon,
        lat: c.lat,
        tone: 'city',
        color: c.capital ? '#dc2626' : '#64748b',
        name: hideMode && !revealed.has(`p:${c.key}`) ? undefined : c.nameKo,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cityLevel, contCities, hideMode, revealed],
  );
  const labels = useMemo<MapLabel[]>(() => {
    const out: MapLabel[] = [];
    if (showCountries) {
      for (const c of contCountries) {
        if (hideMode && !revealed.has(`c:${c.id}`)) continue;
        out.push({ id: `c-${c.id}`, text: c.nameKo, tone: 'country', countryId: c.id, priority: (area.get(c.id) ?? 0) * 1e5 + (c.id === selected ? 1e7 : 0) });
      }
    }
    for (const c of shownCities) {
      if (hideMode && !revealed.has(`p:${c.key}`)) continue;
      const weight = Math.log10(Math.max(c.pop, 10));
      out.push({
        id: c.key,
        text: c.nameKo,
        tone: c.capital ? 'capital' : 'city',
        lon: c.lon,
        lat: c.lat,
        offsetY: 11,
        priority: (c.capital ? 30 : 5) + weight + (c.countryId === selected ? 1e6 : 0),
      });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCountries, contCountries, cityLevel, contCities, hideMode, revealed, selected, area]);

  const sel = selected ? countryById.get(selected) : null;
  const selCities = selected ? contCities.filter((c) => c.countryId === selected) : [];
  const revealedCount = [...revealed].filter((k) => k.startsWith('c:')).length;
  const listed = contCountries.filter((c) => {
    const q = query.trim();
    return !q || c.nameKo.includes(q) || c.nameEn.toLowerCase().includes(q.toLowerCase()) || capitalOf.get(c.id)?.includes(q);
  });

  return (
    <>
      <div className="map-column">
        <section className="map-area atlas-map">
          <WorldMap
            key="atlas"
            countries={countries}
            fillColors={fills}
            markers={markers}
            markerScale={0.75}
            labels={labels}
            labelMode="hide"
            focus={focus}
            onMapClick={onMapClick}
            showTooltip={!hideMode}
          />
          <div className="atlas-legend">
            <span>
              <i className="dot cap" /> 수도
            </span>
            <span>
              <i className="dot city" /> 주요 도시
            </span>
            <span className="muted">확대하면 작은 나라·도시 이름도 보여요</span>
          </div>
        </section>
      </div>

      <aside className="panel atlas-panel">
        <h2>🗺️ 백지도 학습</h2>
        <div className="continent-grid">
          {CONTINENTS.map((c) => (
            <button key={c.id} className={`continent-btn ${continent === c.id ? 'active' : ''}`} onClick={() => changeContinent(c.id)}>
              <span>{c.emoji}</span>
              {c.name}
            </button>
          ))}
        </div>

        <div className="atlas-options">
          <label className="check">
            <input type="checkbox" checked={showCountries} onChange={(e) => setShowCountries(e.target.checked)} /> 나라 이름
          </label>
          <div className="segmented small-seg">
            {(
              [
                ['none', '도시 없음'],
                ['capital', '수도'],
                ['all', '수도+주요 도시'],
              ] as [CityLevel, string][]
            ).map(([v, t]) => (
              <button key={v} className={cityLevel === v ? 'active' : ''} onClick={() => setCityLevel(v)}>
                {t}
              </button>
            ))}
          </div>
          <label className="check hide-toggle">
            <input type="checkbox" checked={hideMode} onChange={(e) => setHideMode(e.target.checked)} /> 🙈 이름 가리기 (클릭하면 공개)
          </label>
          <button className="link small" onClick={() => setFocus(boxFocus(cont.box))}>
            ↺ {cont.name} 전체 보기
          </button>
        </div>

        {sel && (
          <div className="atlas-card">
            <h3>{hideMode && !revealed.has(`c:${sel.id}`) ? '?' : sel.nameKo}</h3>
            <p className="muted small">{sel.nameEn}</p>
            {selCities.length > 0 && (
              <ul>
                {selCities.map((c) => (
                  <li key={c.key}>
                    {c.capital ? '★ 수도 ' : '· '}
                    <b>{c.nameKo}</b> <span className="muted small">{c.nameEn}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {hideMode ? (
          <div className="hide-progress">
            <p>
              <b>{revealedCount}</b> / {contCountries.length}개 나라 확인
            </p>
            <div className="study-progress">
              <span style={{ width: `${(revealedCount / Math.max(1, contCountries.length)) * 100}%` }} />
            </div>
            <p className="muted small">나라를 떠올린 뒤 지도에서 클릭해 이름을 확인하세요. 도시 점을 눌러도 이름이 나와요.</p>
            <div className="form-actions">
              <button className="secondary" onClick={() => setRevealed(new Set(contCountries.map((c) => `c:${c.id}`)))}>
                모두 공개
              </button>
              <button className="secondary" onClick={() => setRevealed(new Set())}>
                다시 가리기
              </button>
            </div>
          </div>
        ) : (
          <>
            <input className="atlas-search" type="search" placeholder={`${cont.name} 나라·수도 검색`} value={query} onChange={(e) => setQuery(e.target.value)} />
            <ul className="atlas-list">
              {listed.map((c) => (
                <li key={c.id}>
                  <button className={selected === c.id ? 'on' : ''} onClick={() => selectCountry(c.id, true)}>
                    <span className="nm">{c.nameKo}</span>
                    <span className="muted small">{capitalOf.get(c.id) ?? ''}</span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="muted small">
              {cont.name} {contCountries.length}개 나라 · 도시 {contCities.length}곳
            </p>
          </>
        )}
      </aside>
    </>
  );
}
