// 점수·콤보·티어 규칙을 한곳에 모아 둔다. 숫자만 바꾸면 게임 밸런스가 바뀐다.

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

/** 빨리 맞힐수록 큰 속도 보너스. max 는 도전 단계마다 다르다 (높은 단계일수록 큼) */
export function speedBonus(elapsedMs: number, max: number = SPEED_BONUS_MAX): number {
  return Math.round(max * Math.max(0, 1 - elapsedMs / SPEED_WINDOW_MS));
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

/** 정답 1개의 점수 = (기본 + 속도 보너스) × 콤보 배수. combo 는 이번 정답을 포함한 연속 정답 수 */
export function pointsFor(combo: number, elapsedMs: number, speedMax: number): number {
  const bonus = speedMax > 0 ? speedBonus(elapsedMs, speedMax) : 0;
  return Math.round((BASE_POINTS + bonus) * comboMultiplier(combo));
}

// ── 칭호와 타임어택 도전 단계 ──
export interface Tier {
  id: string;
  name: string;
  emoji: string;
  color: string; // 배지 색
}

export const TIERS: Tier[] = [
  { id: 'bronze', name: '지리 브론즈', emoji: '🥉', color: '#b45309' },
  { id: 'silver', name: '지리 실버', emoji: '🥈', color: '#64748b' },
  { id: 'gold', name: '지리 골드', emoji: '🥇', color: '#ca8a04' },
  { id: 'grade1', name: '수능 1등급', emoji: '💎', color: '#7c3aed' },
  { id: 'doctor', name: '지리박사', emoji: '🎓', color: '#0891b2' },
];
export const BASE_TIER = TIERS[0];
export const tierById = (id: string) => TIERS.find((t) => t.id === id) ?? BASE_TIER;

export type ChallengeCount = 10 | 20 | 40 | 60;

export interface Challenge {
  count: ChallengeCount; // 문제 수
  limitSec: number; // 제한 시간
  speedMax: number; // 문제당 최대 속도 보너스 (높은 단계일수록 큼)
  timeBonusPerSec: number; // 모두 풀었을 때 남은 시간 1초당 보너스
  tier: Tier; // 성공하면 얻는 칭호
  title: string;
  /** 게임 지도에 나라 이름을 보여 줄지 (실버·골드). 수능 1등급·지리박사는 이름 없는 백지도 */
  countryNames: boolean;
}

/** 문제 수가 많을수록 높은 칭호에 도전 */
export const CHALLENGES: Challenge[] = [
  { count: 10, limitSec: 60, speedMax: 100, timeBonusPerSec: 20, tier: tierById('silver'), title: '지리 실버 도전', countryNames: true },
  { count: 20, limitSec: 90, speedMax: 150, timeBonusPerSec: 30, tier: tierById('gold'), title: '지리 골드 도전', countryNames: true },
  { count: 40, limitSec: 150, speedMax: 200, timeBonusPerSec: 40, tier: tierById('grade1'), title: '수능 1등급 도전', countryNames: false },
  { count: 60, limitSec: 300, speedMax: 250, timeBonusPerSec: 50, tier: tierById('doctor'), title: '지리박사 도전', countryNames: false },
];
export const challengeOf = (count: number | null | undefined) => CHALLENGES.find((c) => c.count === count) ?? null;

/** 도전 성공 조건: 제한 시간 안에 모든 문제를 풀고, 정답률이 이 값 이상 (1 = 모두 정답).
 *  성공하면 그 단계의 칭호를 얻고 다음 단계가 열린다. */
export const CLEAR_ACCURACY = 1;

/** 이 단계에 도전하려면 먼저 성공해야 하는 단계 (실버는 처음부터 열림) */
export function prerequisiteOf(count: ChallengeCount): Challenge | null {
  const i = CHALLENGES.findIndex((c) => c.count === count);
  return i > 0 ? CHALLENGES[i - 1] : null;
}

/** 모든 문제를 시간 안에 풀었을 때만 주는 남은 시간 보너스 */
export function timeBonusFor(count: ChallengeCount, answered: number, elapsedMs: number): number {
  const c = challengeOf(count);
  if (!c || answered < c.count) return 0;
  const leftSec = Math.max(0, Math.floor((c.limitSec * 1000 - elapsedMs) / 1000));
  return leftSec * c.timeBonusPerSec;
}

/** 지도 안내 문구 */
export const mapStyleLabel = (c: Challenge) => (c.countryNames ? '나라 이름 표시' : '백지도');

export function formatLimit(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s ? `${m}분 ${s}초` : `${m}분`;
}

/** 이 기록이 도전에 성공했는지 */
export function isCleared(count: number | null | undefined, correct: number, answered: number, durationMs: number | null): boolean {
  const c = challengeOf(count);
  if (!c) return false;
  return answered >= c.count && correct >= Math.ceil(c.count * CLEAR_ACCURACY) && (durationMs ?? 0) <= c.limitSec * 1000 + 500;
}

/** 기록의 칭호: 도전 성공이면 그 단계의 칭호, 아니면 지리 브론즈 */
export function tierOfRecord(r: { challenge?: number | null; correct_count: number; total: number; duration_ms: number | null }): Tier {
  return isCleared(r.challenge, r.correct_count, r.total, r.duration_ms) ? challengeOf(r.challenge)!.tier : BASE_TIER;
}
