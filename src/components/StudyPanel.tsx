import type { StudyState } from '../game/useStudy';
import type { Country } from '../types';
import { CITY_TOLERANCE_KM } from '../game/scoring';

/** 개념 공부 패널: 문제 → 지도 클릭 → 맞았는지 확인 → 해설 → 다음 */
export default function StudyPanel({
  study,
  countryById,
  source,
}: {
  study: StudyState;
  countryById: Map<string, Country>;
  source: 'loading' | 'db' | 'builtin';
}) {
  const { current, status, lastClick } = study;

  if (source === 'loading') return <p className="muted small">개념을 불러오는 중…</p>;
  if (!current) return <p className="hint small">아직 등록된 개념이 없어요. 관리자 화면에서 개념을 추가해 주세요.</p>;

  const done = status === 'correct' || status === 'revealed';
  const clickedName = lastClick?.countryId ? countryById.get(lastClick.countryId)?.nameKo : null;
  const isCity = current.kind === 'city';

  return (
    <div className="study">
      <div className="study-head">
        <span className="q-count">
          개념 {study.index + 1} / {study.total}
        </span>
        <span className="muted small">
          공부한 개념 {study.stats.done}개 · 한 번에 맞힘 {study.stats.first}개
        </span>
      </div>
      <div className="study-progress">
        <span style={{ width: `${((study.index + 1) / study.total) * 100}%` }} />
      </div>

      <div className="question is-hint">
        <div className="q-tags">
          <span className={`tag tag-${isCity ? 'city' : 'country'}`}>{isCity ? '도시' : '국가'}</span>
          {current.tags.map((t) => (
            <span key={t} className="tag tag-topic">
              {t}
            </span>
          ))}
        </div>
        <p className="hint-text">{current.hint}</p>
        {status === 'asking' && (
          <p className="muted small">
            {isCity ? `지도에서 도시 위치를 클릭하세요 (${CITY_TOLERANCE_KM}km 이내면 정답).` : '지도에서 나라를 클릭하세요.'}
          </p>
        )}
      </div>

      {status === 'wrong' && (
        <div className="feedback no">
          <strong className="feedback-title">❌ 아니에요!</strong>
          <p className="small">
            {isCity
              ? lastClick?.distanceKm != null
                ? `정답과 약 ${lastClick.distanceKm.toLocaleString()}km 떨어진 곳이에요.`
                : '지구 바깥을 클릭했어요.'
              : clickedName
                ? `${clickedName}은(는) 정답이 아니에요.`
                : '바다를 클릭했어요.'}{' '}
            다시 골라 보세요.
          </p>
          <button className="secondary" onClick={study.reveal}>
            👀 정답 보기
          </button>
        </div>
      )}

      {done && (
        <div className={`feedback ${status === 'correct' ? 'ok' : 'reveal'}`}>
          <strong className="feedback-title">
            {status === 'correct' ? (study.tries === 1 ? '⭕ 정답! 한 번에 맞혔어요' : '⭕ 정답!') : '👀 정답 공개'} — {current.answer}
          </strong>
          {(current.explanation || current.climate || current.resources.length > 0) && (
            <div className="explain">
              {current.explanation && <p>💡 {current.explanation}</p>}
              {current.climate && (
                <p className="small">
                  <b>기후</b> {current.climate}
                </p>
              )}
              {current.resources.length > 0 && (
                <div className="chips">
                  {current.resources.map((r) => (
                    <span key={r} className="chip static">
                      {r}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="study-nav">
        <button className="secondary" onClick={study.prev} aria-label="이전 개념">
          ◀ 이전
        </button>
        {status === 'asking' && (
          <button className="link" onClick={study.reveal}>
            모르겠어요 · 정답 보기
          </button>
        )}
        <button className={done ? 'primary' : 'secondary'} onClick={study.next}>
          {study.index + 1 >= study.total ? '처음으로 ↺' : '다음 ▶'}
        </button>
      </div>

      <label className="check small">
        <input type="checkbox" checked={study.shuffle} onChange={(e) => study.setShuffle(e.target.checked)} /> 순서 섞기
      </label>
      {source === 'builtin' && <p className="muted small">관리자 개념을 불러오지 못해 기본 개념으로 공부 중이에요.</p>}
    </div>
  );
}
