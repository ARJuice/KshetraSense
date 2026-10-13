export type Position = readonly [longitude: number, latitude: number];
export interface GeoJsonPolygon {
  type: 'Polygon';
  coordinates: Position[][];
  crs?: 'EPSG:4326' | 'OGC:CRS84';
}
export type GeoJsonGeometry = GeoJsonPolygon | { type: 'MultiPolygon'; coordinates: Position[][][] };

export function estimateGeometryTriangleCount(geometry: GeoJsonGeometry): number {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  return polygons.reduce((total, rings) => {
    const vertices = rings.reduce((count, ring) => count + Math.max(0, ring.length - 1), 0);
    const holes = Math.max(0, rings.length - 1);
    // Hole bridging adds two vertices per hole; each triangulated polygon then has n - 2 faces.
    return total + Math.max(0, vertices + 2 * holes - 2);
  }, 0);
}

export interface LocalPoint {
  x: number;
  y: number;
}

export interface FieldProjection {
  extent: { minX: number; minY: number; maxX: number; maxY: number };
  project: (position: Position) => LocalPoint;
  unproject: (point: LocalPoint) => Position;
}

export function parseFieldBoundary(input: unknown): GeoJsonPolygon {
  if (!input || typeof input !== 'object') throw new Error('Choose a GeoJSON Polygon or Polygon Feature.');
  const candidate = input as { type?: unknown; geometry?: unknown; coordinates?: unknown; crs?: unknown };
  const geometry = candidate.type === 'Feature' ? candidate.geometry : candidate;
  if (!geometry || typeof geometry !== 'object' || (geometry as { type?: unknown }).type !== 'Polygon') {
    throw new Error('Only GeoJSON Polygon geometry is supported.');
  }
  const polygon = geometry as { type: 'Polygon'; coordinates?: unknown; crs?: unknown };
  const crs = polygon.crs ?? candidate.crs;
  if (crs !== undefined && crs !== 'EPSG:4326' && crs !== 'OGC:CRS84') {
    throw new Error('Boundary coordinates must use WGS84 (EPSG:4326 or OGC:CRS84).');
  }
  if (!Array.isArray(polygon.coordinates) || polygon.coordinates.length === 0) {
    throw new Error('The Polygon must contain an outer ring.');
  }
  const coordinates = polygon.coordinates.map((rawRing) => {
    if (!Array.isArray(rawRing) || rawRing.length < 4) throw new Error('Each boundary ring needs at least four coordinates including closure.');
    const ring = rawRing.map((rawPosition) => {
      if (!Array.isArray(rawPosition) || rawPosition.length !== 2) throw new Error('Boundary coordinates must be [longitude, latitude] pairs.');
      const [longitude, latitude] = rawPosition;
      if (typeof longitude !== 'number' || typeof latitude !== 'number' || !Number.isFinite(longitude) || !Number.isFinite(latitude)) {
        throw new Error('Boundary coordinates must be finite numbers.');
      }
      if (longitude < -180 || longitude > 180 || latitude < -80 || latitude > 84) {
        throw new Error('Boundary coordinates must be within the WGS84 UTM-supported range.');
      }
      return [longitude, latitude] as Position;
    });
    const first = ring[0];
    const last = ring[ring.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) throw new Error('Each GeoJSON boundary ring must be closed.');
    if (new Set(ring.slice(0, -1).map(([longitude, latitude]) => `${longitude}:${latitude}`)).size < 3) {
      throw new Error('Each boundary ring needs at least three distinct vertices.');
    }
    return ring;
  });
  return { type: 'Polygon', coordinates, ...(crs ? { crs: crs as GeoJsonPolygon['crs'] } : {}) };
}

type PointLocation = 'outside' | 'inside' | 'boundary';

function locateInRing(point: Position, ring: Position[]): PointLocation {
  let inside = false;
  const [x, y] = point;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index, index += 1) {
    const [x1, y1] = ring[previous];
    const [x2, y2] = ring[index];
    const cross = (x - x1) * (y2 - y1) - (y - y1) * (x2 - x1);
    if (Math.abs(cross) < 1e-12 && x >= Math.min(x1, x2) && x <= Math.max(x1, x2) && y >= Math.min(y1, y2) && y <= Math.max(y1, y2)) {
      return 'boundary';
    }
    if ((y1 > y) !== (y2 > y) && x < ((x2 - x1) * (y - y1)) / (y2 - y1) + x1) inside = !inside;
  }
  return inside ? 'inside' : 'outside';
}

export function isPointInsideFieldBoundary(point: Position, boundary: GeoJsonPolygon): boolean {
  const outer = locateInRing(point, boundary.coordinates[0]);
  if (outer === 'outside') return false;
  for (const hole of boundary.coordinates.slice(1)) {
    if (locateInRing(point, hole) === 'inside') return false;
  }
  return true;
}

export function createLocalProjection(boundary: GeoJsonPolygon): FieldProjection {
  const points = boundary.coordinates.flat();
  const minLongitude = Math.min(...points.map(([longitude]) => longitude));
  const maxLongitude = Math.max(...points.map(([longitude]) => longitude));
  const minLatitude = Math.min(...points.map(([, latitude]) => latitude));
  const maxLatitude = Math.max(...points.map(([, latitude]) => latitude));
  const centerLongitude = (minLongitude + maxLongitude) / 2;
  const centerLatitude = (minLatitude + maxLatitude) / 2;
  const metersPerLongitudeDegree = 111_320 * Math.cos((centerLatitude * Math.PI) / 180);
  const metersPerLatitudeDegree = 110_574;
  const project = ([longitude, latitude]: Position): LocalPoint => ({
    x: (longitude - centerLongitude) * metersPerLongitudeDegree,
    y: (centerLatitude - latitude) * metersPerLatitudeDegree,
  });
  const projected = points.map(project);
  return {
    extent: {
      minX: Math.min(...projected.map(({ x }) => x)),
      minY: Math.min(...projected.map(({ y }) => y)),
      maxX: Math.max(...projected.map(({ x }) => x)),
      maxY: Math.max(...projected.map(({ y }) => y)),
    },
    project,
    unproject: ({ x, y }) => [x / metersPerLongitudeDegree + centerLongitude, centerLatitude - y / metersPerLatitudeDegree],
  };
}
