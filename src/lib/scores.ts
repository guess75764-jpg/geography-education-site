import { supabase } from './supabase';
import type { QuestionKind } from '../game/useGame';

export interface ScoreRow {
  id: number;
  nickname: string;
  score: number;
  max_score: number;
  correct_count: number;
  total: number;
  quiz_kind: QuestionKind;
  created_at: string;
}

export type NewScore = Omit<ScoreRow, 'id' | 'created_at'>;

export const scoresEnabled = supabase !== null;

export async function saveScore(row: NewScore): Promise<void> {
  if (!supabase) throw new Error('Supabase 가 설정되지 않았습니다.');
  const { error } = await supabase.from('scores').insert({ ...row, nickname: row.nickname.trim() });
  if (error) throw error;
}

/** 같은 문제 종류·문제 수끼리 비교한 상위 점수 */
export async function fetchTopScores(kind: QuestionKind, total: number, limit = 10): Promise<ScoreRow[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('scores')
    .select('*')
    .eq('quiz_kind', kind)
    .eq('total', total)
    .order('score', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(limit);
  if (error) throw error;
  return data as ScoreRow[];
}
