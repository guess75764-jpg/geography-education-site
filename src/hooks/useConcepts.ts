import { useCallback, useEffect, useState } from 'react';
import { BUILTIN_CONCEPTS, type GeoHint } from '../data/hints';
import { fetchActiveConcepts, rowToHint } from '../lib/concepts';
import { supabase } from '../lib/supabase';

export type ConceptSource = 'loading' | 'db' | 'builtin';

/**
 * 개념+위치 문제 목록.
 * - 관리자가 Supabase 에 등록한 개념(켜진 것)을 쓴다.
 * - 인터넷이 없거나 Supabase 가 설정되지 않았으면 기본 개념(BUILTIN_CONCEPTS)으로 대신한다.
 */
export function useConcepts() {
  const [hints, setHints] = useState<GeoHint[]>(supabase ? [] : BUILTIN_CONCEPTS);
  const [source, setSource] = useState<ConceptSource>(supabase ? 'loading' : 'builtin');

  const reload = useCallback(async () => {
    if (!supabase) return;
    try {
      const rows = await fetchActiveConcepts();
      setHints(rows.map(rowToHint));
      setSource('db');
    } catch (e) {
      console.warn('개념을 불러오지 못해 기본 개념을 씁니다.', e);
      setHints(BUILTIN_CONCEPTS);
      setSource('builtin');
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { hints, source, reload };
}
