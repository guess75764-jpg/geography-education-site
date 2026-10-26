import { withRanks, type ScoreRow } from '../lib/scores';
import { QUIZ_TYPE_LABEL } from '../game/useGame';
import TierBadge from './TierBadge';

const MEDALS: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

function formatDate(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : `${d.getMonth() + 1}/${d.getDate()}`;
}

/** 순위 목록 (같은 점수는 같은 등수). startRank 로 4위부터 이어서 보여 줄 수 있다 */
export default function RankingList({
  rows,
  highlightId,
  showKind = false,
  rankOffset = 0,
  ranked,
}: {
  rows: ScoreRow[];
  highlightId?: number | null;
  showKind?: boolean;
  rankOffset?: number;
  /** 이미 등수를 매긴 목록 (명예의 전당에서 시상대와 나눠 쓸 때) */
  ranked?: (ScoreRow & { rank: number })[];
}) {
  const list = ranked ?? withRanks(rows).slice(rankOffset);
  return (
    <ol className="ranking">
      {list.map((r) => (
        <li key={r.id} className={`${r.id === highlightId ? 'me' : ''} ${r.rank <= 3 ? `top top-${r.rank}` : ''}`}>
          <span className="rank">{MEDALS[r.rank] ?? r.rank}</span>
          <span className="name">
            {r.nickname}
            <span className="sub">
              <TierBadge score={r.score} />
              {showKind && <span className="kind-chip">{QUIZ_TYPE_LABEL[r.quiz_kind] ?? r.quiz_kind}</span>}
              {r.max_combo >= 3 && <span className="combo-chip">🔥{r.max_combo}</span>}
              <span className="date">{formatDate(r.created_at)}</span>
            </span>
          </span>
          <span className="pts">{r.score.toLocaleString()}</span>
        </li>
      ))}
    </ol>
  );
}
