import { useCallback, useMemo, useState } from 'react';
import { geoArea, geoDistance } from 'd3-geo';
import type { City, Country } from '../types';

export type QuestionKind = 'country' | 'city' | 'mixed';

export type Question =
  | { kind: 'country'; country: Country }
  | { kind: 'city'; city: City };

export interface Answer {
  correct: boolean;
  clickedCountryId: string | null;
  clickedLonLat: [number, number] | null;
  distanceKm: number | null; // 도시 문제일 때 정답과의 거리
}

type Phase = 'ready' | 'asking' | 'answered' | 'finished';

const EARTH_RADIUS_KM = 6371;
/** 도시 문제: 이 거리 안을 클릭하면 정답 */
export const CITY_TOLERANCE_KM = 500;
/** 클릭하기 어려운 아주 작은 나라는 출제에서 제외 (스테라디안 단위, 약 1.2만 km²) */
const MIN_COUNTRY_AREA = 0.0003;
const POINTS_PER_QUESTION = 10;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function useGame(countries: Country[], cities: City[]) {
  const [phase, setPhase] = useState<Phase>('ready');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [answer, setAnswer] = useState<Answer | null>(null);

  const countryPool = useMemo(
    () => countries.filter((c) => !c.id.startsWith('x-') && geoArea(c.feature) >= MIN_COUNTRY_AREA),
    [countries],
  );

  const start = useCallback(
    (kind: QuestionKind, count: number) => {
      const countryQs: Question[] = shuffle(countryPool).map((country) => ({ kind: 'country', country }));
      const cityQs: Question[] = shuffle(cities).map((city) => ({ kind: 'city', city }));
      const pool =
        kind === 'country' ? countryQs : kind === 'city' ? cityQs : shuffle([...countryQs.slice(0, count), ...cityQs.slice(0, count)]);
      setQuestions(pool.slice(0, count));
      setIndex(0);
      setScore(0);
      setCorrectCount(0);
      setAnswer(null);
      setPhase('asking');
    },
    [countryPool, cities],
  );

  const current = phase === 'asking' || phase === 'answered' ? questions[index] ?? null : null;

  /** 지도 클릭으로 답하기 */
  const submit = useCallback(
    (clickedCountryId: string | null, clickedLonLat: [number, number] | null) => {
      if (phase !== 'asking' || !current) return;
      let correct = false;
      let distanceKm: number | null = null;

      if (current.kind === 'country') {
        correct = clickedCountryId === current.country.id;
      } else if (clickedLonLat) {
        const { lon, lat } = current.city;
        distanceKm = Math.round(geoDistance(clickedLonLat, [lon, lat]) * EARTH_RADIUS_KM);
        correct = distanceKm <= CITY_TOLERANCE_KM;
      }

      if (correct) {
        setScore((s) => s + POINTS_PER_QUESTION);
        setCorrectCount((n) => n + 1);
      }
      setAnswer({ correct, clickedCountryId, clickedLonLat, distanceKm });
      setPhase('answered');
    },
    [phase, current],
  );

  const next = useCallback(() => {
    setAnswer(null);
    if (index + 1 >= questions.length) {
      setPhase('finished');
    } else {
      setIndex((i) => i + 1);
      setPhase('asking');
    }
  }, [index, questions.length]);

  const reset = useCallback(() => {
    setPhase('ready');
    setAnswer(null);
  }, []);

  return {
    phase,
    current,
    index,
    total: questions.length,
    score,
    maxScore: questions.length * POINTS_PER_QUESTION,
    correctCount,
    answer,
    start,
    submit,
    next,
    reset,
  };
}

export type GameState = ReturnType<typeof useGame>;
