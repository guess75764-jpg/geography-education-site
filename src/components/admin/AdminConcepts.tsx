import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import WorldMap, { type MapClick, type MapFocus, type MapMarker } from '../WorldMap';
import {
  createConcepts,
  deleteConcepts,
  fetchAllConcepts,
  updateConcept,
  type ConceptInput,
  type ConceptRow,
} from '../../lib/concepts';
import { describeDbError } from '../../lib/scores';
import { TIMEATTACK_COUNT } from '../../game/scoring';
import { CITIES } from '../../data/cities';
import type { Country } from '../../types';

const TAGS = ['기후', '지형', '자원', '농업', '산업', '인구·문화'];

interface FormState {
  editingId: number | null;
  prompt: string;
  answerType: 'country' | 'city';
  countryId: string;
  cityName: string;
  lon: number | null;
  lat: number | null;
  explanation: string;
  climate: string;
  resources: string; // 쉼표로 구분
  tags: string[];
}

const EMPTY: FormState = {
  editingId: null,
  prompt: '',
  answerType: 'country',
  countryId: '',
  cityName: '',
  lon: null,
  lat: null,
  explanation: '',
  climate: '',
  resources: '',
  tags: [],
};

const norm = (s: string) => s.replace(/\s+/g, '').toLowerCase();

/** 개념 관리: 관리자가 개념을 등록하면 '개념+위치 타임어택 게임' 문제로 출제된다 */
export default function AdminConcepts({
  countries,
  countryById,
  onChanged,
}: {
  countries: Country[];
  countryById: Map<string, Country>;
  onChanged: () => void;
}) {
  const [rows, setRows] = useState<ConceptRow[] | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [countryQuery, setCountryQuery] = useState('');
  const [filter, setFilter] = useState('');
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [focus, setFocus] = useState<MapFocus | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const realCountries = useMemo(() => countries.filter((c) => !c.id.startsWith('x-')), [countries]);
  const countryByName = useMemo(() => {
    const m = new Map<string, Country>();
    for (const c of realCountries) {
      m.set(norm(c.nameKo), c);
      m.set(norm(c.nameEn), c);
    }
    return m;
  }, [realCountries]);
  const cityByName = useMemo(() => new Map(CITIES.map((c) => [norm(c.nameKo), c])), []);

  const load = useCallback(async () => {
    try {
      setRows(await fetchAllConcepts());
    } catch (e) {
      console.error(e);
      setMsg({ text: describeDbError(e), error: true });
      setRows([]);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const afterChange = async (text: string) => {
    setMsg({ text });
    await load();
    onChanged(); // 게임 문제 목록도 새로 고침
  };
  const fail = (e: unknown) => {
    console.error(e);
    setMsg({ text: describeDbError(e), error: true });
  };

  // ── 입력 폼 ──
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));
  const chosen = form.countryId ? countryById.get(form.countryId) : undefined;
  const countryHits = useMemo(() => {
    const q = norm(countryQuery);
    if (!q) return [];
    return realCountries.filter((c) => norm(c.nameKo).includes(q) || norm(c.nameEn).includes(q)).slice(0, 6);
  }, [countryQuery, realCountries]);

  const pickCountry = (c: Country) => {
    set('countryId', c.id);
    setCountryQuery('');
    setFocus({ countryIds: [c.id], points: [] });
  };

  const onMapClick = ({ country, lonLat }: MapClick) => {
    if (form.answerType === 'country') {
      if (country && !country.id.startsWith('x-')) set('countryId', country.id);
    } else if (lonLat) {
      setForm((f) => ({
        ...f,
        lon: Math.round(lonLat[0] * 100) / 100,
        lat: Math.round(lonLat[1] * 100) / 100,
        countryId: country && !country.id.startsWith('x-') ? country.id : f.countryId,
      }));
    }
  };

  const fillFromCity = (name: string) => {
    const c = cityByName.get(norm(name));
    if (c) {
      setForm((f) => ({ ...f, cityName: c.nameKo, lon: c.lon, lat: c.lat, countryId: c.countryId }));
      setFocus({ countryIds: [], points: [[c.lon, c.lat]] });
    }
  };

  const formError = (() => {
    if (form.prompt.trim().length < 2) return '개념(문제)을 입력하세요.';
    if (!form.countryId) return form.answerType === 'country' ? '정답 나라를 고르세요.' : '지도에서 도시 위치를 클릭하세요.';
    if (form.answerType === 'city' && (form.lon === null || form.lat === null)) return '지도에서 도시 위치를 클릭하세요.';
    if (form.answerType === 'city' && !form.cityName.trim()) return '도시 이름을 입력하세요.';
    return null;
  })();

  const toInput = (f: FormState): ConceptInput => ({
    prompt: f.prompt,
    answer_type: f.answerType,
    country_id: f.countryId,
    answer_name: f.answerType === 'city' ? f.cityName : countryById.get(f.countryId)?.nameKo ?? '',
    lon: f.answerType === 'city' ? f.lon : null,
    lat: f.answerType === 'city' ? f.lat : null,
    explanation: f.explanation || null,
    climate: f.climate || null,
    resources: f.resources
      .split(',')
      .map((r) => r.trim())
      .filter(Boolean),
    tags: f.tags,
    is_active: true,
  });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formError) return;
    setBusy(true);
    try {
      if (form.editingId !== null) {
        const { is_active: _keep, ...changes } = toInput(form);
        await updateConcept(form.editingId, changes);
        await afterChange('개념을 수정했어요.');
      } else {
        await createConcepts([toInput(form)]);
        await afterChange('개념을 추가했어요. 바로 게임에 출제돼요.');
      }
      setForm(EMPTY);
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (r: ConceptRow) => {
    setForm({
      editingId: r.id,
      prompt: r.prompt,
      answerType: r.answer_type,
      countryId: r.country_id,
      cityName: r.answer_type === 'city' ? r.answer_name : '',
      lon: r.lon,
      lat: r.lat,
      explanation: r.explanation ?? '',
      climate: r.climate ?? '',
      resources: (r.resources ?? []).join(', '),
      tags: r.tags ?? [],
    });
    setFocus(r.answer_type === 'city' && r.lon !== null && r.lat !== null ? { countryIds: [], points: [[r.lon, r.lat]] } : { countryIds: [r.country_id], points: [] });
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // ── 여러 개 한꺼번에 추가 ──
  const [bulk, setBulk] = useState('');
  const bulkParsed = useMemo(() => {
    return bulk
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const i = line.lastIndexOf('|');
        if (i < 0) return { line, error: '"개념 | 정답" 형식이 아니에요' };
        const prompt = line.slice(0, i).trim();
        const answer = line.slice(i + 1).trim();
        if (prompt.length < 2) return { line, error: '개념이 비어 있어요' };
        const city = cityByName.get(norm(answer));
        if (city) {
          return {
            line,
            input: { ...toInput({ ...EMPTY, prompt, answerType: 'city', countryId: city.countryId, cityName: city.nameKo, lon: city.lon, lat: city.lat }) },
            label: `📍 ${city.nameKo}`,
          };
        }
        const country = countryByName.get(norm(answer));
        if (!country) return { line, error: `"${answer}" 을(를) 나라·도시 목록에서 찾지 못했어요` };
        return { line, input: toInput({ ...EMPTY, prompt, countryId: country.id }), label: `🗺️ ${country.nameKo}` };
      });
    // toInput 은 countryById 에만 의존
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bulk, cityByName, countryByName, countryById]);
  const bulkOk = bulkParsed.filter((b) => b.input);

  const saveBulk = async () => {
    if (bulkOk.length === 0) return;
    setBusy(true);
    try {
      await createConcepts(bulkOk.map((b) => b.input!));
      setBulk('');
      await afterChange(`개념 ${bulkOk.length}개를 추가했어요.`);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  // ── 목록 ──
  const toggleActive = async (r: ConceptRow) => {
    try {
      await updateConcept(r.id, { is_active: !r.is_active });
      await afterChange(r.is_active ? '게임에서 빼 두었어요.' : '다시 게임에 출제돼요.');
    } catch (e) {
      fail(e);
    }
  };
  const remove = async (r: ConceptRow) => {
    if (!window.confirm(`이 개념을 삭제할까요? 되돌릴 수 없어요.\n\n"${r.prompt}"\n→ ${r.answer_name}`)) return;
    try {
      await deleteConcepts([r.id]);
      if (form.editingId === r.id) setForm(EMPTY);
      await afterChange('개념을 삭제했어요.');
    } catch (e) {
      fail(e);
    }
  };

  const shown = useMemo(() => {
    const q = norm(filter);
    if (!rows) return null;
    if (!q) return rows;
    return rows.filter((r) => norm(r.prompt).includes(q) || norm(r.answer_name).includes(q));
  }, [rows, filter]);
  const activeCount = rows?.filter((r) => r.is_active).length ?? 0;

  const mapFills = useMemo(() => (form.countryId ? { [form.countryId]: '#2563eb' } : {}), [form.countryId]);
  const mapMarkers = useMemo<MapMarker[]>(
    () =>
      form.answerType === 'city' && form.lon !== null && form.lat !== null
        ? [{ id: 'pick', lon: form.lon, lat: form.lat, tone: 'correct', label: form.cityName || '선택한 위치' }]
        : [],
    [form.answerType, form.lon, form.lat, form.cityName],
  );

  return (
    <div className="admin-concepts">
      <div className="admin-stats card">
        <div>
          <b>{rows?.length ?? '-'}</b>
          <span>등록된 개념</span>
        </div>
        <div>
          <b>{rows ? activeCount : '-'}</b>
          <span>게임에 출제 중</span>
        </div>
        <p className={`small ${rows && activeCount < TIMEATTACK_COUNT ? 'hint' : 'muted'}`}>
          {rows && activeCount < TIMEATTACK_COUNT
            ? `출제 중인 개념이 ${TIMEATTACK_COUNT}개보다 적어 한 판에 같은 개념이 반복돼요. ${TIMEATTACK_COUNT - activeCount}개 이상 더 추가하면 중복 없이 출제돼요.`
            : `한 판(${TIMEATTACK_COUNT}문제)마다 출제 중인 개념 중에서 무작위로, 중복 없이 뽑아요.`}
        </p>
      </div>

      {msg && <p className={`admin-msg ${msg.error ? 'error' : ''}`}>{msg.text}</p>}

      <form ref={formRef} className="card admin-section concept-form" onSubmit={save}>
        <h3>{form.editingId !== null ? '✏️ 개념 수정' : '➕ 개념 추가'}</h3>
        <div className="concept-form-grid">
          <div className="concept-fields">
            <label className="field">
              개념 (문제로 나오는 문장)
              <textarea
                rows={3}
                maxLength={300}
                placeholder="예: 쌈바 축제로 유명한 남아메리카 국가는?"
                value={form.prompt}
                onChange={(e) => set('prompt', e.target.value)}
              />
            </label>

            <div className="field">
              정답 종류
              <div className="segmented">
                <button type="button" className={form.answerType === 'country' ? 'active' : ''} onClick={() => set('answerType', 'country')}>
                  🗺️ 나라
                </button>
                <button type="button" className={form.answerType === 'city' ? 'active' : ''} onClick={() => set('answerType', 'city')}>
                  📍 도시
                </button>
              </div>
            </div>

            {form.answerType === 'country' ? (
              <div className="field">
                정답 나라 {chosen && <span className="answer-chip">✓ {chosen.nameKo}</span>}
                <div className="search">
                  <input
                    type="search"
                    placeholder="나라 이름 검색 (또는 지도에서 클릭)"
                    value={countryQuery}
                    onChange={(e) => setCountryQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && countryHits[0]) {
                        e.preventDefault();
                        pickCountry(countryHits[0]);
                      }
                    }}
                  />
                  {countryHits.length > 0 && (
                    <ul className="search-results">
                      {countryHits.map((c) => (
                        <li key={c.id}>
                          <button type="button" onClick={() => pickCountry(c)}>
                            {c.nameKo} <span className="muted">{c.nameEn}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ) : (
              <div className="field">
                정답 도시
                <input
                  placeholder="도시 이름 (예: 리우데자네이루)"
                  maxLength={50}
                  value={form.cityName}
                  onChange={(e) => set('cityName', e.target.value)}
                  onBlur={(e) => form.lon === null && fillFromCity(e.target.value)}
                />
                <span className="muted small">
                  지도에서 도시 위치를 클릭하세요.
                  {form.lon !== null && form.lat !== null && ` 선택: 경도 ${form.lon}, 위도 ${form.lat}`}
                  {chosen && ` (${chosen.nameKo})`}
                </span>
              </div>
            )}

            <details className="optional" open={!!(form.explanation || form.climate || form.resources || form.tags.length)}>
              <summary>해설·기후·자원·태그 (선택)</summary>
              <label className="field">
                해설 (정답 공개 후 보여 줌)
                <textarea rows={2} value={form.explanation} onChange={(e) => set('explanation', e.target.value)} />
              </label>
              <label className="field">
                기후
                <input placeholder="예: 열대 우림 기후(Af)" value={form.climate} onChange={(e) => set('climate', e.target.value)} />
              </label>
              <label className="field">
                대표 자원·산물 (쉼표로 구분)
                <input placeholder="예: 커피, 철광석" value={form.resources} onChange={(e) => set('resources', e.target.value)} />
              </label>
              <div className="field">
                태그
                <div className="chips">
                  {TAGS.map((t) => (
                    <button
                      type="button"
                      key={t}
                      className={`chip ${form.tags.includes(t) ? 'on' : ''}`}
                      onClick={() => set('tags', form.tags.includes(t) ? form.tags.filter((x) => x !== t) : [...form.tags, t])}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </details>

            {formError && (form.prompt || form.countryId) && <p className="muted small">⚠ {formError}</p>}
            <div className="form-actions">
              <button className="primary" disabled={!!formError || busy}>
                {form.editingId !== null ? '수정 저장' : '개념 추가'}
              </button>
              {(form.editingId !== null || form.prompt) && (
                <button type="button" className="secondary" onClick={() => setForm(EMPTY)}>
                  {form.editingId !== null ? '수정 취소' : '비우기'}
                </button>
              )}
            </div>
          </div>
          <div className="concept-map">
            <WorldMap countries={countries} fillColors={mapFills} markers={mapMarkers} focus={focus} onMapClick={onMapClick} />
            <p className="muted small center">
              {form.answerType === 'country' ? '지도에서 나라를 클릭하면 정답으로 정해져요.' : '지도에서 도시 위치를 클릭하세요. (정답 판정: 500km 이내)'}
            </p>
          </div>
        </div>
      </form>

      <details className="card admin-section bulk">
        <summary>📋 여러 개 한꺼번에 추가하기</summary>
        <p className="muted small">
          한 줄에 하나씩 <b>개념 | 정답</b> 형식으로 붙여 넣으세요. 정답은 나라 이름(한국어·영어) 또는 도시 목록에 있는 도시 이름이에요.
        </p>
        <textarea
          rows={6}
          placeholder={'쌈바 축제로 유명한 남아메리카 국가는? | 브라질\n탱고의 발상지로 알려진 남아메리카 국가는? | 아르헨티나\n센강이 흐르고 에펠탑이 있는 도시는? | 파리'}
          value={bulk}
          onChange={(e) => setBulk(e.target.value)}
        />
        {bulkParsed.length > 0 && (
          <ul className="bulk-preview">
            {bulkParsed.map((b, i) => (
              <li key={i} className={b.input ? 'ok' : 'no'}>
                {b.input ? `✓ ${b.label}` : `✕ ${b.error}`} <span className="muted">— {b.line}</span>
              </li>
            ))}
          </ul>
        )}
        <button className="primary" disabled={bulkOk.length === 0 || busy} onClick={saveBulk}>
          {bulkOk.length > 0 ? `개념 ${bulkOk.length}개 추가` : '추가할 개념 없음'}
        </button>
      </details>

      <section className="card admin-section">
        <div className="admin-toolbar">
          <h3>📚 개념 목록</h3>
          <input className="admin-search" type="search" placeholder="개념·정답 검색" value={filter} onChange={(e) => setFilter(e.target.value)} />
        </div>
        {shown === null ? (
          <p className="muted">불러오는 중…</p>
        ) : shown.length === 0 ? (
          <p className="hof-empty">{rows?.length ? '검색 결과가 없어요.' : '아직 등록된 개념이 없어요. 위에서 추가해 보세요.'}</p>
        ) : (
          <ul className="admin-list concepts">
            {shown.map((r) => (
              <li key={r.id} className={r.is_active ? '' : 'off'}>
                <label className="switch" title={r.is_active ? '게임에 출제 중 (끄기)' : '꺼짐 (켜기)'}>
                  <input type="checkbox" checked={r.is_active} onChange={() => toggleActive(r)} />
                  <span />
                </label>
                <div className="admin-row-main">
                  <span className="concept-prompt">{r.prompt}</span>
                  <span className="sub">
                    <span className="answer-chip">
                      {r.answer_type === 'city' ? '📍' : '🗺️'} {r.answer_name}
                    </span>
                    {r.tags?.map((t) => (
                      <span key={t} className="kind-chip">
                        {t}
                      </span>
                    ))}
                    {!r.is_active && <span className="muted small">게임에서 빠짐</span>}
                  </span>
                </div>
                <button className="icon-btn" title="수정" onClick={() => startEdit(r)}>
                  ✏️
                </button>
                <button className="icon-btn" title="삭제" onClick={() => remove(r)}>
                  🗑
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
