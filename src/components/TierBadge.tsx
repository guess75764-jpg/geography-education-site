import { nextTier, tierOf } from '../game/scoring';

/** 점수에 맞는 칭호 배지 (예: 💎 수능 1등급) */
export default function TierBadge({ score, size = 'sm' }: { score: number; size?: 'sm' | 'lg' }) {
  const tier = tierOf(score);
  return (
    <span className={`tier-badge tier-${tier.id} tier-${size}`} style={{ '--tier': tier.color } as React.CSSProperties}>
      <span aria-hidden>{tier.emoji}</span> {tier.name}
    </span>
  );
}

/** 다음 칭호까지의 진행 막대 */
export function TierProgress({ score }: { score: number }) {
  const n = nextTier(score);
  if (!n) return <p className="tier-next max">최고 칭호 달성! 당신은 진정한 지리박사 🎓</p>;
  return (
    <div className="tier-next">
      <div className="tier-bar">
        <span style={{ width: `${Math.round(n.progress * 100)}%`, background: n.tier.color }} />
      </div>
      <p>
        {n.tier.emoji} <strong>{n.tier.name}</strong>까지 {n.remaining.toLocaleString()}점
      </p>
    </div>
  );
}
