import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { geoArea, geoGraticule10, geoNaturalEarth1, geoPath, type GeoPath } from 'd3-geo';
import { pointer, select } from 'd3-selection';
import { zoom, zoomIdentity, type ZoomBehavior, type ZoomTransform } from 'd3-zoom';
import 'd3-transition'; // selection.transition() 을 활성화
import type { Feature, MultiPolygon, Polygon } from 'geojson';
import type { Country, HighlightMap } from '../types';

// SVG 내부 좌표계 크기. 실제 화면 크기는 CSS(width:100%)로 맞춘다.
const WIDTH = 960;
const HEIGHT = 500;

export interface MapMarker {
  id: string;
  lon: number;
  lat: number;
  label?: string;
  tone: 'city' | 'selected' | 'correct' | 'wrong';
}

export interface MapClick {
  country: Country | null; // 바다를 클릭하면 null
  lonLat: [number, number] | null; // 클릭한 지점의 경도/위도
  markerId: string | null; // 도시 점을 클릭했을 때
}

interface Props {
  countries: Country[];
  highlights: HighlightMap;
  markers: MapMarker[];
  /** 이 국가로 확대 이동 (null 이면 전체 보기) */
  focusCountryId?: string | null;
  onMapClick?: (click: MapClick) => void;
  /** 마우스를 올렸을 때 국가 이름 툴팁을 보여줄지 (게임 모드에서는 끔) */
  showTooltip?: boolean;
}

export default function WorldMap({
  countries,
  highlights,
  markers,
  focusCountryId = null,
  onMapClick,
  showTooltip = true,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const gRef = useRef<SVGGElement>(null);
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown>>();
  const [transform, setTransform] = useState<ZoomTransform>(zoomIdentity);
  const [hovered, setHovered] = useState<Country | null>(null);

  // 투영법: Natural Earth (교육용 세계지도에 흔히 쓰이는 왜곡 적은 도법)
  const { projection, path } = useMemo(() => {
    const projection = geoNaturalEarth1().fitSize([WIDTH, HEIGHT], { type: 'Sphere' });
    return { projection, path: geoPath(projection) };
  }, []);

  const byId = useMemo(() => new Map(countries.map((c) => [c.id, c])), [countries]);

  // 확대/이동(드래그, 휠, 핀치) 설정
  useEffect(() => {
    const svg = select(svgRef.current!);
    const z = zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 20])
      .translateExtent([
        [0, 0],
        [WIDTH, HEIGHT],
      ])
      .on('zoom', (e) => setTransform(e.transform));
    svg.call(z).on('dblclick.zoom', null);
    zoomRef.current = z;
    return () => {
      svg.on('.zoom', null);
    };
  }, []);

  // 선택된 국가로 부드럽게 확대
  useEffect(() => {
    const svg = svgRef.current;
    const z = zoomRef.current;
    if (!svg || !z) return;
    const target = focusCountryId ? byId.get(focusCountryId) : null;
    let next = zoomIdentity;
    if (target) {
      const [[x0, y0], [x1, y1]] = path.bounds(mainland(target));
      const k = Math.min(8, 0.8 / Math.max((x1 - x0) / WIDTH, (y1 - y0) / HEIGHT));
      next = zoomIdentity
        .translate(WIDTH / 2, HEIGHT / 2)
        .scale(k)
        .translate(-(x0 + x1) / 2, -(y0 + y1) / 2);
    }
    select(svg).transition().duration(750).call(z.transform, next);
  }, [focusCountryId, byId, path]);

  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!onMapClick || !gRef.current) return;
    // 클릭 좌표 → (줌 변환 역적용) → 투영 역변환 → 경도/위도
    const [x, y] = pointer(e.nativeEvent, gRef.current);
    const inv = projection.invert?.([x, y]) ?? null;
    const el = e.target as Element;
    const id = el.getAttribute('data-id');
    const markerId = el.closest('[data-marker-id]')?.getAttribute('data-marker-id') ?? null;
    onMapClick({ country: id ? byId.get(id) ?? null : null, lonLat: inv, markerId });
  };

  return (
    <div className="map-wrap">
      <svg
        ref={svgRef}
        className="world-map"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        onClick={handleClick}
        role="img"
        aria-label="세계지도"
      >
        <g ref={gRef} transform={transform.toString()}>
          <path className="sphere" d={path({ type: 'Sphere' }) ?? ''} />
          <path className="graticule" d={path(geoGraticule10()) ?? ''} />
          <CountryLayer
            countries={countries}
            path={path}
            highlights={highlights}
            onHover={showTooltip ? setHovered : undefined}
          />
          {markers.map((m) => {
            const p = projection([m.lon, m.lat]);
            if (!p) return null;
            const r = 5 / transform.k; // 확대해도 화면상 점 크기는 일정하게
            return (
              <g key={m.id} data-marker-id={m.id} className={`marker marker-${m.tone}`} transform={`translate(${p[0]},${p[1]})`}>
                <circle r={r} />
                {m.label && (
                  <text y={-r - 3} fontSize={12 / transform.k}>
                    {m.label}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>
      {showTooltip && hovered && <div className="map-tooltip">{hovered.nameKo}</div>}
      <div className="map-hint">드래그: 이동 · 휠/핀치: 확대</div>
    </div>
  );
}

/** 해외 영토가 있는 나라(프랑스 등)는 가장 큰 땅덩어리 기준으로 확대한다. */
function mainland(country: Country): Feature<Polygon | MultiPolygon> {
  const g = country.feature.geometry;
  if (g.type !== 'MultiPolygon') return country.feature;
  const polys = g.coordinates.map(
    (coordinates): Feature<Polygon> => ({ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates } }),
  );
  return polys.reduce((a, b) => (geoArea(b) > geoArea(a) ? b : a));
}

/**
 * 국가 다각형 레이어. 줌할 때마다 다시 그리지 않도록 memo 처리.
 * (확대는 부모 <g> 의 transform 으로만 처리된다)
 */
const CountryLayer = memo(function CountryLayer({
  countries,
  path,
  highlights,
  onHover,
}: {
  countries: Country[];
  path: GeoPath;
  highlights: HighlightMap;
  onHover?: (c: Country | null) => void;
}) {
  const ds = useMemo(() => countries.map((c) => path(c.feature) ?? ''), [countries, path]);
  return (
    <g className="countries" onMouseLeave={() => onHover?.(null)}>
      {countries.map((c, i) => (
        <path
          key={c.id}
          data-id={c.id}
          d={ds[i]}
          className={`country ${highlights[c.id] ?? ''}`}
          onMouseEnter={() => onHover?.(c)}
        />
      ))}
    </g>
  );
});
