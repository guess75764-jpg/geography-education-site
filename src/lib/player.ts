// 로그인 없는 학생을 구분하기 위한 "브라우저 열쇠".
// 처음 기록을 남길 때 무작위로 만들어 이 브라우저에 저장한다.
// 같은 브라우저 + 같은 별명이면 같은 학생으로 보고, 자기 이전 기록만 갱신할 수 있다.
// (열쇠 자체는 서버에 해시로만 저장되므로, 다른 사람이 남의 기록을 지울 수 없다)

const KEY = 'geo-quiz:player-key';
let memoryKey: string | null = null;

function randomKey(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function getPlayerKey(): string {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved && saved.length >= 16) return saved;
    const k = randomKey();
    localStorage.setItem(KEY, k);
    return k;
  } catch {
    // 저장소를 못 쓰는 환경(사생활 보호 모드 등): 이 화면을 닫기 전까지만 같은 학생으로 인식
    memoryKey ??= randomKey();
    return memoryKey;
  }
}
