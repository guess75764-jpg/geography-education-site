import { useCallback, useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

export type AdminStatus = 'loading' | 'signed-out' | 'not-admin' | 'admin';

/**
 * 관리자 로그인 상태. 로그인했더라도 DB 의 관리자 명단(admins)에 있어야 'admin'.
 * 화면을 숨기는 것은 편의일 뿐이고, 실제 삭제·수정 권한은 DB 보안 규칙(RLS)이 막는다.
 */
export function useAdmin() {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<AdminStatus>(supabase ? 'loading' : 'signed-out');
  const userId = useRef<string | null | undefined>(undefined);

  const check = useCallback(async (s: Session | null) => {
    userId.current = s?.user.id ?? null;
    setSession(s);
    if (!supabase || !s) {
      setStatus('signed-out');
      return;
    }
    const { data, error } = await supabase.rpc('is_admin');
    setStatus(!error && data === true ? 'admin' : 'not-admin');
  }, []);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => check(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, s) => {
      // 토큰 갱신 등으로 자주 불리므로, 로그인한 사람이 바뀐 경우만 다시 확인
      if (userId.current !== (s?.user.id ?? null)) check(s);
      else setSession(s);
    });
    return () => data.subscription.unsubscribe();
  }, [check]);

  const signIn = useCallback(async (email: string, password: string): Promise<string | null> => {
    if (!supabase) return 'Supabase 가 설정되지 않았습니다.';
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      return error.message.includes('Invalid login credentials')
        ? '이메일 또는 비밀번호가 맞지 않아요.'
        : error.message.includes('Email not confirmed')
          ? '이메일 인증이 안 된 계정이에요. Supabase 에서 "Auto Confirm User" 로 만들었는지 확인하세요.'
          : `로그인 실패: ${error.message}`;
    }
    await check(data.session);
    return null;
  }, [check]);

  const signOut = useCallback(async () => {
    await supabase?.auth.signOut();
    userId.current = null;
    setSession(null);
    setStatus('signed-out');
  }, []);

  return { session, status, email: session?.user.email ?? null, signIn, signOut };
}
