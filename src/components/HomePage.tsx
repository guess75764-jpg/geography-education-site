import { BASE_TIER, CHALLENGES, CLEAR_ACCURACY, formatLimit, type ChallengeCount } from '../game/scoring';
import HallOfFame from './HallOfFame';

/** 메인 화면: 개념 공부 · 타임어택 도전 카드 + 명예의 전당 + 칭호 안내 */
export default function HomePage({
  onStart,
  onStudy,
  onPlay,
}: {
  onStart: (c: ChallengeCount) => void;
  onStudy: () => void;
  onPlay: () => void;
}) {
  return (
    <div className="home">
      <section className="hero card">
        <div className="hero-text">
          <span className="eyebrow">통합사회 · 수능 한국지리/세계지리 대비</span>
          <h2>
            개념을 읽고, 지도에서 <span className="accent">위치</span>를 찾아라!
          </h2>
          <p className="muted">
            선생님이 정리한 개념으로 먼저 공부하고, 타임어택에 도전해 <strong>지리박사</strong> 칭호를 노려 보세요.
          </p>
          <div className="hero-actions">
            <button className="secondary big" onClick={onStudy}>
              📖 먼저 공부하기
            </button>
            <button className="primary big" onClick={() => onStart(10)}>
              ⏱ 개념+위치 타임어택 게임
            </button>
          </div>
        </div>
        <div className="hero-art" aria-hidden>
          🌏
        </div>
      </section>

      <div className="home-grid">
        <section className="mode-cards">
          <h3>⏱ 개념+위치 타임어택 도전</h3>
          <div className="mode-card-grid">
            {CHALLENGES.map((c) => (
              <button
                key={c.count}
                className="mode-card challenge"
                style={{ '--tier': c.tier.color } as React.CSSProperties}
                onClick={() => onStart(c.count)}
              >
                <span className="mode-emoji">{c.tier.emoji}</span>
                <strong>{c.title}</strong>
                <span className="muted small">
                  {c.count}문제 · 제한 시간 {formatLimit(c.limitSec)}
                </span>
              </button>
            ))}
          </div>
          <p className="muted small">
            시간 안에 모두 풀고 정답률 {Math.round(CLEAR_ACCURACY * 100)}% 이상이면 도전 성공! 성공한 단계의 칭호가 명예의 전당에 표시돼요.
          </p>

          <h3>더 해 보기</h3>
          <div className="mode-card-grid">
            <button className="mode-card" onClick={onStudy}>
              <span className="mode-emoji">📝</span>
              <strong>개념 공부</strong>
              <span className="muted small">한 문항씩 풀고 바로 정답 확인</span>
            </button>
            <button className="mode-card" onClick={onPlay}>
              <span className="mode-emoji">🧭</span>
              <strong>연습 (국가·도시)</strong>
              <span className="muted small">나라·도시 이름 맞히기, 기록 없음</span>
            </button>
          </div>

          <h3>칭호 안내</h3>
          <ol className="tier-legend">
            <li style={{ '--tier': BASE_TIER.color } as React.CSSProperties}>
              <span className="tier-emoji">{BASE_TIER.emoji}</span>
              <strong>{BASE_TIER.name}</strong>
              <span className="muted">기본 칭호</span>
            </li>
            {CHALLENGES.map((c) => (
              <li key={c.count} style={{ '--tier': c.tier.color } as React.CSSProperties}>
                <span className="tier-emoji">{c.tier.emoji}</span>
                <strong>{c.tier.name}</strong>
                <span className="muted">
                  {c.count}문제 · {formatLimit(c.limitSec)} 도전 성공
                </span>
              </li>
            ))}
          </ol>
        </section>

        <HallOfFame limit={10} />
      </div>
    </div>
  );
}
