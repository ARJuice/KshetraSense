import { OrbitControls, useGLTF } from '@react-three/drei';
import { Canvas, type ThreeEvent } from '@react-three/fiber';
import { Suspense, useLayoutEffect, useMemo, useRef, useState, useCallback, useEffect } from 'react';
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
  brushRadius?: number;
  onCellSelect: (cell: ZoningFieldCell) => void;
  onBrushCell: (cell: ZoningFieldCell) => void;
  onBrushEnd: () => void;
  onCellHover?: (cell: ZoningFieldCell | null) => void;
  fitTrigger?: number;
}

// 12 Normalized Kenney Nature Kit 3D GLBs per Decision 0003
const TREE_OAK_URL = new URL('../../../../assets/3d/external/kenney-nature-kit/kenney_tree_oak.glb', import.meta.url).href;
const TREE_PINE_URL = new URL('../../../../assets/3d/external/kenney-nature-kit/kenney_tree_pineSmallC.glb', import.meta.url).href;
const BUSH_DETAILED_URL = new URL('../../../../assets/3d/external/kenney-nature-kit/kenney_plant_bushDetailed.glb', import.meta.url).href;
const BUSH_SMALL_URL = new URL('../../../../assets/3d/external/kenney-nature-kit/kenney_plant_bushSmall.glb', import.meta.url).href;
const ROCK_A_URL = new URL('../../../../assets/3d/external/kenney-nature-kit/kenney_rock_smallA.glb', import.meta.url).href;
const ROCK_B_URL = new URL('../../../../assets/3d/external/kenney-nature-kit/kenney_rock_smallB.glb', import.meta.url).href;
const ROCK_C_URL = new URL('../../../../assets/3d/external/kenney-nature-kit/kenney_rock_smallC.glb', import.meta.url).href;
const GRASS_LARGE_URL = new URL('../../../../assets/3d/external/kenney-nature-kit/kenney_grass_large.glb', import.meta.url).href;
const GRASS_LEAFS_URL = new URL('../../../../assets/3d/external/kenney-nature-kit/kenney_grass_leafs.glb', import.meta.url).href;
const FLOWER_YELLOW_URL = new URL('../../../../assets/3d/external/kenney-nature-kit/kenney_flower_yellowA.glb', import.meta.url).href;
const FLOWER_PURPLE_URL = new URL('../../../../assets/3d/external/kenney-nature-kit/kenney_flower_purpleA.glb', import.meta.url).href;
const FENCE_URL = new URL('../../../../assets/3d/external/kenney-nature-kit/kenney_fence_simpleLow.glb', import.meta.url).href;

// Mineral soil color gradient (cool verdigris to rich fertile amber)
function mineralColor(value: number, range: readonly [number, number]): THREE.Color {
  const [min, max] = range;
  const norm = max > min ? Math.max(0, Math.min(1, (value - min) / (max - min))) : 0.5;
  // Deep evergreen-teal (204 deg) to warm fertile ochre (46 deg)
  const hue = (204 - norm * 158) / 360;
  const lightness = (38 + norm * 18) / 100;
  return new THREE.Color().setHSL(hue, 0.48, lightness);
}

function computeCellColor(
  cell: ZoningFieldCell,
  zones: Map<string, ZoningFieldZone>,
  selectedZoneId: string | null,
  range: readonly [number, number],
  isBrushHovered: boolean,
): THREE.Color {
  if (isBrushHovered) {
    // Warm terracotta/clay preview for brush footprint
    return new THREE.Color('#C86B49');
  }

  const zone = cell.zoneId ? zones.get(cell.zoneId) : undefined;
  const color = zone ? new THREE.Color(zone.color) : mineralColor(cell.value, range);

  // Soft dimming if a specific zone is selected
  if (selectedZoneId && cell.zoneId !== selectedZoneId) {
    color.lerp(new THREE.Color('#22362C'), 0.68);
  }

  // Fuzzy C-means membership opacity / softness
  if (zone && cell.membership != null) {
    color.lerp(new THREE.Color('#385547'), Math.max(0, 0.5 - cell.membership) * 0.5);
  }

  return color;
}

// Interactive Instanced Soil Grid
function SoilFieldGrid({
  cells,
  zones,
  featureRange,
  selectedCellId,
  selectedZoneId,
  mode,
  brushRadius = 1,
  onCellSelect,
  onBrushCell,
  onBrushEnd,
  onCellHover,
}: FieldScene3DProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const [hoveredCell, setHoveredCell] = useState<ZoningFieldCell | null>(null);
  const [isPointerDown, setIsPointerDown] = useState(false);
  const zoneById = useMemo(() => new Map(zones.map((z) => [z.id, z])), [zones]);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const maxRow = useMemo(() => Math.max(...cells.map((c) => c.row), 1), [cells]);
  const maxCol = useMemo(() => Math.max(...cells.map((c) => c.col), 1), [cells]);

  // Determine which cells are inside the active brush radius
  const brushAffectedIds = useMemo(() => {
    if (!hoveredCell || mode !== 'brush') return new Set<string>();
    const affected = new Set<string>();
    cells.forEach((cell) => {
      const dist = Math.hypot(cell.row - hoveredCell.row, cell.col - hoveredCell.col);
      if (dist <= brushRadius) {
        affected.add(cell.id);
      }
    });
    return affected;
  }, [cells, hoveredCell, mode, brushRadius]);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    cells.forEach((cell, idx) => {
      // Centered coordinate layout
      const x = cell.col - (maxCol + 1) / 2;
      const z = cell.row - (maxRow + 1) / 2;

      // Low-relief terrain elevation
      const norm = Math.max(
        0,
        Math.min(1, (cell.value - featureRange[0]) / (featureRange[1] - featureRange[0] || 1))
      );
      const baseHeight = 0.22 + norm * 0.48;

      const isSelected = cell.id === selectedCellId;
      const isHovered = hoveredCell?.id === cell.id;
      const isBrushNeighbor = brushAffectedIds.has(cell.id);

      // Lift on selection, hover, or brush footprint
      const lift = isSelected ? 0.24 : isHovered ? 0.16 : isBrushNeighbor ? 0.08 : 0;
      const totalY = (baseHeight + lift) / 2;

      dummy.position.set(x, totalY, z);
      // Slight gap between cells for cartographic block aesthetic
      dummy.scale.set(0.92, baseHeight + lift, 0.92);
      dummy.updateMatrix();

      mesh.setMatrixAt(idx, dummy.matrix);
      mesh.setColorAt(
        idx,
        computeCellColor(cell, zoneById, selectedZoneId, featureRange, isBrushNeighbor)
      );
    });

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
  }, [
    cells,
    dummy,
    featureRange,
    hoveredCell,
    brushAffectedIds,
    maxCol,
    maxRow,
    selectedCellId,
    selectedZoneId,
    zoneById,
  ]);

  const getCellFromEvent = useCallback(
    (e: ThreeEvent<PointerEvent>): ZoningFieldCell | null => {
      if (e.instanceId == null || e.instanceId >= cells.length) return null;
      return cells[e.instanceId] ?? null;
    },
    [cells]
  );

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setIsPointerDown(true);
    const cell = getCellFromEvent(e);
    if (!cell) return;

    if (mode === 'brush') {
      onBrushCell(cell);
    } else {
      onCellSelect(cell);
    }
  };

  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
    const cell = getCellFromEvent(e);
    if (!cell) return;

    if (hoveredCell?.id !== cell.id) {
      setHoveredCell(cell);
      onCellHover?.(cell);
    }

    if (isPointerDown && mode === 'brush' && e.buttons === 1) {
      onBrushCell(cell);
    }
  };

  const handlePointerUp = () => {
    if (isPointerDown) {
      setIsPointerDown(false);
      if (mode === 'brush') {
        onBrushEnd();
      }
    }
  };

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, cells.length]}
      castShadow
      receiveShadow
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={() => {
        setHoveredCell(null);
        onCellHover?.(null);
        if (isPointerDown) {
          setIsPointerDown(false);
          if (mode === 'brush') onBrushEnd();
        }
      }}
    >
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial roughness={0.65} metalness={0.04} />
    </instancedMesh>
  );
}

// Deterministic Natural Landscape Scenery around Field Perimeter
function PerimeterNature({ rows, columns }: { rows: number; columns: number }) {
  // Load 12 Kenney Nature Kit Models
  const treeOak = useGLTF(TREE_OAK_URL).scene;
  const treePine = useGLTF(TREE_PINE_URL).scene;
  const bushDetailed = useGLTF(BUSH_DETAILED_URL).scene;
  const bushSmall = useGLTF(BUSH_SMALL_URL).scene;
  const rockA = useGLTF(ROCK_A_URL).scene;
  const rockB = useGLTF(ROCK_B_URL).scene;
  const rockC = useGLTF(ROCK_C_URL).scene;
  const grassLarge = useGLTF(GRASS_LARGE_URL).scene;
  const grassLeafs = useGLTF(GRASS_LEAFS_URL).scene;
  const flowerYellow = useGLTF(FLOWER_YELLOW_URL).scene;
  const flowerPurple = useGLTF(FLOWER_PURPLE_URL).scene;
  const fence = useGLTF(FENCE_URL).scene;

  const halfX = columns / 2;
  const halfZ = rows / 2;

  // Deterministic scenery layout based on field dimensions
  const sceneryItems = useMemo(() => {
    const items: Array<{
      id: string;
      scene: THREE.Group;
      position: [number, number, number];
      rotation: [number, number, number];
      scale: number | [number, number, number];
    }> = [];

    // 1. Rustic North Fence Line along back border
    const fenceStep = 3.2;
    for (let x = -halfX - 0.5; x <= halfX + 0.5; x += fenceStep) {
      items.push({
        id: `fence-n-${x.toFixed(1)}`,
        scene: fence,
        position: [x, 0.01, -halfZ - 0.95],
        rotation: [0, 0, 0],
        scale: 0.95,
      });
    }

    // 2. West & East Flank Fences (partial boundary segments)
    [-halfX - 0.95, halfX + 0.95].forEach((x, sideIdx) => {
      const rotY = Math.PI / 2;
      [-halfZ + 1.5, 0, halfZ - 1.5].forEach((z, i) => {
        items.push({
          id: `fence-side-${sideIdx}-${i}`,
          scene: fence,
          position: [x, 0.01, z],
          rotation: [0, rotY, 0],
          scale: 0.95,
        });
      });
    });

    // 3. North Treeline Grove (Oaks & Small Pines beyond the back fence)
    const treeConfigs = [
      { x: -halfX - 2.8, z: -halfZ - 3.2, type: 'oak', s: 0.78, rot: 0.4 },
      { x: -halfX - 0.5, z: -halfZ - 3.8, type: 'pine', s: 0.85, rot: -0.8 },
      { x: -halfX * 0.6, z: -halfZ - 2.6, type: 'oak', s: 0.68, rot: 1.2 },
      { x: -halfX * 0.25, z: -halfZ - 4.1, type: 'pine', s: 0.92, rot: 0.1 },
      { x: 0.2, z: -halfZ - 3.2, type: 'oak', s: 0.82, rot: -1.5 },
      { x: halfX * 0.35, z: -halfZ - 3.9, type: 'pine', s: 0.88, rot: 2.1 },
      { x: halfX * 0.68, z: -halfZ - 2.8, type: 'oak', s: 0.72, rot: 0.9 },
      { x: halfX + 1.2, z: -halfZ - 3.6, type: 'pine', s: 0.84, rot: -0.4 },
      { x: halfX + 3.2, z: -halfZ - 2.4, type: 'oak', s: 0.75, rot: 1.6 },
      // Side accent trees
      { x: -halfX - 3.4, z: halfZ * 0.2, type: 'pine', s: 0.74, rot: 0.5 },
      { x: halfX + 3.5, z: -halfZ * 0.1, type: 'oak', s: 0.7, rot: -1.1 },
      { x: halfX + 3.2, z: halfZ * 0.7, type: 'pine', s: 0.65, rot: 1.8 },
    ];

    treeConfigs.forEach((t, i) => {
      items.push({
        id: `tree-${i}`,
        scene: t.type === 'oak' ? treeOak : treePine,
        position: [t.x, 0, t.z],
        rotation: [0, t.rot, 0],
        scale: t.s,
      });
    });

    // 4. Shrubbery & Bushes along fence lines and treeline
    const bushConfigs = [
      { x: -halfX - 1.8, z: -halfZ - 1.6, type: 'detailed', s: 0.62 },
      { x: -halfX + 1.2, z: -halfZ - 1.3, type: 'small', s: 0.55 },
      { x: -halfX * 0.45, z: -halfZ - 1.5, type: 'detailed', s: 0.58 },
      { x: halfX * 0.1, z: -halfZ - 1.4, type: 'small', s: 0.48 },
      { x: halfX * 0.55, z: -halfZ - 1.6, type: 'detailed', s: 0.65 },
      { x: halfX + 2.0, z: -halfZ - 1.4, type: 'small', s: 0.52 },
      // West flank bushes
      { x: -halfX - 1.5, z: -halfZ * 0.4, type: 'detailed', s: 0.54 },
      { x: -halfX - 1.6, z: halfZ * 0.5, type: 'small', s: 0.46 },
      // East flank bushes
      { x: halfX + 1.6, z: -halfZ * 0.3, type: 'small', s: 0.5 },
      { x: halfX + 1.5, z: halfZ * 0.4, type: 'detailed', s: 0.58 },
      // South boundary verge bushes
      { x: -halfX * 0.7, z: halfZ + 1.4, type: 'small', s: 0.52 },
      { x: halfX * 0.6, z: halfZ + 1.5, type: 'detailed', s: 0.56 },
    ];

    bushConfigs.forEach((b, i) => {
      items.push({
        id: `bush-${i}`,
        scene: b.type === 'detailed' ? bushDetailed : bushSmall,
        position: [b.x, 0, b.z],
        rotation: [0, (i * 1.3) % Math.PI, 0],
        scale: b.s,
      });
    });

    // 5. Rock Outcrops clustered in natural groups
    const rockConfigs = [
      { x: -halfX - 2.2, z: -halfZ - 0.8, type: 'a', s: 0.65 },
      { x: -halfX - 2.5, z: -halfZ - 0.5, type: 'b', s: 0.48 },
      { x: halfX + 2.2, z: -halfZ - 0.6, type: 'c', s: 0.58 },
      { x: halfX + 2.6, z: -halfZ - 0.9, type: 'a', s: 0.45 },
      { x: -halfX - 2.1, z: halfZ + 0.8, type: 'b', s: 0.55 },
      { x: halfX + 2.1, z: halfZ + 0.7, type: 'a', s: 0.52 },
      { x: 0.5, z: halfZ + 1.6, type: 'c', s: 0.44 },
    ];

    rockConfigs.forEach((r, i) => {
      const rockScene = r.type === 'a' ? rockA : r.type === 'b' ? rockB : rockC;
      items.push({
        id: `rock-${i}`,
        scene: rockScene,
        position: [r.x, 0, r.z],
        rotation: [0, (i * 0.9) % Math.PI, 0],
        scale: r.s,
      });
    });

    // 6. Meadow Grass Tufts and Wildflowers lining perimeter verges
    const grassAndFlowers = [
      // North edge
      { x: -halfX + 2.5, z: -halfZ - 0.55, type: 'grassL', s: 0.42 },
      { x: -halfX + 3.2, z: -halfZ - 0.65, type: 'yellow', s: 0.48 },
      { x: -halfX * 0.1, z: -halfZ - 0.6, type: 'grassS', s: 0.38 },
      { x: halfX * 0.25, z: -halfZ - 0.55, type: 'purple', s: 0.45 },
      { x: halfX * 0.8, z: -halfZ - 0.6, type: 'grassL', s: 0.4 },
      // South edge
      { x: -halfX * 0.85, z: halfZ + 0.65, type: 'grassL', s: 0.45 },
      { x: -halfX * 0.5, z: halfZ + 0.7, type: 'purple', s: 0.48 },
      { x: -halfX * 0.15, z: halfZ + 0.6, type: 'yellow', s: 0.46 },
      { x: halfX * 0.2, z: halfZ + 0.65, type: 'grassS', s: 0.4 },
      { x: halfX * 0.5, z: halfZ + 0.7, type: 'yellow', s: 0.5 },
      { x: halfX * 0.85, z: halfZ + 0.65, type: 'grassL', s: 0.42 },
      // West edge
      { x: -halfX - 0.6, z: -halfZ * 0.6, type: 'grassS', s: 0.38 },
      { x: -halfX - 0.65, z: 0.2, type: 'yellow', s: 0.44 },
      { x: -halfX - 0.55, z: halfZ * 0.7, type: 'grassL', s: 0.4 },
      // East edge
      { x: halfX + 0.6, z: -halfZ * 0.7, type: 'purple', s: 0.44 },
      { x: halfX + 0.65, z: 0.1, type: 'grassL', s: 0.42 },
      { x: halfX + 0.55, z: halfZ * 0.6, type: 'grassS', s: 0.38 },
    ];

    grassAndFlowers.forEach((g, i) => {
      let gScene = grassLarge;
      if (g.type === 'grassS') gScene = grassLeafs;
      else if (g.type === 'yellow') gScene = flowerYellow;
      else if (g.type === 'purple') gScene = flowerPurple;

      items.push({
        id: `foliage-${i}`,
        scene: gScene,
        position: [g.x, 0, g.z],
        rotation: [0, (i * 1.7) % Math.PI, 0],
        scale: g.s,
      });
    });

    return items;
  }, [
    columns,
    rows,
    halfX,
    halfZ,
    fence,
    treeOak,
    treePine,
    bushDetailed,
    bushSmall,
    rockA,
    rockB,
    rockC,
    grassLarge,
    grassLeafs,
    flowerYellow,
    flowerPurple,
  ]);

  return (
    <group name="PerimeterNature">
      {sceneryItems.map((item) => (
        <primitive
          key={item.id}
          object={item.scene.clone(true)}
          position={item.position}
          rotation={item.rotation}
          scale={item.scale}
        />
      ))}
    </group>
  );
}

// Main 3D Agricultural Scene
function Scene(props: FieldScene3DProps) {
  const rows = Math.max(...props.cells.map((c) => c.row), 1);
  const columns = Math.max(...props.cells.map((c) => c.col), 1);
  const controlsRef = useRef<any>(null);

  // Smoothly reset camera to default 2.5D isometric vantage point on trigger
  useEffect(() => {
    if (props.fitTrigger && controlsRef.current) {
      controlsRef.current.reset();
    }
  }, [props.fitTrigger]);

  return (
    <>
      {/* Editorial Agricultural Atmosphere */}
      <color attach="background" args={['#101C16']} />
      <fog attach="fog" args={['#101C16', 22, 54]} />

      {/* Daylight & Ambient Lighting */}
      <hemisphereLight args={['#E8F2E6', '#1E3327', 1.8]} />
      <directionalLight
        position={[14, 22, 10]}
        intensity={2.4}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-far={60}
        shadow-camera-left={-16}
        shadow-camera-right={16}
        shadow-camera-top={14}
        shadow-camera-bottom={-14}
      />
      <directionalLight position={[-10, 12, -8]} intensity={0.6} color="#7CA289" />

      {/* Surrounding Farm Ground Terrain Plane */}
      <mesh rotation-x={-Math.PI / 2} receiveShadow position={[0, -0.015, 0]}>
        <planeGeometry args={[columns + 16, rows + 16]} />
        <meshStandardMaterial color="#17271F" roughness={0.92} metalness={0.02} />
      </mesh>

      {/* Subtle Boundary Field Bed */}
      <mesh rotation-x={-Math.PI / 2} receiveShadow position={[0, 0.005, 0]}>
        <planeGeometry args={[columns + 0.6, rows + 0.6]} />
        <meshStandardMaterial color="#1B2E24" roughness={0.85} />
      </mesh>

      {/* 216 Instanced Soil Pedestals */}
      <SoilFieldGrid {...props} />

      {/* Deterministic Perimeter Scenery with 12 Kenney Models */}
      <Suspense fallback={null}>
        <PerimeterNature rows={rows} columns={columns} />
      </Suspense>

      {/* Smooth Orbit Controls calibrated for 2.5D field perspective */}
      <OrbitControls
        ref={controlsRef}
        makeDefault
        enabled={props.mode === 'inspect'}
        enableDamping
        dampingFactor={0.07}
        minDistance={8}
        maxDistance={38}
        maxPolarAngle={Math.PI / 2.16}
        minPolarAngle={Math.PI / 5.8}
        target={[0, 0.2, 0]}
      />
    </>
  );
}

/**
 * FieldScene3D
 * 
 * High-performance, realistic 3D agricultural field renderer.
 * Features 216 low-relief soil pedestals surrounded by a natural deterministic
 * perimeter of trees, rocks, bushes, fences, and wildflowers from the Kenney Nature Kit.
 */
export function FieldScene3D(props: FieldScene3DProps) {
  const hasWebGl =
    typeof window !== 'undefined' &&
    Boolean(
      document.createElement('canvas').getContext('webgl2') ||
        document.createElement('canvas').getContext('webgl')
    );

  if (!hasWebGl) {
    return (
      <div className="flex items-center justify-center h-full p-8 text-center text-sage-400 bg-evergreen-950">
        WebGL is not available in this environment. Falling back to the 2.5D Atlas Map.
      </div>
    );
  }

  return (
    <div
      className={`relative w-full h-full select-none ${
        props.mode === 'brush' ? 'cursor-field-brush' : 'cursor-field-reticle'
      }`}
      aria-label="Interactive 3D soil field. Drag to orbit, right-drag to pan, scroll to zoom; switch to brush mode to paint soil values."
    >
      <Canvas
        shadows
        dpr={[1, 1.75]}
        camera={{ position: [13, 16, 17], fov: 40 }}
        onPointerMissed={() => props.onBrushEnd()}
      >
        <Scene {...props} />
      </Canvas>
    </div>
  );
}
