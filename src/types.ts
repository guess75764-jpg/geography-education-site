import type { Feature, MultiPolygon, Polygon } from 'geojson';

export type Mode = 'learn' | 'game';

/** 지도에 그려지는 국가 하나 */
export interface Country {
  id: string; // ISO 3166-1 숫자 코드 (없으면 임시 키)
  nameKo: string;
  nameEn: string;
  feature: Feature<Polygon | MultiPolygon>;
}

/** 도시는 영역이 아니라 좌표(점)로 다룬다 */
export interface City {
  id: string;
  nameKo: string;
  nameEn: string;
  countryId: string; // Country.id
  lon: number;
  lat: number;
}

/** 지도 위에 칠할 색 지정: 국가 id → 색 이름 */
export type Highlight = 'selected' | 'correct' | 'wrong';
export type HighlightMap = Record<string, Highlight>;
