import { useEffect, useMemo } from 'react';

// 지역 브랜드 캐릭터(장소마케팅 사례) 누끼 이미지 20장. 빌드 시 해시가 붙은 주소로 바뀐다.
const CHARACTER_URLS: string[] = Object.values(
  import.meta.glob('../assets/characters/*.webp', { eager: true, query: '?url', import: 'default' }),
) as string[];

const CHEERS = ['정답이에요!', '대단해요!', '최고예요!', '완벽해요!', '지리 박사!', '멋져요!', '척척박사!'];
const CONFETTI_COLORS = ['#3b82f6', '#f97316', '#10b981', '#a855f7', '#ef4444', '#eab308', '#ec4899'];

/** 같은 캐릭터가 연달아 나오지 않도록, 20장을 섞어 한 바퀴씩 돌린다 */
let bag: string[] = [];
function nextCharacter(): string {
  if (bag.length === 0) {
    bag = [...CHARACTER_URLS];
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
  }
  return bag.pop()!;
}

/** 게임 화면에 들어오면 미리 받아 두어, 정답 순간에 바로 뜨게 한다 */
export function usePreloadCharacters() {
  useEffect(() => {
    for (const url of CHARACTER_URLS) {
      const img = new Image();
      img.src = url;
    }
  }, []);
}

/**
 * 정답 축하 연출: 지도 오른쪽 아래에서 캐릭터가 튀어 오르고 색종이가 터진다.
 * 지도 클릭을 막지 않도록 pointer-events 는 꺼 둔다.
 */
export default function Celebration() {
  const { src, cheer, confetti } = useMemo(
    () => ({
      src: nextCharacter(),
      cheer: CHEERS[Math.floor(Math.random() * CHEERS.length)],
      confetti: Array.from({ length: 18 }, (_, i) => ({
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        // 위쪽 반원으로 퍼지는 방향과 거리
        angle: -160 + (140 / 17) * i + (Math.random() * 10 - 5),
        dist: 90 + Math.random() * 70,
        delay: Math.random() * 0.12,
        rot: Math.random() * 720 - 360,
      })),
    }),
    [],
  );

  if (!src) return null;

  return (
    <div className="celebration" aria-live="polite">
      <div className="confetti">
        {confetti.map((c, i) => {
          const rad = (c.angle * Math.PI) / 180;
          return (
            <span
              key={i}
              style={
                {
                  background: c.color,
                  '--dx': `${Math.cos(rad) * c.dist}px`,
                  '--dy': `${Math.sin(rad) * c.dist}px`,
                  '--rot': `${c.rot}deg`,
                  animationDelay: `${c.delay}s`,
                } as React.CSSProperties
              }
            />
          );
        })}
      </div>
      <div className="cheer-bubble">{cheer} 🎉</div>
      <img className="cheer-character" src={src} alt="정답을 축하하는 지역 캐릭터" draggable={false} />
    </div>
  );
}
