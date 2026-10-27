import { useCallback, useEffect, useState } from 'react';
import {
  describeDbError,
  fetchRanking,
  scoresEnabled,
  withRanks,
  type Period,
  type RankingFilter,
  type ScoreRow,
} from '../lib/scores';
import { CHALLENGES, challengeOf, formatLimit, tierOfRecord } from '../game/scoring';
import RankingList from './RankingList';
import TierBadge from './TierBadge';

const PERIODS: [Period, string][] = [
  ['all', '전체 기간'],
  ['week', '최근 7일'],
  ['today', '오늘'],
];

/** 명예의 전당: 도전 단계별 상위 기록 (시상대 Top 3 + 나머지 목록) */
export default function HallOfFame({
  limit = 10,
  initial = { challenge: 10, period: 'all' },
  showPeriod = false,
}: {
  limit?: number;
  initial?: RankingFilter;
  showPeriod?: boolean;
}) {
  const [filter, setFilter] = useState<RankingFilter>(initial);
  const [rows, setRows] = useState<ScoreRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ch = challengeOf(filter.challenge)!;

  const load = useCallback(async () => {
    if (!scoresEnabled) return;
    setRows(null);
    setError(null);
    try {
      setRows(await fetchRanking(filter, limit));
    } catch (e) {
      console.error(e);
      setError(describeDbError(e));
      setRows([]);
    }
  }, [filter, limit]);

  useEffect(() => {
    load();
  }, [load]);

  const ranked = withRanks(rows ?? []);
  const podium = ranked.slice(0, 3);
  const rest = ranked.slice(3);

  return (
    <section className="hof card">
      <header className="hof-head">
        <div>
          <h2>🏆 명예의 전당</h2>
          <p className="muted small">
            {ch.title} ({ch.count}문제 · {formatLimit(ch.limitSec)}) Top {limit} · 같은 점수면 더 빨리 끝낸 순
          </p>
        </div>
        {scoresEnabled && (
          <button className="ghost-btn" onClick={load} aria-label="새로고침">
            ↻
          </button>
        )}
      </header>

      <div className="pill-tabs" role="tablist">
        {CHALLENGES.map((c) => (
          <button
            key={c.count}
            role="tab"
            aria-selected={filter.challenge === c.count}
            className={filter.challenge === c.count ? 'active' : ''}
            onClick={() => setFilter((f) => ({ ...f, challenge: c.count }))}
          >
            {c.tier.emoji} {c.count}문제
          </button>
        ))}
      </div>
      {showPeriod && (
        <div className="pill-tabs sub">
          {PERIODS.map(([p, label]) => (
            <button key={p} className={filter.period === p ? 'active' : ''} onClick={() => setFilter((f) => ({ ...f, period: p }))}>
              {label}
            </button>
          ))}
        </div>
      )}

      {!scoresEnabled ? (
        <p className="hof-empty">랭킹을 쓰려면 .env 에 Supabase 공개 키를 설정하세요.</p>
      ) : error ? (
        <p className="hof-empty error">{error}</p>
      ) : rows === null ? (
        <div className="hof-skeleton" aria-label="불러오는 중">
          {Array.from({ length: 4 }, (_, i) => (
            <span key={i} />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="hof-empty">아직 {ch.title} 기록이 없어요. 첫 번째 전설이 되어 보세요! 🚀</p>
      ) : (
        <>
          <div className="podium">
            {/* 2위 - 1위 - 3위 순서로 놓아 시상대 모양을 만든다 */}
            {[podium[1], podium[0], podium[2]].map((r, i) =>
              r ? (
                <div key={r.id} className={`podium-spot place-${r.rank}`}>
                  <span className="podium-medal">{['🥇', '🥈', '🥉'][r.rank - 1] ?? r.rank}</span>
                  <strong className="podium-name">{r.nickname}</strong>
                  <TierBadge tier={tierOfRecord(r)} />
                  <span className="podium-score">{r.score.toLocaleString()}</span>
                  <div className="podium-block">{r.rank}</div>
                </div>
              ) : (
                <div key={`empty-${i}`} className="podium-spot empty" />
              ),
            )}
          </div>
          {rest.length > 0 && <RankingList rows={[]} ranked={rest} />}
        </>
      )}
    </section>
  );
}
