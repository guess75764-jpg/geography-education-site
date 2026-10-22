import { useMemo, useState } from 'react';
import type { City, Country } from '../types';

interface Props {
  countries: Country[];
  cities: City[];
  selectedCountry: Country | null;
  selectedCity: City | null;
  onSelectCountry: (c: Country | null) => void;
  onSelectCity: (c: City) => void;
}

type SearchItem = { type: 'country'; item: Country } | { type: 'city'; item: City };

export default function LearnPanel({
  countries,
  cities,
  selectedCountry,
  selectedCity,
  onSelectCountry,
  onSelectCity,
}: Props) {
  const [query, setQuery] = useState('');

  // 한국어/영어 이름으로 국가와 도시를 함께 검색
  const results = useMemo<SearchItem[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const match = (ko: string, en: string) => ko.toLowerCase().includes(q) || en.toLowerCase().includes(q);
    return [
      ...countries.filter((c) => match(c.nameKo, c.nameEn)).map((item) => ({ type: 'country' as const, item })),
      ...cities.filter((c) => match(c.nameKo, c.nameEn)).map((item) => ({ type: 'city' as const, item })),
    ].slice(0, 8);
  }, [query, countries, cities]);

  const citiesInCountry = selectedCountry ? cities.filter((c) => c.countryId === selectedCountry.id) : [];

  const pick = (r: SearchItem) => {
    if (r.type === 'country') onSelectCountry(r.item);
    else onSelectCity(r.item);
    setQuery('');
  };

  return (
    <aside className="panel">
      <h2>학습 모드</h2>
      <p className="muted">나라나 도시를 검색하거나 지도에서 직접 클릭해 보세요.</p>

      <div className="search">
        <input
          type="search"
          placeholder="예: 프랑스, 도쿄, Brazil"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && results[0] && pick(results[0])}
        />
        {results.length > 0 && (
          <ul className="search-results">
            {results.map((r) => (
              <li key={`${r.type}-${r.item.id}`}>
                <button onClick={() => pick(r)}>
                  <span className={`tag tag-${r.type}`}>{r.type === 'country' ? '국가' : '도시'}</span>
                  {r.item.nameKo} <span className="muted">{r.item.nameEn}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {selectedCountry ? (
        <div className="info-card">
          <h3>{selectedCountry.nameKo}</h3>
          <p className="muted">{selectedCountry.nameEn}</p>
          {selectedCity && (
            <p>
              📍 선택한 도시: <strong>{selectedCity.nameKo}</strong>
            </p>
          )}
          {citiesInCountry.length > 0 && (
            <>
              <h4>주요 도시</h4>
              <div className="chips">
                {citiesInCountry.map((c) => (
                  <button
                    key={c.id}
                    className={`chip ${selectedCity?.id === c.id ? 'active' : ''}`}
                    onClick={() => onSelectCity(c)}
                  >
                    {c.nameKo}
                  </button>
                ))}
              </div>
            </>
          )}
          <button className="link" onClick={() => onSelectCountry(null)}>
            선택 해제 · 전체 지도 보기
          </button>
        </div>
      ) : (
        <div className="info-card empty">아직 선택한 나라가 없어요.</div>
      )}
    </aside>
  );
}
