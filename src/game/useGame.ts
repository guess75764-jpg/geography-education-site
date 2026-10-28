import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { geoArea, geoDistance } from 'd3-geo';
import type { City, Country } from '../types';
import type { GeoHint } from '../data/hints';
import { CITY_TOLERANCE_KM, FEEDBACK_MS, PRACTICE_COUNT, challengeOf, pointsFor, timeBonusFor, type ChallengeCount } from './scoring';

/** 문제 유형 */
export type QuizType = 'country' | 'city' | 'mixed' | 'hint';
/** 플레이 방식: 타임어택 도전(관리자 개념, 10·20·40·60문제 + 제한 시간, 랭킹 등록) / 연습(10문제, 기록 없음) */
export type PlayStyle = 'timeattack' | 'practice';

export const QUIZ_TYPE_LABEL: Record<QuizType, string> = {
  country: '국가',
  city: '도시',
  mixed: '섞어서',
  hint: '개념+위치',
};

/** 나라 정답은 여러 개일 수 있다 (altIds 중 하나를 골라도 정답) */
export type Target =
  | { type: 'country'; countryId: string; altIds?: string[] }
  | { type: 'point'; lon: number; lat: number; countryId?: string }; // 도시: 좌표 + 그 도시가 있는 나라

/** 이 나라를 고르면 정답인지 */
export const isTargetCountry = (t: Target, id: string | null) =>
  !!id && t.type === 'country' && (t.countryId === id || (t.altIds ?? []).includes(id));

export interface Question {
  key: string;
  target: Target;
  answerName: string; // 정답 이름
  label: '국가' | '도시';
  hint?: GeoHint; // 개념+위치 문제일 때
}

export interface AnswerResult {
  question: Question;
  correct: boolean;
  points: number;
  combo: number; // 이 답 이후의 연속 정답 수
  elapsedMs: number; // 문제가 나온 뒤 답하기까지 걸린 시간
  clickedCountryId: string | null;
  clickedLonLat: [number, number] | null;
  distanceKm: number | null; // 도시 문제일 때 정답과의 거리
}

export type Phase = 'ready' | 'countdown' | 'playing' | 'answered' | 'finished';

const EARTH_RADIUS_KM = 6371;
/** 클릭하기 어려운 아주 작은 나라는 출제에서 제외 (스테라디안 단위, 약 1.2만 km²) */
const MIN_COUNTRY_AREA = 0.0003;
/** 남극 대륙은 나라가 아니므로 출제하지 않는다 */
const EXCLUDED_COUNTRY_IDS = new Set(['010']);
const COUNTDOWN_FROM = 3;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 문제 n개를 만든다. 문제 은행이 n개보다 적으면 섞어서 반복하되, 같은 문제가 연달아 나오지 않게 한다 */
function buildQueue(pool: Question[], n: number): Question[] {
  if (pool.length === 0) return [];
  const out: Question[] = [];
  while (out.length < n) {
    let more = shuffle(pool);
    if (more.length > 1 && out.length && more[0].key === out[out.length - 1].key) more = [...more.slice(1), more[0]];
    out.push(...more);
  }
  return out.slice(0, n);
}

export function useGame(countries: Country[], cities: City[], hints: GeoHint[]) {
  const [type, setType] = useState<QuizType>('country');
  const [style, setStyle] = useState<PlayStyle>('timeattack');
  const [challenge, setChallenge] = useState<ChallengeCount>(10);
  const [phase, setPhase] = useState<Phase>('ready');
  const [countdown, setCountdown] = useState(COUNTDOWN_FROM);
  const [queue, setQueue] = useState<Question[]>([]);
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<AnswerResult[]>([]);
  const [combo, setCombo] = useState(0);
  const [startedAt, setStartedAt] = useState(0);
  const [finishedAt, setFinishedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const questionStartedAt = useRef(0);

  // ── 문제 은행 ──
  const countryQuestions = useMemo<Question[]>(
    () =>
      countries
        .filter((c) => !c.id.startsWith('x-') && !EXCLUDED_COUNTRY_IDS.has(c.id) && geoArea(c.feature) >= MIN_COUNTRY_AREA)
        .map((c) => ({ key: `c:${c.id}`, target: { type: 'country', countryId: c.id }, answerName: c.nameKo, label: '국가' })),
    [countries],
  );
  const cityQuestions = useMemo<Question[]>(
    () =>
      cities.map((c) => ({
        key: `p:${c.id}`,
        target: { type: 'point', lon: c.lon, lat: c.lat, countryId: c.countryId },
        answerName: c.nameKo,
        label: '도시',
      })),
    [cities],
  );
  const nameOf = useMemo(() => new Map(countries.map((c) => [c.id, c.nameKo])), [countries]);
  const hintQuestions = useMemo<Question[]>(
    () =>
      hints.map((h) => ({
        key: `h:${h.id}`,
        target:
          h.kind === 'city' && h.lon !== undefined && h.lat !== undefined
            ? { type: 'point', lon: h.lon, lat: h.lat, countryId: h.countryId }
            : { type: 'country', countryId: h.countryId, altIds: h.altCountryIds ?? [] },
        // 복수 정답이면 "아르헨티나 또는 우루과이"
        answerName:
          h.kind === 'country' && h.altCountryIds?.length
            ? [h.answer, ...h.altCountryIds.map((id) => nameOf.get(id) ?? id)].join(' 또는 ')
            : h.answer,
        label: h.kind === 'country' ? '국가' : '도시',
        hint: h,
      })),
    [hints, nameOf],
  );

  const poolFor = useCallback(
    (t: QuizType): Question[] =>
      t === 'country'
        ? countryQuestions
        : t === 'city'
          ? cityQuestions
          : t === 'hint'
            ? hintQuestions
            : [...countryQuestions, ...cityQuestions],
    [countryQuestions, cityQuestions, hintQuestions],
  );

  const isTimed = style === 'timeattack';
  const limitMs = (challengeOf(challenge)?.limitSec ?? 60) * 1000;
  const endsAt = startedAt + limitMs;
  /** 타임어택 경과 시간 / 남은 시간 */
  const elapsedMs =
    phase === 'playing' || phase === 'answered' || phase === 'finished'
      ? Math.max(0, Math.min(finishedAt ?? now, isTimed ? endsAt : Infinity) - startedAt)
      : 0;
  const timeLeftMs = isTimed ? (phase === 'ready' || phase === 'countdown' ? limitMs : Math.max(0, limitMs - elapsedMs)) : 0;
  const current = phase === 'playing' || phase === 'answered' ? queue[index] ?? null : null;
  const lastResult = phase === 'answered' ? results[results.length - 1] ?? null : null;
  const answerPoints = results.reduce((s, r) => s + r.points, 0);
  /** 타임어택에서 모든 문제를 시간 안에 풀면 남은 시간만큼 보너스 (게임이 끝난 뒤 더해짐) */
  const timeBonus = isTimed && phase === 'finished' ? timeBonusFor(challenge, results.length, elapsedMs) : 0;
  const score = answerPoints + timeBonus;
  const maxCombo = results.reduce((m, r) => Math.max(m, r.combo), 0);

  /** 타임어택은 항상 관리자 개념(개념+위치) 문제, 연습은 고른 유형 */
  const start = useCallback(
    (opts: { type?: QuizType; style?: PlayStyle; challenge?: ChallengeCount } = {}) => {
      const s = opts.style ?? style;
      const c = opts.challenge ?? challenge;
      const t = s === 'timeattack' ? 'hint' : opts.type ?? type;
      setType(t);
      setStyle(s);
      setChallenge(c);
      setQueue(buildQueue(poolFor(t), s === 'practice' ? PRACTICE_COUNT : c));
      setIndex(0);
      setResults([]);
      setCombo(0);
      setFinishedAt(null);
      if (s === 'timeattack') {
        setCountdown(COUNTDOWN_FROM);
        setPhase('countdown');
      } else {
        const t0 = Date.now();
        setStartedAt(t0);
        questionStartedAt.current = t0;
        setPhase('playing');
      }
    },
    [type, style, challenge, poolFor],
  );

  // 3-2-1 카운트다운 → 시작
  useEffect(() => {
    if (phase !== 'countdown') return;
    if (countdown <= 0) {
      const t = Date.now();
      setStartedAt(t);
      setNow(t);
      questionStartedAt.current = t;
      setPhase('playing');
      return;
    }
    const id = setTimeout(() => setCountdown((c) => c - 1), 800);
    return () => clearTimeout(id);
  }, [phase, countdown]);

  // 타임어택 시계: 화면 갱신 + 시간이 다 되면 종료
  useEffect(() => {
    if (!isTimed || (phase !== 'playing' && phase !== 'answered')) return;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= endsAt) {
        setFinishedAt(endsAt);
        setPhase('finished');
      }
    }, 100);
    return () => clearInterval(id);
  }, [isTimed, phase, endsAt]);

  /** 지도 클릭으로 답하기 */
  const submit = useCallback(
    (clickedCountryId: string | null, clickedLonLat: [number, number] | null) => {
      if (phase !== 'playing' || !current) return;
      const elapsedMs = Date.now() - questionStartedAt.current;
      let correct = false;
      let distanceKm: number | null = null;
      if (current.target.type === 'country') {
        correct = isTargetCountry(current.target, clickedCountryId);
      } else if (clickedLonLat) {
        const { lon, lat } = current.target;
        distanceKm = Math.round(geoDistance(clickedLonLat, [lon, lat]) * EARTH_RADIUS_KM);
        correct = distanceKm <= CITY_TOLERANCE_KM;
      }
      const nextCombo = correct ? combo + 1 : 0;
      const points = correct ? pointsFor(nextCombo, elapsedMs, isTimed ? challengeOf(challenge)?.speedMax ?? 0 : 0) : 0;
      setCombo(nextCombo);
      setResults((rs) => [
        ...rs,
        { question: current, correct, points, combo: nextCombo, elapsedMs, clickedCountryId, clickedLonLat, distanceKm },
      ]);
      setPhase('answered');
    },
    [phase, current, combo, isTimed, challenge],
  );

  const next = useCallback(() => {
    if (phase !== 'answered') return;
    if (index + 1 >= queue.length || (isTimed && Date.now() >= endsAt)) {
      setFinishedAt(Date.now());
      setPhase('finished');
      return;
    }
    setIndex((i) => i + 1);
    questionStartedAt.current = Date.now();
    setPhase('playing');
  }, [phase, index, queue.length, isTimed, endsAt]);

  // 타임어택은 잠깐 결과를 보여 준 뒤 자동으로 다음 문제
  useEffect(() => {
    if (phase !== 'answered' || !isTimed || !lastResult) return;
    const id = setTimeout(next, lastResult.correct ? FEEDBACK_MS.correct : FEEDBACK_MS.wrong);
    return () => clearTimeout(id);
  }, [phase, isTimed, lastResult, next]);

  const reset = useCallback(() => {
    setFinishedAt(null);
    setPhase('ready');
    setResults([]);
    setCombo(0);
  }, []);

  return {
    type,
    setType,
    style,
    setStyle,
    challenge,
    setChallenge,
    phase,
    countdown,
    current,
    lastResult,
    results,
    questionNumber: index + 1,
    totalQuestions: queue.length,
    /** 이 유형의 문제 은행 크기 (개념이 0개면 시작할 수 없음) */
    poolSize: (t: QuizType) => poolFor(t).length,
    score,
    answerPoints,
    timeBonus,
    combo,
    maxCombo,
    elapsedMs,
    timeLeftMs,
    start,
    submit,
    next,
    reset,
  };
}

export type GameState = ReturnType<typeof useGame>;
