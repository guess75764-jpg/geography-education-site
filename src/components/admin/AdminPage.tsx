import { useState } from 'react';
import { useAdmin } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import type { Country } from '../../types';
import AdminConcepts from './AdminConcepts';
import AdminScores from './AdminScores';

type Tab = 'concepts' | 'scores';

/**
 * 관리자 화면. 로그인 + 관리자 명단 확인 후에만 관리 기능을 보여 준다.
 * (화면을 숨기는 것과 별개로, 실제 수정·삭제 권한은 DB 보안 규칙이 막는다)
 */
export default function AdminPage({
  countries,
  countryById,
  onConceptsChanged,
}: {
  countries: Country[];
  countryById: Map<string, Country>;
  onConceptsChanged: () => void;
}) {
  const admin = useAdmin();
  const [tab, setTab] = useState<Tab>('concepts');

  if (!supabase) {
    return (
      <section className="card admin-box">
        <h2>🔐 관리자</h2>
        <p className="muted">관리 기능을 쓰려면 Supabase 공개 키(.env 또는 Vercel 환경 변수)를 설정하세요.</p>
      </section>
    );
  }
  if (admin.status === 'loading') {
    return <p className="muted center">로그인 상태 확인 중…</p>;
  }
  if (admin.status === 'signed-out') return <LoginForm onSignIn={admin.signIn} />;
  if (admin.status === 'not-admin') {
    return (
      <section className="card admin-box">
        <h2>🔐 관리자 권한 없음</h2>
        <p>
          <b>{admin.email}</b> 계정으로 로그인했지만 관리자 명단에 없어요.
        </p>
        <p className="muted small">
          Supabase SQL Editor 에서 아래 한 줄을 실행하면 관리자로 등록돼요.
        </p>
        <pre className="code">
          insert into public.admins (user_id) select id from auth.users where email = '{admin.email}';
        </pre>
        <button className="secondary" onClick={admin.signOut}>
          로그아웃
        </button>
      </section>
    );
  }

  return (
    <div className="admin">
      <header className="admin-head card">
        <div>
          <h2>🛠 관리자 화면</h2>
          <p className="muted small">{admin.email} 로그인 중</p>
        </div>
        <div className="pill-tabs">
          <button className={tab === 'concepts' ? 'active' : ''} onClick={() => setTab('concepts')}>
            📝 개념 관리
          </button>
          <button className={tab === 'scores' ? 'active' : ''} onClick={() => setTab('scores')}>
            🏆 명예의 전당 관리
          </button>
        </div>
        <button className="secondary" onClick={admin.signOut}>
          로그아웃
        </button>
      </header>
      {tab === 'concepts' ? (
        <AdminConcepts countries={countries} countryById={countryById} onChanged={onConceptsChanged} />
      ) : (
        <AdminScores />
      )}
    </div>
  );
}

function LoginForm({ onSignIn }: { onSignIn: (email: string, password: string) => Promise<string | null> }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const err = await onSignIn(email, password);
    setBusy(false);
    if (err) setError(err);
  };

  return (
    <form className="card admin-box login" onSubmit={submit}>
      <h2>🔐 관리자 로그인</h2>
      <p className="muted small">선생님(관리자)만 로그인해요. 학생은 로그인 없이 게임에 참여합니다.</p>
      <label className="field">
        이메일
        <input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <label className="field">
        비밀번호
        <input
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      {error && <p className="error small">{error}</p>}
      <button className="primary" disabled={busy}>
        {busy ? '로그인 중…' : '로그인'}
      </button>
    </form>
  );
}
