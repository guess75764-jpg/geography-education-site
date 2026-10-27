import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

/**
 * Supabase 클라이언트. .env 가 설정되지 않았으면 null 이고,
 * 이때 사이트는 점수 저장·관리 기능만 숨긴 채 정상 동작한다.
 *
 * 브라우저에서는 반드시 "공개용(publishable)" 키만 쓴다.
 * 공개용 키는 노출되어도 괜찮고, 실제 권한은 DB 의 RLS 정책이 제한한다.
 * 로그인 세션은 관리자만 쓰며, 같은 브라우저에서 로그인이 유지되도록 저장한다.
 */
export const supabase: SupabaseClient | null =
  url && key
    ? createClient(url, key, {
        auth: { persistSession: true, autoRefreshToken: true, storageKey: 'geo-quiz-admin' },
      })
    : null;
