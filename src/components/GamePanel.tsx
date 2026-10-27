import { useEffect } from 'react';
import { QUIZ_TYPE_LABEL, type GameState, type PlayStyle, type QuizType } from '../game/useGame';
import {
  BASE_POINTS,
  CITY_TOLERANCE_KM,
  PRACTICE_COUNT,
  TIMEATTACK_COUNT,
  comboMultiplier,
  speedBonus,
  tierOf,
  TIERS,
} from '../game/scoring';
import { fireFinish } from '../game/fx';
import type { Country } from '../types';
import ScoreBoard from './ScoreBoard';
import TierBadge, { TierProgress } from './TierBadge';
import { formatDuration } from './GameHud';

interface Props {
  game: GameState;
  countryById: Map<string, Country>;
  onOpenRanking?: () => void;
  /** 개념 문제를 어디서 불러왔는지 (db: 관리자 등록, builtin: 예비 문제) */
  conceptSource: 'loading' | 'db' | 'builtin';
}

const TYPE_INFO: Record<QuizType, { emoji: string; desc: string }> = {
  hint: { emoji: '📝', desc: '개념 설명을 읽고 위치 찾기' },
  country: { emoji: '🗺️', desc: '나라 이름 보고 찾기' },
  city: { emoji: '📍', desc: `${CITY_TOLERANCE_KM}km 안이면 정답` },
  mixed: { emoji: '🎲', desc: '국가 + 도시 무작위' },
};
const TYPE_ORDER: QuizType[] = ['hint', 'country', 'city', 'mixed'];

export default function GamePanel({ game, countryById, onOpenRanking, conceptSource }: Props) {
  const { phase, current, lastResult } = game;
  const conceptCount = game.poolSize('hint');
  const conceptNote =
    conceptSource === 'loading' ? (
      <p className="muted small">개념 문제를 불러오는 중…</p>
    ) : conceptCount === 0 ? (
      <p className="hint small">아직 등록된 개념이 없어요. 관리자 화면에서 개념을 추가해 주세요.</p>
    ) : (
      <p className="muted small">
        등록된 개념 {conceptCount}개
        {conceptSource === 'builtin' && ' (인터넷 연결이 없어 기본 개념 사용)'}
        {conceptCount < TIMEATTACK_COUNT && game.style === 'timeattack' && ` · ${TIMEATTACK_COUNT}개보다 적어 일부 반복돼요`}
      </p>
    );

  // ── 시작 전: 문제 유형·플레이 방식 고르기 ──
  if (phase === 'ready') {
    return (
      <aside className="panel game-panel">
        <h2>🎯 게임 모드</h2>
        <div className="field">
          문제 유형
          <div className="type-grid">
            {TYPE_ORDER.map((t) => (
              <button key={t} className={`type-card ${game.type === t ? 'active' : ''}`} onClick={() => game.setType(t)}>
                <span className="type-emoji">{TYPE_INFO[t].emoji}</span>
                <strong>{QUIZ_TYPE_LABEL[t]}</strong>
                <span className="small">{TYPE_INFO[t].desc}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          플레이 방식
          <div className="segmented">
            {(
              [
                ['timeattack', `⏱ 타임어택 ${TIMEATTACK_COUNT}문제`],
                ['practice', `📘 연습 ${PRACTICE_COUNT}문제`],
              ] as [PlayStyle, string][]
            ).map(([s, label]) => (
              <button key={s} className={game.style === s ? 'active' : ''} onClick={() => game.setStyle(s)}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <ul className="rules small">
          {game.style === 'timeattack' ? (
            <>
              <li>{TIMEATTACK_COUNT}문제를 최대한 빠르고 정확하게!</li>
              <li>정답 {BASE_POINTS}점 + 빨리 맞힐수록 속도 보너스 최대 +100</li>
              <li>🔥 연속 정답 3·6·9·12개마다 점수 배수 ×1.5 → ×3</li>
              <li>틀리면 콤보가 끊겨요. 기록은 명예의 전당에 등록!</li>
            </>
          ) : (
            <>
              <li>시간 제한 없이 {PRACTICE_COUNT}문제를 풀어요</li>
              <li>문제마다 해설(기후·자원)을 보고 넘어갈 수 있어요</li>
              <li>연습 기록은 랭킹에 올라가지 않아요</li>
            </>
          )}
        </ul>
        {game.type === 'hint' && conceptNote}
        <button className="primary big" disabled={game.poolSize(game.type) === 0} onClick={() => game.start()}>
          {game.style === 'timeattack' ? '⏱ 타임어택 시작!' : '📘 연습 시작'}
        </button>
      </aside>
    );
  }

  if (phase === 'countdown') {
    return (
      <aside className="panel game-panel">
        <div className="get-ready">
          <span className="type-emoji">{TYPE_INFO[game.type].emoji}</span>
          <h2>{game.type === 'hint' ? '개념+위치 타임어택 게임' : `${QUIZ_TYPE_LABEL[game.type]} 타임어택`}</h2>
          <p className="muted">지도 위 숫자가 끝나면 시작해요. 준비!</p>
        </div>
      </aside>
    );
  }

  if (phase === 'finished') return <ResultPanel game={game} onOpenRanking={onOpenRanking} />;

  if (!current) return null;
  const isTimed = game.style === 'timeattack';
  const clickedName = lastResult?.clickedCountryId ? countryById.get(lastResult.clickedCountryId)?.nameKo : null;
  const hint = current.hint;

  return (
    <aside className="panel game-panel">
      <div className="game-status">
        <span className="q-count">
          문제 {game.questionNumber} / {game.totalQuestions}
        </span>
        <span className="score-live" key={game.score}>
          {game.score.toLocaleString()}
          <small>점</small>
        </span>
      </div>

      <div className={`question ${hint ? 'is-hint' : ''}`}>
        <div className="q-tags">
          <span className={`tag tag-${current.label === '국가' ? 'country' : 'city'}`}>{current.label}</span>
          {hint?.tags.map((t) => (
            <span key={t} className="tag tag-topic">
              {t}
            </span>
          ))}
        </div>
        {hint ? (
          <p className="hint-text">{hint.hint}</p>
        ) : (
          <p>
            <strong>{current.answerName}</strong>
            {current.label === '국가' ? ' 은(는) 어디일까요?' : ' 은(는) 어디에 있을까요?'}
          </p>
        )}
        {current.label === '도시' && <p className="muted small">정답 위치에서 {CITY_TOLERANCE_KM}km 안을 클릭하면 정답!</p>}
      </div>

      {lastResult && (
        <div className={`feedback ${lastResult.correct ? 'ok' : 'no'}`}>
          {lastResult.correct ? (
            <>
              <strong className="feedback-title">
                정답! <span className="plus">+{lastResult.points}</span>
              </strong>
              <p className="breakdown small">
                기본 {BASE_POINTS}
                {isTimed && ` + 속도 ${speedBonus(lastResult.elapsedMs)}`}
                {comboMultiplier(lastResult.combo) > 1 && ` × 콤보 ${comboMultiplier(lastResult.combo)}`} ·{' '}
                {(lastResult.elapsedMs / 1000).toFixed(1)}초
              </p>
            </>
          ) : (
            <>
              <strong className="feedback-title">아쉬워요! 정답은 {current.answerName}</strong>
              <p className="small">
                {current.target.type === 'country'
                  ? clickedName
                    ? `클릭한 곳은 ${clickedName}이에요.`
                    : '바다를 클릭했어요.'
                  : lastResult.distanceKm != null
                    ? `정답과의 거리 약 ${lastResult.distanceKm.toLocaleString()}km`
                    : '지구 바깥을 클릭했어요.'}{' '}
                초록색이 정답이에요.
              </p>
            </>
          )}
          {/* 연습 모드: 해설을 읽고 직접 넘어간다 */}
          {!isTimed && hint && (hint.explanation || hint.climate || hint.resources.length > 0) && (
            <div className="explain">
              {hint.explanation && <p>💡 {hint.explanation}</p>}
              {hint.climate && (
                <p className="small">
                  <b>기후</b> {hint.climate}
                </p>
              )}
              {hint.resources.length > 0 && (
                <div className="chips">
                  {hint.resources.map((r) => (
                    <span key={r} className="chip static">
                      {r}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
          {!isTimed && (
            <button className="primary" onClick={game.next}>
              {game.questionNumber >= game.totalQuestions ? '결과 보기' : '다음 문제 →'}
            </button>
          )}
        </div>
      )}

      <button className="link" onClick={game.reset}>
        게임 그만하기
      </button>
    </aside>
  );
}

/** 결과 화면: 점수·칭호·통계·기록 저장 */
function ResultPanel({ game, onOpenRanking }: { game: GameState; onOpenRanking?: () => void }) {
  const { results, score } = game;
  const correct = results.filter((r) => r.correct).length;
  const accuracy = results.length ? Math.round((correct / results.length) * 100) : 0;
  const correctTimes = results.filter((r) => r.correct).map((r) => r.elapsedMs);
  const avgSec = correctTimes.length ? correctTimes.reduce((a, b) => a + b, 0) / correctTimes.length / 1000 : 0;
  const isTimed = game.style === 'timeattack';

  useEffect(() => {
    if (correct > 0) fireFinish(TIERS.indexOf(tierOf(score)));
    // 결과 화면이 열릴 때 한 번
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <aside className="panel game-panel result">
      <p className="eyebrow">
        {isTimed ? (game.type === 'hint' ? '개념+위치 타임어택 게임 종료' : `${QUIZ_TYPE_LABEL[game.type]} 타임어택 종료`) : '연습 끝!'}
      </p>
      <p className="big-score">
        {score.toLocaleString()}
        <small>점</small>
      </p>
      {isTimed && (
        <>
          <TierBadge score={score} size="lg" />
          <TierProgress score={score} />
        </>
      )}
      <div className="stat-grid">
        <div>
          <b>
            {correct}/{results.length}
          </b>
          <span>정답</span>
        </div>
        <div>
          <b>{accuracy}%</b>
          <span>정확도</span>
        </div>
        <div>
          <b>🔥{game.maxCombo}</b>
          <span>최고 콤보</span>
        </div>
        <div>
          <b>{isTimed ? formatDuration(game.elapsedMs) : avgSec ? `${avgSec.toFixed(1)}초` : '-'}</b>
          <span>{isTimed ? '걸린 시간' : '평균 정답 속도'}</span>
        </div>
      </div>

      {isTimed ? (
        results.length > 0 ? (
          <ScoreBoard
            result={{
              score,
              correct_count: correct,
              total: results.length,
              quiz_kind: game.type,
              game_mode: 'timeattack',
              max_combo: game.maxCombo,
              duration_ms: Math.round(game.elapsedMs),
            }}
            onOpenRanking={onOpenRanking}
          />
        ) : (
          <p className="muted small">한 문제도 풀지 않아 기록을 저장할 수 없어요.</p>
        )
      ) : (
        <p className="muted small">연습 기록은 랭킹에 올라가지 않아요. 준비됐다면 타임어택에 도전!</p>
      )}

      <div className="result-actions">
        <button className="primary" onClick={() => game.start()}>
          ↻ 다시 도전
        </button>
        <button className="secondary" onClick={game.reset}>
          다른 모드
        </button>
      </div>
      <p className="muted small">아래 ‘문제 돌아보기’에서 해설을 확인하세요.</p>
    </aside>
  );
}
