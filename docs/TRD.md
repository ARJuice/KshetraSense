# Technical requirements

**Status:** Phases 1–5 are implemented: field-scale sparse-sample zoning and selected-cell/zone Crop Fit; a provenance-checked historical telemetry service; the three-view Field Monitoring UI; and the image-only 17-class Leaf Diagnosis API/UI. The Leaf Diagnosis test split reached 92.97% accuracy and 93.52% macro-F1 on 4,653 PlantVillage images; no field-photo performance or calibrated probability claim is made. The five-phase architecture and current implementation status are indexed in [plans/README.md](plans/README.md); product behavior is defined by the [PRD](PRD.md), domain terms by [GLOSSARY](../GLOSSARY.md), and user-facing interactions by the [UX specification](UX-SPEC.md). SoilGrids uses the public ISRIC WCS adapter; Earth Engine remains a user-configuration gate. Neither source may be replaced by stand-in data.

## System boundary

The product shell is a local browser application. User-authored soil state and each analysis module's view state remain isolated. Clustering, crop-rule evaluation, historical telemetry, and image inference use implemented versioned modules/services. Leaf inference uses only the uploaded image and has no implicit read/write path to Soil Zoning, Crop Fit, or Field Monitoring. Field Monitoring owns its sample records, on-demand SoilGrids WCS context, historical replay controls, and independent vegetation-monitoring session.

Keep React, TypeScript, and Vite for the host UI, with Three.js/React Three Fiber for the functional field and a complete 2D path. The local FastAPI service uses the repository's NumPy K-means++/FCM implementations and rule-based crop-fit module. Historical replay is mounted under `/v1/telemetry/`; its trained GRU uses Keras 3 with the CPU PyTorch backend. Leaf Diagnosis serves a fine-tuned MobileNetV3-Small through `/v1/leaf/predict` using the CPU PyTorch runtime. Field Monitoring's React CropSight view calls a separately configured CropSight API (`VITE_CROPSIGHT_API_URL`, defaulting to the local `/cropsight` route); its Earth Engine credentials/configuration remain isolated from host secrets and state. The UI accepts only validated aggregate/time-series output currently returned by that API; no raster or zone geometry is exposed. SoilGrids is optional regional context retrieved on demand through ISRIC WCS, with property-specific scale conversion and no-data/provider errors surfaced as unavailable. The paused REST API and local coordinate formulas are not data sources.

```text
Browser UI
  ├─ boundary/sample forms, accessible 2D returned-result map
  ├─ lazily loaded Three.js / React Three Fiber field enhancement
  ├─ zoning request ─────────────> clustering module/service
  ├─ crop-fit request ───────────> versioned rules module/service
  └─ image request ──────────────> shared model inference module/service

Field Monitoring
  ├─ soil investigation records ─> local persistence / validated import
  ├─ SoilGrids context ──────────> public ISRIC WCS point-cell subsets (8 properties, 6 depths, Q05/Q50/Q95)
  ├─ historical telemetry replay ─> pinned local data + isolated replay/model service
  └─ vegetation monitoring ─────> separate CropSight API + user-configured Earth Engine
                                    (own circular AOI, date window, and provider auth)

Versioned local artifacts: feature schema | scenarios/presets | crop profiles/rules
                           class map/preprocessing | model | SoilGrids metadata/cache index
                           CropSight source pin | provider/configuration manifest
```

## Domain contracts

### Legacy grid scenario and soil cell (`/v1`)

The schema below is retained for the backward-compatible cell-grid endpoint. The current Soil Zoning UI does not create a synthetic `Scenario` or edit grid cells; its request/response contract is the boundary-and-sample workflow described under [Zoning](#zoning).

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

SoilGridsContextResult {             // Real WCS result or explicit provider/no-data error (503)
  property, propertyName, mappedValue, unit, depth, nativeResolution,
  quantiles: { Q0.05, Q0.50, Q0.95 }, source, retrievalDate,
  label: "modeled regional context; not a field measurement"
}

CropSightSession {
  centerLatitude, centerLongitude, radiusMeters,
  startDate, endDate, cropContext?, growthStage?,
  selectedSupportedMethod?, providerProjectReference?
}

HistoricalTelemetryReplay {
  datasetVersion, sourceHashes, trialPeriod, replayTimestampUtc,
  treatmentLineId, treatmentLabel,
  sourceObservations, originalUnits,
  experimentalSignalForecast { status, targetUnit, inputResamplingCount, holdoutDisposition }?,
  anomalyReviewCandidate?,
  capabilities: { liveTelemetry: false, zoneBinding: false, actuation: false }
}
```

Soil samples support manual entry and validated CSV import. New sessions start empty; legacy synthetic preset rows are moved to a separate local archive and excluded from measurement summaries/trends. Keep original values/units and record any explicit conversion. `GET /v1/monitoring/soilgrids` queries ISRIC WCS for the requested property/depth's Q0.05, Q0.50, and Q0.95 GeoTIFF subsets, samples the returned georeferenced cell, and converts stored integers using the official property-specific factors. It must never generate coordinate-derived estimates, fabricate fine-resolution cells, or feed Soil Zoning/Crop Fit. The nominal 250 m global product is contextual, not a farm-scale map; masked cells, malformed responses, and upstream errors return no estimate. The WCS adapter is documented in [Decision 0010](decisions/0010-soilgrids-wcs-context-adapter.md). CropSight keeps a circular AOI and its own date/result state; no cadastral parcel, soil samples, zoning assignments, Crop Fit results, or leaf results are passed into it. Earth Engine access is user-configured and optional rainfall is independently sourced/labeled. The API response currently includes aggregate NDVI statistics, a per-scene time series, optional rainfall, and upstream heuristic strings; it does not include an NDVI raster, pixel labels, zone polygons, or per-zone statistics. Therefore the host UI does not render a spatial map or claim patch-level scouting coordinates.

The separate FAO-56 endpoint accepts only explicit calibrated VWC fractions and site parameters. Phase 4 does not add a UI for it: the historical trial's `%RH` sensor signal is not VWC, and joining the two would be unsafe. The API remains available for separately supplied inputs; no irrigation operation is implemented.

### Historical telemetry service

The service loads the CC BY 4.0 Mendeley v2 Parma tomato-trial files from `services/telemetry/data/raw/` and verifies each pinned file's SHA-256 and size before parsing. The source spans 2023-06-29 through 2023-09-13 and provides three 100/60/30%-of-Irriframe treatment lines, one shared environment stream, soil humidity `%RH` signal (not VWC), soil EC `µS/cm`, temperatures in °C, and a source-reported meter field. Raw source observations/timestamps remain distinct from the nominal 10-minute model grid; the latter bridges only valid gaps of at most 30 minutes and does not extrapolate.

`GET /v1/telemetry/health` verifies service readiness; `/metadata`, `/state`, `/stream`, `/history`, and read-only `/ws` expose provenance and historical playback. `POST /control` accepts bounded seek, play/pause, and speeds 1/10/60/360. Playback state is in-memory and process-local, so it resets on restart and is intended for the local single-worker demo. Treatment line IDs are not zoning IDs; the API exposes no live sensor connection, device identity, valve, actuation, or implicit soil-sample handoff.

The GRU consumes a complete 24-hour, five-feature window and emits `%RH` sensor-signal point estimates at +6/+12/+24 hours. Its metadata includes chronological split boundaries, train-only scaler parameters, source hashes, MAE/RMSE/R², and a per-horizon persistence comparison. The current artifact fails to beat persistence at every horizon; these predictions are research/evaluation output only. An Isolation Forest fitted on the first 70% of the timeline produces review candidates without fault probability/diagnosis semantics. The separate `/water-balance/advisory` endpoint accepts explicit VWC fractions and calibrated field parameters for FAO-56 TAW/RAW screening; it cannot consume the `%RH` replay or actuate hardware.

The new sample records must persist across application restarts so users can review investigations over time. The exact local storage engine and migrations are an implementation choice, but data must stay local by default and be exportable/erasable. Provider credentials must never be embedded in frontend code or committed.

### Zoning

The legacy `POST /v1/zoning/run` remains available for compatibility; the current Soil Zoning workspace calls the field-scale `POST /v2/zoning/run`. The v2 request accepts a WGS84 GeoJSON Polygon and 3–50 georeferenced soil samples (5–10 recommended). Each sample supplies exactly pH, EC, N, P, and K, an explicit common sampling-depth interval, and optional collection date, laboratory method, and standard uncertainty. Units are pH (dimensionless), EC (dS/m), and N/P/K (mg/kg). Cell size is 5 or 10 m; sample locations must lie within the polygon.

The v2 service chooses a local UTM CRS, discretizes cells whose centers are within the polygon, clips cell/zone areas to the boundary, and caps the request at 5,000 cells (and 100,000 bounding-box candidates). It runs IDW with fixed power p=2 over projected metres and returns per-property leave-one-out RMSE/MAE, nearest-sample distances, and explicitly labeled interpolated estimates. Sampling depth mismatch is rejected; incomplete or mixed date/method context is surfaced as warnings.

For clustering, standardize the varying pH/EC/N/P/K interpolated fields separately, exclude constant features with reasons, and run K-means++ or Bezdek FCM (NumPy; samples × features). Auto-K tests valid K=2 through the request's `maxK` ceiling (2–6) and selects the maximum silhouette; ties choose smaller K. The current UI fixes that ceiling at 6 and does not expose a manual final-K selector. FPC is an FCM diagnostic, not an Auto-K criterion. FCM membership orientation is cells × source clusters and is not model confidence or crop probability.

Merge only adjacent clusters whose standardized multivariate centroid distance is at most the configured threshold (default 0.5); then assign separate zone IDs to disconnected four-connected components and keep small components. The independent KshetraSense SHI uses provisional project-defined curves/weights and is not an official USDA/NRCS score, a Crop Fit input, or a calibrated agronomic threshold. Sample perturbation reruns IDW and clustering at fixed selected K (10 runs by default, configurable from 0–50), reports ARI/flip/sensitivity diagnostics, and labels noise values as project assumptions unless per-sample standard uncertainty is provided. It does not assign a universal pass/fail grade.

The field result includes a measured `processingDurationMs`, cells, zone polygons/profiles, diagnostics, pipeline versions, and suggested per-zone medoids/geometric gateway candidates. Every cell includes its exact WGS84 `geometry` clipped to the field boundary, allowing the 2D and 3D renderers to show the same edge shapes and holes. The Phase 2 UI displays those results and sends a selected cell's `soilValues` or a selected zone's `meanSoilValues` to `/v1/crop-fit/evaluate`; Crop Fit remains a separate rules call and is not folded into clustering. Gateway `radioCoverageValidated` is false; results are request-local, with no persistence, link budget, or Field Monitoring hand-off. See the [Phase 1 plan](plans/phase-1-backend-algorithmic-core.md) for the full schema and method details.

The v1 and v2 zoning routes use the repository's own NumPy implementations rather than a scikit-fuzzy adapter. FCM uses its own fuzzy objective and is not K-means with soft colors. Both methods use recorded seeds; any future normalization/weighting control must be explicit, versioned run configuration.

### Crop compatibility

`POST /v1/crop-fit/evaluate` receives the selected cell's `soilValues` or zone's `meanSoilValues`, a profile version, and optional scope/lab context. Zone means are already computed by the field service as area-weighted averages of IDW-estimated cell values. Profile version `2026.10-crop-reference-report-v3` returns independent Finger Millet (Ragi), Tomato, and Groundnut factor rows with the observed value, unit, reference context, source, and neutral note; there is no crop-level `assessmentState`. The current report compares pH numerically to its cited interval only. It shows EC salinity references as context but does not compare generic single-depth EC with root-zone ECe. N/P/K remain visible with method-/region-calibration limits; moisture and soil temperature are not inputs to the field-zoning contract. It does not classify a crop as fit/suitable, recommend planting, rank crops, calculate a composite, or make a probability claim. Crop references and scope caveats are documented in the [current crop research](research/crop-fit-crop-selection.md) and [Decision 0012](decisions/0012-karnataka-crop-reference-catalog.md).

### Leaf inference

`POST /v1/leaf/predict` accepts exactly one JPEG/PNG up to 10 MiB. The route checks declared type against file signature, safely decodes with EXIF orientation, enforces 8,192-pixel per-side and 25-megapixel limits, resizes to RGB 224 × 224, and does not persist image bytes. The lazy-loaded Keras 3 / PyTorch runtime verifies the MobileNetV3-Small artifact SHA-256, 17-class map, preprocessing version, and input/output shapes before inference. The response contains all 17 uncalibrated softmax scores, semantic labels, versions, measured server inference duration, and `reviewRequired: true` for every result. The model was fine-tuned on a grouped PlantVillage split; after excluding ten records from five source train/test overlap groups, its 4,653-image test result was 92.97% accuracy and 93.52% macro-F1. PlantDoc and field-photo performance have not been evaluated. Severity, simultaneous conditions, and treatment advice are outside the contract. See [Phase 5](plans/phase-5-leaf-contract-and-verification.md) and the [training notes](../services/leaf/README.md).

## Rendering architecture

- The 2D boundary-and-sample map is the complete, accessible default. The optional R3F field is dynamically imported only when requested and uses actual `/v2` response geometry; no mock-result phase exists.
- The R3F scene triangulates exact boundary-clipped cell footprints into one batched `BufferGeometry`, with a face-to-cell lookup for selection. Reuse the field material and use instancing for repeated sample/node markers; do not allocate a mesh/material per cell.
- The 3D camera is initially isometric; pointer controls orbit/pan and zoom, and a visible **Fit** action resets the view. Keep camera state separate from soil/run state. Cell relief is a bounded visual encoding of the selected feature, not geospatial elevation; soil standardization must never be visualized as terrain flattening.
- Use DOM/SVG for controls, text, legends, accessible hit targets, zone patterns, and the complete 2D workflow. Keep 2D available for WebGL failure, large fields, or geometry that exceeds the 3D budget.
- Use one ambient and one directional light by default. No post-processing, physics, dense foliage, particle system, or per-cell texture is required.
- Update instance buffers only when relevant state changes. Dispose resources when the scene unmounts. Keep camera movement separate from soil-data state.
- Spline is restricted to lazy decorative scenes and must have a static SVG or lightweight Three.js fallback. Verify current free-tier export/embed behavior before choosing it.

## Performance budgets

These are design limits, not measured performance claims. **This table is the single source of truth for scene budgets.**

| Measure | Initial/default | Hard ceiling |
| --- | ---: | ---: |
| Field cells in 3D | 216 | 768 desktop; 384 if mobile 3D is explicitly enabled |
| Estimated total scene geometry | — | 20,000 triangles desktop, including up to 1,300 reserved for markers/selection |
| Field scene draw calls | — | 8 desktop; 6 constrained/mobile |
| Lab sample markers | — | 50, instanced; included in triangle reserve |
| Suggested WSN markers | 8 desktop / 6 constrained | 24 desktop / 12 constrained; included in triangle reserve |
| Optional crop cues | Off by default | 256 desktop / 96 constrained; hide first under pressure |
| Materials/lights | Shared materials; 2 lights | 5 materials desktop / 4 constrained; 2 lights |
| Texture use | 0 required | 4 MiB total; no texture dimension above 512 px |
| Canvas pixel ratio | 1–1.5 desktop | 1.5 desktop; 1.0 constrained/mobile |
| Optional decorative hero | Static fallback first | 1 MiB transfer and 10,000 triangles total for imported models; procedural vignette limit is 500 triangles |
| Any future individual GLB | None required | 512 KiB; 2,000 triangles; 2 materials; 1 texture up to 512 px |
| Ambient loops | 0 required | 2; pause while hidden and remove in reduced-motion/constrained modes |

Estimate triangulation from the vertex counts of the returned cell and field polygons, including holes, and enable 3D only when the estimate plus the 1,300-triangle overlay reserve is at most 20,000. This is a conservative geometry guard, not a measured frame-rate guarantee. Instance count and draw-call budgets apply to the entire scene. If a hard ceiling is exceeded, keep the full 2D map and revisit the budget only with device profiling.

### Performance verification targets

- Aim for 60 FPS on a named desktop reference device and at least 30 FPS on a named constrained/mobile reference.
- Record device, browser, viewport, cell count, pixel ratio, quality tier, frame-time summary, draw calls, triangles, texture memory, transfer bytes, and load time.
- Measure a typical returned field and the largest 3D-eligible result during selection/orbit/pan and with zoning overlays. These targets are not product claims until measured.

## Asset policy

Procedural geometry/SVG covers grid cells, field edges, zones, patterns, membership overlays, sensor markers, crop cues, centroids, and root layers. No model, texture, font, icon pack, or external asset service is required to operate the product. Sensor markers are illustrative primitives labeled “Illustrative; no live sensor stream.”

The current zoning scene uses procedural geometry only; prepared Kenney Nature Kit GLBs are not loaded into it. The twelve small models in the [asset manifest](../assets/3d/asset-manifest.json) remain optional assets for a later documented visual need. They must not represent cells, crop outcomes, soil state, or sensors; imported decoration must remain outside selectable field data, optional behind a working fallback, and inside the scene budgets. Any model addition needs exact source/creator/license provenance, original/optimized SHA-256 and size/geometry metadata, and zero-error glTF validation. [Poly Haven](https://polyhaven.com/license) remains a potential CC0 source; its collection-wide license alone does not approve a specific model.

Use `.glb` as the runtime interchange format for a justified imported model. The [Khronos glTF 2.0 specification](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html) defines GLB as binary glTF, a container for JSON and binary asset data.

## Privacy, reliability, and reproducibility

- The UI tracks local input/boundary revisions and labels the last immutable API response stale when those inputs change; the response also records its fingerprint and run metadata. No server persistence is implemented.
- Failures retain edits and the previous immutable run. Do not replace a failure with invented output.
- Export preserves seed, method/configuration, feature schema/exclusions, pipeline versions, and diagnostics from the returned run; storage across restarts is not implemented.
- Do not persist uploaded leaf images by default; omit image bytes from logs.
- The Earth Engine dependency for live CropSight analysis is an explicit external-service requirement: it requires user project/auth configuration and available quota. Document it and show unavailable/error states. No credentials are committed or shown. No other hosted API, font, asset, or runtime is required for core workflows.
- Mark unavailable Earth Engine credentials, quota exhaustion, no valid image coverage, and provider failures as distinct user-visible states. Never substitute a prepared map or recommendation.
- Preserve CropSight's pinned source attribution and keep its environment/provider credentials isolated. The missing license file remains an unresolved rights caveat documented in Decision 0004; user acceptance is not a license grant.
- SoilGrids requests use the live remote WCS on demand and do not cache provider values; timeouts/no-data remain errors. If a cache is added later, retain product, property, depth, quantiles, resolution, retrieval date, and source terms.

## Technical verification plan

| Area | Evidence required |
| --- | --- |
| Soil zoning | Boundary/sample validation, units/depth, API response fidelity, stale-state transitions, selected-scope Crop Fit isolation, and response export. |
| Clustering | Feature inclusion/exclusion, fixed-seed run, FCM membership dimensions/sums, adjacency, merge trace, synthetic recovery and stability. |
| Rules | Threshold/source/version/unit/boundary/missing-data behavior and independence from cluster labels. |
| Vision | Preprocessing/class-map/model version match, 17 labels, review branch, no contextual inputs, transient upload. |
| Soil investigation | Manual/CSV validation, original-unit preservation, sample metadata completeness, local persistence, export/delete behavior. |
| SoilGrids | Mocked WCS GeoTIFF parsing, requested-cell georeferencing, all eight property scale/unit mappings, quantile ordering, no-data/provider failures, API provenance, and no zoning/crop-rule coupling. |
| CropSight | API request validation, user AOI/date fidelity, returned aggregate/time-series validation, no synthetic zone/map fallback, Earth Engine/provider error handling, and no KshetraSense module-data dependency. |
| Historical telemetry | Source-hash verification, strict parser, unit/source timestamp fidelity, bounded interpolation, deterministic playback, API bounds, GRU shape/split/holdout-vs-persistence metrics, anomaly-candidate semantics, separate FAO-56 hand calculation, replay UI integrity, and no zone/actuation coupling. |
| UI/renderer | Returned-geometry parity, 2D keyboard path, 3D selection/orbit/fit, reduced motion, scene-budget guard, and fallback behavior. |
| Performance | Trace against all budgets above on named desktop and constrained/mobile reference devices. |

## Implementation-time technical choices

These choices remain for implementation and benchmarking; they do not change the accepted product or module boundaries:

- Local service topology and transport for zoning/rules/inference.
- Whether to package model weights separately from the local application distribution.
- Device-specific 3D performance after profiling on named hardware.
- Whether to include Spline after current free-tier/export verification. Its absence must not block any task.
- Exact local persistence mechanism and validated sample-import file format.
- CropSight's external process startup/orchestration and Earth Engine user setup; its AOI/data boundary is fixed by [Decision 0004](decisions/0004-field-monitoring-and-direct-build.md). The current UI is ready to consume validated aggregate/time-series response fields, not spatial raster outputs.
- Verify live SoilGrids WCS availability at demonstration time; its upstream service is external and has no uptime guarantee. The local adapter is implemented and smoke-tested; no cache is used. ISRIC's REST beta remains paused, so the documented WCS path is used instead.
