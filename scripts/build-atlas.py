"""백지도 학습용 데이터 만들기: 나라별 대륙 + 수도·주요 도시 (한국어 이름).

원본: Natural Earth (public domain) https://github.com/nvkelso/natural-earth-vector
  - geojson/ne_50m_admin_0_countries.geojson
  - geojson/ne_50m_populated_places.geojson
사용: python3 scripts/build-atlas.py <원본 폴더>  →  src/data/atlas.json
"""
import json
import sys
from pathlib import Path

src = Path(sys.argv[1])
countries = json.load(open(src / 'ne_50m_admin_0_countries.geojson'))['features']
places = json.load(open(src / 'ne_50m_populated_places.geojson'))['features']

def iso_n3(p):
    for k in ('ISO_N3_EH', 'ISO_N3'):
        v = str(p.get(k) or '')
        if v.isdigit():
            return v.zfill(3)
    return None

def continents_of(p):
    cont, sub, un = p.get('CONTINENT'), p.get('SUBREGION'), p.get('REGION_UN')
    if cont == 'North America':
        return ['northAmerica'] if sub == 'Northern America' else ['latinAmerica']
    if cont == 'South America':
        return ['latinAmerica']
    if cont == 'Europe':
        # 러시아는 유럽·아시아 양쪽에 걸쳐 있으므로 두 대륙 지도에 모두 표시
        return ['europe', 'asia'] if p.get('ADM0_A3') == 'RUS' else ['europe']
    if cont == 'Asia':
        return ['asia']
    if cont == 'Africa':
        return ['africa']
    if cont == 'Oceania':
        return ['oceania']
    if cont == 'Seven seas (open ocean)':
        return {'Africa': ['africa'], 'Asia': ['asia'], 'Oceania': ['oceania']}.get(un, [])
    return []  # 남극 등

country_continents = {}
a3_to_n3 = {}
for f in countries:
    p = f['properties']
    n3 = iso_n3(p)
    if not n3:
        continue
    a3_to_n3[p['ADM0_A3']] = n3
    cs = continents_of(p)
    if cs:
        country_continents[n3] = cs

# 한국어 이름 다듬기 (Natural Earth 표기 중 교과서와 다른 것)
KO_FIX = {
    '사우스타라와': '타라와',
    '바티칸 시국': '바티칸',
    '도쿄도': '도쿄',
    '서울특별시': '서울',
    '평양직할시': '평양',
    '쿠웨이트 시': '쿠웨이트시티',
    '브뤼셀 시': '브뤼셀',
    '과테말라 시티': '과테말라시티',
    '키예프': '키이우',  # 2022년부터 국립국어원 표기
    '누르술탄': '아스타나',  # 2022년 이름 되돌림
}
# 중국·일본·타이완 도시는 '…시' 행정 단위를 떼고 부른다 (예: 상하이시 → 상하이)
STRIP_SI = {'156', '392', '158'}

cities = []
for f in places:
    p = f['properties']
    capital = p.get('ADM0CAP') == 1
    rank = p.get('SCALERANK', 9)
    if not (capital or rank <= 2):
        continue
    n3 = a3_to_n3.get(p.get('ADM0_A3')) or a3_to_n3.get(p.get('SOV_A3'))
    if not n3:
        continue
    ko = (p.get('NAME_KO') or '').strip() or p['NAME']
    ko = KO_FIX.get(ko, ko)
    if n3 in STRIP_SI and ko.endswith('시') and len(ko) > 2:
        ko = ko[:-1]
    lon, lat = f['geometry']['coordinates']
    cities.append({
        'nameKo': ko,
        'nameEn': p.get('NAME_EN') or p['NAME'],
        'countryId': n3,
        'lon': round(lon, 3),
        'lat': round(lat, 3),
        'capital': capital,
        'rank': rank,
        'pop': p.get('POP_MAX') or 0,
    })

cities.sort(key=lambda c: (not c['capital'], c['rank'], -c['pop']))
out = {'countryContinents': country_continents, 'cities': cities}
dst = Path(__file__).resolve().parent.parent / 'src' / 'data' / 'atlas.json'
dst.write_text(json.dumps(out, ensure_ascii=False, separators=(',', ':')))
print(f'{len(country_continents)} countries, {len(cities)} cities ({sum(c["capital"] for c in cities)} capitals) → {dst} ({dst.stat().st_size // 1024} KB)')
