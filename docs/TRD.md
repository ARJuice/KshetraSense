# Technical requirements

**Status:** Phase 1 field-scale zoning backend is implemented; the Phase 2 frontend migration is pending. The five-phase architecture and current implementation status are indexed in [plans/README.md](plans/README.md); product behavior is defined by the [PRD](PRD.md), domain terms by [GLOSSARY](../GLOSSARY.md), and user-facing interactions by the [UX specification](UX-SPEC.md).

## System boundary

The product shell is a local browser application. User-authored soil state and each analysis module's view state remain isolated. Clustering, crop-rule evaluation, and image inference use isolated, versioned modules/services behind stable request/result contracts. Field Monitoring owns its sample records, optional SoilGrids context, and independent vegetation-monitoring session. It has no implicit read/write path to Soil Zoning, Crop Fit, or Leaf Diagnosis.

Keep React, TypeScript, and Vite for the host UI, with Three.js/React Three Fiber for the functional field and a complete 2D path. The local FastAPI zoning service currently uses the repository's NumPy K-means++/FCM implementations and rule-based crop-fit module; the image-model runtime and Keras/TensorFlow deployment remain a separate Phase 5 decision and are not changed by Phase 1. Run the pinned CropSight Streamlit application as a separate local sub-application with its own dependencies, configuration, and state. Preserve its files as-is; connect it through a separate Field Monitoring route/launch boundary rather than importing its UI code into the host React tree. SoilGrids access is optional and should use a downloaded/cached supported product subset, not require its currently paused REST endpoint.

```text
Browser UI
  ├─ scenario state, forms, accessible 2D field
  ├─ Three.js / React Three Fiber field enhancement
  ├─ zoning request ─────────────> clustering module/service
  ├─ crop-fit request ───────────> versioned rules module/service
  └─ image request ──────────────> shared model inference module/service

Field Monitoring
  ├─ soil investigation records ─> local persistence / validated import
  ├─ optional SoilGrids context ─> cached/downloaded coarse raster adapter
  └─ vegetation monitoring ─────> isolated CropSight Streamlit sub-application
                                    (own circular AOI, date window, and provider auth)

Versioned local artifacts: feature schema | scenarios/presets | crop profiles/rules
                           class map/preprocessing | model | SoilGrids metadata/cache index
                           CropSight source pin | provider/configuration manifest
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

Missing values are null/absent, never zero. Measurement context identifies source, original unit, timestamp, depth, and method where applicable. Coordinates support spatial location/adjacency and are not silently included as soil measurements. Production-facing results must be returned by the relevant module; test fixtures are not a product-result source.

### Field Monitoring contracts

```text
SoilSample {
  sampleId, investigationId, locationLabel?, latitude, longitude,
  collectedAt, depth?, collectionMethod, sourceType, sourceReference?,
  measurements: [{parameter, value, originalUnit, canonicalValue?, canonicalUnit?}],
  notes?, importedAt?
}

SoilGridsContextRequest {
  location or investigationArea, property, depthLayer,
  requestedQuantiles?, productVersion?
}

SoilGridsContextResult {
  property, predictedValue, unit, depthLayer, nativeResolution,
  uncertaintyQuantiles?, source, productVersion, retrievalDate,
  label: "modeled regional context; not a field measurement"
}

CropSightSession {
  centerLatitude, centerLongitude, radiusMeters,
  startDate, endDate, cropContext?, growthStage?,
  selectedSupportedMethod?, providerProjectReference?
}
```

Soil samples support manual entry and validated CSV import. Keep original values/units and record any explicit conversion. SoilGrids output is a separate contextual result; never create synthetic fine-resolution cells from its 250 m raster or feed it to the default soil-zoning feature matrix. CropSight keeps a circular AOI and its own date/result state; no cadastral parcel, soil samples, zoning assignments, Crop Fit results, or leaf results are passed into it. The as-is workflow depends on its configured Earth Engine access; optional rainfall remains independently sourced and labeled. The current FastAPI endpoint does not expose map-ready NDVI rasters/zone polygons, so the initial reuse target is the standalone Streamlit application, not that API as a shared-map contract.

The new sample records must persist across application restarts so users can review investigations over time. The exact local storage engine and migrations are an implementation choice, but data must stay local by default and be exportable/erasable. Provider credentials must never be embedded in frontend code or committed.

### Zoning

The legacy `POST /v1/zoning/run` remains available while the current grid frontend is migrated. The field-scale `POST /v2/zoning/run` accepts a WGS84 GeoJSON Polygon and 3–50 georeferenced soil samples (5–10 recommended). Each sample supplies exactly pH, EC, N, P, and K, an explicit common sampling-depth interval, and optional collection date, laboratory method, and standard uncertainty. Units are pH (dimensionless), EC (dS/m), and N/P/K (mg/kg). Cell size is 5 or 10 m; sample locations must lie within the polygon.

The v2 service chooses a local UTM CRS, discretizes cells whose centers are within the polygon, clips cell/zone areas to the boundary, and caps the request at 5,000 cells (and 100,000 bounding-box candidates). It runs IDW with fixed power p=2 over projected metres and returns per-property leave-one-out RMSE/MAE, nearest-sample distances, and explicitly labeled interpolated estimates. Sampling depth mismatch is rejected; incomplete or mixed date/method context is surfaced as warnings.

For clustering, standardize the varying pH/EC/N/P/K interpolated fields separately, exclude constant features with reasons, and run K-means++ or Bezdek FCM (NumPy; samples × features). Auto-K tests K=2 through the requested maximum (at most 6) and selects the maximum silhouette; ties choose smaller K. FPC is an FCM diagnostic, not an Auto-K criterion. FCM membership orientation is cells × source clusters and is not model confidence or crop probability.

Merge only adjacent clusters whose standardized multivariate centroid distance is at most the configured threshold (default 0.5); then assign separate zone IDs to disconnected four-connected components and keep small components. The independent KshetraSense SHI uses provisional project-defined curves/weights and is not an official USDA/NRCS score, a Crop Fit input, or a calibrated agronomic threshold. Sample perturbation reruns IDW and clustering at fixed selected K (10 runs by default, configurable from 0–50), reports ARI/flip/sensitivity diagnostics, and labels noise values as project assumptions unless per-sample standard uncertainty is provided. It does not assign a universal pass/fail grade.

The field result includes a measured `processingDurationMs`, cells, zone polygons/profiles, diagnostics, pipeline versions, and suggested per-zone medoids/geometric gateway candidates. Gateway `radioCoverageValidated` is false; no deployment, storage, link budget, or Field Monitoring hand-off is implemented. See the [Phase 1 plan](plans/phase-1-backend-algorithmic-core.md) for the full schema and method details.

The v1 and v2 zoning routes use the repository's own NumPy implementations rather than a scikit-fuzzy adapter. FCM uses its own fuzzy objective and is not K-means with soft colors. Both methods use recorded seeds; any future normalization/weighting control must be explicit, versioned run configuration.

### Crop compatibility

Request identifies scenario revision, profile/rules version, and selected cells/zones. Results contain crop, profile version/source references, factor records (observed value, unit, state, reason, supported range), missing-data state, and zone coverage/variation. Rules consume soil inputs only and cannot read or change cluster assignments. No composite score exists until sources define thresholds and weights. Any later aggregate must identify its metric, denominator, source, and production assumptions; a rule index/class or modeled per-crop yield ratio is not a probability. Never normalize the three crops to a 100% crop-success distribution. A probability field requires a separately approved event/data/calibration contract and validation report.

### Leaf inference

Request contains the image and model/preprocessing version. Result contains the supported class-map version, ranked 17 labels, top class, review state, model version, and inference duration. Zone/crop context is UI-only and is not passed as a model feature. Image bytes are transient by default.

## Rendering architecture

- Build the functional, accessible 2D field path as part of the first real Field Lab slice; add the data-driven low-relief 2.5D R3F enhancement in the same production-intended product sequence. There is no R3F-only mock milestone or separate fake-result phase.
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

Procedural geometry/SVG covers grid cells, field edges, zones, patterns, membership overlays, sensor markers, crop cues, centroids, and root layers. No model, texture, font, icon pack, or external asset service is required to operate the product. Sensor markers are illustrative primitives labeled “Illustrative; no live sensor stream.”

The desktop product may use the twelve small Kenney Nature Kit GLBs listed in the [asset manifest](../assets/3d/asset-manifest.json) as an optional art-direction palette for distant trees, sparse foliage/flowers, rocks, and a short background rail. Their combined prepared size is 79,544 bytes, with 882 triangles and no textures. They do not represent cells, crop outcomes, soil state, or sensors; the functional field remains procedural. Start with two or three distinct imported model types in the default view, keep them outside selectable cells, and never exceed the full-scene draw-call budget. Any additional decorative GLB must improve a documented visual need, have exact source/creator/license provenance, stay within the budgets above, include original/optimized SHA-256 and size/geometry metadata, pass glTF validation with zero errors, and remain optional behind a working fallback. [Poly Haven](https://polyhaven.com/license) remains a potential CC0 source; its collection-wide license alone does not approve a specific model.

Use `.glb` as the runtime interchange format for a justified imported model. The [Khronos glTF 2.0 specification](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html) defines GLB as binary glTF, a container for JSON and binary asset data.

## Privacy, reliability, and reproducibility

- A request carries `gridRevision`; a result is current only when its revision matches current inputs.
- Failures retain edits and the previous immutable run. Do not replace a failure with invented output.
- Persist seed, method/configuration, feature schema/exclusions, algorithm/model/profile versions, and diagnostics with each run.
- Do not persist uploaded leaf images by default; omit image bytes from logs.
- The planned Earth Engine dependency for CropSight is an explicit hosted-service exception: it requires project/auth configuration and quota availability but must not require a paid tier for the college build. Document it and show unavailable/error states. No other hosted API, font, asset, or runtime is required for core workflows.
- Mark unavailable Earth Engine credentials, quota exhaustion, no valid image coverage, and provider failures as distinct user-visible states. Never substitute a prepared map or recommendation.
- Preserve CropSight's pinned source attribution and keep its environment/provider credentials isolated. The missing license file remains an unresolved rights caveat documented in Decision 0004; user acceptance is not a license grant.
- SoilGrids cache entries record the native product, property, depth, quantiles, resolution, retrieval date, and source terms. Expired/missing context is shown as unavailable, not as a measurement.

## Technical verification plan

| Area | Evidence required |
| --- | --- |
| Scenario/commands | Same-seed output, edit bounds, exact preset deltas, undo/redo, stale-state transitions, and invalid/missing values. |
| Clustering | Feature inclusion/exclusion, fixed-seed run, FCM membership dimensions/sums, adjacency, merge trace, synthetic recovery and stability. |
| Rules | Threshold/source/version/unit/boundary/missing-data behavior and independence from cluster labels. |
| Vision | Preprocessing/class-map/model version match, 17 labels, review branch, no contextual inputs, transient upload. |
| Soil investigation | Manual/CSV validation, original-unit preservation, sample metadata completeness, local persistence, export/delete behavior. |
| SoilGrids | Product/depth/property/quantile/resolution provenance and explicit modeled-context display; no coupling into zoning/crop rules. |
| CropSight | Pinned source startup, Earth Engine configuration and failure handling, date/AOI correctness, supported map/time-series consistency, no KshetraSense module-data dependency. |
| UI/renderer | 2D/WebGL parity, keyboard path, reduced motion, no per-cell mesh allocation, context-loss fallback. |
| Performance | Trace against all budgets above on named desktop and constrained/mobile reference devices. |

## Implementation-time technical choices

These choices remain for implementation and benchmarking; they do not change the accepted product or module boundaries:

- Local service topology and transport for zoning/rules/inference.
- Final local inference runtime, model artifact size, and distribution strategy after benchmark.
- Exact 2D grid implementation and picking technique after interaction validation.
- Whether to include Spline after current free-tier/export verification. Its absence must not block any task.
- Exact local persistence mechanism and validated sample-import file format.
- CropSight sub-application hosting/embedding mechanics and separate Python dependency lockfile; its AOI/data boundary is fixed by [Decision 0004](decisions/0004-field-monitoring-and-direct-build.md).
- First supported SoilGrids download/cache format and user-selectable property/depth set.
