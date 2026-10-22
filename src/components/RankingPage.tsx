import { useCallback, useEffect, useState } from 'react';
import { fetchRanking, scoresEnabled, type Period, type RankingFilter, type ScoreRow } from '../lib/scores';
import type { QuestionKind } from '../game/useGame';
import RankingList from './RankingList';

const KINDS: [QuestionKind, string][] = [
  ['country', '국가'],
  ['city', '도시'],
  ['mixed', '섞어서'],
];
const TOTALS = [5, 10, 20];
const PERIODS: [Period, string][] = [
  ['all', '전체'],
  ['week', '최근 7일'],
  ['today', '오늘'],
];

/** 언제든 볼 수 있는 랭킹 화면 */
export default function RankingPage({ initial }: { initial: RankingFilter }) {
  const [filter, setFilter] = useState<RankingFilter>(initial);
  const [rows, setRows] = useState<ScoreRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setRows(null);
    setError(null);
    try {
      setRows(await fetchRanking(filter, 50));
    } catch (e) {
      console.error(e);
      setError('랭킹을 불러오지 못했어요.');
      setRows([]);
    }
  }, [filter]);

  useEffect(() => {
    if (scoresEnabled) load();
  }, [load]);

  const set = <K extends keyof RankingFilter>(key: K, value: RankingFilter[K]) =>
    setFilter((f) => ({ ...f, [key]: value }));

  return (
    <section className="panel ranking-page">
      <div className="ranking-title">
        <h2>🏆 랭킹</h2>
        {scoresEnabled && (
          <button className="link" onClick={load}>
            ↻ 새로고침
          </button>
        )}
      </div>
      <p className="muted small">같은 문제 종류·문제 수끼리 점수를 비교해요. 같은 점수면 같은 등수예요.</p>

      <div className="ranking-filters">
        <Segmented label="문제 종류" options={KINDS} value={filter.kind} onChange={(v) => set('kind', v)} />
        <Segmented
          label="문제 수"
          options={TOTALS.map((n) => [n, `${n}문제`] as [number, string])}
          value={filter.total}
          onChange={(v) => set('total', v)}
        />
        <Segmented label="기간" options={PERIODS} value={filter.period} onChange={(v) => set('period', v)} />
      </div>

      {!scoresEnabled ? (
        <p className="muted">랭킹을 쓰려면 .env 에 Supabase 공개 키를 설정하세요.</p>
      ) : error ? (
        <p className="error">{error}</p>
      ) : rows === null ? (
        <p className="muted">불러오는 중…</p>
      ) : rows.length === 0 ? (
        <p className="muted">아직 기록이 없어요. 게임 모드에서 첫 기록을 세워 보세요!</p>
      ) : (
        <RankingList rows={rows} detailed />
      )}
    </section>
  );
}

function Segmented<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: [T, string][];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="field">
      {label}
      <div className="segmented">
        {options.map(([v, text]) => (
          <button key={String(v)} className={value === v ? 'active' : ''} onClick={() => onChange(v)}>
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}
