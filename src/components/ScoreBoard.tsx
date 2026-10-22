import { useEffect, useState } from 'react';
import {
  fetchRankOf,
  fetchRanking,
  saveScore,
  scoresEnabled,
  type NewScore,
  type RankingFilter,
  type ScoreRow,
} from '../lib/scores';
import RankingList from './RankingList';

const KIND_LABEL = { country: '국가', city: '도시', mixed: '섞어서' } as const;
const NICKNAME_KEY = 'geo-quiz:nickname';

function loadNickname(): string {
  try {
    return localStorage.getItem(NICKNAME_KEY) ?? '';
  } catch {
    return '';
  }
}

/** 게임 종료 화면: 별명으로 점수 저장 + 내 등수 + 상위 10명 */
export default function ScoreBoard({
  result,
  onOpenRanking,
}: {
  result: Omit<NewScore, 'nickname'>;
  onOpenRanking?: () => void;
}) {
  const [nickname, setNickname] = useState(loadNickname);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [top, setTop] = useState<ScoreRow[] | null>(null);
  const [savedId, setSavedId] = useState<number | null>(null);
  const [myRank, setMyRank] = useState<{ rank: number; count: number } | null>(null);

  const filter: RankingFilter = { kind: result.quiz_kind, total: result.total, period: 'all' };

  useEffect(() => {
    if (!scoresEnabled) return;
    fetchRanking(filter)
      .then(setTop)
      .catch((e) => {
        console.error(e);
        setError('순위표를 불러오지 못했어요.');
        setTop([]);
      });
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
    let id: number | null = null;
    try {
      id = await saveScore({ ...result, nickname: name });
      try {
        localStorage.setItem(NICKNAME_KEY, name);
      } catch {
        /* 저장 못 해도 무시 */
      }
      setSavedId(id);
      setStatus('saved');
      const [rows, rank] = await Promise.all([fetchRanking(filter), fetchRankOf(filter, result.score)]);
      setTop(rows);
      setMyRank(rank);
    } catch (err) {
      console.error(err);
      // 저장은 됐는데 순위 조회만 실패한 경우와 저장 자체가 실패한 경우를 구분
      setStatus(id !== null ? 'saved' : 'error');
      setError(id !== null ? '순위를 불러오지 못했어요.' : '저장에 실패했어요. 잠시 후 다시 시도해 주세요.');
    }
  };

  return (
    <div className="scoreboard">
      {status !== 'saved' ? (
        <>
          <form className="save-form" onSubmit={submit}>
            <input
              placeholder="별명 (최대 20자)"
              aria-describedby="nickname-hint"
              maxLength={20}
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              disabled={status === 'saving'}
            />
            <button className="primary" disabled={!nickname.trim() || status === 'saving'}>
              {status === 'saving' ? '저장 중…' : '점수 저장'}
            </button>
          </form>
          <p id="nickname-hint" className="hint small">
            🔒 실명 대신 별명을 써 주세요. 입력한 이름은 순위표에 모두에게 보여요.
          </p>
        </>
      ) : (
        <div className="saved-msg">
          ✅ 점수를 저장했어요!
          {myRank && myRank.count > 0 && (
            <p className="my-rank">
              전체 {myRank.count}개 기록 중 <strong>{myRank.rank}위</strong>
              {myRank.rank <= 3 ? ' 🎉' : ''}
            </p>
          )}
        </div>
      )}
      {error && <p className="error small">{error}</p>}

      <h4>
        🏆 상위 10명 <span className="muted small">({KIND_LABEL[result.quiz_kind]} · {result.total}문제)</span>
      </h4>
      {top === null ? (
        <p className="muted small">불러오는 중…</p>
      ) : top.length === 0 ? (
        <p className="muted small">아직 기록이 없어요. 첫 번째 주인공이 되어 보세요!</p>
      ) : (
        <RankingList rows={top} highlightId={savedId} />
      )}
      {onOpenRanking && (
        <button className="link" onClick={onOpenRanking}>
          전체 랭킹 보기 →
        </button>
      )}
    </div>
  );
}
