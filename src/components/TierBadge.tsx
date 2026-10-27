import type { Tier } from '../game/scoring';

/** 칭호 배지 (예: 💎 수능 1등급) */
export default function TierBadge({ tier, size = 'sm' }: { tier: Tier; size?: 'sm' | 'lg' }) {
  return (
    <span className={`tier-badge tier-${tier.id} tier-${size}`} style={{ '--tier': tier.color } as React.CSSProperties}>
      <span aria-hidden>{tier.emoji}</span> {tier.name}
    </span>
  );
}
