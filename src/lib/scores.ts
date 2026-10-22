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

/** 랭킹 기간: 전체 / 오늘 / 최근 7일 */
export type Period = 'all' | 'today' | 'week';

export interface RankingFilter {
  kind: QuestionKind;
  total: number;
  period: Period;
}

export const scoresEnabled = supabase !== null;

function sinceOf(period: Period): string | null {
  if (period === 'all') return null;
  const d = new Date();
  if (period === 'today') d.setHours(0, 0, 0, 0);
  else d.setDate(d.getDate() - 7);
  return d.toISOString();
}

/** 같은 문제 종류·문제 수끼리만 비교한다 (5문제 50점과 20문제 50점은 다른 기록) */
function baseQuery(f: RankingFilter, columns: string, head = false) {
  let q = supabase!
    .from('scores')
    .select(columns, head ? { count: 'exact', head: true } : undefined)
    .eq('quiz_kind', f.kind)
    .eq('total', f.total);
  const since = sinceOf(f.period);
  if (since) q = q.gte('created_at', since);
  return q;
}

/** 저장 후 새 기록의 id 를 돌려준다 */
export async function saveScore(row: NewScore): Promise<number> {
  if (!supabase) throw new Error('Supabase 가 설정되지 않았습니다.');
  const { data, error } = await supabase
    .from('scores')
    .insert({ ...row, nickname: row.nickname.trim() })
    .select('id')
    .single();
  if (error) throw error;
  return data.id as number;
}

export async function fetchRanking(f: RankingFilter, limit = 10): Promise<ScoreRow[]> {
  if (!supabase) return [];
  const { data, error } = await baseQuery(f, '*')
    .order('score', { ascending: false })
    .order('created_at', { ascending: true }) // 같은 점수면 먼저 세운 기록이 위
    .limit(limit);
  if (error) throw error;
  return data as unknown as ScoreRow[];
}

/** 이 점수가 몇 위인지 (같은 점수는 같은 등수) 와 전체 기록 수 */
export async function fetchRankOf(f: RankingFilter, score: number): Promise<{ rank: number; count: number }> {
  if (!supabase) return { rank: 0, count: 0 };
  const [higher, all] = await Promise.all([baseQuery(f, 'id', true).gt('score', score), baseQuery(f, 'id', true)]);
  if (higher.error) throw higher.error;
  if (all.error) throw all.error;
  return { rank: (higher.count ?? 0) + 1, count: all.count ?? 0 };
}

/** 같은 점수에 같은 등수를 매긴다: 100, 90, 90, 80 → 1, 2, 2, 4 */
export function withRanks<T extends { score: number }>(rows: T[]): (T & { rank: number })[] {
  let prev: { score: number; rank: number } | null = null;
  return rows.map((r, i) => {
    const rank = prev && prev.score === r.score ? prev.rank : i + 1;
    prev = { score: r.score, rank };
    return { ...r, rank };
  });
}
