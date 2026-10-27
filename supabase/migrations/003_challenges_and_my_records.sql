-- 타임어택 도전 단계(10·20·40·60문제) + "내 기록 갱신" (이전 기록 자동 삭제)
-- 001, 002 를 실행한 뒤, Supabase 대시보드 → SQL Editor 에 전체를 붙여넣고 Run 하세요.
-- 여러 번 실행해도 안전합니다.

create extension if not exists pgcrypto with schema extensions;

-- ───────────────────────── 1. 기록에 도전 단계와 "기록 주인" 표시 ─────────────────────────
-- challenge : 10(지리 실버 도전) · 20(지리 골드 도전) · 40(수능 1등급 도전) · 60(지리박사 도전)
-- owner_hash: 학생 브라우저가 가진 비밀 열쇠의 해시. 같은 브라우저+같은 별명이면 같은 학생으로 보고,
--             그 학생만 자기 이전 기록을 갱신(삭제 후 저장)할 수 있다. 해시는 아무에게도 보여 주지 않는다.
alter table public.scores add column if not exists challenge smallint;
alter table public.scores add column if not exists owner_hash text;
alter table public.scores drop constraint if exists scores_challenge_check;
alter table public.scores add constraint scores_challenge_check
  check (challenge is null or challenge in (10, 20, 40, 60));
create index if not exists scores_challenge_idx on public.scores (challenge, score desc, duration_ms);
create index if not exists scores_owner_idx on public.scores (owner_hash, challenge);

-- 읽기: owner_hash 를 뺀 열만 공개
revoke select on public.scores from anon, authenticated;
grant select (id, nickname, score, max_score, correct_count, total, quiz_kind, game_mode,
              max_combo, duration_ms, challenge, created_at)
  on public.scores to anon, authenticated;

-- 쓰기: 학생은 표에 직접 쓰지 못하고, 아래 submit_score 함수로만 저장한다
revoke insert, update on public.scores from anon, authenticated;
drop policy if exists "anyone can submit a score" on public.scores;
-- (관리자 삭제 규칙 "admins can delete scores" 는 002 에서 만든 그대로 유지)

-- ───────────────────────── 2. 기록 저장 / 갱신 ─────────────────────────
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
  -- 문제 하나의 최대 점수는 (100 + 속도 100) × 콤보 3 = 600점
  if p_score > p_correct * 600 then
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

-- 이 학생(같은 브라우저 + 같은 별명)의 같은 도전 기록 찾기
create or replace function public.find_my_scores(p_secret text, p_nickname text, p_challenge integer)
returns table (id bigint, score integer, correct_count integer, total integer, duration_ms integer, created_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select s.id, s.score, s.correct_count, s.total, s.duration_ms, s.created_at
    from public.scores s
   where p_secret is not null and char_length(p_secret) >= 16
     and s.owner_hash = encode(extensions.digest(p_secret, 'sha256'), 'hex')
     and s.challenge = p_challenge
     and s.nickname = btrim(p_nickname)
   order by s.score desc
   limit 5;
$$;
revoke all on function public.find_my_scores(text, text, integer) from public;
grant execute on function public.find_my_scores(text, text, integer) to anon, authenticated;

notify pgrst, 'reload schema';
