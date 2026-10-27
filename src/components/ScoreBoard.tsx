import { useEffect, useState } from 'react';
import {
  describeDbError,
  fetchRankOf,
  fetchRanking,
  findMyScores,
  scoresEnabled,
  submitScore,
  type MyScore,
  type NewScore,
  type RankingFilter,
  type ScoreRow,
} from '../lib/scores';
import { challengeOf } from '../game/scoring';
import RankingList from './RankingList';
import { formatDuration } from './GameHud';

const NICKNAME_KEY = 'geo-quiz:nickname';

function loadNickname(): string {
  try {
    return localStorage.getItem(NICKNAME_KEY) ?? '';
  } catch {
    return '';
  }
}

type Status = 'idle' | 'checking' | 'choose' | 'saving' | 'saved' | 'discarded' | 'error';

/**
 * 게임 종료 화면의 기록 남기기.
 * 같은 브라우저 + 같은 별명으로 같은 도전 기록이 이미 있으면,
 * "이번 기록으로 갱신(이전 기록 삭제)" 또는 "이번 기록 지우기"를 고른다.
 */
export default function ScoreBoard({
  result,
  onOpenRanking,
  initialNickname,
}: {
  result: Omit<NewScore, 'nickname'>;
  onOpenRanking?: () => void;
  /** 게임을 시작할 때 쓴 별명 */
  initialNickname?: string;
}) {
  const [nickname, setNickname] = useState(() => initialNickname || loadNickname());
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [previous, setPrevious] = useState<MyScore[]>([]);
  const [replaced, setReplaced] = useState(0);
  const [top, setTop] = useState<ScoreRow[] | null>(null);
  const [savedId, setSavedId] = useState<number | null>(null);
  const [myRank, setMyRank] = useState<{ rank: number; count: number } | null>(null);

  const ch = challengeOf(result.challenge)!;
  const filter: RankingFilter = { challenge: result.challenge, period: 'all' };

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

  const save = async (replace: boolean) => {
    setStatus('saving');
    setError(null);
    let id: number | null = null;
    try {
      id = await submitScore({ ...result, nickname }, replace);
      setSavedId(id);
      setReplaced(replace ? previous.length : 0);
      setStatus('saved');
      const [rows, rank] = await Promise.all([fetchRanking(filter, 5), fetchRankOf(filter, result.score)]);
      setTop(rows);
      setMyRank(rank);
    } catch (err) {
      console.error(err);
      setStatus(id !== null ? 'saved' : 'error');
      setError(id !== null ? '순위를 불러오지 못했어요.' : describeDbError(err));
    }
  };

  /** 별명 확인 → 내 이전 기록이 있으면 선택 화면, 없으면 바로 저장 */
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = nickname.trim();
    if (!name) return;
    try {
      localStorage.setItem(NICKNAME_KEY, name);
    } catch {
      /* 저장 못 해도 무시 */
    }
    setStatus('checking');
    setError(null);
    try {
      const mine = await findMyScores(name, result.challenge);
      setPrevious(mine);
      if (mine.length > 0) setStatus('choose');
      else await save(false);
    } catch (err) {
      console.error(err);
      setStatus('error');
      setError(describeDbError(err));
    }
  };

  const best = previous[0];

  return (
    <div className="scoreboard">
      {(status === 'idle' || status === 'checking' || status === 'error') && (
        <>
          <form className="save-form" onSubmit={submit}>
            <input
              placeholder="별명 (최대 20자)"
              aria-describedby="nickname-hint"
              maxLength={20}
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              disabled={status === 'checking'}
            />
            <button className="primary" disabled={!nickname.trim() || status === 'checking'}>
              {status === 'checking' ? '확인 중…' : '🏆 기록 남기기'}
            </button>
          </form>
          <p id="nickname-hint" className="hint small">
            🔒 실명 대신 별명을 써 주세요. 입력한 이름은 명예의 전당에 모두에게 보여요.
          </p>
        </>
      )}

      {(status === 'choose' || status === 'saving') && best && (
        <div className="choose-box">
          <p className="choose-title">
            <b>{nickname.trim()}</b> 님의 <b>{ch.title}</b> 이전 기록이 있어요.
          </p>
          <div className="compare">
            <div>
              <span>이전 기록</span>
              <b>{best.score.toLocaleString()}점</b>
              <small>
                정답 {best.correct_count}/{ch.count}
                {best.duration_ms != null && ` · ${formatDuration(best.duration_ms)}`}
              </small>
            </div>
            <span className="vs">→</span>
            <div className={result.score > best.score ? 'up' : result.score < best.score ? 'down' : ''}>
              <span>이번 기록</span>
              <b>{result.score.toLocaleString()}점</b>
              <small>
                정답 {result.correct_count}/{ch.count} · {formatDuration(result.duration_ms)}
              </small>
            </div>
          </div>
          <p className="small muted">
            {result.score > best.score
              ? '🎉 이전 기록보다 높아요!'
              : result.score < best.score
                ? '이전 기록보다 낮아요. 갱신하면 이전 기록은 사라져요.'
                : '이전 기록과 같은 점수예요.'}
          </p>
          <div className="choose-actions">
            <button className="primary" disabled={status === 'saving'} onClick={() => save(true)}>
              🔄 이번 기록으로 갱신
              <small>이전 기록은 자동 삭제</small>
            </button>
            <button className="secondary" disabled={status === 'saving'} onClick={() => setStatus('discarded')}>
              🗑 이번 기록 지우기
              <small>이전 기록 유지</small>
            </button>
          </div>
        </div>
      )}

      {status === 'saved' && (
        <div className="saved-msg">
          ✅ {replaced > 0 ? '기록을 갱신했어요! (이전 기록은 삭제됨)' : '명예의 전당에 등록했어요!'}
          {myRank && myRank.count > 0 && (
            <p className="my-rank">
              {ch.title} 기록 {myRank.count}개 중 <strong>{myRank.rank}위</strong>
              {myRank.rank <= 3 ? ' 🎉' : ''}
            </p>
          )}
        </div>
      )}
      {status === 'discarded' && (
        <p className="discarded-msg">🗑 이번 기록은 남기지 않았어요. 이전 기록이 그대로 유지돼요.</p>
      )}
      {error && <p className="error small">{error}</p>}

      {top && top.length > 0 && (
        <>
          <h4>🏆 {ch.title} Top 5</h4>
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
