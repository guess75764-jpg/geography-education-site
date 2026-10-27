import { useCallback, useEffect, useState } from 'react';
import { deleteScores, describeDbError, fetchScoresAdmin, type ScoreRow } from '../../lib/scores';
import TierBadge from '../TierBadge';
import { CHALLENGES, challengeOf, tierOfRecord, type ChallengeCount } from '../../game/scoring';
import { formatDuration } from '../GameHud';

const FILTERS: [ChallengeCount | 'all', string][] = [['all', '전체'], ...CHALLENGES.map((c) => [c.count, `${c.tier.emoji} ${c.count}문제`] as [ChallengeCount, string])];

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** 명예의 전당 관리: 기록 검색 · 선택 삭제 */
export default function AdminScores() {
  const [challenge, setChallenge] = useState<ChallengeCount | 'all'>('all');
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<ScoreRow[] | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setRows(null);
    setSelected(new Set());
    try {
      setRows(await fetchScoresAdmin({ challenge, search }));
    } catch (e) {
      console.error(e);
      setMsg({ text: describeDbError(e), error: true });
      setRows([]);
    }
  }, [challenge, search]);

  useEffect(() => {
    // 검색어 입력이 멈춘 뒤 불러온다
    const id = setTimeout(load, 300);
    return () => clearTimeout(id);
  }, [load]);

  const toggle = (id: number) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const allSelected = !!rows?.length && rows.every((r) => selected.has(r.id));
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(rows?.map((r) => r.id)));

  const remove = async (ids: number[]) => {
    if (ids.length === 0) return;
    const names = rows?.filter((r) => ids.includes(r.id)).map((r) => r.nickname) ?? [];
    const preview = names.slice(0, 5).join(', ') + (names.length > 5 ? ` 외 ${names.length - 5}개` : '');
    if (!window.confirm(`기록 ${ids.length}개를 삭제할까요? 되돌릴 수 없어요.\n\n${preview}`)) return;
    setBusy(true);
    try {
      const n = await deleteScores(ids);
      setMsg(n === ids.length ? { text: `기록 ${n}개를 삭제했어요.` } : { text: `삭제 권한이 없어 ${ids.length - n}개는 지우지 못했어요.`, error: true });
      await load();
    } catch (e) {
      console.error(e);
      setMsg({ text: describeDbError(e), error: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card admin-section">
      <div className="admin-toolbar">
        <div className="pill-tabs">
          {FILTERS.map(([k, label]) => (
            <button key={k} className={challenge === k ? 'active' : ''} onClick={() => setChallenge(k)}>
              {label}
            </button>
          ))}
        </div>
        <input className="admin-search" type="search" placeholder="별명 검색" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="admin-actions">
        <label className="check">
          <input type="checkbox" checked={allSelected} onChange={toggleAll} disabled={!rows?.length} /> 전체 선택
        </label>
        <span className="muted small">
          {rows ? `${rows.length}개 기록 (최근 순, 최대 300개)` : '불러오는 중…'}
          {selected.size > 0 && ` · ${selected.size}개 선택`}
        </span>
        <button className="danger-btn" disabled={selected.size === 0 || busy} onClick={() => remove([...selected])}>
          🗑 선택 삭제
        </button>
      </div>
      {msg && <p className={`admin-msg ${msg.error ? 'error' : ''}`}>{msg.text}</p>}

      {rows && rows.length === 0 ? (
        <p className="hof-empty">기록이 없어요.</p>
      ) : (
        <ul className="admin-list">
          {rows?.map((r) => (
            <li key={r.id} className={selected.has(r.id) ? 'sel' : ''}>
              <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} aria-label={`${r.nickname} 선택`} />
              <div className="admin-row-main">
                <strong>{r.nickname}</strong>
                <span className="sub">
                  <TierBadge tier={tierOfRecord(r)} />
                  <span className="kind-chip">{challengeOf(r.challenge)?.title ?? '이전 방식 기록'}</span>
                  <span className="muted small">
                    정답 {r.correct_count}/{r.challenge ?? r.total}
                    {r.duration_ms != null && ` · ⏱${formatDuration(r.duration_ms)}`} · {formatDateTime(r.created_at)}
                  </span>
                </span>
              </div>
              <span className="pts">{r.score.toLocaleString()}</span>
              <button className="icon-btn" title="삭제" disabled={busy} onClick={() => remove([r.id])}>
                🗑
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
