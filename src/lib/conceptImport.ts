// PDF·붙여넣은 글에서 개념 문항을 뽑아 정답(나라·도시)과 주제 태그를 자동으로 붙인다.
// 브라우저 안에서만 동작하며, 결과는 관리자가 확인 표에서 고친 뒤 저장한다.

export interface Place {
  kind: 'country' | 'city';
  name: string; // 표시 이름 (예: 브라질, 파리)
  countryId: string;
  lon?: number;
  lat?: number;
}

export type ImportStatus = 'auto' | 'check' | 'none';

export interface ImportItem {
  source: string; // 원문 한 항목
  prompt: string; // 문제로 쓸 문장 (정답 이름은 가림)
  base: string; // 이름을 가리기 전 문장 (정답을 바꾸면 이걸로 다시 가림)
  answer: Place | null;
  alts: Place[]; // 함께 정답으로 인정할 나라 (예: 아르헨티나 + 우루과이)
  candidates: Place[]; // 글에 나온 나라·도시들
  status: ImportStatus; // auto: 자동 인식 · check: 확인 필요 · none: 정답 못 찾음
  reason: string;
  tags: string[];
}

// ───────────── 이름 사전 ─────────────

/** 교과서·수업에서 흔히 쓰는 다른 이름 → ISO 숫자 코드 */
export const COUNTRY_ALIASES: Record<string, string> = {
  호주: '036',
  미합중국: '840',
  터키: '792',
  한국: '410',
  남한: '410',
  조선: '408',
  UAE: '784',
  '아랍 에미리트': '784',
  사우디: '682',
  홀란드: '528',
  남아공: '710',
  남아프리카공화국: '710',
  '남아프리카 공화국': '710',
  민주콩고: '180',
  콩고민주공화국: '180',
  타이완: '158',
  대만: '158',
  타이: '764',
  버마: '104',
  '뉴 질랜드': '554',
  잉글랜드: '826',
  '영 국': '826',
  체코공화국: '203',
  아르헨: '032',
};

/** 나라 이름이 다른 낱말 안에 들어 있는 경우 (예: 인도양의 '인도', 타이가의 '타이') */
const BLOCKERS = [
  '인도양', '인도차이나', '인도적', '인도주의', '인도하', '인도로 가는',
  '남중국해', '동중국해', '멕시코만', '기니만', '아라비아해', '뉴기니섬',
  '타이가', '타이밍', '타이어', '타이틀',
  '교통 수단', '교통수단', '수단으로', '수단을', '수단이', '수단과', '수단은', '이동 수단',
  '가나다', '말리는', '말리고', '오만한', '오만함', '이란성', '페루 해류', '차드는 말',
  '로마자', '로마 제국', '고대 로마',
];

export function buildPlaces(
  countries: { id: string; nameKo: string; nameEn: string }[],
  cities: { nameKo: string; nameEn: string; countryId: string; lon: number; lat: number }[],
): { places: Place[]; lookup: Map<string, Place> } {
  const lookup = new Map<string, Place>(); // 표기 → 장소
  const byId = new Map<string, Place>();
  for (const c of countries) {
    if (c.id.startsWith('x-')) continue;
    const p: Place = { kind: 'country', name: c.nameKo, countryId: c.id };
    byId.set(c.id, p);
    lookup.set(c.nameKo, p);
    lookup.set(c.nameKo.replace(/\s+/g, ''), p);
    if (c.nameEn) lookup.set(c.nameEn.toLowerCase(), p);
  }
  for (const [alias, id] of Object.entries(COUNTRY_ALIASES)) {
    const p = byId.get(id);
    if (p && !lookup.has(alias)) lookup.set(alias, p);
  }
  for (const c of cities) {
    const p: Place = { kind: 'city', name: c.nameKo, countryId: c.countryId, lon: c.lon, lat: c.lat };
    // 나라 이름과 같은 도시 이름은 나라를 우선 (예: 싱가포르)
    if (!lookup.has(c.nameKo)) lookup.set(c.nameKo, p);
    if (!lookup.has(c.nameEn.toLowerCase())) lookup.set(c.nameEn.toLowerCase(), p);
  }
  return { places: [...new Set(lookup.values())], lookup };
}

/** 글에 나온 나라·도시를 위치 순서대로 찾는다 (긴 이름 먼저, 겹치면 긴 것만) */
export function findPlaces(text: string, lookup: Map<string, Place>): { place: Place; index: number; length: number }[] {
  const names = [...lookup.keys()].filter((n) => n.length >= 2).sort((a, b) => b.length - a.length);
  const lower = text.toLowerCase();
  const taken = new Array<boolean>(text.length).fill(false);
  const found: { place: Place; index: number; length: number }[] = [];
  for (const name of names) {
    const isLatin = /^[a-z .'-]+$/i.test(name);
    const hay = isLatin ? lower : text;
    let from = 0;
    while (true) {
      const i = hay.indexOf(name, from);
      if (i < 0) break;
      from = i + name.length;
      if (taken.slice(i, i + name.length).some(Boolean)) continue;
      if (isLatin && (/[a-z]/i.test(text[i - 1] ?? '') || /[a-z]/i.test(text[i + name.length] ?? ''))) continue;
      if (BLOCKERS.some((b) => {
        const k = b.indexOf(name);
        return k >= 0 && text.slice(i - k, i - k + b.length) === b;
      })) continue;
      for (let j = i; j < i + name.length; j++) taken[j] = true;
      found.push({ place: lookup.get(name)!, index: i, length: name.length });
    }
  }
  return found.sort((a, b) => a.index - b.index);
}

// ───────────── 주제 태그 ─────────────

const TAG_WORDS: Record<string, string[]> = {
  기후: ['기후', '기온', '강수', '강우', '건조', '습윤', '열대', '온대', '냉대', '한대', '고산', '계절풍', '몬순', '편서풍', '무역풍', '연교차', '백야', '우기', '건기', '사바나', '스텝', '툰드라', '타이가', '지중해성'],
  지형: ['산맥', '고원', '평야', '분지', '삼각주', '하천', '해안', '피오르', '빙하', '화산', '지진', '조산대', '해령', '해협', '반도', '섬나라', '사막', '카르스트', '협곡', '호수', '운하', '범람원', '간척'],
  자원: ['석유', '천연가스', '석탄', '철광석', '구리', '리튬', '보크사이트', '우라늄', '희토류', '자원', '광산', '에너지', '지열', '수력', '유전'],
  농업: ['재배', '농업', '목축', '유목', '쌀', '밀', '옥수수', '대두', '커피', '카카오', '사탕수수', '목화', '플랜테이션', '낙농', '소고기', '포도', '올리브', '벼농사', '목양', '화훼', '팜유'],
  산업: ['공업', '산업', '제조', '관광', '금융', '서비스', '항만', '무역', '첨단', '반도체', '자동차', '수출'],
  '인구·문화': ['종교', '이슬람', '크리스트교', '가톨릭', '힌두교', '불교', '축제', '카니발', '문화', '언어', '민족', '원주민', '인구', '이주', '식민', '유산', '유적', '음식', '음악', '삼바', '쌈바', '성지'],
};

export function guessTags(text: string): string[] {
  const scored = Object.entries(TAG_WORDS)
    .map(([tag, words]) => [tag, words.filter((w) => text.includes(w)).length] as const)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1]);
  return scored.slice(0, 3).map(([t]) => t);
}

// ───────────── 문장 정리 ─────────────

const SEP_TAIL = /\s*(?:\||│|\t|->|→|⇒|=>|=|–|—|-|:|：)\s*([^|│\t→⇒=:：]+?)\s*[.。]?\s*$/;
const SEP_HEAD = /^\s*\[?([^|│\t:：\]→]+?)\]?\s*(?:\||│|\t|:|：|\]|→|-|–|—)\s*(.+)$/s;
const ANSWER_LABEL = /(?:정답|답|answer)\s*[:：)]\s*([^\n,，.]+)/i;
const BULLET = /^\s*(?:\(?\d{1,3}[.)번]|[①-⑳]|[-•·▶▷■□○●◆◇※★☆✓✔]|[가-하][.)])\s*/;

const cleanAnswerText = (s: string) => s.replace(/[()[\]「」『』"'.。,，]/g, '').replace(/\s+/g, ' ').trim();

/** "브라질은" → "이 나라는" 처럼 정답 이름을 가린다 (받침에 맞게 조사도 바꿈) */
export function maskAnswer(text: string, place: Place, lookup: Map<string, Place>): string {
  const label = place.kind === 'city' ? '이 도시' : '이 나라';
  const names = [...lookup.entries()].filter(([, p]) => p === place).map(([n]) => n).sort((a, b) => b.length - a.length);
  let out = text;
  for (const n of names) {
    const esc = n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out.replace(new RegExp(`${esc}(으로|은|을|과|이(?=[\\s,.!?]|$))?`, 'g'), (_m, josa: string | undefined) => {
      const fix: Record<string, string> = { 은: '는', 을: '를', 과: '와', 으로: '로', 이: '가' };
      return label + (josa ? fix[josa] : '');
    });
  }
  return out.replace(/\s{2,}/g, ' ').trim();
}

/** 정답 이름을 모두 가린다 */
export function maskAll(text: string, places: Place[], lookup: Map<string, Place>): string {
  return places.reduce((t, p) => maskAnswer(t, p, lookup), text);
}

function resolveOne(text: string, lookup: Map<string, Place>): Place | null {
  const t = cleanAnswerText(text);
  return lookup.get(t) ?? lookup.get(t.replace(/\s+/g, '')) ?? lookup.get(t.toLowerCase()) ?? null;
}

/** "아르헨티나, 우루과이" · "아르헨티나/우루과이" · "아르헨티나 또는 우루과이" → [아르헨티나, 우루과이] (모두 찾아야 인정) */
export function resolveMany(text: string, lookup: Map<string, Place>): Place[] | null {
  const parts = text.split(/\s*(?:,|，|\/|·|또는|혹은)\s*/).filter((x) => x.trim());
  if (parts.length === 0) return null;
  const found = parts.map((x) => resolveOne(x, lookup));
  if (found.some((x) => !x)) return null;
  const uniq = [...new Set(found as Place[])];
  // 도시가 섞여 있으면 첫 정답만 (복수 정답은 나라끼리만)
  return uniq.length > 1 && uniq.some((x) => x.kind === 'city') ? [uniq[0]] : uniq;
}

const resolve = (text: string, lookup: Map<string, Place>): Place | null => resolveMany(text, lookup)?.[0] ?? null;

/** 한 항목 → 개념 문항 */
export function classify(source: string, lookup: Map<string, Place>): ImportItem {
  const text = source.replace(BULLET, '').replace(/\s+/g, ' ').trim();
  const tags = guessTags(text);
  const all = findPlaces(text, lookup);
  const candidates = [...new Map(all.map((f) => [f.place, f.place])).values()];

  // 1) 정답이 따로 적혀 있는 경우: "… 정답: 브라질", "… - 브라질", "브라질: …", "… (브라질)"
  const label = text.match(ANSWER_LABEL);
  if (label) {
    const many = resolveMany(label[1], lookup);
    if (many) {
      const [p, ...alts] = many;
      const rest = text.replace(ANSWER_LABEL, '').replace(/[\s,(]+$/, '').trim();
      return { source, base: rest, prompt: maskAll(rest, many, lookup), answer: p, alts, candidates, status: 'auto', reason: '‘정답’ 표시', tags };
    }
  }
  const paren = text.match(/^(.*\S)\s*[(（]([^()（）]+)[)）]\s*[.。]?$/);
  if (paren) {
    const many = resolveMany(paren[2], lookup);
    if (many) {
      const [p, ...alts] = many;
      return { source, base: paren[1], prompt: maskAll(paren[1], many, lookup), answer: p, alts, candidates, status: 'auto', reason: '괄호 속 정답', tags };
    }
  }
  const tail = text.match(SEP_TAIL);
  if (tail) {
    const many = resolveMany(tail[1], lookup);
    if (many) {
      const [p, ...alts] = many;
      const rest = text.slice(0, text.length - tail[0].length).trim();
      if (rest.length >= 2) return { source, base: rest, prompt: maskAll(rest, many, lookup), answer: p, alts, candidates, status: 'auto', reason: '끝에 적힌 정답', tags };
    }
  }
  const head = text.match(SEP_HEAD);
  if (head) {
    const many = resolveMany(head[1], lookup);
    if (many && head[2].trim().length >= 2) {
      const [p, ...alts] = many;
      return { source, base: head[2].trim(), prompt: maskAll(head[2].trim(), many, lookup), answer: p, alts, candidates, status: 'auto', reason: '앞에 적힌 정답', tags };
    }
  }

  // 끝에 정답 이름만 붙은 경우: "… 재배한다. 인도", "… 많은 나라는 러시아이다."
  const last = text.match(/^(.*\S)\s+(\S+?)(?:이다|입니다|이에요|예요|다)?[.。!]?$/);
  if (last) {
    const p = resolve(last[2], lookup);
    if (p && last[1].length >= 6) {
      let rest = last[1].trim();
      if (/[은는]$/.test(rest)) rest += '?'; // "… 나라는" → "… 나라는?"
      return { source, base: rest, prompt: maskAnswer(rest, p, lookup), answer: p, alts: [], candidates, status: 'auto', reason: '끝에 적힌 정답', tags };
    }
  }

  // 줄 맨 앞에 이름만 쓰고 띄어 쓴 경우 (표의 칸이 붙어 읽힌 경우 등): "노르웨이 빙하 침식으로 …"
  if (all.length && all[0].index === 0 && /\s/.test(text[all[0].length] ?? '')) {
    const p = all[0].place;
    const rest = text.slice(all[0].length).trim();
    if (rest.length >= 6) return { source, base: rest, prompt: maskAnswer(rest, p, lookup), answer: p, alts: [], candidates, status: 'auto', reason: '앞에 적힌 정답', tags };
  }

  // 2) 문장 안에 나온 나라·도시로 추측
  if (candidates.length === 0) {
    return { source, base: text, prompt: text, answer: null, alts: [], candidates, status: 'none', reason: '나라·도시 이름이 없음', tags };
  }
  if (candidates.length === 1) {
    const p = candidates[0];
    return { source, base: text, prompt: maskAnswer(text, p, lookup), answer: p, alts: [], candidates, status: 'auto', reason: '문장 속 이름', tags };
  }
  // 여러 곳이 나오면: '도시·수도'를 묻는 문장이면 도시, 아니면 주어(맨 앞)로 나온 곳을 고르고 확인 요청
  const asksCity = /도시|수도/.test(text);
  const pick = (asksCity && candidates.find((c) => c.kind === 'city')) || all[0].place;
  return {
    source,
    base: text,
    prompt: maskAnswer(text, pick, lookup),
    answer: pick,
    alts: [],
    candidates,
    status: 'check',
    reason: `여러 곳이 나옴 (${candidates.map((c) => c.name).join(', ')})`,
    tags,
  };
}

// ───────────── 글 → 항목 나누기 ─────────────

/** 줄 목록을 문항 단위로 묶는다. 번호·글머리표·정답 구분자가 있으면 새 문항, 아니면 앞 문항에 이어 붙임 */
export function splitItems(lines: string[], lookup: Map<string, Place>): string[] {
  const items: string[] = [];
  let cur = '';
  const flush = () => {
    const t = cur.trim();
    if (t) items.push(t);
    cur = '';
  };
  for (const raw of lines) {
    const line = raw.replace(/\s+/g, ' ').trim();
    if (!line) {
      flush();
      continue;
    }
    if (/^[-–—\s]*\d{1,3}[-–—\s]*$/.test(line) || /^\d+\s*\/\s*\d+$/.test(line)) continue; // 쪽 번호
    // 다음 줄에 정답만 적힌 경우: "이 도시는 파리이다.", "정답: 브라질", "→ 브라질", "브라질"
    const answerOnly = line
      .replace(/^(?:정답|답)\s*[:：)]?\s*|^(?:->|→|⇒|=>)\s*/, '')
      .replace(/^이\s*(?:나라|도시|국가)(?:는|은|가|의 이름은)\s*/, '')
      .replace(/(?:이다|입니다|이에요|예요|다)?[.。!]?$/, '');
    if (cur && line.length <= 30 && resolve(answerOnly, lookup)) {
      cur += ' 정답: ' + answerOnly.trim();
      flush();
      continue;
    }
    const startsNew = BULLET.test(line);
    const selfContained = (SEP_TAIL.test(line) && !!resolve(line.match(SEP_TAIL)![1], lookup)) || (SEP_HEAD.test(line) && !!resolve(line.match(SEP_HEAD)![1], lookup));
    const prevEnded = /[.?!。]$|[다요죠]$|\)$/.test(cur.trim());
    if (startsNew || selfContained || prevEnded || !cur) {
      flush();
      cur = line;
    } else {
      cur += ' ' + line;
    }
    if (selfContained) flush();
  }
  flush();
  // 너무 짧은 제목·머리말은 버림
  return items.filter((t) => t.replace(BULLET, '').trim().length >= 6);
}

export function importFromText(text: string, lookup: Map<string, Place>): ImportItem[] {
  return splitItems(text.split(/\r?\n/), lookup).map((s) => classify(s, lookup));
}
