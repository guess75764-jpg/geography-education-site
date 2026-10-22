import { useState } from 'react';
import { CITY_TOLERANCE_KM, type GameState, type QuestionKind } from '../game/useGame';
import type { Country } from '../types';
import ScoreBoard from './ScoreBoard';

interface Props {
  game: GameState;
  countryById: Map<string, Country>;
  onOpenRanking?: () => void;
}

const KIND_LABEL: Record<QuestionKind, string> = { country: '국가', city: '도시', mixed: '섞어서' };

export default function GamePanel({ game, countryById, onOpenRanking }: Props) {
  const [kind, setKind] = useState<QuestionKind>('country');
  const [count, setCount] = useState(10);
  const { phase, current, answer } = game;

  if (phase === 'ready') {
    return (
      <aside className="panel">
        <h2>게임 모드</h2>
        <p className="muted">문제로 나온 나라나 도시를 백지도에서 찾아 클릭하세요!</p>
        <label className="field">
          문제 종류
          <div className="segmented">
            {(Object.keys(KIND_LABEL) as QuestionKind[]).map((k) => (
              <button key={k} className={kind === k ? 'active' : ''} onClick={() => setKind(k)}>
                {KIND_LABEL[k]}
              </button>
            ))}
          </div>
        </label>
        <label className="field">
          문제 수
          <select value={count} onChange={(e) => setCount(Number(e.target.value))}>
            {[5, 10, 20].map((n) => (
              <option key={n} value={n}>
                {n}문제
              </option>
            ))}
          </select>
        </label>
        <button className="primary" onClick={() => game.start(kind, count)}>
          게임 시작
        </button>
      </aside>
    );
  }

  if (phase === 'finished') {
    return (
      <aside className="panel">
        <h2>게임 끝! 🎉</h2>
        <p className="big-score">
          {game.score} <span className="muted">/ {game.maxScore}점</span>
        </p>
        <p>
          {game.total}문제 중 {game.correctCount}문제 정답
        </p>
        <ScoreBoard
          result={{
            score: game.score,
            max_score: game.maxScore,
            correct_count: game.correctCount,
            total: game.total,
            quiz_kind: game.kind,
          }}
          onOpenRanking={onOpenRanking}
        />
        <button className="primary" onClick={game.reset}>
          다시 하기
        </button>
      </aside>
    );
  }

  if (!current) return null;
  const target = current.kind === 'country' ? current.country.nameKo : current.city.nameKo;
  const clickedName = answer?.clickedCountryId ? countryById.get(answer.clickedCountryId)?.nameKo : null;

  return (
    <aside className="panel">
      <div className="game-status">
        <span>
          문제 {game.index + 1} / {game.total}
        </span>
        <span className="score">점수 {game.score}</span>
      </div>

      <div className="question">
        <span className={`tag tag-${current.kind}`}>{current.kind === 'country' ? '국가' : '도시'}</span>
        <p>
          <strong>{target}</strong>
          {current.kind === 'country' ? ' 은(는) 어디일까요?' : ' 은(는) 어디에 있을까요?'}
        </p>
        {current.kind === 'city' && (
          <p className="muted small">정답 위치에서 {CITY_TOLERANCE_KM}km 안을 클릭하면 정답!</p>
        )}
      </div>

      {answer && (
        <div className={`feedback ${answer.correct ? 'ok' : 'no'}`}>
          <strong>{answer.correct ? '정답입니다! +10' : '아쉬워요, 오답!'}</strong>
          {current.kind === 'country' && !answer.correct && (
            <p>{clickedName ? `클릭한 곳은 ${clickedName}이에요.` : '바다를 클릭했어요.'} 초록색이 정답이에요.</p>
          )}
          {current.kind === 'city' && answer.distanceKm != null && (
            <p>정답과의 거리: 약 {answer.distanceKm.toLocaleString()}km</p>
          )}
          <button className="primary" onClick={game.next}>
            {game.index + 1 >= game.total ? '결과 보기' : '다음 문제'}
          </button>
        </div>
      )}

      <button className="link" onClick={game.reset}>
        게임 그만하기
      </button>
    </aside>
  );
}
