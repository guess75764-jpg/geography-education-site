import type { AnswerResult } from '../game/useGame';

interface ReviewItem {
  r: AnswerResult; // 대표 기록 (틀린 적이 있으면 틀린 기록)
  tries: number;
  wrongs: number;
}

/** 같은 문제를 여러 번 풀었으면 한 줄로 묶는다 */
function group(results: AnswerResult[]): ReviewItem[] {
  const map = new Map<string, ReviewItem>();
  for (const r of results) {
    const item = map.get(r.question.key);
    if (!item) map.set(r.question.key, { r, tries: 1, wrongs: r.correct ? 0 : 1 });
    else {
      item.tries++;
      if (!r.correct) {
        item.wrongs++;
        item.r = r;
      }
    }
  }
  return [...map.values()];
}

function Item({ it }: { it: ReviewItem }) {
  const { r } = it;
  const h = r.question.hint;
  const ok = it.wrongs === 0;
  return (
    <li className={ok ? 'ok' : 'no'}>
      <span className="mark">{ok ? '⭕' : '❌'}</span>
      <div className="review-body">
        <p className="review-q">{h ? h.hint : `${r.question.answerName} 찾기`}</p>
        <p className="review-a">
          정답 <strong>{r.question.answerName}</strong>
          {it.tries > 1 && (
            <span className="muted small">
              {' '}
              · {it.tries}번 중 {it.tries - it.wrongs}번 정답
            </span>
          )}
        </p>
        {h && (
          <div className="review-explain small">
            <p>💡 {h.explanation}</p>
            <p>
              <b>기후</b> {h.climate} · <b>자원</b> {h.resources.join(', ')}
            </p>
          </div>
        )}
      </div>
    </li>
  );
}

/** 게임이 끝난 뒤 푼 문제를 다시 보며 해설을 확인하는 오답 노트 */
export default function ReviewList({ results }: { results: AnswerResult[] }) {
  if (results.length === 0) return null;
  const items = group(results);
  const wrong = items.filter((it) => it.wrongs > 0);
  const right = items.filter((it) => it.wrongs === 0);
  return (
    <section className="review card">
      <h3>
        📒 문제 돌아보기 <span className="muted small">틀린 문제 {wrong.length}개 · 맞힌 문제 {right.length}개</span>
      </h3>
      {wrong.length > 0 ? (
        <ol>
          {wrong.map((it) => (
            <Item key={it.r.question.key} it={it} />
          ))}
        </ol>
      ) : (
        <p className="muted">틀린 문제가 없어요. 완벽해요! 🎉</p>
      )}
      {right.length > 0 && (
        <details className="review-more">
          <summary>맞힌 문제 {right.length}개 해설 보기</summary>
          <ol>
            {right.map((it) => (
              <Item key={it.r.question.key} it={it} />
            ))}
          </ol>
        </details>
      )}
    </section>
  );
}
