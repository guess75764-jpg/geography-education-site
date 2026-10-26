-- 게임 점수(명예의 전당) 테이블
-- Supabase 대시보드 → SQL Editor 에 전체를 붙여넣고 Run 하세요.
-- 여러 번 실행해도 안전하며, 예전 버전의 scores 테이블이 있으면 새 구조로 업그레이드합니다.

create table if not exists public.scores (
  id            bigint generated always as identity primary key,
  nickname      text        not null,
  score         integer     not null,
  max_score     integer     not null,
  correct_count integer     not null,
  total         integer     not null,
  quiz_kind     text        not null,
  created_at    timestamptz not null default now()
);

-- 새 기능용 열: 플레이 방식(타임어택/연습), 최고 콤보
alter table public.scores add column if not exists game_mode text not null default 'timeattack';
alter table public.scores add column if not exists max_combo integer not null default 0;

-- 값 검증 규칙 (다시 만들어 최신 규칙으로 맞춤)
alter table public.scores drop constraint if exists scores_nickname_check;
alter table public.scores drop constraint if exists scores_score_check;
alter table public.scores drop constraint if exists scores_max_score_check;
alter table public.scores drop constraint if exists scores_correct_count_check;
alter table public.scores drop constraint if exists scores_total_check;
alter table public.scores drop constraint if exists scores_quiz_kind_check;
alter table public.scores drop constraint if exists scores_game_mode_check;
alter table public.scores drop constraint if exists scores_max_combo_check;
alter table public.scores drop constraint if exists scores_check;
alter table public.scores drop constraint if exists scores_check1;

alter table public.scores
  add constraint scores_nickname_check      check (char_length(btrim(nickname)) between 1 and 20),
  add constraint scores_score_check         check (score between 0 and 100000),
  add constraint scores_max_score_check     check (max_score between 1 and 100000),
  add constraint scores_correct_count_check check (correct_count between 0 and total),
  add constraint scores_total_check         check (total between 1 and 300),
  add constraint scores_quiz_kind_check     check (quiz_kind in ('country', 'city', 'mixed', 'hint')),
  add constraint scores_game_mode_check     check (game_mode in ('timeattack', 'practice')),
  add constraint scores_max_combo_check     check (max_combo between 0 and total),
  add constraint scores_check               check (score <= max_score);

-- 명예의 전당 조회를 빠르게
drop index if exists public.scores_rank_idx;
create index if not exists scores_hof_idx on public.scores (game_mode, quiz_kind, score desc, created_at);

-- 행 단위 보안(RLS): 공개 키로는 "읽기"와 "추가"만 가능, 수정/삭제 불가
alter table public.scores enable row level security;

grant select, insert on public.scores to anon, authenticated;

drop policy if exists "scores are readable by everyone" on public.scores;
create policy "scores are readable by everyone"
  on public.scores for select
  to anon, authenticated
  using (true);

drop policy if exists "anyone can submit a score" on public.scores;
create policy "anyone can submit a score"
  on public.scores for insert
  to anon, authenticated
  with check (true);  -- 값 검증은 위의 check 제약 조건이 담당

-- API 가 새 테이블 구조를 바로 알도록
notify pgrst, 'reload schema';
