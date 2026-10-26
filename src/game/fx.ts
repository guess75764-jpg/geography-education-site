// 정답 타격감용 폭죽 효과 (canvas-confetti). 움직임 줄이기 설정을 켠 사용자에게는 생략된다.
import confetti from 'canvas-confetti';
import { comboMultiplier } from './scoring';

const COLORS = ['#3b82f6', '#f97316', '#10b981', '#a855f7', '#ef4444', '#eab308', '#ec4899'];
const base = { disableForReducedMotion: true, colors: COLORS, zIndex: 50 } as const;

/** 클릭한 지점(화면 좌표)에서 터지는 정답 폭죽. 콤보가 높을수록 커진다 */
export function fireCorrect(clientX: number, clientY: number, combo: number) {
  const origin = { x: clientX / window.innerWidth, y: clientY / window.innerHeight };
  const power = comboMultiplier(combo); // 1 ~ 3
  confetti({ ...base, origin, particleCount: Math.round(40 * power), spread: 55 + 15 * power, startVelocity: 28 + 6 * power, ticks: 120, scalar: 0.9 });
}

/** 콤보 배수가 올라가는 순간: 화면 양옆에서 한 번 더 */
export function fireComboLevelUp() {
  confetti({ ...base, particleCount: 70, angle: 60, spread: 70, origin: { x: 0, y: 0.75 } });
  confetti({ ...base, particleCount: 70, angle: 120, spread: 70, origin: { x: 1, y: 0.75 } });
}

/** 게임 종료(결과 화면): 위에서 쏟아지는 축하 */
export function fireFinish(strength: number) {
  const end = Date.now() + 900 + strength * 300;
  (function frame() {
    confetti({ ...base, particleCount: 6, angle: 60, spread: 60, origin: { x: 0, y: 0.6 } });
    confetti({ ...base, particleCount: 6, angle: 120, spread: 60, origin: { x: 1, y: 0.6 } });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
}
