import { useEffect, useState } from 'react';
import { fetchTopScores, saveScore, scoresEnabled, type NewScore, type ScoreRow } from '../lib/scores';

const KIND_LABEL = { country: '국가', city: '도시', mixed: '섞어서' } as const;
const NICKNAME_KEY = 'geo-quiz:nickname';

function loadNickname(): string {
  try {
    return localStorage.getItem(NICKNAME_KEY) ?? '';
  } catch {
    return '';
  }
}

/** 게임 종료 화면: 닉네임으로 점수 저장 + 순위표 */
export default function ScoreBoard({ result }: { result: Omit<NewScore, 'nickname'> }) {
  const [nickname, setNickname] = useState(loadNickname);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [top, setTop] = useState<ScoreRow[] | null>(null);
  const [savedId, setSavedId] = useState<number | null>(null);

  const load = async () => {
    try {
      setTop(await fetchTopScores(result.quiz_kind, result.total));
    } catch (e) {
      setError('순위표를 불러오지 못했어요.');
      console.error(e);
    }
  };

  useEffect(() => {
    if (scoresEnabled) load();
    // 결과 화면이 처음 열릴 때 한 번만 불러온다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!scoresEnabled) {
    return <p className="muted small">점수 저장을 쓰려면 .env 에 Supabase 공개 키를 설정하세요.</p>;
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = nickname.trim();
    if (!name) return;
    setStatus('saving');
    setError(null);
    try {
      await saveScore({ ...result, nickname: name });
      try {
        localStorage.setItem(NICKNAME_KEY, name);
      } catch {
        /* 저장 못 해도 무시 */
      }
      setStatus('saved');
      const rows = await fetchTopScores(result.quiz_kind, result.total);
      setTop(rows);
      // 방금 저장한 기록을 순위표에서 강조
      const mine = rows.find((r) => r.nickname === name && r.score === result.score);
      setSavedId(mine?.id ?? null);
    } catch (err) {
      console.error(err);
      setStatus('error');
      setError('저장에 실패했어요. 잠시 후 다시 시도해 주세요.');
    }
  };

  return (
    <div className="scoreboard">
      {status !== 'saved' ? (
        <form className="save-form" onSubmit={submit}>
          <input
            placeholder="닉네임 (최대 20자)"
            maxLength={20}
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            disabled={status === 'saving'}
          />
          <button className="primary" disabled={!nickname.trim() || status === 'saving'}>
            {status === 'saving' ? '저장 중…' : '점수 저장'}
          </button>
        </form>
      ) : (
        <p className="saved-msg">✅ 점수를 저장했어요!</p>
      )}
      {error && <p className="error small">{error}</p>}

      <h4>
        🏆 순위표 <span className="muted small">({KIND_LABEL[result.quiz_kind]} · {result.total}문제)</span>
      </h4>
      {top === null ? (
        <p className="muted small">불러오는 중…</p>
      ) : top.length === 0 ? (
        <p className="muted small">아직 기록이 없어요. 첫 번째 주인공이 되어 보세요!</p>
      ) : (
        <ol className="ranking">
          {top.map((r, i) => (
            <li key={r.id} className={r.id === savedId ? 'me' : ''}>
              <span className="rank">{i + 1}</span>
              <span className="name">{r.nickname}</span>
              <span className="pts">{r.score}점</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
