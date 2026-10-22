-- 게임 점수 저장용 테이블
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 Run 하세요.

create table if not exists public.scores (
  id            bigint generated always as identity primary key,
  nickname      text        not null check (char_length(btrim(nickname)) between 1 and 20),
  score         integer     not null check (score >= 0),
  max_score     integer     not null check (max_score between 1 and 1000),
  correct_count integer     not null check (correct_count >= 0),
  total         integer     not null check (total between 1 and 100),
  quiz_kind     text        not null check (quiz_kind in ('country', 'city', 'mixed')),
  created_at    timestamptz not null default now(),
  check (score <= max_score),
  check (correct_count <= total)
);

-- 순위표 조회를 빠르게
create index if not exists scores_rank_idx
  on public.scores (quiz_kind, total, score desc, created_at);

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
