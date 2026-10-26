import { useMemo, useState } from 'react';
import { colorAt } from '../data/palette';
import { GEO_HINTS, type CountryHint } from '../data/hints';

const HINT_BY_COUNTRY = new Map(
  GEO_HINTS.filter((h): h is CountryHint => h.kind === 'country').map((h) => [h.countryId, h]),
);
import type { City, Country, LearnView } from '../types';

interface Props {
  view: LearnView;
  onViewChange: (v: LearnView) => void;
  countries: Country[];
  cities: City[];
  countryById: Map<string, Country>;
  selectedCountryIds: string[];
  selectedCityIds: string[];
  onToggleCountry: (id: string) => void;
  onToggleCity: (id: string) => void;
  onClear: () => void;
  onShowAll: () => void;
}

export default function LearnPanel({
  view,
  onViewChange,
  countries,
  cities,
  countryById,
  selectedCountryIds,
  selectedCityIds,
  onToggleCountry,
  onToggleCity,
  onClear,
  onShowAll,
}: Props) {
  const [query, setQuery] = useState('');
  const isCountry = view === 'country';
  const selectedIds = isCountry ? selectedCountryIds : selectedCityIds;
  const toggle = isCountry ? onToggleCountry : onToggleCity;

  // 지금 보고 있는 지도 종류만 한국어/영어 이름으로 검색
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const pool: (Country | City)[] = isCountry ? countries : cities;
    return pool
      .filter((c) => c.nameKo.toLowerCase().includes(q) || c.nameEn.toLowerCase().includes(q))
      .slice(0, 8);
  }, [query, isCountry, countries, cities]);

  const pick = (id: string) => {
    toggle(id);
    setQuery('');
  };

  const cityById = useMemo(() => new Map(cities.map((c) => [c.id, c])), [cities]);
  const selectedItems = selectedIds
    .map((id) => (isCountry ? countryById.get(id) : cityById.get(id)))
    .filter((x): x is Country | City => !!x);

  // 도시 목록은 나라 이름 순으로 정렬
  const sortedCities = useMemo(
    () =>
      [...cities].sort(
        (a, b) =>
          (countryById.get(a.countryId)?.nameKo ?? '').localeCompare(countryById.get(b.countryId)?.nameKo ?? '', 'ko') ||
          a.nameKo.localeCompare(b.nameKo, 'ko'),
      ),
    [cities, countryById],
  );

  return (
    <aside className="panel">
      <h2>학습 모드</h2>

      <div className="segmented" role="tablist" aria-label="지도 종류">
        <button role="tab" aria-selected={isCountry} className={isCountry ? 'active' : ''} onClick={() => onViewChange('country')}>
          🗺️ 국가 지도
        </button>
        <button role="tab" aria-selected={!isCountry} className={!isCountry ? 'active' : ''} onClick={() => onViewChange('city')}>
          📍 도시 지도
        </button>
      </div>

      <p className="muted small">
        {isCountry ? '나라' : '도시'}를 검색하거나 지도에서 클릭하면 색칠돼요. 여러 개를 함께 고를 수 있고, 다시 누르면 해제돼요.
      </p>

      <div className="search">
        <input
          type="search"
          placeholder={isCountry ? '예: 프랑스, Brazil' : '예: 도쿄, Paris'}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && results[0] && pick(results[0].id)}
        />
        {results.length > 0 && (
          <ul className="search-results">
            {results.map((r) => {
              const on = selectedIds.includes(r.id);
              const country = 'countryId' in r ? countryById.get(r.countryId) : null;
              return (
                <li key={r.id}>
                  <button onClick={() => pick(r.id)}>
                    <span className={`tag tag-${view}`}>{on ? '✓ 선택됨' : isCountry ? '국가' : '도시'}</span>
                    {r.nameKo}
                    <span className="muted">{country ? country.nameKo : r.nameEn}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="info-card">
        <div className="selected-head">
          <h4>
            선택한 {isCountry ? '나라' : '도시'} <span className="muted">{selectedItems.length}개</span>
          </h4>
          {selectedItems.length > 0 && (
            <div className="selected-actions">
              <button className="link" onClick={onShowAll}>
                모두 보기
              </button>
              <button className="link danger" onClick={onClear}>
                전체 해제
              </button>
            </div>
          )}
        </div>
        {selectedItems.length === 0 ? (
          <p className="muted small">아직 선택한 {isCountry ? '나라' : '도시'}가 없어요.</p>
        ) : (
          <ul className="selected-list">
            {selectedItems.map((item, i) => (
              <li key={item.id}>
                <span className="swatch" style={{ background: colorAt(i) }} />
                <span className="sel-name">
                  {item.nameKo}
                  <span className="muted small">
                    {' '}
                    {'countryId' in item ? countryById.get(item.countryId)?.nameKo ?? '' : item.nameEn}
                  </span>
                </span>
                <button className="remove" aria-label={`${item.nameKo} 선택 해제`} onClick={() => toggle(item.id)}>
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 수능 포인트: 선택한 나라 중 힌트 데이터가 있는 나라의 기후·자원 */}
      {isCountry &&
        selectedCountryIds
          .map((id) => HINT_BY_COUNTRY.get(id))
          .filter((h): h is CountryHint => !!h)
          .map((h) => (
            <div key={h.id} className="exam-point">
              <h4>📝 수능 포인트 · {h.answer}</h4>
              <p className="small">
                <b>기후</b> {h.climate}
              </p>
              <div className="chips">
                {h.resources.map((r) => (
                  <span key={r} className="chip static">
                    {r}
                  </span>
                ))}
              </div>
              <p className="small">💡 {h.explanation}</p>
            </div>
          ))}

      {!isCountry && (
        <div>
          <h4 className="list-title">도시 목록</h4>
          <div className="chips city-chips">
            {sortedCities.map((c) => {
              const idx = selectedCityIds.indexOf(c.id);
              return (
                <button
                  key={c.id}
                  className={`chip ${idx >= 0 ? 'active' : ''}`}
                  style={idx >= 0 ? { background: colorAt(idx), borderColor: colorAt(idx) } : undefined}
                  title={countryById.get(c.countryId)?.nameKo}
                  onClick={() => onToggleCity(c.id)}
                >
                  {c.nameKo}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </aside>
  );
}
