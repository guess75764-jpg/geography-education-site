// 타임어택 단계 잠금 해제 상태: 별명별로 이 브라우저에 저장한다.
// 실버(10문제)는 처음부터 열려 있고, 한 단계를 모두 맞히면 다음 단계가 열린다.
// 이미 열린 단계는 계속 열려 있어 낮은 단계에 다시 도전할 수 있다.
import { CHALLENGES, type ChallengeCount } from '../game/scoring';

const KEY = 'geo-quiz:unlocked';
const norm = (nickname: string) => nickname.trim().toLowerCase();

function load(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') ?? {};
  } catch {
    return {};
  }
}

/** 이 별명이 도전할 수 있는 가장 높은 단계의 순번 (0 = 실버만) */
export function unlockedIndex(nickname: string): number {
  const n = norm(nickname);
  if (!n) return 0;
  return Math.min(load()[n] ?? 0, CHALLENGES.length - 1);
}

export function isUnlocked(nickname: string, count: ChallengeCount): boolean {
  return CHALLENGES.findIndex((c) => c.count === count) <= unlockedIndex(nickname);
}

/** 단계 성공 → 다음 단계 열기. 새로 열렸으면 그 단계를 돌려준다 */
export function markCleared(nickname: string, count: ChallengeCount) {
  const n = norm(nickname);
  if (!n) return null;
  const next = CHALLENGES.findIndex((c) => c.count === count) + 1;
  const data = load();
  if (next >= CHALLENGES.length || (data[n] ?? 0) >= next) return null;
  data[n] = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* 저장 못 해도 이번 화면에서는 계속 진행 */
  }
  return CHALLENGES[next];
}
