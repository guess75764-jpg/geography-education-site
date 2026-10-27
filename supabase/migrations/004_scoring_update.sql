-- 점수 규칙 변경(단계별 속도 보너스·남은 시간 보너스)에 맞춰 기록 저장 함수의 "최대 점수" 검사를 넓힌다.
-- 003 을 실행한 뒤, SQL Editor 에 전체를 붙여넣고 Run 하세요. 여러 번 실행해도 안전합니다.

create or replace function public.submit_score(
  p_secret      text,
  p_nickname    text,
  p_challenge   integer,
  p_score       integer,
  p_correct     integer,
  p_total       integer,
  p_max_combo   integer,
  p_duration_ms integer,
  p_replace     boolean default false  -- true 면 이 학생의 같은 도전 이전 기록을 지우고 저장
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash text;
  v_id   bigint;
begin
  if p_secret is null or char_length(p_secret) < 16 then
    raise exception '잘못된 학생 열쇠' using errcode = '22023';
  end if;
  if p_challenge not in (10, 20, 40, 60) or p_total > p_challenge then
    raise exception '잘못된 도전 단계' using errcode = '22023';
  end if;
  -- 문제 하나의 최대 점수: (100 + 속도 최대 250) × 콤보 3 = 1,050점
  -- 남은 시간 보너스 최대: 300초 × 50점 = 15,000점
  if p_score > p_correct * 1050 + 15000 then
    raise exception '점수가 너무 높음' using errcode = '22023';
  end if;

  v_hash := encode(extensions.digest(p_secret, 'sha256'), 'hex');

  if p_replace then
    delete from public.scores
     where owner_hash = v_hash and challenge = p_challenge and nickname = btrim(p_nickname);
  end if;

  insert into public.scores
    (nickname, score, max_score, correct_count, total, quiz_kind, game_mode, max_combo, duration_ms, challenge, owner_hash)
  values
    (btrim(p_nickname), p_score, greatest(p_score, 1), p_correct, p_total, 'hint', 'timeattack',
     p_max_combo, p_duration_ms, p_challenge, v_hash)
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.submit_score(text, text, integer, integer, integer, integer, integer, integer, boolean) from public;
grant execute on function public.submit_score(text, text, integer, integer, integer, integer, integer, integer, boolean) to anon, authenticated;

notify pgrst, 'reload schema';
