import { useEffect, useRef, useState } from 'react';
import { TIME_LIMIT_SEC, comboMultiplier, combosToNextMultiplier } from '../game/scoring';
import type { GameState } from '../game/useGame';

export interface FloatingPoint {
  id: number;
  x: number; // 지도 영역 기준 px
  y: number;
  text: string;
  good: boolean;
}

/**
 * 게임 중 지도 위에 겹쳐 보이는 정보: 남은 시간 막대, 콤보 게이지, 카운트다운, 점수 팝업.
 * 클릭을 막지 않도록 모두 pointer-events: none.
 */
export default function GameHud({ game, floats }: { game: GameState; floats: FloatingPoint[] }) {
  const { phase, combo, lastResult } = game;
  const isTimed = game.style === 'timeattack';
  const playing = phase === 'playing' || phase === 'answered';
  const sec = game.timeLeftMs / 1000;
  const mult = comboMultiplier(combo);
  const toNext = combosToNextMultiplier(combo);

  // 콤보가 끊긴 순간 (3콤보 이상이었을 때만) 잠깐 표시
  const [broken, setBroken] = useState<number | null>(null);
  const prevCombo = useRef(0);
  useEffect(() => {
    if (lastResult && !lastResult.correct && prevCombo.current >= 3) {
      setBroken(prevCombo.current);
      const id = setTimeout(() => setBroken(null), 1200);
      prevCombo.current = combo;
      return () => clearTimeout(id);
    }
    prevCombo.current = combo;
  }, [lastResult, combo]);

  return (
    <div className="hud" aria-live="polite">
      {isTimed && (playing || phase === 'countdown') && (
        <div className={`timer ${sec <= 10 && playing ? 'warn' : ''}`}>
          <div className="timer-bar">
            <span style={{ width: `${(game.timeLeftMs / (TIME_LIMIT_SEC * 1000)) * 100}%` }} />
          </div>
          <span className="timer-sec">{Math.ceil(sec)}</span>
        </div>
      )}

      {playing && combo >= 2 && (
        <div className={`combo-meter mult-${String(mult).replace('.', '_')}`} key={combo}>
          <span className="combo-fire">🔥</span>
          <span className="combo-num">{combo}</span>
          <span className="combo-label">
            COMBO
            <b>×{mult}</b>
          </span>
          {toNext !== null && <span className="combo-next">{toNext}개 더 맞히면 ×{comboMultiplier(combo + toNext)}</span>}
        </div>
      )}

      {broken !== null && (
        <div className="combo-broken" key={`b${game.results.length}`}>
          💔 {broken}콤보 끊김
        </div>
      )}

      {phase === 'countdown' && (
        <div className="countdown" key={game.countdown}>
          {game.countdown > 0 ? game.countdown : 'GO!'}
        </div>
      )}

      {floats.map((f) => (
        <span key={f.id} className={`float-pts ${f.good ? 'good' : 'bad'}`} style={{ left: f.x, top: f.y }}>
          {f.text}
        </span>
      ))}
    </div>
  );
}
