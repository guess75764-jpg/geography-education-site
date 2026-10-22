import { withRanks, type ScoreRow } from '../lib/scores';

const MEDALS: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

function formatDate(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : `${d.getMonth() + 1}/${d.getDate()}`;
}

/** 순위표 (같은 점수는 같은 등수) */
export default function RankingList({
  rows,
  highlightId,
  detailed = false,
}: {
  rows: ScoreRow[];
  highlightId?: number | null;
  detailed?: boolean;
}) {
  return (
    <ol className={`ranking ${detailed ? 'detailed' : ''}`}>
      {detailed && (
        <li className="ranking-head" aria-hidden>
          <span className="rank">순위</span>
          <span className="name">별명</span>
          <span className="correct">정답</span>
          <span className="date">날짜</span>
          <span className="pts">점수</span>
        </li>
      )}
      {withRanks(rows).map((r) => (
        <li key={r.id} className={`${r.id === highlightId ? 'me' : ''} ${r.rank <= 3 ? `top top-${r.rank}` : ''}`}>
          <span className="rank">{MEDALS[r.rank] ?? r.rank}</span>
          <span className="name">{r.nickname}</span>
          {detailed && (
            <>
              <span className="correct">
                {r.correct_count}/{r.total}
              </span>
              <span className="date">{formatDate(r.created_at)}</span>
            </>
          )}
          <span className="pts">{r.score}점</span>
        </li>
      ))}
    </ol>
  );
}
