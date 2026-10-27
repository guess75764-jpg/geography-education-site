-- 관리자 로그인 + 개념(문제) 관리 + 타임어택 20문제 기록
-- 001 을 실행한 뒤, Supabase 대시보드 → SQL Editor 에 전체를 붙여넣고 Run 하세요.
-- 여러 번 실행해도 안전합니다.

-- ───────────────────────── 1. 관리자 명단 ─────────────────────────
-- 로그인 계정(auth.users) 중 이 표에 있는 사람만 관리자.
create table if not exists public.admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;
revoke all on public.admins from anon, authenticated;
grant select on public.admins to authenticated;
drop policy if exists "admins can see themselves" on public.admins;
create policy "admins can see themselves"
  on public.admins for select to authenticated
  using (user_id = auth.uid());

-- 지금 로그인한 사람이 관리자인지 (관리자 명단은 이 함수로만 확인)
create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- ───────────────────────── 2. 기록(scores): 관리자만 삭제 ─────────────────────────
alter table public.scores add column if not exists duration_ms integer;
alter table public.scores drop constraint if exists scores_duration_ms_check;
alter table public.scores add constraint scores_duration_ms_check
  check (duration_ms is null or duration_ms between 0 and 86400000);

grant delete on public.scores to authenticated;
drop policy if exists "admins can delete scores" on public.scores;
create policy "admins can delete scores"
  on public.scores for delete to authenticated
  using (public.is_admin());

-- ───────────────────────── 3. 개념(문제) ─────────────────────────
create table if not exists public.concepts (
  id          bigint generated always as identity primary key,
  prompt      text        not null,           -- 문제로 나오는 개념 설명
  answer_type text        not null default 'country',
  country_id  text        not null,           -- 정답 나라 (ISO 숫자 코드, 예: 브라질 076)
  answer_name text        not null,           -- 정답 이름 (예: 브라질, 리우데자네이루)
  lon         double precision,               -- 도시 정답일 때 좌표
  lat         double precision,
  explanation text,                           -- 해설 (선택)
  climate     text,                           -- 기후 (선택)
  resources   text[]      not null default '{}', -- 대표 자원·산물 (선택)
  tags        text[]      not null default '{}', -- 주제 태그 (선택)
  is_active   boolean     not null default true, -- 끄면 게임에 안 나옴
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.concepts drop constraint if exists concepts_prompt_check;
alter table public.concepts drop constraint if exists concepts_answer_type_check;
alter table public.concepts drop constraint if exists concepts_country_id_check;
alter table public.concepts drop constraint if exists concepts_answer_name_check;
alter table public.concepts drop constraint if exists concepts_point_check;
alter table public.concepts
  add constraint concepts_prompt_check      check (char_length(btrim(prompt)) between 2 and 300),
  add constraint concepts_answer_type_check check (answer_type in ('country', 'city')),
  add constraint concepts_country_id_check  check (country_id ~ '^[0-9]{3}$'),
  add constraint concepts_answer_name_check check (char_length(btrim(answer_name)) between 1 and 50),
  add constraint concepts_point_check       check (
    answer_type = 'country'
    or (lon between -180 and 180 and lat between -90 and 90)
  );

create index if not exists concepts_active_idx on public.concepts (is_active);

-- 수정 시각 자동 기록
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
drop trigger if exists concepts_touch on public.concepts;
create trigger concepts_touch before update on public.concepts
  for each row execute function public.touch_updated_at();

-- 보안: 학생(로그인 없음)은 켜진 개념 읽기만, 관리자는 전부 읽기·추가·수정·삭제
alter table public.concepts enable row level security;
grant select on public.concepts to anon, authenticated;
grant insert, update, delete on public.concepts to authenticated;

drop policy if exists "active concepts are readable" on public.concepts;
create policy "active concepts are readable"
  on public.concepts for select to anon, authenticated
  using (is_active or public.is_admin());

drop policy if exists "admins can add concepts" on public.concepts;
create policy "admins can add concepts"
  on public.concepts for insert to authenticated
  with check (public.is_admin());

drop policy if exists "admins can edit concepts" on public.concepts;
create policy "admins can edit concepts"
  on public.concepts for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admins can delete concepts" on public.concepts;
create policy "admins can delete concepts"
  on public.concepts for delete to authenticated
  using (public.is_admin());

-- ───────────────────────── 4. 시작용 개념 24개 (표가 비어 있을 때만) ─────────────────────────
insert into public.concepts (prompt, answer_type, country_id, answer_name, lon, lat, explanation, climate, resources, tags)
select * from (values
  ('온대 초원인 팜파스에서 기업적 목축과 밀 재배가 활발하며, 소고기 수출이 많은 남아메리카 국가는?', 'country', '032', '아르헨티나', null::float8, null::float8,
   '팜파스는 비옥한 온대 초원으로, 대규모 기업적 목축과 밀·대두 재배가 이루어진다.', '온대 기후(Cfa) · 남부는 건조 기후', array['소고기','밀','대두'], array['농업','기후']),
  ('세계 최대의 열대 우림(셀바스)이 분포하고, 철광석·커피·대두 수출이 많은 남아메리카 최대 국가는?', 'country', '076', '브라질', null, null,
   '아마존강 유역의 셀바스는 세계 최대 열대 우림이며, 카라자스 철광산과 커피 플랜테이션이 유명하다.', '열대 우림 기후(Af) · 열대 사바나 기후(Aw)', array['철광석','커피','대두','사탕수수'], array['기후','자원','농업']),
  ('리우데자네이루 카니발에서 삼바 축제가 열리는 것으로 유명한 남아메리카 국가는?', 'country', '076', '브라질', null, null,
   '포르투갈 식민 지배와 아프리카계 이주민의 문화가 섞여 삼바 음악과 카니발 축제가 발달했다.', null, array[]::text[], array['인구·문화']),
  ('세계 최대의 구리 생산국으로, 남북으로 길게 뻗어 북부에는 아타카마 사막이 나타나는 국가는?', 'country', '152', '칠레', null, null,
   '안데스산맥을 따라 남북으로 길어 기후가 다양하며, 추키카마타 등 대규모 구리 광산이 있다.', '북부 사막 기후(BW) · 중부 지중해성 기후(Cs) · 남부 서안 해양성 기후(Cfb)', array['구리','리튬','포도(와인)'], array['자원','기후','지형']),
  ('국토의 대부분이 건조 기후이며, 철광석·석탄 수출이 많고 대찬정 분지에서 양을 기르는 국가는?', 'country', '036', '오스트레일리아', null, null,
   '내륙은 사막과 스텝이며, 대찬정 분지의 지하수를 이용한 목양업과 서부 필바라 지역의 철광석이 유명하다.', '건조 기후(BW·BS)가 대부분 · 남동부 온대 기후', array['철광석','석탄','양모','보크사이트'], array['기후','자원','농업']),
  ('국토 대부분이 사막 기후이며, 세계적인 석유 수출국이자 이슬람교 성지 메카가 있는 국가는?', 'country', '682', '사우디아라비아', null, null,
   '페르시아만 연안에 대규모 유전이 분포하며, 이슬람교 최대 성지인 메카와 메디나가 있다.', '사막 기후(BW)', array['석유','천연가스'], array['자원','기후','인구·문화']),
  ('계절풍(몬순)의 영향으로 여름에 비가 집중되며, 아삼 지방의 차와 데칸고원의 목화 재배로 유명한 국가는?', 'country', '356', '인도', null, null,
   '여름 계절풍이 많은 비를 내려 벼농사가 활발하고, 아삼 지방의 차·데칸고원의 흑색토(레구르)에서 목화를 재배한다.', '열대 몬순 기후(Am) · 사바나 기후(Aw)', array['차','목화','쌀','철광석'], array['기후','농업']),
  ('국토 면적이 세계에서 가장 넓고, 냉대 기후의 타이가가 넓게 분포하며 천연가스 수출이 많은 국가는?', 'country', '643', '러시아', null, null,
   '시베리아의 침엽수림(타이가)은 세계 최대 규모이며, 파이프라인으로 유럽·아시아에 천연가스를 수출한다.', '냉대 기후(Df·Dw) · 북부 한대 기후(ET)', array['천연가스','석유','목재'], array['기후','자원']),
  ('빙하 침식으로 형성된 피오르 해안이 발달하고, 북해 유전에서 석유·천연가스를 생산하는 북유럽 국가는?', 'country', '578', '노르웨이', null, null,
   '빙식곡에 바닷물이 들어와 만들어진 피오르가 해안을 따라 발달하며, 북해 유전 개발로 소득 수준이 높다.', '서안 해양성 기후(Cfb) · 내륙 냉대 기후', array['석유','천연가스','수산물(연어)'], array['지형','자원']),
  ('환태평양 조산대에 위치한 세계 최대의 섬나라로, 팜유 생산량이 세계 1위인 국가는?', 'country', '360', '인도네시아', null, null,
   '1만 7천여 개의 섬으로 이루어져 화산·지진이 잦으며, 열대 우림을 개간한 기름야자 플랜테이션이 많다.', '열대 우림 기후(Af)', array['팜유','석탄','천연고무','주석'], array['지형','농업','자원']),
  ('나일강 하류의 좁은 범람원과 삼각주에 인구가 집중하며, 수에즈 운하가 지나는 북아프리카 국가는?', 'country', '818', '이집트', null, null,
   '국토 대부분이 사막이라 나일강 유역에 인구와 농경지가 몰려 있고, 수에즈 운하가 지중해와 홍해를 잇는다.', '사막 기후(BW)', array['목화','천연가스','관광'], array['기후','지형','인구·문화']),
  ('메콩강 삼각주에서 벼농사가 활발해 쌀 수출이 많고, 커피 생산량이 세계 2위인 동남아시아 국가는?', 'country', '704', '베트남', null, null,
   '남부 메콩강 삼각주와 북부 홍강 삼각주가 대표적인 벼농사 지역이며, 중부 고원에서 커피를 재배한다.', '열대 사바나 기후(Aw) · 북부 온대 동계 건조 기후(Cw)', array['쌀','커피','후추'], array['농업','지형']),
  ('국토 면적 세계 2위로, 북부에 툰드라와 타이가가 넓고 남부 프레리에서 밀을 대규모로 재배하는 국가는?', 'country', '124', '캐나다', null, null,
   '대부분 냉대·한대 기후이며, 인구는 미국과 맞닿은 남부에 몰려 있다. 프레리는 세계적인 밀 생산지이다.', '냉대 기후(Df) · 북부 한대 기후(ET)', array['밀','목재','석유(오일샌드)'], array['기후','농업','자원']),
  ('건조한 초원(스텝)에서 이동식 가옥 게르를 이용한 유목이 이루어지는 동아시아의 내륙국은?', 'country', '496', '몽골', null, null,
   '강수량이 적어 농경보다 양·말·염소를 기르는 유목이 발달했고, 계절에 따라 풀을 찾아 이동한다.', '스텝 기후(BS) · 냉대 동계 건조 기후(Dw)', array['양','구리','석탄'], array['기후','인구·문화']),
  ('국토의 약 4분의 1이 해수면보다 낮아 간척지(폴더)를 개발하고, 화훼 재배와 낙농업이 발달한 국가는?', 'country', '528', '네덜란드', null, null,
   '제방과 풍차·배수 시설로 바다를 막아 폴더를 만들었으며, 튤립 등 원예 작물과 낙농업이 유명하다.', '서안 해양성 기후(Cfb)', array['화훼(튤립)','치즈','천연가스'], array['지형','농업']),
  ('알프스산맥에 위치한 내륙국으로, 정밀 기계·시계 공업과 산악 관광이 발달한 영세 중립국은?', 'country', '756', '스위스', null, null,
   '자원이 적어 기술 집약적인 정밀 기계·시계 산업과 금융, 알프스 산악 관광이 발달했다.', '서안 해양성 기후 · 고산 기후', array['시계','관광','금융'], array['지형','산업']),
  ('적도에 걸쳐 있지만 고원 지대가 넓어 차·화훼를 재배하고, 사바나의 야생 동물 관광(사파리)이 유명한 동아프리카 국가는?', 'country', '404', '케냐', null, null,
   '해발 고도가 높은 고원은 기온이 온화해 차 재배에 유리하며, 사바나 초원의 국립공원 관광이 주요 산업이다.', '열대 사바나 기후(Aw) · 고산 기후', array['차','화훼','관광'], array['기후','농업','산업']),
  ('안데스산맥에 잉카 문명 유적 마추픽추가 있고, 연안을 흐르는 차가운 해류의 영향으로 해안 사막이 나타나는 국가는?', 'country', '604', '페루', null, null,
   '한류(페루 해류)의 영향으로 해안은 비가 적은 사막이며, 이 해류가 약해지는 현상이 엘니뇨이다.', '해안 사막 기후(BW) · 고산 기후', array['구리','은','어분(멸치)'], array['기후','지형','인구·문화']),
  ('원주민 마오리족의 문화가 남아 있고, 서안 해양성 기후에서 낙농업과 목양업이 발달한 남반구 섬나라는?', 'country', '554', '뉴질랜드', null, null,
   '편서풍의 영향으로 연중 강수가 고른 서안 해양성 기후가 나타나 목초지가 잘 자라고, 낙농 제품을 많이 수출한다.', '서안 해양성 기후(Cfb)', array['유제품','양모','키위'], array['기후','농업','인구·문화']),
  ('판의 경계인 대서양 중앙 해령에 위치해 화산과 간헐천이 많고, 지열 발전 비중이 높은 북대서양 섬나라는?', 'country', '352', '아이슬란드', null, null,
   '두 판이 갈라지는 경계에 있어 화산 활동이 활발하며, 지열과 수력으로 대부분의 전기를 만든다.', '한대 기후(ET) · 서안 해양성 기후', array['지열 에너지','수산물','알루미늄'], array['지형','자원']),
  ('보스포루스 해협을 사이에 두고 유럽과 아시아 대륙에 걸쳐 있으며, 이스탄불이 있는 국가는?', 'country', '792', '튀르키예', null, null,
   '흑해와 지중해를 잇는 보스포루스 해협이 지나며, 동서 문명의 교차로로 비잔티움·오스만 제국의 유산이 남아 있다.', '지중해성 기후(Cs) · 내륙 스텝 기후', array['관광','섬유','헤이즐넛'], array['지형','인구·문화']),
  ('적도 부근이지만 해발 약 2,800m의 고산 지대에 있어, 연중 봄과 같은 기후가 나타나는 에콰도르의 수도는?', 'city', '218', '키토', -78.47, -0.18,
   '안데스산맥의 고산 도시로, 적도에 있지만 해발 고도가 높아 연중 기온이 13~14℃ 정도로 온화하다.', '고산 기후 · 연교차가 매우 작음', array['바나나(저지대)','석유'], array['기후','지형']),
  ('여름은 고온 건조하고 겨울은 온난 습윤한 지중해성 기후 지역으로, 수목 농업(포도·올리브)이 발달한 이탈리아의 수도는?', 'city', '380', '로마', 12.5, 41.9,
   '여름에 아열대 고압대의 영향으로 건조해 올리브·포도 같은 수목 작물을 재배한다.', '지중해성 기후(Cs)', array['올리브','포도','코르크'], array['기후','농업']),
  ('사막 기후 지역에 있으며, 석유 수입을 바탕으로 관광·금융·항공 교통의 중심지로 성장한 페르시아만 연안 도시는?', 'city', '784', '두바이', 55.27, 25.2,
   '석유 의존도를 낮추기 위해 인공섬·초고층 건물·국제공항 등 관광과 서비스 산업을 육성했다.', '사막 기후(BW)', array['석유','관광·금융 서비스'], array['기후','산업'])
) as v (prompt, answer_type, country_id, answer_name, lon, lat, explanation, climate, resources, tags)
where not exists (select 1 from public.concepts);

-- API 가 새 표를 바로 알도록
notify pgrst, 'reload schema';

-- ───────────────────────── 5. 관리자 등록 (한 번만) ─────────────────────────
-- ① 대시보드 → Authentication → Users → Add user → Create new user
--    (이메일·비밀번호 입력, "Auto Confirm User" 체크)
-- ② 아래 줄의 이메일을 바꾼 뒤, 앞의 "-- " 를 지우고 이 줄만 선택해서 Run
-- insert into public.admins (user_id) select id from auth.users where email = 'teacher@example.com' on conflict do nothing;
