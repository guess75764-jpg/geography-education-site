import { supabase } from './supabase';
import type { GeoHint } from '../data/hints';

/** 정답 나라 전체 (주 정답 + 함께 인정하는 나라) */
export function answerCountryIds(h: { countryId: string; altCountryIds?: string[] }): string[] {
  return [h.countryId, ...(h.altCountryIds ?? [])];
}

/** Supabase concepts 표의 한 줄 */
export interface ConceptRow {
  id: number;
  prompt: string;
  answer_type: 'country' | 'city';
  country_id: string;
  /** 함께 정답으로 인정하는 나라들 (SQL 005 이전에는 없음) */
  alt_country_ids?: string[];
  answer_name: string;
  lon: number | null;
  lat: number | null;
  explanation: string | null;
  climate: string | null;
  resources: string[];
  tags: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type ConceptInput = Omit<ConceptRow, 'id' | 'created_at' | 'updated_at'>;

export function rowToHint(r: ConceptRow): GeoHint {
  return {
    id: `db-${r.id}`,
    kind: r.answer_type,
    countryId: r.country_id,
    altCountryIds: r.answer_type === 'country' ? (r.alt_country_ids ?? []).filter((id) => id !== r.country_id) : [],
    lon: r.lon ?? undefined,
    lat: r.lat ?? undefined,
    answer: r.answer_name,
    hint: r.prompt,
    explanation: r.explanation ?? undefined,
    climate: r.climate ?? undefined,
    resources: r.resources ?? [],
    tags: r.tags ?? [],
  };
}

/** 게임용: 켜져 있는 개념 (학생은 보안 규칙상 켜진 것만 받는다) */
export async function fetchActiveConcepts(): Promise<ConceptRow[]> {
  if (!supabase) throw new Error('Supabase 가 설정되지 않았습니다.');
  const { data, error } = await supabase.from('concepts').select('*').eq('is_active', true).order('id');
  if (error) throw error;
  return data as ConceptRow[];
}

/** 관리자용: 꺼진 것 포함 전부 */
export async function fetchAllConcepts(): Promise<ConceptRow[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('concepts').select('*').order('id', { ascending: false });
  if (error) throw error;
  return data as ConceptRow[];
}

function clean(input: Partial<ConceptInput>, keepEmptyAlts = false): Partial<ConceptInput> {
  const out = { ...input };
  if (out.prompt !== undefined) out.prompt = out.prompt.trim();
  if (out.answer_name !== undefined) out.answer_name = out.answer_name.trim();
  if (out.explanation !== undefined) out.explanation = out.explanation?.trim() || null;
  if (out.climate !== undefined) out.climate = out.climate?.trim() || null;
  if (out.answer_type === 'country') {
    out.lon = null;
    out.lat = null;
  }
  if (out.answer_type === 'city') out.alt_country_ids = [];
  if (out.alt_country_ids) out.alt_country_ids = [...new Set(out.alt_country_ids)].filter((id) => id !== out.country_id);
  // 복수 정답이 없으면 칸을 보내지 않는다 (SQL 005 실행 전에도 저장되도록)
  if (out.alt_country_ids && out.alt_country_ids.length === 0 && !keepEmptyAlts) delete out.alt_country_ids;
  return out;
}

export async function createConcepts(inputs: ConceptInput[]): Promise<void> {
  if (!supabase) throw new Error('Supabase 가 설정되지 않았습니다.');
  const { error } = await supabase.from('concepts').insert(inputs.map((i) => clean(i)));
  if (error) throw error;
}

/** clearAlts: 복수 정답을 모두 지운 경우 빈 목록을 저장 */
export async function updateConcept(id: number, input: Partial<ConceptInput>, clearAlts = false): Promise<void> {
  if (!supabase) throw new Error('Supabase 가 설정되지 않았습니다.');
  const { error } = await supabase.from('concepts').update(clean(input, clearAlts)).eq('id', id);
  if (error) throw error;
}

export async function deleteConcepts(ids: number[]): Promise<void> {
  if (!supabase) throw new Error('Supabase 가 설정되지 않았습니다.');
  const { error } = await supabase.from('concepts').delete().in('id', ids);
  if (error) throw error;
}
