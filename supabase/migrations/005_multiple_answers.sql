-- 한 개념에 정답 나라를 여러 개 둘 수 있게 한다.
-- 예: "탱고로 유명한 라틴 아메리카 국가는?" → 아르헨티나(country_id) + 우루과이(alt_country_ids)
-- 004 를 실행한 뒤, SQL Editor 에 전체를 붙여넣고 Run 하세요. 여러 번 실행해도 안전합니다.

alter table public.concepts add column if not exists alt_country_ids text[] not null default '{}';

alter table public.concepts drop constraint if exists concepts_alt_country_ids_check;
alter table public.concepts add constraint concepts_alt_country_ids_check check (
  cardinality(alt_country_ids) <= 10
  and array_to_string(alt_country_ids, ',') ~ '^([0-9]{3}(,[0-9]{3})*)?$'
);

-- 시작용 예시: 탱고 개념이 없으면 하나 넣어 둔다 (아르헨티나·우루과이 둘 다 정답)
insert into public.concepts (prompt, answer_type, country_id, alt_country_ids, answer_name, explanation, tags)
select '아프리카의 리듬과 유럽의 음악이 결합해 만들어진 춤, 탱고로 유명한 라틴 아메리카 국가는?',
       'country', '032', array['858'], '아르헨티나',
       '탱고는 라플라타강 하구의 부에노스아이레스(아르헨티나)와 몬테비데오(우루과이)에서 함께 발전했다.',
       array['인구·문화']
 where not exists (select 1 from public.concepts where prompt like '%탱고%');

notify pgrst, 'reload schema';
