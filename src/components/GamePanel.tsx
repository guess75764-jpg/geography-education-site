import { useEffect } from 'react';
import { QUIZ_TYPE_LABEL, type GameState, type QuizType } from '../game/useGame';
import {
  BASE_POINTS,
  CHALLENGES,
  CITY_TOLERANCE_KM,
  CLEAR_ACCURACY,
  PRACTICE_COUNT,
  TIERS,
  challengeOf,
  comboMultiplier,
  formatLimit,
  isCleared,
  speedBonus,
} from '../game/scoring';
import { fireFinish } from '../game/fx';
import type { Country } from '../types';
import ScoreBoard from './ScoreBoard';
import TierBadge from './TierBadge';
import { formatDuration } from './GameHud';

interface Props {
  game: GameState;
  countryById: Map<string, Country>;
  onOpenRanking?: () => void;
  /** 개념 문제를 어디서 불러왔는지 (db: 관리자 등록, builtin: 예비 문제) */
  conceptSource: 'loading' | 'db' | 'builtin';
}

const PRACTICE_TYPES: [QuizType, string, string][] = [
  ['country', '🗺️', '나라 이름 보고 찾기'],
  ['city', '📍', `${CITY_TOLERANCE_KM}km 안이면 정답`],
  ['mixed', '🎲', '국가 + 도시 무작위'],
];

export default function GamePanel({ game, countryById, onOpenRanking, conceptSource }: Props) {
  const { phase, current, lastResult } = game;
  const conceptCount = game.poolSize('hint');

  // ── 시작 전: 타임어택 도전 단계 또는 연습 고르기 ──
  if (phase === 'ready') {
    const isTA = game.style === 'timeattack';
    const ch = challengeOf(game.challenge)!;
    return (
      <aside className="panel game-panel">
        <h2>🎯 게임</h2>
        <div className="segmented">
          <button className={isTA ? 'active' : ''} onClick={() => game.setStyle('timeattack')}>
            ⏱ 개념+위치 타임어택
          </button>
          <button className={!isTA ? 'active' : ''} onClick={() => game.setStyle('practice')}>
            🧭 연습
          </button>
        </div>

        {isTA ? (
          <>
            <div className="field">
              도전 단계
              <div className="challenge-grid">
                {CHALLENGES.map((c) => (
                  <button
                    key={c.count}
                    className={`challenge-card ${game.challenge === c.count ? 'active' : ''}`}
                    style={{ '--tier': c.tier.color } as React.CSSProperties}
                    onClick={() => game.setChallenge(c.count)}
                  >
                    <span className="challenge-emoji">{c.tier.emoji}</span>
                    <strong>{c.title}</strong>
                    <span className="small">
                      {c.count}문제 · {formatLimit(c.limitSec)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <ul className="rules small">
              <li>
                관리자가 등록한 개념 {ch.count}문제를 <b>{formatLimit(ch.limitSec)}</b> 안에 풀어요
              </li>
              <li>
                모두 풀고 정답률 {Math.round(CLEAR_ACCURACY * 100)}% 이상({Math.ceil(ch.count * CLEAR_ACCURACY)}문제)이면{' '}
                <b>
                  {ch.tier.emoji} {ch.tier.name}
                </b>{' '}
                달성!
              </li>
              <li>정답 {BASE_POINTS}점 + 속도 보너스, 🔥 연속 정답이면 배수 ×1.5~×3</li>
            </ul>
            {conceptSource === 'loading' ? (
              <p className="muted small">개념 문제를 불러오는 중…</p>
            ) : conceptCount === 0 ? (
              <p className="hint small">아직 등록된 개념이 없어요. 관리자 화면에서 개념을 추가해 주세요.</p>
            ) : (
              <p className="muted small">
                등록된 개념 {conceptCount}개 중 무작위 출제
                {conceptSource === 'builtin' && ' (관리자 개념을 불러오지 못해 기본 개념 사용)'}
                {conceptCount < ch.count && ` · ${ch.count}개보다 적어 일부 반복돼요`}
              </p>
            )}
            <button className="primary big" disabled={conceptCount === 0} onClick={() => game.start({ style: 'timeattack' })}>
              ⏱ {ch.title} 시작!
            </button>
          </>
        ) : (
          <>
            <div className="field">
              연습 유형
              <div className="type-grid">
                {PRACTICE_TYPES.map(([t, emoji, desc]) => (
                  <button key={t} className={`type-card ${game.type === t ? 'active' : ''}`} onClick={() => game.setType(t)}>
                    <span className="type-emoji">{emoji}</span>
                    <strong>{QUIZ_TYPE_LABEL[t]}</strong>
                    <span className="small">{desc}</span>
                  </button>
                ))}
              </div>
            </div>
            <ul className="rules small">
              <li>시간 제한 없이 {PRACTICE_COUNT}문제를 풀어요</li>
              <li>연습 기록은 명예의 전당에 올라가지 않아요</li>
              <li>개념 문제는 ‘학습 → 개념 공부’에서 한 문항씩 공부할 수 있어요</li>
            </ul>
            <button
              className="primary big"
              onClick={() => game.start({ style: 'practice', type: game.type === 'hint' ? 'country' : game.type })}
            >
              🧭 연습 시작
            </button>
          </>
        )}
      </aside>
    );
  }

  if (phase === 'countdown') {
    const ch = challengeOf(game.challenge)!;
    return (
      <aside className="panel game-panel">
        <div className="get-ready">
          <span className="type-emoji">{ch.tier.emoji}</span>
          <h2>{ch.title}</h2>
          <p className="muted">
            {ch.count}문제 · 제한 시간 {formatLimit(ch.limitSec)}. 준비!
          </p>
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

/** 결과 화면: 도전 성공 여부·칭호·통계·기록 저장 */
function ResultPanel({ game, onOpenRanking }: { game: GameState; onOpenRanking?: () => void }) {
  const { results, score } = game;
  const correct = results.filter((r) => r.correct).length;
  const accuracy = results.length ? Math.round((correct / results.length) * 100) : 0;
  const isTimed = game.style === 'timeattack';
  const ch = challengeOf(game.challenge)!;
  const cleared = isTimed && isCleared(ch.count, correct, results.length, game.elapsedMs);
  const timedOut = isTimed && results.length < ch.count;
  const nextCh = CHALLENGES[CHALLENGES.indexOf(ch) + 1];

  useEffect(() => {
    // 도전에 성공했을 때만 축하 폭죽 (연습은 다 맞히면)
    if (cleared) fireFinish(TIERS.indexOf(ch.tier));
    else if (!isTimed && correct === results.length && correct > 0) fireFinish(0);
    // 결과 화면이 열릴 때 한 번
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <aside className="panel game-panel result">
      <p className="eyebrow">{isTimed ? `${ch.title} 결과` : '연습 끝!'}</p>
      {isTimed && (
        <div className={`clear-banner ${cleared ? 'ok' : 'no'}`}>
          {cleared ? (
            <>
              <span className="clear-title">🎉 도전 성공!</span>
              <TierBadge tier={ch.tier} size="lg" />
              {nextCh && <span className="small">다음은 {nextCh.title}({nextCh.count}문제)에 도전해 보세요!</span>}
            </>
          ) : (
            <>
              <span className="clear-title">도전 실패 😢</span>
              <span className="small">
                {timedOut
                  ? `시간 안에 ${results.length}/${ch.count}문제를 풀었어요.`
                  : `정답 ${correct}개 · ${Math.ceil(ch.count * CLEAR_ACCURACY)}개 이상 맞혀야 성공이에요.`}
              </span>
            </>
          )}
        </div>
      )}
      <p className="big-score">
        {score.toLocaleString()}
        <small>점</small>
      </p>
      <div className="stat-grid">
        <div>
          <b>
            {correct}/{isTimed ? ch.count : results.length}
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
          <b>{formatDuration(game.elapsedMs)}</b>
          <span>{isTimed ? `걸린 시간 / ${formatLimit(ch.limitSec)}` : '걸린 시간'}</span>
        </div>
      </div>

      {isTimed ? (
        results.length > 0 ? (
          <ScoreBoard
            result={{
              challenge: ch.count,
              score,
              correct_count: correct,
              total: results.length,
              max_combo: game.maxCombo,
              duration_ms: Math.round(game.elapsedMs),
            }}
            onOpenRanking={onOpenRanking}
          />
        ) : (
          <p className="muted small">한 문제도 풀지 않아 기록을 남길 수 없어요.</p>
        )
      ) : (
        <p className="muted small">연습 기록은 명예의 전당에 올라가지 않아요.</p>
      )}

      <div className="result-actions">
        <button className="primary" onClick={() => game.start()}>
          ↻ 다시 도전
        </button>
        <button className="secondary" onClick={game.reset}>
          다른 단계
        </button>
      </div>
      <p className="muted small">아래 ‘문제 돌아보기’에서 해설을 확인하세요.</p>
    </aside>
  );
}
