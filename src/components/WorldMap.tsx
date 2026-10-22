import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { geoArea, geoGraticule10, geoEqualEarth, geoPath, type GeoPath } from 'd3-geo';
import { pointer, select } from 'd3-selection';
import { zoom, zoomIdentity, type ZoomBehavior, type ZoomTransform } from 'd3-zoom';
import 'd3-transition'; // selection.transition() 을 활성화
import type { Feature, MultiPolygon, Polygon } from 'geojson';
import type { Country, HighlightMap } from '../types';

// SVG 내부 좌표계 크기. 실제 화면 크기는 CSS(width:100%)로 맞춘다.
// 이퀄 어스(Equal Earth) 도법: 나라 면적 비율이 실제와 같아 왜곡이 적다.
// 지구 모양 자체는 양옆이 둥글기 때문에, 바깥 모서리를 바다색으로 채워 네모난 지도로 보여준다.
const WIDTH = 960;

function makeProjection() {
  const projection = geoEqualEarth().fitWidth(WIDTH, { type: 'Sphere' });
  const [[, y0], [, y1]] = geoPath(projection).bounds({ type: 'Sphere' });
  return { projection, height: Math.ceil(y1 - y0) };
}

const { height: HEIGHT } = makeProjection();
const MAX_FOCUS_ZOOM = 8;
// 기본값을 매번 새로 만들지 않도록 (memo 된 레이어가 불필요하게 다시 그려지는 것 방지)
const NO_HIGHLIGHTS: HighlightMap = {};
const NO_FILLS: Record<string, string> = {};
const NO_MARKERS: MapMarker[] = [];

export interface MapMarker {
  id: string;
  lon: number;
  lat: number;
  label?: string; // 지도에 항상 보이는 이름
  name?: string; // 마우스를 올렸을 때 툴팁 이름
  tone: 'city' | 'selected' | 'correct' | 'wrong';
  color?: string; // tone 색 대신 쓸 색
}

export interface MapClick {
  country: Country | null; // 바다를 클릭하면 null
  lonLat: [number, number] | null; // 클릭한 지점의 경도/위도
  markerId: string | null; // 도시 점을 클릭했을 때
}

/**
 * 확대 요청. 새 객체를 넘길 때마다 지도가 해당 영역에 맞춰 이동한다.
 * countryIds 와 points 가 모두 비어 있으면 전체 지도로 돌아간다.
 */
export interface MapFocus {
  countryIds: string[];
  points: [number, number][]; // [경도, 위도]
}

interface Props {
  countries: Country[];
  highlights?: HighlightMap;
  /** 국가별 채우기 색 (여러 나라를 서로 다른 색으로 칠할 때) */
  fillColors?: Record<string, string>;
  markers?: MapMarker[];
  focus?: MapFocus | null;
  onMapClick?: (click: MapClick) => void;
  /** 마우스를 올렸을 때 이름 툴팁을 보여줄지 (게임 모드에서는 끔) */
  showTooltip?: boolean;
  /** 도시 점 크기 배율 (도시 지도에서는 크게) */
  markerScale?: number;
}

export default function WorldMap({
  countries,
  highlights = NO_HIGHLIGHTS,
  fillColors = NO_FILLS,
  markers = NO_MARKERS,
  focus = null,
  onMapClick,
  showTooltip = true,
  markerScale = 1,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const gRef = useRef<SVGGElement>(null);
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown>>();
  const [transform, setTransform] = useState<ZoomTransform>(zoomIdentity);
  const [hovered, setHovered] = useState<string | null>(null);

  // 투영법: 이퀄 어스 (면적 비율이 정확한 도법)
  const { projection, path } = useMemo(() => {
    const { projection } = makeProjection();
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

  // 확대 요청이 오면 선택한 곳이 모두 보이도록 이동
  useEffect(() => {
    const svg = svgRef.current;
    const z = zoomRef.current;
    if (!svg || !z || !focus) return;

    let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
    const include = (ax: number, ay: number, bx: number, by: number) => {
      x0 = Math.min(x0, ax);
      y0 = Math.min(y0, ay);
      x1 = Math.max(x1, bx);
      y1 = Math.max(y1, by);
    };
    for (const id of focus.countryIds) {
      const c = byId.get(id);
      if (!c) continue;
      const [[ax, ay], [bx, by]] = path.bounds(mainland(c));
      include(ax, ay, bx, by);
    }
    for (const p of focus.points) {
      const q = projection(p);
      if (q) include(q[0], q[1], q[0], q[1]);
    }

    let next = zoomIdentity;
    if (Number.isFinite(x0)) {
      // 도시 하나만 선택하면 영역 크기가 0 이므로 최소 크기를 둔다
      const w = Math.max(x1 - x0, 40);
      const h = Math.max(y1 - y0, 25);
      const k = Math.max(1, Math.min(MAX_FOCUS_ZOOM, 0.8 / Math.max(w / WIDTH, h / HEIGHT)));
      next = zoomIdentity
        .translate(WIDTH / 2, HEIGHT / 2)
        .scale(k)
        .translate(-(x0 + x1) / 2, -(y0 + y1) / 2);
    }
    select(svg).transition().duration(750).call(z.transform, next);
  }, [focus, byId, path, projection]);

  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!onMapClick || !gRef.current) return;
    // 클릭 좌표 → (줌 변환 역적용) → 투영 역변환 → 경도/위도
    const [x, y] = pointer(e.nativeEvent, gRef.current);
    const raw = projection.invert?.([x, y]) ?? null;
    // 지구 바깥(네모 모서리 부분)을 클릭하면 위치 없음으로 처리:
    // 거꾸로 계산한 경위도를 다시 지도 좌표로 바꿨을 때 클릭 위치와 다르면 지구 바깥이다.
    const back = raw ? projection(raw) : null;
    const onGlobe = !!back && Math.hypot(back[0] - x, back[1] - y) < 1;
    const inv = onGlobe ? raw : null;
    const el = e.target as Element;
    const id = el.getAttribute('data-id');
    const markerId = el.closest('[data-marker-id]')?.getAttribute('data-marker-id') ?? null;
    onMapClick({ country: id ? byId.get(id) ?? null : null, lonLat: inv, markerId });
  };

  const onCountryHover = useMemo(
    () => (showTooltip ? (c: Country | null) => setHovered(c?.nameKo ?? null) : undefined),
    [showTooltip],
  );

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
          {/* 네모난 바다 배경 (지구 바깥 모서리까지 바다색) */}
          <rect className="ocean" x={0} y={0} width={WIDTH} height={HEIGHT} />
          <path className="graticule" d={path(geoGraticule10()) ?? ''} />
          <CountryLayer
            countries={countries}
            path={path}
            highlights={highlights}
            fillColors={fillColors}
            onHover={onCountryHover}
          />
          {markers.map((m) => {
            const p = projection([m.lon, m.lat]);
            if (!p) return null;
            const r = (5 * markerScale) / transform.k; // 확대해도 화면상 점 크기는 일정하게
            return (
              <g
                key={m.id}
                data-marker-id={m.id}
                className={`marker marker-${m.tone}`}
                transform={`translate(${p[0]},${p[1]})`}
                onMouseEnter={() => showTooltip && setHovered(m.name ?? m.label ?? null)}
                onMouseLeave={() => showTooltip && setHovered(null)}
              >
                {/* 작은 점도 쉽게 클릭되도록 보이지 않는 넓은 영역 */}
                <circle className="hit" r={r * 2.2} />
                <circle r={r} style={m.color ? { fill: m.color } : undefined} />
                {m.label && (
                  <text y={-r - 3 / transform.k} fontSize={12 / transform.k}>
                    {m.label}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>
      {showTooltip && hovered && <div className="map-tooltip">{hovered}</div>}
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
  fillColors,
  onHover,
}: {
  countries: Country[];
  path: GeoPath;
  highlights: HighlightMap;
  fillColors: Record<string, string>;
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
          className={`country ${highlights[c.id] ?? ''} ${fillColors[c.id] ? 'filled' : ''}`}
          style={fillColors[c.id] ? { fill: fillColors[c.id] } : undefined}
          onMouseEnter={() => onHover?.(c)}
        />
      ))}
    </g>
  );
});
