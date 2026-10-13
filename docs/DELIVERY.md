# Delivery plan and acceptance

**Status:** Release acceptance checklist. The authoritative implementation sequence and phase status are in [plans/README.md](plans/README.md); Phase 1 backend is complete, and the Phase 2 UI migration is next. No visual-only or fixture-output product phase is planned.

## Delivery principles

- Build working, testable vertical slices; do not build all screens against fabricated results and wire services later.
- Synthetic data is allowed for unit tests, algorithm benchmarks, and explicit development diagnostics. It is never silently presented as a user field, satellite observation, zoning run, crop assessment, or leaf prediction.
- A module can show a truthful input-needed, no-data, unavailable, or error state while its real data contract is being implemented. A false “success” screen is not an acceptable placeholder.
- Preserve scope boundaries in [Decision 0004](decisions/0004-field-monitoring-and-direct-build.md): Soil Zoning, Crop Fit, Leaf Diagnosis, and Field Monitoring remain separate.
- Design and visual craft matter from the first useful screen. Use sketches/visual exploration as needed, but implement the selected design directly as a functional product slice rather than a throwaway mock app.

## Functional delivery phases

| Phase | Deliverable | Exit condition |
| --- | --- | --- |
| 1. Backend Algorithmic Core — complete | GeoJSON/UTM grid, IDW, KshetraSense SHI, Auto-K K-means/FCM, adjacent-profile merge, contiguous components, source-sample sensitivity, and WSN/gateway candidates at `/v2/zoning/run`. | Backend tests pass; estimates, provisional score, sensitivity assumptions, and geometry-only candidates are labeled honestly. |
| 2. Soil Zoning UI Redesign — planned | Replace the legacy grid/painting path with boundary/sample input, real `/v2` integration, returned layers/diagnostics, and selected-cell/zone Crop Fit via the existing rules endpoint. | No canned result; edits make prior runs stale; 2D and WebGL paths agree with actual response data and expose limitations. |
| 3. WSN Telemetry Service & Edge AI — planned | Verify the selected replay data, implement a provenance-aware playback API, GRU moisture forecast, FAO-56 MAD logic, and anomaly filtering. | Dataset/schema/split and forecasting tests pass; no hardware actuation claim unless validated separately. |
| 4. Field Monitoring UI Transformation — planned | Build monitoring views for the telemetry workflow and the isolated CropSight vegetation workflow; preserve Soil Investigation and SoilGrids boundaries. | Provider/data failures are honest; no monitoring output silently changes zoning or Crop Fit. |
| 5. Leaf Contract, Verification & Defense — planned | Freeze and verify the 17-class MobileNetV3-Small interface and evaluation/data contract; prepare demonstration and defense materials. | Model, preprocessing, class map, evaluation report, and inference interface agree; image bytes are not persisted by default. |

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
| AC-03 | Boundary/sample edits preserve exact prior input state and identify the changed source records. | Domain test. |
| AC-04 | A boundary, sample, or run-parameter change marks a prior real zoning result stale and retains the prior immutable run. | Integration test. |
| AC-05 | K-means/FCM runs record parameters, seed, features/exclusions, versions, timing, diagnostics, and assignments. | Serialized real-run record. |
| AC-06 | The Phase 1 field run uses only pH, EC, N, P, and K with fixed units and a common explicit depth; unsupported properties are not silently mixed in. | Request-schema and UI validation tests. |
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
2. Change one source sample value, show that the previous run is stale but retained, rerun zoning, then inspect the returned summaries and diagnostics.
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

## Soil zoning frontend migration

The prior grid-brush refinement list is superseded by the [Phase 2 sparse-sample UI contract](plans/phase-2-soil-zoning-ui-redesign.md). Do not implement brush-specific work against the new field-scale pipeline.

