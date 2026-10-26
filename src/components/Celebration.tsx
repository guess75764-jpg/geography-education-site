import { useEffect, useMemo } from 'react';

// 지역 브랜드 캐릭터(장소마케팅 사례) 누끼 이미지 20장. 빌드 시 해시가 붙은 주소로 바뀐다.
const CHARACTER_URLS: string[] = Object.values(
  import.meta.glob('../assets/characters/*.webp', { eager: true, query: '?url', import: 'default' }),
) as string[];

const CHEERS = ['정답이에요!', '대단해요!', '최고예요!', '완벽해요!', '지리 박사!', '멋져요!', '척척박사!'];

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
 * 정답 축하: 지도 오른쪽 아래에서 지역 캐릭터가 튀어 오르며 응원한다. (폭죽은 fx.ts 가 담당)
 * 지도 클릭을 막지 않도록 pointer-events 는 꺼 둔다.
 */
export default function Celebration({ combo }: { combo: number }) {
  const { src, cheer } = useMemo(
    () => ({
      src: nextCharacter(),
      cheer: combo >= 3 ? `${combo}연속 정답!` : CHEERS[Math.floor(Math.random() * CHEERS.length)],
    }),
    // 등장할 때 한 번만 정한다
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  if (!src) return null;

  return (
    <div className="celebration" aria-live="polite">
      <div className="cheer-bubble">{cheer} 🎉</div>
      <img className="cheer-character" src={src} alt="정답을 축하하는 지역 캐릭터" draggable={false} />
    </div>
  );
}
