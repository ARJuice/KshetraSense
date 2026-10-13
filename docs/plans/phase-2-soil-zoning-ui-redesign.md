# Phase 2: Soil Zoning UI Redesign

**Scope:** `src/features/zoning/` — React / TypeScript frontend & 3D WebGL Canvas  
**Depends on:** Completed Phase 1 backend at `POST /v2/zoning/run`
**Status:** Implemented and verified on 2026-10-14. The workspace uses the Phase 1 sparse-sample API and retains the legacy `/v1` endpoints only for backward compatibility.
**Produces:** Boundary/sample entry, real API integration, returned-surface and zone inspection, diagnostic views, and a clearly labeled JSON result export.

---

## 2.1 Overview & Design Rationale

Phase 2 replaces the former grid-painting workflow with the sparse-sample field model. The UI submits boundary and measured samples to `/v2/zoning/run`; it never preloads a practice farm or fabricates a zoning result.

In Phase 2, the UI is overhauled to reflect actual precision farming:
1. **Field Boundary & Geometry:** Import a valid GeoJSON Polygon. Any bundled benchmark must have verified provenance and be labeled as measured or synthetic; never present invented samples as a real farm.
2. **Sparse Soil Testing Interface:** Enter or import 3–50 georeferenced samples (5–10 recommended), each with the same explicit sampling-depth interval. Use pH, EC, N, P, K in the Phase 1 units.
3. **Field Analysis:** A single request to `/v2/zoning/run` performs IDW, SHI scoring, Auto-K clustering, zone post-processing, and sensitivity analysis; it returns continuous estimates and zones together.
4. **Result Exploration:** Toggle returned pH, EC, N, P, K, SHI, zone, and FCM-membership layers; inspect the silhouette sweep, merge log, sample coverage, and sensitivity diagnostics. A selected cell or zone exposes its independent crop-fit screen.
5. **Candidate Locations:** Show per-zone medoid and gateway candidates with prominent “suggested geometry only” limits. Export the actual JSON response; do not claim a sensor deployment or navigate to a not-yet-built telemetry console.

---

## 2.2 Implemented Component Hierarchy & Architecture

```
src/features/zoning/
├── ZoningWorkspace.tsx       # Boundary/sample workflow, run state, inspection and Crop Fit
├── zoning.css                # Scoped workspace layout and responsive states
└── field/
    ├── FieldMap2D.tsx        # Complete accessible default map and sample placement
    ├── FieldScene3D.tsx      # Lazily loaded, batched optional R3F scene
    ├── fieldDisplay.ts       # Returned layer values, ranges and colors
    ├── fieldGeometry.ts      # GeoJSON validation, local projection and geometry budgets
    ├── fieldSamples.ts      # Sample validation and `/v2` request construction
    ├── fieldSurface.ts      # One triangulated surface geometry and face-to-cell mapping
    ├── fieldTypes.ts        # Request/response contract, including cell footprints
    └── soilSampleCsv.ts     # Validated sample CSV import

src/services/zoningApi.ts    # `/v2/zoning/run` and `/v1/crop-fit/evaluate` clients
```

The 2D map renders every returned cell up to the service's 5,000-cell limit. The optional 3D scene is lazy-loaded and enabled only for at most 768 cells and an estimated total of at most 20,000 triangles (including a reserved marker budget); otherwise the full 2D workflow remains available. Both views use exact WGS84 cell footprints returned by the service, including clipped edges and holes.

---

## 2.3 Detailed Feature Specifications

### 2.3.1 Field Boundary & Custom GeoJSON Loader

- Accept a GeoJSON `Polygon`, or a `Feature` whose geometry is a `Polygon`; normalize it to the exact `/v2` boundary request before submission. Reject malformed, unclosed, self-intersecting, unsupported-CRS, or out-of-range geometry with actionable errors.
- Do not ship the three unverified Parma/Punjab/Bangalore “realistic” farms from the earlier draft. A future bundled dataset requires traceable boundary and sample provenance, compatible units/depth, and permission to use it. Synthetic data must never masquerade as a real farm.
- Do not impose a separate hectare range that the backend does not enforce. Let Phase 1 validate candidate/cell caps, empty grids, and supported cell sizes.
- Fit the field view to the accepted boundary; keep the source file and original coordinates available for the run record/export.

### 2.3.2 Sparse Sample Pinning & Table Editor

- Allow a user to place pins inside the polygon or enter WGS84 coordinates. A pin is a draft until all measurements and required context are valid; do not invent its soil values.
- Enforce the API limit of **3–50 samples**; recommend 5–10 for the intended workflow. Require one explicit common depth interval for all samples. Dates, lab methods, and per-property standard uncertainty are recorded when available; missing/mixed date or method is surfaced as a warning.
- Require exactly pH, EC, N, P, and K for every sample. Units are fixed by the Phase 1 contract: pH dimensionless, EC dS/m, N/P/K mg/kg. Accept pH in [0,14] and non-negative EC/N/P/K; do not silently convert kg/ha values.
- Disable **Run field analysis** until boundary, sample count, unique IDs/coordinates, in-boundary locations, required values, and common depth pass validation.

### 2.3.3 Returned Soil-Surface Layers

Phase 1 exposes one full-pipeline request, not a separate interpolation endpoint. After `/v2/zoning/run` succeeds, use the exact returned cell estimates for:

- pH, EC, nitrogen, phosphorus, and potassium in their declared units.
- KshetraSense SHI and its individual component scores, labeled **project-defined screening score; not locally calibrated or crop-specific**.
- Cluster/zone assignment and, for FCM, memberships to the original clusters.

Use a readable sequential/diverging scale with a visible numeric legend, units, and returned min/max. Do not label unsupported bins “deficient,” “sufficient,” “acidic,” “saline,” “low SHI,” or “good soil” without a separately sourced and approved threshold. Cell values remain explicitly labeled as IDW estimates; nearest-sample distance and the LOOCV summary are available from the response.

### 2.3.4 Auto-K, Clustering, and Contiguous Zones

- Each run selects **K-means++** or **Fuzzy C-means**; the backend sweeps K from 2 to the requested maximum (2–6) and selects maximum silhouette, breaking ties toward smaller K. The user may change the maximum K and rerun, but cannot override the selected K in this API version.
- Plot the returned silhouette for every tested K; show FPC only for FCM as a diagnostic, not as the selection rule. Describe silhouette as internal separation of interpolated profiles, not agronomic validation.
- For FCM, visualize membership to each original cluster as membership strength (not probability or confidence). Since adjacent clusters may be merged and disconnected components split afterward, keep source-cluster membership distinct from final zone labels.
- Explain each merge from `mergeLog.profileDistanceZ` and `sharedGridEdges`; the default threshold is `mergeThresholdZ = 0.5` in standardized multivariate feature space. Do not describe it as an SHI difference. Every disconnected four-connected component receives its own zone; small components are not silently removed.

### 2.3.5 Suggested Sensor/Gateway Locations

- Show the returned in-zone medoid and gateway candidate using lightweight procedural markers; label them **suggested locations—not installed or coverage-validated hardware**.
- If showing straight-line distances, identify them as projected Euclidean distances only. Do not render radio-coverage rings or imply a LoRa link budget, accessibility, or feasibility.

### 2.3.6 Export Analysis Result

- Offer **Download analysis JSON** after a successful response. Export the returned `/v2` JSON, including run ID, input fingerprint, timestamps, algorithm versions, provenance, warnings, estimates, zones, and diagnostics.
- Keep the run immutable in current view state; do not claim server persistence, deployment readiness, or a hand-off to the not-yet-implemented WSN telemetry console.

### 2.3.7 Cell/Zone-scoped Crop Fit

- When the user selects a returned zone, send its exact `meanSoilValues`; for a selected cell, send its exact `soilValues`. Include the selected scope as context in the existing `POST /v1/crop-fit/evaluate` request. Do not use SHI, cluster IDs, FCM memberships, or WSN candidates as crop-fit inputs.
- Show three independent Apple, Tomato, and Potato assessments with factor state, source, and limitations. The current backend has a sourced pH screen only; N/P/K and EC remain “not assessed.” Do not rank crops or normalize results to 100%.
- Keep the Crop Fit panel inside Soil Zoning's selected-cell/zone detail; it is not a separate top-level module in this Phase 2 workflow.

---

## 2.4 Data Models & TypeScript Interfaces

```typescript
type Position = [longitude: number, latitude: number];
type GeoJsonPolygon = { type: 'Polygon'; coordinates: Position[][]; crs?: 'EPSG:4326' | 'OGC:CRS84' };
type SoilProperty = 'pH' | 'ec' | 'nitrogen' | 'phosphorus' | 'potassium';
type SoilValues = Record<SoilProperty, number>;
type GeoJsonGeometry = GeoJsonPolygon | { type: 'MultiPolygon'; coordinates: Position[][][] };

export interface FieldZoningRequest {
  boundary: GeoJsonPolygon;
  cellSizeM: 5 | 10;
  method: 'kmeans' | 'fcm';
  maxK: 2 | 3 | 4 | 5 | 6;
  seed: number;
  mergeThresholdZ: number; // 0–2; default 0.5
  perturbationRuns: number; // 0–50; default 10, up to 50 for deeper sensitivity analysis
  fcm?: { fuzziness: number; maxIterations: number; tolerance: number };
  samples: SoilSampleInput[]; // 3–50; one common explicit depth interval
}

export interface SoilSampleInput {
  id: string;
  latitude: number;
  longitude: number;
  depthCm: string;
  collectionDate?: string | null;
  labMethod?: string | null;
  standardUncertainty?: Partial<Record<'pH' | 'ec' | 'nitrogen' | 'phosphorus' | 'potassium', number>>;
  measurements: {
    pH: number;
    ec: number;
    nitrogen: number;
    phosphorus: number;
    potassium: number;
  };
}

export interface FieldCellResult {
  cellId: string;
  row: number;
  column: number;
  centerUtm: { eastingM: number; northingM: number };
  centerWgs84: { longitude: number; latitude: number };
  geometry: GeoJsonGeometry; // Exact WGS84 footprint clipped to the analyzed field boundary
  areaM2: number;
  nearestSampleDistanceM: number;
  soilValues: SoilValues;
  valueKind: 'idw_interpolated_estimate';
  shi: number;
  shiComponents: SoilValues;
  clusterId: number;
  zoneId: number;
  clusterMemberships?: number[]; // Original FCM cluster columns, not final-zone probabilities
}

export interface FieldZoneResult {
  zoneId: number;
  mergedClusterId: number;
  sourceClusterIds: number[];
  cellCount: number;
  cellIds: string[];
  areaM2: number;
  meanSoilValues: SoilValues;
  stdSoilValues: SoilValues;
  meanShi: number;
  meanShiComponents: SoilValues;
  centroidUtm: { eastingM: number; northingM: number };
  centroidWgs84: { longitude: number; latitude: number };
  geometry: GeoJsonGeometry;
  meanClusterMemberships?: Record<string, number>;
}

export interface FieldZoningResponse {
  runId: string;
  inputFingerprint: string;
  createdAt: string;
  processingDurationMs: number;
  method: 'kmeans' | 'fcm';
  selectedK: number;
  zoneCount: number;
  parameters: {
    cellSizeM: 5 | 10;
    maxK: number;
    seed: number;
    mergeThresholdZ: number;
    perturbationRuns: number;
    fcm: { fuzziness: number; maxIterations: number; tolerance: number };
  };
  versions: Record<string, string>;
  field: {
    boundary: GeoJsonPolygon;
    utmCrs: string;
    cellSizeM: number;
    areaHectares: number;
    cellCount: number;
    representedGridAreaM2: number;
    gridCoveragePercent: number;
    boundingBoxUtm: Record<'minX' | 'minY' | 'maxX' | 'maxY', number>;
  };
  samples: Array<Record<string, unknown>>;
  sampleWarnings: string[];
  interpolation: {
    method: 'IDW';
    power: 2;
    distanceMetric: string;
    crossValidation: Record<SoilProperty, { sampleCount: number; rmse: number; mae: number }>;
  };
  featureSchema: { requested: SoilProperty[]; included: SoilProperty[]; excluded: Array<Record<string, string>>; units: Record<SoilProperty, string>; normalization: Array<{ feature: SoilProperty; mean: number; stdDev: number }> };
  shi: { name: string; version: string; officialUSDAIndex: false; scoreRange: [0, 100]; weights: Record<SoilProperty, number>; limitations: string };
  cells: FieldCellResult[];
  zones: FieldZoneResult[];
  autoK: {
    optimalK: number;
    selectionCriterion: string;
    sweep: Array<{ k: number; silhouette: number | null; fpc: number | null; inertia: number | null; iterations: number }>;
    selectedAlgorithmConverged: boolean;
    silhouetteInterpretation: string;
  };
  mergeLog: Array<{ mergedClusters: number[]; profileDistanceZ: number; sharedGridEdges: number }>;
  stability: {
    perturbationRuns: number;
    referenceK: number | null;
    conditionalOnSelectedK: true;
    ariScores: number[];
    meanARI: number | null;
    stdARI: number | null;
    minARI: number | null;
    perCellClusterFlipRate: Record<string, number> | null;
    perCellShiStdDev: Record<string, number> | null;
    noiseModel: Record<string, unknown>;
    limitations: string;
  };
  wsnNodes: Array<{ zoneId: number; cellId: string; positionUtm: { eastingM: number; northingM: number }; positionWgs84: { longitude: number; latitude: number }; zoneMeanShi: number; placementStatus: string }>;
  clusterHead: {
    positionUtm: { eastingM: number; northingM: number };
    positionWgs84: { longitude: number; latitude: number };
    totalDistanceToNodesM: number;
    algorithm: string;
    radioCoverageValidated: false;
    placementStatus: string;
  };
}
```

---

## 2.5 Verification & Acceptance Criteria

1. **Boundary and sample inputs — implemented:** WGS84 GeoJSON import; blank manual drafts and CSV import; 3–50 sample, value, unit, depth, coordinate, and uniqueness checks; placement is constrained to the field polygon. Backend validation remains authoritative.
2. **Real run — implemented:** the workspace submits to `/v2/zoning/run`, displays the returned result, and reports service failures without substituting fixtures.
3. **Layer/diagnostic fidelity — implemented:** pH, EC, N, P, K, project-defined SHI, zone, and FCM-membership views read the response; Auto-K, LOOCV, merges, and sensitivity data are shown with their limits.
4. **Stale result and export — implemented:** changed inputs preserve the previous immutable response as stale; export downloads the actual response JSON.
5. **Crop Fit — implemented:** selected cell values or zone means are sent to `/v1/crop-fit/evaluate`; three independent source-backed crop assessments remain contextual to Soil Zoning.
6. **2D/3D map — implemented:** accessible 2D is complete and default; 3D is lazy, uses returned clipped geometry, supports orbit/zoom/fit and selection, and is disabled above 768 cells or the 20,000-triangle estimate.

**Verification on 2026-10-14:** 38 frontend tests passed, TypeScript typecheck passed, 51 zoning-service tests passed, and the production build succeeded. The browser layout was checked at desktop and narrow widths. The build emits an optional 3D chunk of approximately 824 kB raw / 223 kB gzip; the main app bundle is approximately 289 kB raw / 87 kB gzip. Device frame-time profiling and a full UI run against real farm measurements remain unverified; no real-field or performance claim is made.
