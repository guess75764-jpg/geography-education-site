import { useCallback, useEffect, useMemo, useState } from 'react';
import { geoDistance } from 'd3-geo';
import type { GeoHint } from '../data/hints';
import { CITY_TOLERANCE_KM } from './scoring';

export type StudyStatus = 'asking' | 'wrong' | 'correct' | 'revealed';

export interface StudyClick {
  countryId: string | null;
  lonLat: [number, number] | null;
  distanceKm: number | null;
}

const EARTH_RADIUS_KM = 6371;

function shuffledIndexes(n: number): number[] {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * 개념 공부: 관리자가 등록한 개념을 한 문항씩 풀어 본다.
 * 나라(또는 도시 위치)를 클릭하면 바로 맞았는지 알려 주고, 틀리면 다시 시도하거나 정답을 볼 수 있다.
 */
export function useStudy(hints: GeoHint[]) {
  const [shuffle, setShuffle] = useState(false);
  const [order, setOrder] = useState<number[]>([]);
  const [index, setIndex] = useState(0);
  const [status, setStatus] = useState<StudyStatus>('asking');
  const [tries, setTries] = useState(0);
  const [lastClick, setLastClick] = useState<StudyClick | null>(null);
  /** 개념별 결과: 한 번에 맞힘 / 다시 해서 맞힘 / 정답 봄 */
  const [record, setRecord] = useState<Record<string, 'first' | 'retry' | 'revealed'>>({});

  // 개념 목록이 바뀌면(불러오기·관리자 수정) 처음부터
  useEffect(() => {
    setOrder(shuffle ? shuffledIndexes(hints.length) : hints.map((_, i) => i));
    setIndex(0);
    setStatus('asking');
    setTries(0);
    setLastClick(null);
    setRecord({});
  }, [hints, shuffle]);

  const current: GeoHint | null = order.length ? hints[order[index]] ?? null : null;

  const go = useCallback(
    (i: number) => {
      if (order.length === 0) return;
      setIndex(((i % order.length) + order.length) % order.length);
      setStatus('asking');
      setTries(0);
      setLastClick(null);
    },
    [order.length],
  );

  const answer = useCallback(
    (countryId: string | null, lonLat: [number, number] | null) => {
      if (!current || status === 'correct' || status === 'revealed') return;
      let ok = false;
      let distanceKm: number | null = null;
      if (current.kind === 'city' && current.lon !== undefined && current.lat !== undefined) {
        if (lonLat) {
          distanceKm = Math.round(geoDistance(lonLat, [current.lon, current.lat]) * EARTH_RADIUS_KM);
          ok = distanceKm <= CITY_TOLERANCE_KM;
        }
      } else {
        ok = countryId === current.countryId;
      }
      setLastClick({ countryId, lonLat, distanceKm });
      setTries((t) => t + 1);
      if (ok) {
        setStatus('correct');
        setRecord((r) => (r[current.id] ? r : { ...r, [current.id]: tries === 0 ? 'first' : 'retry' }));
      } else {
        setStatus('wrong');
      }
    },
    [current, status, tries],
  );

  const reveal = useCallback(() => {
    if (!current) return;
    setStatus('revealed');
    setRecord((r) => (r[current.id] ? r : { ...r, [current.id]: 'revealed' }));
  }, [current]);

  const stats = useMemo(() => {
    const v = Object.values(record);
    return { done: v.length, first: v.filter((x) => x === 'first').length };
  }, [record]);

  return {
    current,
    index,
    total: order.length,
    status,
    tries,
    lastClick,
    stats,
    shuffle,
    setShuffle,
    answer,
    reveal,
    next: () => go(index + 1),
    prev: () => go(index - 1),
    restart: () => {
      setOrder(shuffle ? shuffledIndexes(hints.length) : hints.map((_, i) => i));
      setRecord({});
      go(0);
    },
  };
}

export type StudyState = ReturnType<typeof useStudy>;
