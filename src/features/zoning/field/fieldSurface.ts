import * as THREE from 'three';
import type { FieldProjection, GeoJsonGeometry, Position } from './fieldGeometry';
import { getFieldCellColor, getFieldLayerValue, type FieldLayer } from './fieldDisplay';
import type { FieldCellResult } from './fieldTypes';

export interface FieldSurface {
  geometry: THREE.BufferGeometry;
  triangleCellIds: string[];
}

function polygons(geometry: GeoJsonGeometry): Position[][][] {
  return geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
}

export function buildFieldSurface(
  cells: readonly FieldCellResult[],
  projection: FieldProjection,
  layer: FieldLayer,
  range: readonly [number, number],
  membershipCluster: number,
  selectedZoneId: number | null,
): FieldSurface {
  const positions: number[] = [];
  const colors: number[] = [];
  const triangleCellIds: string[] = [];
  const background = new THREE.Color('#EEF1E9');

  for (const cell of cells) {
    const value = getFieldLayerValue(cell, layer, membershipCluster);
    const normalized = value === null || range[1] <= range[0] ? 0.5 : Math.max(0, Math.min(1, (value - range[0]) / (range[1] - range[0])));
    const height = layer === 'zone' ? 0.35 : 0.12 + normalized * 0.34;
    const color = new THREE.Color(getFieldCellColor(cell, layer, range, membershipCluster));
    if (selectedZoneId !== null && selectedZoneId !== cell.zoneId) color.lerp(background, 0.76);

    for (const polygon of polygons(cell.geometry)) {
      const rings = polygon.map((ring) => {
        const points = ring.slice(0, -1).map(([longitude, latitude]) => {
          const local = projection.project([longitude, latitude]);
          return new THREE.Vector2(local.x, local.y);
        });
        return points;
      });
      const contour = rings[0];
      const holes = rings.slice(1);
      if (!contour || contour.length < 3) continue;
      const vertices = [...contour, ...holes.flat()];
      for (const triangle of THREE.ShapeUtils.triangulateShape(contour, holes)) {
        for (const vertexIndex of triangle) {
          const point = vertices[vertexIndex];
          positions.push(point.x, height, point.y);
          colors.push(color.r, color.g, color.b);
        }
        triangleCellIds.push(cell.cellId);
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return { geometry, triangleCellIds };
}

export function buildGeoJsonSurfaceGeometry(
  geometry: GeoJsonGeometry,
  projection: FieldProjection,
  y = 0,
): THREE.BufferGeometry {
  const positions: number[] = [];
  for (const polygon of polygons(geometry)) {
    const rings = polygon.map((ring) => ring.slice(0, -1).map(([longitude, latitude]) => {
      const local = projection.project([longitude, latitude]);
      return new THREE.Vector2(local.x, local.y);
    }));
    const contour = rings[0];
    const holes = rings.slice(1);
    if (!contour || contour.length < 3) continue;
    const vertices = [...contour, ...holes.flat()];
    for (const triangle of THREE.ShapeUtils.triangulateShape(contour, holes)) {
      for (const vertexIndex of triangle) {
        const point = vertices[vertexIndex];
        positions.push(point.x, y, point.y);
      }
    }
  }
  const result = new THREE.BufferGeometry();
  result.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  result.computeVertexNormals();
  result.computeBoundingSphere();
  return result;
}
