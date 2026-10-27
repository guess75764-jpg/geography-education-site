import { supabase } from './supabase';
import type { PlayStyle, QuizType } from '../game/useGame';

export interface ScoreRow {
  id: number;
  nickname: string;
  score: number;
  max_score: number;
  correct_count: number;
  total: number;
  quiz_kind: QuizType;
  game_mode: PlayStyle;
  max_combo: number;
  duration_ms: number | null; // 타임어택 20문제에 걸린 시간
  created_at: string;
}

export type NewScore = Omit<ScoreRow, 'id' | 'created_at' | 'max_score'>;

/** 랭킹 기간: 전체 / 오늘 / 최근 7일 */
export type Period = 'all' | 'today' | 'week';

/** 명예의 전당 필터 (타임어택 기록만 순위에 오른다) */
export interface RankingFilter {
  kind: QuizType | 'all';
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

function baseQuery(f: RankingFilter, columns: string, head = false) {
  let q = supabase!
    .from('scores')
    .select(columns, head ? { count: 'exact', head: true } : undefined)
    .eq('game_mode', 'timeattack');
  if (f.kind !== 'all') q = q.eq('quiz_kind', f.kind);
  const since = sinceOf(f.period);
  if (since) q = q.gte('created_at', since);
  return q;
}

/** DB 오류를 학생이 이해할 수 있는 말로 바꾼다 */
export function describeDbError(e: unknown): string {
  const code = (e as { code?: string } | null)?.code;
  // 테이블/열이 없음 → SQL 을 아직 실행하지 않음
  if (code === 'PGRST205' || code === 'PGRST204' || code === '42P01' || code === '42703') {
    return '점수 저장소가 아직 준비되지 않았어요. 선생님께 Supabase SQL 실행을 부탁하세요.';
  }
  if (code === '23514') return '저장할 수 없는 값이 있어요. (별명은 1~20자)';
  return '서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.';
}

/** 저장 후 새 기록의 id 를 돌려준다 */
export async function saveScore(row: NewScore): Promise<number> {
  if (!supabase) throw new Error('Supabase 가 설정되지 않았습니다.');
  const { data, error } = await supabase
    .from('scores')
    // max_score 는 예전 규칙(score <= max_score)과의 호환용
    .insert({ ...row, nickname: row.nickname.trim(), max_score: Math.max(row.score, 1) })
    .select('id')
    .single();
  if (error) throw error;
  return data.id as number;
}

export async function fetchRanking(f: RankingFilter, limit = 10): Promise<ScoreRow[]> {
  if (!supabase) return [];
  const { data, error } = await baseQuery(f, '*')
    .order('score', { ascending: false })
    .order('duration_ms', { ascending: true, nullsFirst: false }) // 같은 점수면 더 빨리 끝낸 기록이 위
    .order('created_at', { ascending: true })
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

// ───────────── 관리자 전용 (DB 보안 규칙상 관리자 로그인 상태에서만 성공) ─────────────

/** 관리 화면용 기록 목록: 연습 기록 포함, 별명 검색 */
export async function fetchScoresAdmin(opts: { kind: QuizType | 'all'; search: string; limit?: number }): Promise<ScoreRow[]> {
  if (!supabase) return [];
  let q = supabase.from('scores').select('*');
  if (opts.kind !== 'all') q = q.eq('quiz_kind', opts.kind);
  const term = opts.search.trim();
  if (term) q = q.ilike('nickname', `%${term.replace(/[%_]/g, (m) => '\\' + m)}%`);
  const { data, error } = await q.order('created_at', { ascending: false }).limit(opts.limit ?? 300);
  if (error) throw error;
  return data as ScoreRow[];
}

/** 기록 삭제. 실제로 지워진 개수를 돌려준다 (권한이 없으면 0) */
export async function deleteScores(ids: number[]): Promise<number> {
  if (!supabase || ids.length === 0) return 0;
  const { data, error } = await supabase.from('scores').delete().in('id', ids).select('id');
  if (error) throw error;
  return data?.length ?? 0;
}
