import { useEffect, useState } from 'react';
import {
  describeDbError,
  fetchRankOf,
  fetchRanking,
  saveScore,
  scoresEnabled,
  type NewScore,
  type RankingFilter,
  type ScoreRow,
} from '../lib/scores';
import { QUIZ_TYPE_LABEL } from '../game/useGame';
import RankingList from './RankingList';

const NICKNAME_KEY = 'geo-quiz:nickname';

function loadNickname(): string {
  try {
    return localStorage.getItem(NICKNAME_KEY) ?? '';
  } catch {
    return '';
  }
}

/** 게임 종료 화면: 별명으로 기록 저장 + 내 등수 + 같은 유형 Top 5 */
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

  const filter: RankingFilter = { kind: result.quiz_kind, period: 'all' };

  useEffect(() => {
    if (!scoresEnabled) return;
    fetchRanking(filter, 5)
      .then(setTop)
      .catch((e) => {
        console.error(e);
        setError(describeDbError(e));
        setTop([]);
      });
    // 결과 화면이 처음 열릴 때 한 번만 불러온다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!scoresEnabled) {
    return <p className="muted small">기록 저장을 쓰려면 .env 에 Supabase 공개 키를 설정하세요.</p>;
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
      const [rows, rank] = await Promise.all([fetchRanking(filter, 5), fetchRankOf(filter, result.score)]);
      setTop(rows);
      setMyRank(rank);
    } catch (err) {
      console.error(err);
      // 저장은 됐는데 순위 조회만 실패한 경우와 저장 자체가 실패한 경우를 구분
      setStatus(id !== null ? 'saved' : 'error');
      setError(id !== null ? '순위를 불러오지 못했어요.' : describeDbError(err));
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
              {status === 'saving' ? '저장 중…' : '🏆 기록 등록'}
            </button>
          </form>
          <p id="nickname-hint" className="hint small">
            🔒 실명 대신 별명을 써 주세요. 입력한 이름은 명예의 전당에 모두에게 보여요.
          </p>
        </>
      ) : (
        <div className="saved-msg">
          ✅ 명예의 전당에 등록했어요!
          {myRank && myRank.count > 0 && (
            <p className="my-rank">
              {QUIZ_TYPE_LABEL[result.quiz_kind]} 기록 {myRank.count}개 중 <strong>{myRank.rank}위</strong>
              {myRank.rank <= 3 ? ' 🎉' : ''}
            </p>
          )}
        </div>
      )}
      {error && <p className="error small">{error}</p>}

      {top && top.length > 0 && (
        <>
          <h4>
            🏆 {QUIZ_TYPE_LABEL[result.quiz_kind]} Top 5
          </h4>
          <RankingList rows={top} highlightId={savedId} />
        </>
      )}
      {onOpenRanking && (
        <button className="link" onClick={onOpenRanking}>
          명예의 전당 전체 보기 →
        </button>
      )}
    </div>
  );
}
