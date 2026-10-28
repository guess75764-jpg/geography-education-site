// 나라 면적·본토 계산은 무거워서(50m 지도) 나라마다 한 번만 계산해 둔다.
import { geoArea } from 'd3-geo';
import type { Feature, MultiPolygon, Polygon } from 'geojson';
import type { Country } from '../types';

const areas = new WeakMap<object, number>();
const mainlands = new WeakMap<object, Feature<Polygon | MultiPolygon>>();

/** 나라 면적 (스테라디안) */
export function areaOf(c: Country): number {
  let a = areas.get(c.feature);
  if (a === undefined) {
    a = geoArea(c.feature);
    areas.set(c.feature, a);
  }
  return a;
}

/** 해외 영토가 있는 나라(프랑스 등)는 가장 큰 땅덩어리 */
export function mainlandOf(c: Country): Feature<Polygon | MultiPolygon> {
  let m = mainlands.get(c.feature);
  if (!m) {
    const g = c.feature.geometry;
    if (g.type !== 'MultiPolygon') m = c.feature;
    else {
      let best = -1;
      for (const coordinates of g.coordinates) {
        const f: Feature<Polygon> = { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates } };
        const a = geoArea(f);
        if (a > best) [best, m] = [a, f];
      }
    }
    mainlands.set(c.feature, m!);
  }
  return m!;
}

/** 페이지가 한가할 때 조금씩 미리 계산해 둔다 (게임 시작 순간 멈춤 방지) */
export function warmGeoCache(countries: Country[]) {
  const idle: (cb: () => void) => void =
    'requestIdleCallback' in window ? (cb) => window.requestIdleCallback(cb, { timeout: 2000 }) : (cb) => setTimeout(cb, 50);
  let i = 0;
  const step = () => {
    const end = Math.min(countries.length, i + 15);
    for (; i < end; i++) {
      areaOf(countries[i]);
      mainlandOf(countries[i]);
    }
    if (i < countries.length) idle(step);
  };
  idle(step);
}
