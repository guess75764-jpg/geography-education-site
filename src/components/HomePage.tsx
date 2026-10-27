import { TIERS, TIMEATTACK_COUNT } from '../game/scoring';
import type { QuizType } from '../game/useGame';
import HallOfFame from './HallOfFame';

const MODE_CARDS: { type: QuizType; emoji: string; title: string; desc: string; badge?: string }[] = [
  { type: 'hint', emoji: '📝', title: '개념+위치', desc: '개념 설명을 읽고 지도에서 위치를 찾아라', badge: 'NEW' },
  { type: 'country', emoji: '🗺️', title: '국가 맞히기', desc: '나라 이름을 보고 백지도에서 클릭' },
  { type: 'city', emoji: '📍', title: '도시 맞히기', desc: '500km 안을 클릭하면 정답' },
  { type: 'mixed', emoji: '🎲', title: '섞어서', desc: '국가와 도시가 무작위로' },
];

/** 메인 화면: 바로 시작 카드 + 명예의 전당 + 칭호 안내 */
export default function HomePage({ onStart, onLearn }: { onStart: (t: QuizType) => void; onLearn: () => void }) {
  return (
    <div className="home">
      <section className="hero card">
        <div className="hero-text">
          <span className="eyebrow">통합사회 · 수능 한국지리/세계지리 대비</span>
          <h2>
            {TIMEATTACK_COUNT}문제, 가장 빠르고 정확하게 <span className="accent">정복</span>하라!
          </h2>
          <p className="muted">
            빨리 맞힐수록 점수가 높고, 연속으로 맞히면 <strong>콤보 배수</strong>가 올라가요. 최고 기록은 명예의 전당에!
          </p>
          <div className="hero-actions">
            <button className="primary big" onClick={() => onStart('hint')}>
              ⏱ 개념+위치 타임어택 게임
            </button>
            <button className="secondary big" onClick={onLearn}>
              📖 먼저 공부하기
            </button>
          </div>
        </div>
        <div className="hero-art" aria-hidden>
          🌏
        </div>
      </section>

      <div className="home-grid">
        <section className="mode-cards">
          <h3>게임 바로 시작</h3>
          <div className="mode-card-grid">
            {MODE_CARDS.map((m) => (
              <button key={m.type} className="mode-card" onClick={() => onStart(m.type)}>
                {m.badge && <span className="new-badge">{m.badge}</span>}
                <span className="mode-emoji">{m.emoji}</span>
                <strong>{m.title}</strong>
                <span className="muted small">{m.desc}</span>
              </button>
            ))}
          </div>

          <h3>칭호 안내</h3>
          <ol className="tier-legend">
            {TIERS.map((t) => (
              <li key={t.id} style={{ '--tier': t.color } as React.CSSProperties}>
                <span className="tier-emoji">{t.emoji}</span>
                <strong>{t.name}</strong>
                <span className="muted">{t.min.toLocaleString()}점~</span>
              </li>
            ))}
          </ol>
        </section>

        <HallOfFame limit={10} />
      </div>
    </div>
  );
}
