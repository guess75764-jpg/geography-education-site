import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { geoArea, geoDistance } from 'd3-geo';
import type { City, Country } from '../types';
import { GEO_HINTS, type GeoHint } from '../data/hints';
import { CITY_TOLERANCE_KM, FEEDBACK_MS, PRACTICE_COUNT, TIME_LIMIT_SEC, pointsFor } from './scoring';

/** 문제 유형 */
export type QuizType = 'country' | 'city' | 'mixed' | 'hint';
/** 플레이 방식: 타임어택(60초, 랭킹 등록) / 연습(10문제, 해설 보며 천천히) */
export type PlayStyle = 'timeattack' | 'practice';

export const QUIZ_TYPE_LABEL: Record<QuizType, string> = {
  country: '국가',
  city: '도시',
  mixed: '섞어서',
  hint: '수능 힌트',
};

export type Target = { type: 'country'; countryId: string } | { type: 'point'; lon: number; lat: number };

export interface Question {
  key: string;
  target: Target;
  answerName: string; // 정답 이름
  label: '국가' | '도시';
  hint?: GeoHint; // 수능 힌트 문제일 때
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

export function useGame(countries: Country[], cities: City[]) {
  const [type, setType] = useState<QuizType>('country');
  const [style, setStyle] = useState<PlayStyle>('timeattack');
  const [phase, setPhase] = useState<Phase>('ready');
  const [countdown, setCountdown] = useState(COUNTDOWN_FROM);
  const [queue, setQueue] = useState<Question[]>([]);
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<AnswerResult[]>([]);
  const [combo, setCombo] = useState(0);
  const [endsAt, setEndsAt] = useState(0);
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
        target: { type: 'point', lon: c.lon, lat: c.lat },
        answerName: c.nameKo,
        label: '도시',
      })),
    [cities],
  );
  const hintQuestions = useMemo<Question[]>(
    () =>
      GEO_HINTS.map((h) => ({
        key: `h:${h.id}`,
        target: h.kind === 'country' ? { type: 'country', countryId: h.countryId } : { type: 'point', lon: h.lon, lat: h.lat },
        answerName: h.answer,
        label: h.kind === 'country' ? '국가' : '도시',
        hint: h,
      })),
    [],
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
  const timeLeftMs = isTimed && (phase === 'playing' || phase === 'answered') ? Math.max(0, endsAt - now) : isTimed && phase !== 'finished' ? TIME_LIMIT_SEC * 1000 : 0;
  const current = phase === 'playing' || phase === 'answered' ? queue[index] ?? null : null;
  const lastResult = phase === 'answered' ? results[results.length - 1] ?? null : null;
  const score = results.reduce((s, r) => s + r.points, 0);
  const maxCombo = results.reduce((m, r) => Math.max(m, r.combo), 0);

  const start = useCallback(
    (t: QuizType = type, s: PlayStyle = style) => {
      setType(t);
      setStyle(s);
      const pool = shuffle(poolFor(t));
      setQueue(s === 'practice' ? pool.slice(0, PRACTICE_COUNT) : pool);
      setIndex(0);
      setResults([]);
      setCombo(0);
      if (s === 'timeattack') {
        setCountdown(COUNTDOWN_FROM);
        setPhase('countdown');
      } else {
        questionStartedAt.current = Date.now();
        setPhase('playing');
      }
    },
    [type, style, poolFor],
  );

  // 3-2-1 카운트다운 → 시작
  useEffect(() => {
    if (phase !== 'countdown') return;
    if (countdown <= 0) {
      const t = Date.now();
      setEndsAt(t + TIME_LIMIT_SEC * 1000);
      setNow(t);
      questionStartedAt.current = t;
      setPhase('playing');
      return;
    }
    const id = setTimeout(() => setCountdown((c) => c - 1), 800);
    return () => clearTimeout(id);
  }, [phase, countdown]);

  // 타임어택 시계
  useEffect(() => {
    if (!isTimed || (phase !== 'playing' && phase !== 'answered')) return;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= endsAt) setPhase('finished');
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
        correct = clickedCountryId === current.target.countryId;
      } else if (clickedLonLat) {
        const { lon, lat } = current.target;
        distanceKm = Math.round(geoDistance(clickedLonLat, [lon, lat]) * EARTH_RADIUS_KM);
        correct = distanceKm <= CITY_TOLERANCE_KM;
      }
      const nextCombo = correct ? combo + 1 : 0;
      const points = correct ? pointsFor(nextCombo, elapsedMs, isTimed) : 0;
      setCombo(nextCombo);
      setResults((rs) => [
        ...rs,
        { question: current, correct, points, combo: nextCombo, elapsedMs, clickedCountryId, clickedLonLat, distanceKm },
      ]);
      setPhase('answered');
    },
    [phase, current, combo, isTimed],
  );

  const next = useCallback(() => {
    if (phase !== 'answered') return;
    if (!isTimed && index + 1 >= queue.length) {
      setPhase('finished');
      return;
    }
    if (isTimed && Date.now() >= endsAt) {
      setPhase('finished');
      return;
    }
    // 타임어택에서 문제를 다 쓰면 다시 섞어 이어 붙인다 (방금 문제가 바로 또 나오지 않게)
    if (index + 1 >= queue.length) {
      let more = shuffle(poolFor(type));
      if (more.length > 1 && more[0].key === queue[index]?.key) more = [...more.slice(1), more[0]];
      setQueue((q) => [...q, ...more]);
    }
    setIndex((i) => i + 1);
    questionStartedAt.current = Date.now();
    setPhase('playing');
  }, [phase, isTimed, index, queue, endsAt, poolFor, type]);

  // 타임어택은 잠깐 결과를 보여 준 뒤 자동으로 다음 문제
  useEffect(() => {
    if (phase !== 'answered' || !isTimed || !lastResult) return;
    const id = setTimeout(next, lastResult.correct ? FEEDBACK_MS.correct : FEEDBACK_MS.wrong);
    return () => clearTimeout(id);
  }, [phase, isTimed, lastResult, next]);

  const reset = useCallback(() => {
    setPhase('ready');
    setResults([]);
    setCombo(0);
  }, []);

  return {
    type,
    setType,
    style,
    setStyle,
    phase,
    countdown,
    current,
    lastResult,
    results,
    questionNumber: index + 1,
    practiceTotal: queue.length,
    score,
    combo,
    maxCombo,
    timeLeftMs,
    start,
    submit,
    next,
    reset,
  };
}

export type GameState = ReturnType<typeof useGame>;
