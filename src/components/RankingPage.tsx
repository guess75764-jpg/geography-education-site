import type { RankingFilter } from '../lib/scores';
import HallOfFame from './HallOfFame';

/** 명예의 전당 전체 화면 (Top 50, 기간 선택) */
export default function RankingPage({ initial }: { initial: RankingFilter }) {
  return (
    <div className="ranking-page">
      <HallOfFame limit={50} initial={initial} showPeriod />
      <p className="muted small center">
        타임어택 기록만 순위에 올라가요. 같은 점수면 먼저 세운 기록이 위, 등수는 같아요.
      </p>
    </div>
  );
}
