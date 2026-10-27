import { useMemo, useRef, useState } from 'react';
import { buildPlaces, importFromText, maskAnswer, type ImportItem, type Place } from '../../lib/conceptImport';
import { extractPdfLines } from '../../lib/pdfText';
import { createConcepts, type ConceptInput, type ConceptRow } from '../../lib/concepts';
import { describeDbError } from '../../lib/scores';
import { CITIES } from '../../data/cities';
import type { Country } from '../../types';

const TAGS = ['기후', '지형', '자원', '농업', '산업', '인구·문화'];
const STATUS_LABEL = { auto: '자동 인식', check: '확인 필요', none: '정답 없음' } as const;
const norm = (s: string) => s.replace(/\s+/g, '').toLowerCase();

interface Row extends ImportItem {
  key: number;
  promptEdited: boolean; // 관리자가 문장을 직접 고쳤는지
  include: boolean;
  answerText: string;
  duplicate: boolean;
}

/** PDF(또는 붙여 넣은 글)에서 개념을 자동으로 뽑아 확인 후 한꺼번에 추가 */
export default function ConceptImport({
  countries,
  existing,
  onAdded,
}: {
  countries: Country[];
  existing: ConceptRow[];
  onAdded: (message: string) => Promise<void>;
}) {
  const { lookup } = useMemo(() => buildPlaces(countries, CITIES), [countries]);
  const placeNames = useMemo(() => {
    const seen = new Set<Place>();
    const out: string[] = [];
    for (const p of lookup.values()) {
      if (seen.has(p)) continue;
      seen.add(p);
      out.push(p.name);
    }
    return out.sort((a, b) => a.localeCompare(b, 'ko'));
  }, [lookup]);
  const existingPrompts = useMemo(() => new Set(existing.map((c) => norm(c.prompt))), [existing]);

  const [rows, setRows] = useState<Row[] | null>(null);
  const [fileName, setFileName] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [paste, setPaste] = useState('');
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const toRows = (items: ImportItem[]): Row[] =>
    items.map((it, i) => {
      const duplicate = existingPrompts.has(norm(it.prompt));
      return { ...it, key: i, promptEdited: false, answerText: it.answer?.name ?? '', duplicate, include: !!it.answer && !duplicate && it.status !== 'none' };
    });

  const readFile = async (file: File) => {
    if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') {
      setMsg({ text: 'PDF 파일만 올릴 수 있어요.', error: true });
      return;
    }
    setBusy(true);
    setMsg(null);
    setFileName(file.name);
    try {
      const { lines, pages } = await extractPdfLines(file);
      const text = lines.join('\n');
      if (text.replace(/\s/g, '').length < 10) {
        setRows(null);
        setMsg({
          text: '이 PDF에서 글자를 찾지 못했어요. 스캔하거나 그림으로 된 PDF일 수 있어요. 한글·워드에서 “PDF로 저장”한 파일을 쓰거나, 내용을 복사해 아래 ‘글 붙여 넣기’를 이용해 주세요.',
          error: true,
        });
        return;
      }
      const items = importFromText(text, lookup);
      setRows(toRows(items));
      setMsg({ text: `${pages}쪽에서 ${items.length}개 항목을 찾았어요. 확인 후 추가하세요.` });
    } catch (e) {
      console.error(e);
      setMsg({ text: 'PDF를 읽지 못했어요. 암호가 걸려 있거나 손상된 파일일 수 있어요.', error: true });
    } finally {
      setBusy(false);
    }
  };

  const readPaste = () => {
    const items = importFromText(paste, lookup);
    setFileName('붙여 넣은 글');
    setRows(toRows(items));
    setMsg({ text: `${items.length}개 항목을 찾았어요. 확인 후 추가하세요.` });
  };

  const update = (key: number, patch: Partial<Row>) => setRows((rs) => rs?.map((r) => (r.key === key ? { ...r, ...patch } : r)) ?? null);

  /** 정답 칸을 고치면 나라·도시를 다시 찾고, 문장 속에 새 정답 이름이 있으면 가린다 */
  const changeAnswer = (r: Row, text: string) => {
    const p = lookup.get(text.trim()) ?? lookup.get(text.trim().toLowerCase()) ?? null;
    update(r.key, {
      answerText: text,
      answer: p,
      // 직접 고친 문장이 아니면 원래 문장에서 새 정답 이름만 다시 가린다
      prompt: p ? maskAnswer(r.promptEdited ? r.prompt : r.base, p, lookup) : r.promptEdited ? r.prompt : r.base,
      status: p ? 'auto' : 'none',
      reason: p ? '직접 고름' : '정답 없음',
      include: p ? true : r.include,
    });
  };

  const selected = rows?.filter((r) => r.include && r.answer && r.prompt.trim().length >= 2) ?? [];
  const counts = useMemo(() => {
    const c = { auto: 0, check: 0, none: 0, dup: 0 };
    for (const r of rows ?? []) {
      if (r.duplicate) c.dup++;
      else c[r.status]++;
    }
    return c;
  }, [rows]);

  const add = async () => {
    if (selected.length === 0) return;
    setBusy(true);
    try {
      const inputs: ConceptInput[] = selected.map((r) => ({
        prompt: r.prompt.trim(),
        answer_type: r.answer!.kind,
        country_id: r.answer!.countryId,
        answer_name: r.answer!.name,
        lon: r.answer!.kind === 'city' ? r.answer!.lon ?? null : null,
        lat: r.answer!.kind === 'city' ? r.answer!.lat ?? null : null,
        explanation: null,
        climate: null,
        resources: [],
        tags: r.tags,
        is_active: true,
      }));
      for (let i = 0; i < inputs.length; i += 100) await createConcepts(inputs.slice(i, i + 100));
      setRows(null);
      setFileName('');
      setPaste('');
      setMsg(null);
      await onAdded(`PDF에서 개념 ${inputs.length}개를 추가했어요. 바로 게임에 출제돼요.`);
    } catch (e) {
      console.error(e);
      setMsg({ text: describeDbError(e), error: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card admin-section pdf-import">
      <h3>📄 PDF로 개념 가져오기</h3>
      <p className="muted small">
        정리해 둔 PDF를 올리면 항목마다 <b>정답 나라·도시</b>와 <b>주제 태그</b>를 자동으로 찾아요. 문장 속 정답 이름은 “이 나라”로 가려요.
        아래 표에서 확인·수정한 뒤 추가하세요. (파일은 서버로 보내지 않고 이 브라우저에서만 읽어요)
      </p>

      <div
        className={`drop-zone ${dragging ? 'over' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const f = e.dataTransfer.files[0];
          if (f) readFile(f);
        }}
        onClick={() => fileRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && fileRef.current?.click()}
      >
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf,.pdf"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) readFile(f);
            e.target.value = '';
          }}
        />
        <span className="drop-icon">{busy ? '⏳' : '📄'}</span>
        <strong>{busy ? 'PDF 읽는 중…' : 'PDF 파일을 끌어다 놓거나 눌러서 고르세요'}</strong>
        <span className="muted small">예: “1. 쌈바로 유명한 나라이다. - 브라질”, “칠레: 세계 최대의 구리 생산국…”, 표 형식 모두 가능</span>
      </div>

      <button type="button" className="link small" onClick={() => setPasteOpen((v) => !v)}>
        {pasteOpen ? '▲ 글 붙여 넣기 닫기' : '▼ PDF 대신 글 붙여 넣기'}
      </button>
      {pasteOpen && (
        <div className="paste-box">
          <textarea rows={6} placeholder="한글·워드·PDF에서 복사한 내용을 그대로 붙여 넣으세요." value={paste} onChange={(e) => setPaste(e.target.value)} />
          <button type="button" className="secondary" disabled={!paste.trim()} onClick={readPaste}>
            자동 분류하기
          </button>
        </div>
      )}

      {msg && <p className={`admin-msg ${msg.error ? 'error' : ''}`}>{msg.text}</p>}

      {rows && rows.length > 0 && (
        <>
          <div className="import-summary">
            <span className="muted small">{fileName}</span>
            <span className="st st-auto">자동 인식 {counts.auto}</span>
            <span className="st st-check">확인 필요 {counts.check}</span>
            <span className="st st-none">정답 없음 {counts.none}</span>
            {counts.dup > 0 && <span className="st st-dup">이미 등록됨 {counts.dup}</span>}
            <label className="check small">
              <input
                type="checkbox"
                checked={rows.every((r) => r.include || !r.answer)}
                onChange={(e) => setRows(rows.map((r) => ({ ...r, include: e.target.checked && !!r.answer })))}
              />{' '}
              정답 있는 항목 모두 선택
            </label>
          </div>
          <datalist id="place-names">
            {placeNames.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
          <ol className="import-list">
            {rows.map((r) => (
              <li key={r.key} className={`${r.include ? 'on' : ''} ${r.duplicate ? 'dup' : `st-${r.status}`}`}>
                <input type="checkbox" checked={r.include} disabled={!r.answer} onChange={(e) => update(r.key, { include: e.target.checked })} aria-label="추가할지 선택" />
                <div className="import-main">
                  <textarea rows={2} value={r.prompt} onChange={(e) => update(r.key, { prompt: e.target.value, promptEdited: true })} aria-label="개념 문장" />
                  <div className="import-meta">
                    <label className="answer-edit">
                      정답
                      <input list="place-names" value={r.answerText} placeholder="나라·도시 이름" onChange={(e) => changeAnswer(r, e.target.value)} />
                      {r.answer && <span className="small">{r.answer.kind === 'city' ? '📍 도시' : '🗺️ 나라'}</span>}
                    </label>
                    <span className={`st st-${r.duplicate ? 'dup' : r.status}`} title={r.reason}>
                      {r.duplicate ? '이미 등록됨' : STATUS_LABEL[r.status]}
                    </span>
                    {r.status === 'check' && r.candidates.length > 1 && (
                      <span className="cands">
                        {r.candidates.map((c) => (
                          <button type="button" key={c.name} className={`chip ${r.answer === c ? 'on' : ''}`} onClick={() => changeAnswer(r, c.name)}>
                            {c.name}
                          </button>
                        ))}
                      </span>
                    )}
                    <span className="tag-pick">
                      {TAGS.map((t) => (
                        <button
                          type="button"
                          key={t}
                          className={`chip ${r.tags.includes(t) ? 'on' : ''}`}
                          onClick={() => update(r.key, { tags: r.tags.includes(t) ? r.tags.filter((x) => x !== t) : [...r.tags, t] })}
                        >
                          {t}
                        </button>
                      ))}
                    </span>
                  </div>
                  {r.source.replace(/\s+/g, ' ') !== r.prompt && <p className="muted small source">원문: {r.source}</p>}
                </div>
              </li>
            ))}
          </ol>
          <div className="form-actions">
            <button className="primary" disabled={busy || selected.length === 0} onClick={add}>
              {selected.length > 0 ? `선택한 개념 ${selected.length}개 추가` : '추가할 개념을 고르세요'}
            </button>
            <button
              className="secondary"
              onClick={() => {
                setRows(null);
                setMsg(null);
              }}
            >
              취소
            </button>
          </div>
        </>
      )}
    </section>
  );
}
