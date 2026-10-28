import { useMemo } from 'react';
import { feature } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from 'geojson';
import isoCountries from 'i18n-iso-countries';
import ko from 'i18n-iso-countries/langs/ko.json';
// 50m 해상도: 241개국, 작은 나라도 포함. (110m는 가볍지만 작은 나라가 빠짐)
import worldTopo from 'world-atlas/countries-50m.json';
import type { Country } from '../types';

isoCountries.registerLocale(ko);

// 브라우저 내장 국가명(짧은 이름: "짐바브웨")을 우선 쓰고, 없으면 라이브러리 이름("짐바브웨 공화국")을 쓴다.
const regionNames = new Intl.DisplayNames(['ko'], { type: 'region' });

/** 브라우저 표기 대신 교과서 표기를 쓰는 나라 */
const TEXTBOOK_NAMES: Record<string, string> = {
  '180': '콩고 민주 공화국',
  '178': '콩고',
  '710': '남아프리카 공화국',
  '446': '마카오',
  '344': '홍콩',
  '275': '팔레스타인',
};

function koreanName(numericId: string): string | undefined {
  if (TEXTBOOK_NAMES[numericId]) return TEXTBOOK_NAMES[numericId];
  const alpha2 = isoCountries.numericToAlpha2(numericId);
  const short = alpha2 ? regionNames.of(alpha2) : undefined;
  if (short && short !== alpha2) return short;
  return isoCountries.getName(numericId, 'ko');
}

type CountryProps = { name: string };

/** TopoJSON → GeoJSON 으로 변환하고 한국어 국가명을 붙인다. */
export function useWorldData(): Country[] {
  return useMemo(() => {
    const topo = worldTopo as unknown as Topology<{
      countries: GeometryCollection<CountryProps>;
    }>;
    const fc = feature(topo, topo.objects.countries) as FeatureCollection<
      Polygon | MultiPolygon,
      CountryProps
    >;

    const seen = new Set<string>();
    return fc.features.map((f, i): Country => {
      const iso = f.id != null ? String(f.id) : null;
      // 코소보 등 ISO 코드 없는 지역, 그리고 같은 코드를 쓰는 부속 섬(예: 호주의 애시모어 제도)은 임시 키
      const id = iso && !seen.has(iso) ? iso : `x-${i}`;
      seen.add(id);
      const nameEn = f.properties.name;
      const nameKo = (iso && id === iso && koreanName(iso)) || nameEn;
      return { id, nameKo, nameEn, feature: f as Feature<Polygon | MultiPolygon> };
    });
  }, []);
}
