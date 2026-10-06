# Technical requirements

**Status:** pre-build architecture contract. Product behavior is defined by the [PRD](PRD.md) and user-facing interactions by the [UX specification](UX-SPEC.md).

## System boundary

The planned UI is a local browser application. Scenario editing and display state live in the client. Clustering, crop-rule evaluation, and image inference use isolated, versioned modules/services behind stable request/result contracts. The final local service/runtime boundary remains an implementation decision; these contracts do not prescribe HTTP versus an in-process call.

The current working stack proposal is React, TypeScript, and Vite with Three.js/React Three Fiber for the functional field. A local Python service using scikit-learn, scikit-fuzzy, and TensorFlow/Keras is the proposed path for clustering and image inference. Confirm the boundary and inference runtime against model size and measured latency before fixing the package set; this is a proposal, not an implemented dependency list.

```text
Browser UI
  ├─ scenario state, forms, accessible 2D field
  ├─ Three.js / React Three Fiber field enhancement
  ├─ zoning request ─────────────> clustering module/service
  ├─ crop-fit request ───────────> versioned rules module/service
  └─ image request ──────────────> shared model inference module/service

Versioned local artifacts: feature schema | scenarios/presets | crop profiles/rules
                           class map/preprocessing | model | data/evaluation manifests
```

## Domain contracts

### Scenario and soil cell

```text
Scenario {
  id, name, seed, sourceType: synthetic | user_provided,
  gridRevision, cells[], featureUnits, measurementContext,
  selectedCells[], selectedZone?, activeFeature, mapMode,
  clusteringConfig, latestRun?, compatibilityResult?,
  leafPrediction?, selectedCropContext?, actionHistory
}

Cell {
  row, column, pH?, moisture?, soilTemperature?, ec?,
  nitrogen?, phosphorus?, potassium?, measurementContextRef?
}
```

Missing values are null/absent, never zero. Measurement context identifies source, unit, and timestamp; moisture additionally needs depth and method. Coordinates support layout/adjacency and are not silently included as soil measurements.

### Zoning

Request: `scenarioId`, `gridRevision`, method (`kmeans` or `fcm`), cluster count, seed, requested feature set, feature context, and normalization version.

Result: immutable run ID/revision, method and parameters, included/excluded features with reasons, preprocessing/algorithm versions, timestamps, diagnostics, assignments, centers, summaries, adjacency, and optional FCM membership matrix.

Build a stable samples × features matrix from valid cells. Apply a declared, versioned feature-wise normalization policy before either distance-based algorithm; record its feature order and parameters and retain raw values for display. Do not normalize incompatible moisture measurements together. If a feature has no variation across the current cells, flag that it cannot distinguish zones. Start with equal feature weights; any weighting control is explicit run configuration, never an automatic change to other feature values.

K-means input follows the selected implementation's samples × features convention. The scikit-fuzzy `cmeans` adapter must transpose the same normalized matrix to its features × samples convention and preserve the returned membership orientation when mapping it back to cells. Both methods use recorded seeds. FCM uses its own fuzzy objective and is not K-means with soft colors. Any spatial merge is an explicit adjacency-based post-process with a recorded threshold and distance definition.

### Crop compatibility

Request identifies scenario revision, profile/rules version, and selected cells/zones. Results contain crop, profile version/source references, factor records (observed value, unit, state, reason, supported range), missing-data state, and zone coverage/variation. Rules consume soil inputs only and cannot read or change cluster assignments. No composite score exists until sources define thresholds and weights. Any later aggregate must identify its metric, denominator, source, and production assumptions; a rule index/class or modeled per-crop yield ratio is not a probability. Never normalize the three crops to a 100% crop-success distribution. A probability field requires a separately approved event/data/calibration contract and validation report.

### Leaf inference

Request contains the image and model/preprocessing version. Result contains the supported class-map version, ranked 17 labels, top class, review state, model version, and inference duration. Zone/crop context is UI-only and is not passed as a model feature. Image bytes are transient by default.

## Rendering architecture

- The mock-demo milestone is a desktop-only visual prototype and may render the low-relief 2.5D field with R3F before the production rendering phase. This early scene is not evidence of production performance or completion of the later 2D-first, accessibility, fallback, and profiling gates; see [Decision 0002](decisions/0002-mock-data-demo-first.md).
- Implement and verify the 2D field interaction first. It is a complete mode, not a loading placeholder.
- On capable desktop devices, render the functional 2.5D field with React Three Fiber and Three.js. Derive colors/transforms from scenario and run state. Reuse geometry/materials and use instancing for cells and repeated markers; do not create a React component, mesh, or material per cell.
- The default field camera is isometric. Desktop drag orbits/pans, scroll zooms, and `F` fits the complete grid. Keep camera state separate from soil/run state. Cell relief is a bounded visual encoding of the selected feature, not geospatial elevation; soil standardization must never be visualized as terrain flattening.
- Use DOM/SVG for controls, text, legends, accessible hit targets, zone patterns, and overlays. Use 2D fallback for mobile by default and for WebGL failure/context loss.
- Use one ambient and one directional light by default. No post-processing, physics, dense foliage, particle system, or per-cell texture is required.
- Update instance buffers only when relevant state changes. Dispose resources when the scene unmounts. Keep camera movement separate from soil-data state.
- Spline is restricted to lazy decorative scenes and must have a static SVG or lightweight Three.js fallback. Verify current free-tier export/embed behavior before choosing it.

## Performance budgets

These are design limits, not measured performance claims. **This table is the single source of truth for scene budgets.**

| Measure | Initial/default | Hard ceiling |
| --- | ---: | ---: |
| Field cells in 3D | 216 (18 × 12) | 768 desktop; 384 if mobile 3D is explicitly enabled |
| Cell mesh geometry | 12 triangles per cell | 9,216 triangles at 768 cells |
| Total scene geometry | — | 20,000 visible triangles desktop; 12,000 constrained/mobile |
| Field scene draw calls | — | 8 desktop; 6 constrained/mobile |
| Sensor markers | 8 desktop / 6 constrained | 24 desktop / 12 constrained |
| Optional crop cues | Off by default | 256 desktop / 96 constrained; hide first under pressure |
| Materials/lights | Shared materials; 2 lights | 5 materials desktop / 4 constrained; 2 lights |
| Texture use | 0 required | 4 MiB total; no texture dimension above 512 px |
| Canvas pixel ratio | 1–1.5 desktop | 1.5 desktop; 1.0 constrained/mobile |
| Optional decorative hero | Static fallback first | 1 MiB transfer and 10,000 triangles total for imported models; procedural vignette limit is 500 triangles |
| Any future individual GLB | None required | 512 KiB; 2,000 triangles; 2 materials; 1 texture up to 512 px |
| Ambient loops | 0 required | 2; pause while hidden and remove in reduced-motion/constrained modes |

Use a shared box geometry with no more than 12 triangles per cell; 768 cells therefore account for 9,216 triangles before overlays and optional visuals. Instance count and draw-call budgets apply to the entire scene. If a hard ceiling is exceeded, remove decorative cues or use 2D; revisit the budget only with device profiling.

### Performance verification targets

- Aim for 60 FPS on a named desktop reference device and at least 30 FPS on a named constrained/mobile reference.
- Record device, browser, viewport, cell count, pixel ratio, quality tier, frame-time summary, draw calls, triangles, texture memory, transfer bytes, and load time.
- Measure the initial grid and maximum allowed grid during selection/edit/pan and with zoning overlays. These targets are not product claims until measured.

## Asset policy

Procedural geometry/SVG covers grid cells, field edges, zones, patterns, membership overlays, sensor markers, crop/grass cues, centroids, and root layers. No model, texture, font, icon pack, or external asset service is required. Sensor markers are illustrative and labeled “Illustrative; no live sensor stream.”

A future decorative GLB is accepted only when it improves a documented visual need, has an exact source/creator/model-specific reuse license and attribution record, stays within the budgets above, has original/optimized SHA-256 and size/geometry metadata, passes glTF validation with zero errors, and is lazy-loaded behind a working fallback. The [asset manifest](../assets/3d/asset-manifest.json) tracks the current zero-model state and the intake criteria. [Poly Haven](https://polyhaven.com/license) is a vetted CC0 source if a justified future need exists; that collection-wide license alone does not approve a specific model.

Use `.glb` as the runtime interchange format for a justified imported model. The [Khronos glTF 2.0 specification](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html) defines GLB as binary glTF, a container for JSON and binary asset data.

## Privacy, reliability, and reproducibility

- A request carries `gridRevision`; a result is current only when its revision matches current inputs.
- Failures retain edits and the previous immutable run. Do not replace a failure with invented output.
- Persist seed, method/configuration, feature schema/exclusions, algorithm/model/profile versions, and diagnostics with each run.
- Do not persist uploaded leaf images by default; omit image bytes from logs.
- External asset/font/API use requires a manifest record and must not introduce a paid or hosted runtime requirement.

## Technical verification plan

| Area | Evidence required |
| --- | --- |
| Scenario/commands | Same-seed output, edit bounds, exact preset deltas, undo/redo, stale-state transitions, and invalid/missing values. |
| Clustering | Feature inclusion/exclusion, fixed-seed run, FCM membership dimensions/sums, adjacency, merge trace, synthetic recovery and stability. |
| Rules | Threshold/source/version/unit/boundary/missing-data behavior and independence from cluster labels. |
| Vision | Preprocessing/class-map/model version match, 17 labels, review branch, no contextual inputs, transient upload. |
| UI/renderer | 2D/WebGL parity, keyboard path, reduced motion, no per-cell mesh allocation, context-loss fallback. |
| Performance | Trace against all budgets above on named desktop and constrained/mobile reference devices. |

## Open technical decisions

- Local service topology and transport for zoning/rules/inference.
- Final local inference runtime, model artifact size, and distribution strategy after benchmark.
- Exact 2D grid implementation and picking technique after interaction validation.
- Whether to include Spline after current free-tier/export verification. Its absence must not block any task.
