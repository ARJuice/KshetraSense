import { OrbitControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import type { FieldMapSample } from './FieldMap2D';
import { createLocalProjection } from './fieldGeometry';
import type { FieldLayer } from './fieldDisplay';
import { buildFieldSurface, buildGeoJsonSurfaceGeometry } from './fieldSurface';
import type { FieldCellResult, FieldZoningResponse } from './fieldTypes';

export interface FieldScene3DProps {
  result: FieldZoningResponse;
  samples: readonly FieldMapSample[];
  layer: FieldLayer;
  range: readonly [number, number];
  membershipCluster: number;
  selectedCellId: string | null;
  selectedZoneId: number | null;
  fitTrigger: number;
  onCellSelect: (cell: FieldCellResult) => void;
  onCellHover: (cell: FieldCellResult | null) => void;
}

function boundaryOutline(boundary: FieldZoningResponse['field']['boundary'], project: ReturnType<typeof createLocalProjection>['project']) {
  const positions: number[] = [];
  for (const ring of boundary.coordinates) {
    for (let index = 0; index < ring.length - 1; index += 1) {
      const start = project(ring[index]);
      const end = project(ring[index + 1]);
      positions.push(start.x, 0.035, start.y, end.x, 0.035, end.y);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeBoundingSphere();
  return geometry;
}

function MarkerCloud({ points, color, shape }: {
  points: readonly [number, number, number][];
  color: string;
  shape: 'sample' | 'node';
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const marker = useMemo(() => new THREE.Object3D(), []);
  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    points.forEach(([x, y, z], index) => {
      marker.position.set(x, y, z);
      marker.updateMatrix();
      mesh.setMatrixAt(index, marker.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [marker, points]);
  return <instancedMesh ref={meshRef} args={[undefined, undefined, points.length]}>
    {shape === 'sample' ? <coneGeometry args={[0.15, 0.34, 8]} /> : <octahedronGeometry args={[0.15, 0]} />}
    <meshStandardMaterial color={color} roughness={0.6} />
  </instancedMesh>;
}

function Scene({ result, samples, layer, range, membershipCluster, selectedCellId, selectedZoneId, onCellSelect, onCellHover }: Omit<FieldScene3DProps, 'fitTrigger'>) {
  const [hoveredCellId, setHoveredCellId] = useState<string | null>(null);
  const projection = useMemo(() => createLocalProjection(result.field.boundary), [result.field.boundary]);
  const surface = useMemo(
    () => buildFieldSurface(result.cells, projection, layer, range, membershipCluster, selectedZoneId),
    [layer, membershipCluster, projection, range, result.cells, selectedZoneId],
  );
  const boundaryGeometry = useMemo(
    () => buildGeoJsonSurfaceGeometry(result.field.boundary, projection),
    [projection, result.field.boundary],
  );
  const outlineGeometry = useMemo(
    () => boundaryOutline(result.field.boundary, projection.project),
    [projection, result.field.boundary],
  );
  const samplePoints = useMemo<readonly [number, number, number][]>(() => samples.map((sample) => {
    const point = projection.project([sample.longitude, sample.latitude]);
    return [point.x, 0.34, point.y];
  }), [projection, samples]);
  const nodePoints = useMemo<readonly [number, number, number][]>(() => result.wsnNodes.slice(0, 24).map((node) => {
    const point = projection.project([node.positionWgs84.longitude, node.positionWgs84.latitude]);
    return [point.x, 0.37, point.y];
  }), [projection, result.wsnNodes]);
  const selectedCell = selectedCellId ? result.cells.find((cell) => cell.cellId === selectedCellId) ?? null : null;

  useEffect(() => () => surface.geometry.dispose(), [surface]);
  useEffect(() => () => boundaryGeometry.dispose(), [boundaryGeometry]);
  useEffect(() => () => outlineGeometry.dispose(), [outlineGeometry]);

  const cellForEvent = (event: { faceIndex?: number | null }) => {
    const triangle = event.faceIndex;
    const cellId = triangle == null ? undefined : surface.triangleCellIds[triangle];
    return cellId ? result.cells.find((cell) => cell.cellId === cellId) ?? null : null;
  };

  const projectPoint = (position: { longitude: number; latitude: number }) => {
    const point = projection.project([position.longitude, position.latitude]);
    return [point.x, point.y] as const;
  };

  const span = Math.max(
    projection.extent.maxX - projection.extent.minX,
    projection.extent.maxY - projection.extent.minY,
    10,
  );
  const [gatewayX, gatewayZ] = projectPoint(result.clusterHead.positionWgs84);

  return (
    <>
      <color attach="background" args={['#F2F4EE']} />
      <ambientLight intensity={0.82} />
      <directionalLight position={[span * 0.25, span * 0.75, span * 0.35]} intensity={1.05} />
      <mesh geometry={boundaryGeometry} position={[0, -0.045, 0]} receiveShadow>
        <meshStandardMaterial color="#DDE4D8" roughness={0.94} side={THREE.DoubleSide} />
      </mesh>
      <lineSegments geometry={outlineGeometry}>
        <lineBasicMaterial color="#315E4F" />
      </lineSegments>
      <mesh
        geometry={surface.geometry}
        onClick={(event) => {
          event.stopPropagation();
          const cell = cellForEvent(event);
          if (cell) onCellSelect(cell);
        }}
        onPointerMove={(event) => {
          const cell = cellForEvent(event);
          if (cell?.cellId === hoveredCellId) return;
          setHoveredCellId(cell?.cellId ?? null);
          onCellHover(cell);
        }}
        onPointerOut={() => {
          setHoveredCellId(null);
          onCellHover(null);
        }}
        receiveShadow
      >
        <meshStandardMaterial vertexColors roughness={0.82} metalness={0} side={THREE.DoubleSide} />
      </mesh>
      {samplePoints.length > 0 && <MarkerCloud points={samplePoints} color="#E5A343" shape="sample" />}
      {nodePoints.length > 0 && <MarkerCloud points={nodePoints} color="#4A9B76" shape="node" />}
      <group position={[gatewayX, 0.33, gatewayZ]}>
        <mesh position={[0, 0.46, 0]}>
          <octahedronGeometry args={[0.2, 0]} />
          <meshStandardMaterial color="#E1A33F" emissive="#684319" emissiveIntensity={0.34} />
        </mesh>
      </group>
      {selectedCell && (() => {
        const point = projectPoint(selectedCell.centerWgs84);
        return (
          <mesh position={[point[0], 0.48, point[1]]}>
            <torusGeometry args={[0.42, 0.055, 6, 20]} />
            <meshStandardMaterial color="#F1C36B" emissive="#8C5818" emissiveIntensity={0.35} />
          </mesh>
        );
      })()}
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        minDistance={span * 0.18}
        maxDistance={span * 8}
        maxPolarAngle={Math.PI * 0.49}
        target={[0, 0, 0]}
      />
    </>
  );
}

export function FieldScene3D(props: FieldScene3DProps) {
  const extent = props.result.field.boundingBoxUtm;
  const span = Math.max(extent.maxX - extent.minX, extent.maxY - extent.minY, 10);
  return (
    <Canvas
      key={props.fitTrigger}
      dpr={[1, 1.5]}
      frameloop="demand"
      camera={{ position: [span * 0.9, span * 1.45, span * 0.95], fov: 39, near: 0.1, far: span * 10 }}
      gl={{ antialias: true, powerPreference: 'low-power' }}
      aria-label="Interactive three-dimensional soil zoning field"
    >
      <Scene {...props} />
    </Canvas>
  );
}
