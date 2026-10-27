import type { RankingFilter } from '../lib/scores';
import HallOfFame from './HallOfFame';

/** 명예의 전당 전체 화면 (Top 50, 기간 선택) */
export default function RankingPage({ initial }: { initial: RankingFilter }) {
  return (
    <div className="ranking-page">
      <HallOfFame limit={50} initial={initial} showPeriod />
      <p className="muted small center">
        도전 단계별로 순위를 매겨요. 같은 점수면 더 빨리 끝낸 기록이 위에 오고, 등수는 같아요. 칭호는 그 도전에 성공(시간 안에 모두 정답)했을 때 표시돼요.
      </p>
    </div>
  );
}
