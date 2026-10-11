import { OrbitControls, useGLTF } from '@react-three/drei';
import { Canvas, type ThreeEvent } from '@react-three/fiber';
import { Suspense, useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import type { ZoningFieldCell, ZoningFieldZone } from './ZoningFieldCanvas';

export type FieldInteractionMode = 'inspect' | 'brush';

export interface FieldScene3DProps {
  cells: readonly ZoningFieldCell[];
  zones: readonly ZoningFieldZone[];
  featureRange: readonly [number, number];
  selectedCellId: string | null;
  selectedZoneId: string | null;
  mode: FieldInteractionMode;
  onCellSelect: (cell: ZoningFieldCell) => void;
  onBrushCell: (cell: ZoningFieldCell) => void;
  onBrushEnd: () => void;
}

const TREE_URL = new URL('../../../../assets/3d/external/kenney-nature-kit/kenney_tree_oak.glb', import.meta.url).href;
const GRASS_URL = new URL('../../../../assets/3d/external/kenney-nature-kit/kenney_grass_large.glb', import.meta.url).href;
const FENCE_URL = new URL('../../../../assets/3d/external/kenney-nature-kit/kenney_fence_simpleLow.glb', import.meta.url).href;

function colourFor(value: number, range: readonly [number, number]): THREE.Color {
  const [minimum, maximum] = range;
  const amount = maximum > minimum ? Math.max(0, Math.min(1, (value - minimum) / (maximum - minimum))) : 0.5;
  return new THREE.Color().setHSL((204 - amount * 158) / 360, 0.47, (42 + amount * 11) / 100);
}

function displayColour(cell: ZoningFieldCell, zones: Map<string, ZoningFieldZone>, selectedZoneId: string | null, range: readonly [number, number]) {
  const zone = cell.zoneId ? zones.get(cell.zoneId) : undefined;
  const result = zone ? new THREE.Color(zone.color) : colourFor(cell.value, range);
  if (selectedZoneId && cell.zoneId !== selectedZoneId) result.lerp(new THREE.Color('#d7dfd6'), 0.68);
  if (zone && cell.membership != null) result.lerp(new THREE.Color('#ffffff'), Math.max(0, 0.56 - cell.membership) * 0.45);
  return result;
}

function SoilBlocks({ cells, zones, featureRange, selectedCellId, selectedZoneId, mode, onCellSelect, onBrushCell, onBrushEnd }: FieldScene3DProps) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const zoneById = useMemo(() => new Map(zones.map((zone) => [zone.id, zone])), [zones]);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const maxRow = Math.max(...cells.map((cell) => cell.row), 1);
  const maxCol = Math.max(...cells.map((cell) => cell.col), 1);

  useLayoutEffect(() => {
    if (!mesh.current) return;
    cells.forEach((cell, index) => {
      const x = cell.col - (maxCol + 1) / 2;
      const z = cell.row - (maxRow + 1) / 2;
      const normalized = Math.max(0, Math.min(1, (cell.value - featureRange[0]) / (featureRange[1] - featureRange[0] || 1)));
      const height = 0.16 + normalized * 0.55;
      const lift = cell.id === selectedCellId || cell.id === hoveredId ? 0.13 : 0;
      dummy.position.set(x, height / 2 + lift, z);
      dummy.scale.set(0.94, height, 0.94);
      dummy.updateMatrix();
      mesh.current?.setMatrixAt(index, dummy.matrix);
      mesh.current?.setColorAt(index, displayColour(cell, zoneById, selectedZoneId, featureRange));
    });
    mesh.current.instanceMatrix.needsUpdate = true;
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true;
  }, [cells, dummy, featureRange, hoveredId, maxCol, maxRow, selectedCellId, selectedZoneId, zoneById]);

  const resolve = (event: ThreeEvent<PointerEvent>) => event.instanceId == null ? null : cells[event.instanceId] ?? null;
  const paint = (event: ThreeEvent<PointerEvent>) => {
    const cell = resolve(event);
    if (cell && mode === 'brush' && event.buttons === 1) onBrushCell(cell);
  };

  return <instancedMesh
    ref={mesh}
    args={[undefined, undefined, cells.length]}
    castShadow
    receiveShadow
    onPointerDown={(event) => {
      event.stopPropagation();
      const cell = resolve(event);
      if (!cell) return;
      if (mode === 'brush') onBrushCell(cell);
      else onCellSelect(cell);
    }}
    onPointerMove={(event) => {
      const cell = resolve(event);
      setHoveredId(cell?.id ?? null);
      paint(event);
    }}
    onPointerUp={onBrushEnd}
  >
    <boxGeometry args={[1, 1, 1]} />
    <meshStandardMaterial roughness={0.72} metalness={0.02} />
  </instancedMesh>;
}

function Decorations({ rows, columns }: { rows: number; columns: number }) {
  const tree = useGLTF(TREE_URL).scene;
  const grass = useGLTF(GRASS_URL).scene;
  const fence = useGLTF(FENCE_URL).scene;
  const edgeX = columns / 2 + 1.25;
  const edgeZ = rows / 2 + 1.25;
  return <group>
    <primitive object={tree.clone(true)} position={[-edgeX, 0, -edgeZ]} scale={0.72} rotation={[0, 0.65, 0]} />
    <primitive object={tree.clone(true)} position={[edgeX, 0, edgeZ - 1]} scale={0.52} rotation={[0, -1.1, 0]} />
    <primitive object={grass.clone(true)} position={[edgeX - 0.7, 0, -edgeZ]} scale={0.45} />
    <primitive object={fence.clone(true)} position={[0, 0.02, edgeZ + 0.2]} scale={1.05} rotation={[0, Math.PI / 2, 0]} />
  </group>;
}

function Scene(props: FieldScene3DProps) {
  const rows = Math.max(...props.cells.map((cell) => cell.row), 1);
  const columns = Math.max(...props.cells.map((cell) => cell.col), 1);
  return <>
    <color attach="background" args={['#edf3e9']} />
    <hemisphereLight args={['#f8fff6', '#405847', 1.6]} />
    <directionalLight position={[8, 14, 5]} intensity={2.1} castShadow />
    <mesh rotation-x={-Math.PI / 2} receiveShadow position={[0, -0.025, 0]}>
      <planeGeometry args={[columns + 5, rows + 5]} />
      <meshStandardMaterial color="#cad9c8" roughness={1} />
    </mesh>
    <SoilBlocks {...props} />
    <Suspense fallback={null}><Decorations rows={rows} columns={columns} /></Suspense>
    <OrbitControls
      makeDefault
      enabled={props.mode === 'inspect'}
      enableDamping
      dampingFactor={0.08}
      minDistance={7}
      maxDistance={32}
      maxPolarAngle={Math.PI / 2.18}
      minPolarAngle={Math.PI / 5.5}
      target={[0, 0, 0]}
    />
  </>;
}

/** Lightweight WebGL primary view. SVG remains available as an accessibility and no-WebGL fallback. */
export function FieldScene3D(props: FieldScene3DProps) {
  const hasWebGl = typeof window !== 'undefined' && Boolean(document.createElement('canvas').getContext('webgl2') || document.createElement('canvas').getContext('webgl'));
  if (!hasWebGl) return null;
  return <div className="field-scene-3d" aria-label="Interactive 3D soil field. Drag to orbit, right-drag to pan, scroll to zoom; switch to brush mode to paint a soil value.">
    <Canvas shadows dpr={[1, 1.5]} camera={{ position: [12, 15, 16], fov: 42 }} onPointerMissed={() => props.onBrushEnd()}>
      <Scene {...props} />
    </Canvas>
  </div>;
}
