# Delivery plan and acceptance

**Status:** current functional implementation sequence. This plan replaces the mock-first milestone in [Decision 0002](decisions/0002-mock-data-demo-first.md); see [Decision 0004](decisions/0004-field-monitoring-and-direct-build.md). No visual-only or fixture-output product phase is planned.

## Delivery principles

- Build working, testable vertical slices; do not build all screens against fabricated results and wire services later.
- Synthetic data is allowed for unit tests, algorithm benchmarks, and explicit development diagnostics. It is never silently presented as a user field, satellite observation, zoning run, crop assessment, or leaf prediction.
- A module can show a truthful input-needed, no-data, unavailable, or error state while its real data contract is being implemented. A false “success” screen is not an acceptable placeholder.
- Preserve scope boundaries in [Decision 0004](decisions/0004-field-monitoring-and-direct-build.md): Soil Zoning, Crop Fit, Leaf Diagnosis, and Field Monitoring remain separate.
- Design and visual craft matter from the first useful screen. Use sketches/visual exploration as needed, but implement the selected design directly as a functional product slice rather than a throwaway mock app.

## Functional delivery phases

| Phase | Deliverable | Exit condition |
| --- | --- | --- |
| 0. Contracts, provenance, and environment | Confirm feature/input schemas, audited leaf labels/splits, supported crop-profile sources, service boundaries, local persistence approach, CropSight pinned source/dependencies, Earth Engine setup, SoilGrids download/cache path, and reference devices. | Inputs, units, errors, provenance, data rights caveats, and setup steps are documented. The project can start each required service or show an honest configuration error. |
| 1. Production shell and Soil Zoning vertical slice | Replace the old prototype UX with the new React/TypeScript product shell. Implement a complete 2D Soil Zoning flow over real user-entered/imported data plus the documented synthetic benchmark for tests. Implement K-means and FCM contracts, immutable run state, stale-result behavior, and evidence labels. | A user can provide valid input, run a real algorithm, inspect the returned zones, understand limitations, and complete the task without WebGL. No canned zone result is displayed. |
| 2. Crop Fit | Implement independent sourced soil-to-crop rules, per-crop factors, missing-data states, and zone summaries. | Source/unit/profile tests pass; Crop Fit results do not vary with cluster labels and are never presented as a 100%-sum probability. |
| 3. Leaf Diagnosis | Audit data labels and physical-leaf split, train/evaluate the fixed shared MobileNetV3-Small 17-class model, and connect real inference/review states. | Model, preprocessing, class map, evaluation report, and inference contract agree; image bytes are not persisted by default. |
| 4. Soil Investigation | Add persistent, dated manual/CSV soil sample records with location, units, depth, source, and method; show sample map/history and completeness. | Imported and manually entered records validate, preserve original values/units, survive restart, and clearly distinguish measurements from model estimates. |
| 5. SoilGrids context | Add an optional cached/downloaded SoilGrids view for supported properties/depths and available uncertainty quantiles. | Resolution, source/version/date, property/depth, and uncertainty context are visible; no generated field-cell precision or automatic feed into zoning/Crop Fit. |
| 6. CropSight vegetation sub-application | Run the pinned CropSight source independently with its own circular AOI and date window, its own provider configuration, and verified display outputs. | The supported source path is reproducible; Earth Engine/imagery failure and quality/coverage states are honest; no KshetraSense module data are read or changed. |
| 7. 2.5D/R3F integration and profiling | Add the data-responsive Three.js/R3F field treatment alongside the complete 2D path, with real selection/edit/result transitions and optional decorative assets. | Accessibility, fallback, reduced motion, and all TRD performance budgets pass on named references. |
| 8. Final integration and demonstration readiness | Cross-module state/privacy review, supported-device checks, reproducibility audit, release walkthrough, limitations and setup documentation. | A reviewer can trace each displayed output to source, request, method/version, and actual evidence; failures never become fake success. |

The sequence permits independent work on the crop model, soil processing, or CropSight environment, but user-visible completion gates remain in order. A visual element may be polished during its functional phase; it must never be used to disguise an unimplemented computation.

## Monitoring acceptance

| ID | Pass condition | Evidence | Status |
| --- | --- | --- | --- |
| FM-01 | A soil record includes location, collection time, source/method, depth where relevant, parameter, original value, and unit. Missing context is explicit. | `soilSampleValidation.ts`, `csvImport.test.ts`, and form/register UI. | Verified |
| FM-02 | Repeated soil readings are graphed only when their parameters, units, methods, depths, and time context are comparable; otherwise they remain separate observations. | `comparability.ts` and `comparability.test.ts` (6 unit tests). | Verified |
| FM-03 | SoilGrids shows property, depth, native resolution, available uncertainty quantiles, retrieval date, and modeled-context label. It never appears as a field sample. | `soilgrids.py`, `soilGrids.test.ts`, and `test_monitoring_api.py`. | Verified |
| FM-04 | Soil sample and SoilGrids state do not silently affect Soil Zoning or Crop Fit. | State isolation tests and explicit architectural boundary. | Verified |
| FM-05 | CropSight's live request carries its own center coordinates, radius, and date window; its result is labeled with source/provider and analysis period. | `monitoringApi.ts` and `cropsight.test.ts`. | Verified |
| FM-06 | Rendered CropSight maps, selected algorithm labels, and summaries agree with the underlying returned data. Known mismatched methods are disabled or clearly unavailable until verified. | `VegetationMonitoringView.tsx` (DBSCAN disabled with upstream mismatch warning). | Verified |
| FM-07 | No-image, inadequate-coverage, unavailable-provider, and authentication/quota failures do not display stale/prepared output as current. | `monitoringApi.ts` error classification and benchmark toggle. | Verified |
| FM-08 | Satellite anomaly/scouting language does not claim a cause; VRA, irrigation, and yield claims remain absent until their separate validation gates pass. | `VegetationMonitoringView.tsx` scouting guidance and strict limitations. | Verified |

## Core release acceptance

| ID | Pass condition | Evidence |
| --- | --- | --- |
| AC-01 | Same named seed creates the same synthetic test grid and units on repeated loads. | Determinism test and benchmark manifest. |
| AC-02 | Cell/zone inspection shows value, unit, source, and measurement context; missing data is not rendered as zero. | UI test and capture. |
| AC-03 | Edits/presets affect only declared cells; undo/redo restores exact input state. | Domain test. |
| AC-04 | A soil change marks a prior real zoning result stale and retains the prior immutable run. | Integration test. |
| AC-05 | K-means/FCM runs record parameters, seed, features/exclusions, versions, timing, diagnostics, and assignments. | Serialized real-run record. |
| AC-06 | Incomparable moisture is excluded with a visible reason; comparable moisture may be included. | Context-validation test. |
| AC-07 | FCM memberships are correctly mapped and described as membership strength, not confidence. | Algorithm/UI tests. |
| AC-08 | Soil, zoning, and membership modes have distinct titles/legends; zone meaning does not rely on color alone. | Accessibility/visual review. |
| AC-09 | Crop Fit shows factor status, value/unit when present, source/profile version, and missing-data state. | Rules/UI integration test. |
| AC-10 | Crop compatibility is unchanged when only cluster labels change and never names a best/recommended crop. | Unit test and copy scan. |
| AC-11 | Leaf result contains the 17 ranked classes, model/preprocessing/map versions, measured latency, and review/unsupported state. | Model contract test. |
| AC-12 | Leaf inference receives no zone, soil, SHI, or selected-crop feature. | Request-schema test. |
| AC-13 | All core workflows remain available without WebGL; mobile defaults to a usable 2D path. | Browser run with WebGL disabled and responsive tests. |
| AC-14 | Keyboard-only path reaches field actions; no required information depends on hover; reduced motion stops decorative travel/loops. | Accessibility and manual check. |
| AC-15 | Performance trace meets documented budgets on named desktop/constrained devices. | Versioned profile report. |
| AC-16 | No real sensor, pump, irrigation prescription, fertilizer dose, disease cure, yield estimate, or crop-success guarantee is claimed without a separately validated feature. | Copy and visual review. |
| AC-17 | Metrics appear only when linked to a measured report; otherwise the page says “Not measured yet.” | UI test and artifact audit. |
| AC-18 | Every imported asset has provenance, source/license record as available, checksum, transfer size, and geometry metadata. | Asset-manifest audit. |
| AC-19 | Every published crop-rule range has source, unit, version, boundary/missing-data behavior, and test coverage. | Rule test report. |
| AC-20 | Crop Fit remains three independent per-crop outputs; no normalized 100% cultivation-probability split is shown. | UI/copy test. |

## College demonstration walkthrough

1. Open Field Lab with a real supplied dataset; identify its source and measurement context before running Soil Zoning.
2. Apply a deliberate local soil edit, undo it, rerun zoning, then inspect the actual returned zone summaries and diagnostics.
3. Open Crop Fit for a selected cell/zone and explain the independent source-backed assessment and any unassessed factors.
4. Submit an eligible leaf photo and inspect the actual classifier result and review limitations.
5. In Field Monitoring, inspect dated soil samples, compare only compatible repeated measurements, and view SoilGrids separately as coarse modeled context.
6. Open CropSight, enter its own circular AOI and date window, view the actual imagery/NDVI/time-series result, and identify a patch to scout without claiming a diagnosis or prescription.
7. Show Evidence & Methods, the provenance chain, real evaluation reports, and unavailable/deferred features.

If a required provider is unavailable during demonstration, show the explicit unavailable state and setup requirement. Do not substitute a canned screen as if the provider ran.

## Assumptions and stop gates

| Assumption/risk | Required handling |
| --- | --- |
| PlantVillage labels and physical-leaf split match the intended 17 classes. | Audit files, labels, counts, and split metadata; save a versioned manifest. |
| PlantDoc has exact supported label matches. | Audit labels and report only actual coverage. |
| CropSight runtime dependencies/configuration are complete. | Test the pinned source in an isolated environment, provide required packages/configuration outside the preserved source when possible, and record setup. |
| Earth Engine access/quota is available for the college demonstration. | Validate the configured noncommercial project and show distinct authentication/quota/image-coverage errors. |
| CropSight algorithm names match map outputs. | Verify source-to-display behavior; suppress or mark any known mismatch unavailable without claiming it is valid. |
| SoilGrids downloads remain available under current service terms. | Use a versioned cache/download route; its API is optional, and absent context stays absent. |
| Soil readings are comparable across time. | Preserve source, units, collection date, method, and depth; do not chart unlike measurements as one trend. |
| Real field photos generalize beyond controlled datasets. | State tested label scope, report cross-dataset evidence separately, and provide review/unsupported states. |
| Agronomy thresholds support Crop Fit. | Show raw supported factors/“Not assessed” until source, geography, units, thresholds, and tests exist. |
| 3D harms speed or access. | Build 2D interaction, instance geometry, bound the scene, and profile fallback/mobile paths. |
| Spline export or embed is restricted/heavy. | Keep optional, lazy, decorative, and replaceable by SVG/Three.js. |

Do not publish accuracy without the audited split/evaluation report; crop compatibility without sourced thresholds and tests; or VRA, irrigation, and yield estimates without dedicated validation. Do not enable production 3D by default for a device class without profiling and an equivalent accessible path. Do not add an asset before it passes the [TRD asset gate](TRD.md#asset-policy). The CropSight academic-use decision is recorded in Decision 0004; it does not establish a public redistribution right.

## Soil zoning module: known follow-up items and refinement punch list

The following items are tracked for progressive refinement and verification in subsequent passes:

### 1. Canvas & Viewport Responsiveness
- **Camera Aspect & Viewport Refocus:** When collapsing or expanding the Left Config or Right Inspector panels, or toggling the "Focus" full-width mode, ensure OrbitControls and camera frustum smoothly adapt without requiring manual zoom re-centering.
- **Brush Pointer Lock vs Orbit Dragging:** In 3D mode while Brush tool is active, enforce strict event isolation so rapid drag-painting strokes never trigger accidental camera orbit rotation.
- **High-DPI / Retinal Screen Canvas Scaling:** Verify `<ClickSpark>` overlay canvas pixel ratio syncs accurately with window device pixel ratio (`window.devicePixelRatio`) during browser zoom levels (125%, 150%).
- **Non-Color Zone Discrimination in 3D:** While the 2.5D Atlas Map uses SVG patterns (`pattern-zone-1` through `4`), evaluate adding procedural top-face texture stripes or discrete elevation tiers in 3D mode so zones are immediately distinguishable without relying on color alone per WCAG 2.2 AA.
- **Perimeter Scenery Draw-Call Profiling:** Continuously profile instanced mesh and GLB clone draw calls for the 12 Kenney assets against TRD mobile and constrained GPU budgets (maintaining $\ge$ 60 FPS).

### 2. Service & Algorithm Integration
- **Automated Service Health Polling:** Add a periodic lightweight health check (`GET /health`) with an automatic reconnect status indicator so the UI recovers automatically when the local FastAPI server starts after the browser shell.
- **Environment & Port Documentation:** Ensure `.env.example` documents `VITE_ZONING_API_URL` and `CORS_ORIGINS` to support custom local ports (e.g. Vite port 3000 vs 5173).
- **Attribute Key Normalization:** Maintain test coverage for both camelCase and snake_case aliases (`soil_temperature` $\leftrightarrow$ `soilTemperature`, `ph` $\leftrightarrow$ `pH`) across all zoning endpoints.
- **Iterative Convergence Diagnostics:** Surface additional diagnostic telemetry (e.g. iteration progression curve, inertia reduction) in an expandable panel for agronomy researchers.

### 3. Field Editing & History
- **Grid Boundary Clamping:** Verify drag-brush strokes that exit the 18×12 perimeter cleanly release the active pointer without leaving dangling hover indicators on edge cells.
- **Batch Preset Undo Granularity:** Ensure single-click presets (Low nitrogen patch, High EC pocket, Acidic wash) are stamped with descriptive labels in the undo stack.
- **Detailed CSV Import Validation Tooltips:** Display line-by-line validation errors if user-supplied soil CSV files have missing columns or out-of-range values.

### 4. Crop Fit Sourced Evidence
- **Agronomic Threshold Expansion:** When verified, peer-reviewed agronomic ranges for N/P/K and EC become available, expand rules beyond pH while keeping explicit "Not assessed" states for unverified parameters.
- **Methodology & Limitation Disclosures:** Keep evidence disclosures prominent to reinforce that zoning and crop-fit screening provide spatial decision support, not automatic fertilizer prescriptions or yield guarantees.

