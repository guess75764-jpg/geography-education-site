// 점수·콤보·티어 규칙을 한곳에 모아 둔다. 숫자만 바꾸면 게임 밸런스가 바뀐다.

/** 타임어택 문제 수 (고정) */
export const TIMEATTACK_COUNT = 20;
/** 연습 모드 문제 수 */
export const PRACTICE_COUNT = 10;
/** 도시 문제: 이 거리 안을 클릭하면 정답 */
export const CITY_TOLERANCE_KM = 500;

/** 정답 기본 점수 */
export const BASE_POINTS = 100;
/** 빨리 맞힐수록 받는 추가 점수 (최대) */
export const SPEED_BONUS_MAX = 100;
/** 이 시간 안에 맞히면 속도 보너스가 남는다 (0초 = 100점 → 8초 = 0점) */
export const SPEED_WINDOW_MS = 8000;

/** 정답 후 다음 문제로 넘어가기까지 (타임어택) */
export const FEEDBACK_MS = { correct: 700, wrong: 1500 };

export function speedBonus(elapsedMs: number): number {
  return Math.round(SPEED_BONUS_MAX * Math.max(0, 1 - elapsedMs / SPEED_WINDOW_MS));
}

/** 연속 정답 수에 따른 점수 배수: 3콤보 ×1.5, 6콤보 ×2, 9콤보 ×2.5, 12콤보 이상 ×3 */
export function comboMultiplier(combo: number): number {
  if (combo >= 12) return 3;
  if (combo >= 9) return 2.5;
  if (combo >= 6) return 2;
  if (combo >= 3) return 1.5;
  return 1;
}

/** 다음 배수까지 남은 콤보 수 (최대 배수면 null) */
export function combosToNextMultiplier(combo: number): number | null {
  const steps = [3, 6, 9, 12];
  const next = steps.find((s) => s > combo);
  return next === undefined ? null : next - combo;
}

/** 정답 1개의 점수. combo 는 이번 정답을 포함한 연속 정답 수 */
export function pointsFor(combo: number, elapsedMs: number, withSpeedBonus: boolean): number {
  const bonus = withSpeedBonus ? speedBonus(elapsedMs) : 0;
  return Math.round((BASE_POINTS + bonus) * comboMultiplier(combo));
}

// ── 티어(칭호): 타임어택 20문제 점수 기준 ──
export interface Tier {
  id: string;
  name: string;
  emoji: string;
  min: number;
  color: string; // 배지 색
}

export const TIERS: Tier[] = [
  { id: 'bronze', name: '지리 브론즈', emoji: '🥉', min: 0, color: '#b45309' },
  { id: 'silver', name: '지리 실버', emoji: '🥈', min: 1000, color: '#64748b' },
  { id: 'gold', name: '지리 골드', emoji: '🥇', min: 2500, color: '#ca8a04' },
  { id: 'grade1', name: '수능 1등급', emoji: '💎', min: 4500, color: '#7c3aed' },
  { id: 'doctor', name: '지리박사', emoji: '🎓', min: 7000, color: '#0891b2' },
];

export function tierOf(score: number): Tier {
  return [...TIERS].reverse().find((t) => score >= t.min) ?? TIERS[0];
}

/** 다음 티어와 남은 점수 (최고 티어면 null) */
export function nextTier(score: number): { tier: Tier; remaining: number; progress: number } | null {
  const cur = tierOf(score);
  const idx = TIERS.indexOf(cur);
  const next = TIERS[idx + 1];
  if (!next) return null;
  return { tier: next, remaining: next.min - score, progress: (score - cur.min) / (next.min - cur.min) };
}
