# Delivery plan and acceptance

**Status:** Release acceptance checklist. The authoritative implementation sequence and phase status are in [plans/README.md](plans/README.md); Phases 1–4 are implemented, Phase 5 contract/defense materials are prepared, and the leaf classifier release gate remains open. SoilGrids uses the public ISRIC WCS with honest no-data/outage states; live Earth Engine use still requires user setup. No visual-only or fixture-output product phase is planned.

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
| 2. Soil Zoning UI Redesign — complete | Boundary/sample input, real `/v2` integration, returned clipped-cell layers/diagnostics, and selected-cell/zone Crop Fit via the existing rules endpoint. | Frontend/service tests pass; no canned result; edits mark prior runs stale; 2D/3D use the same response geometry; 3D obeys cell and triangle limits. |
| 3. Historical Telemetry Replay & Soil-Signal Forecast — complete | Pinned Parma research data, provenance-aware playback API, experimental `%RH`-signal GRU, candidate-only anomaly screen, and separate calibrated-VWC FAO-56 advisory. | 62 Python tests pass; model/data metadata and source hashes are recorded. The GRU fails to beat persistence at all horizons and is explicitly evaluation-only; no live/zone/actuation claim. |
| 4. Field Monitoring UI Transformation — complete | Add the historical replay view alongside empty-by-default Soil Investigation and independent CropSight aggregate analysis; preserve module boundaries. | Frontend/API tests pass; replay provenance, raw units, data quality, and weak model performance are visible; no fake SoilGrids values or CropSight zones; provider/setup failures are honest; no output silently changes zoning or Crop Fit. |
| 5. Leaf Contract, Verification & Defense — contract prepared | Freeze the image-only 17-class MobileNetV3-Small API boundary, cross-module test matrix, demonstration narrative, and defense guide. | **Documentation complete; classifier release gate remains open.** The future route/model must pass dataset audit, preprocessing/class-map agreement, measured evaluation, calibration/review policy, resource-limit and image-privacy tests before inference is enabled. No leaf model, route, or weights are currently included. |

The sequence permits independent work on the crop model, soil processing, or CropSight environment, but user-visible completion gates remain in order. A visual element may be polished during its functional phase; it must never be used to disguise an unimplemented computation.

## Monitoring acceptance

Phase 3 backend acceptance is verified by its data, playback, water-balance, and API tests together with the existing zoning tests. Phase 4 adds API-client/view-model tests and a production build. Automated verification does not replace a manual browser/accessibility review; the visual browser pass remains pending.

| ID | Pass condition | Evidence | Status |
| --- | --- | --- | --- |
| FM-01 | A soil record includes location, collection time, source/method, depth where relevant, parameter, original value, and unit. Missing context is explicit. | `soilSampleValidation.ts`, `csvImport.test.ts`, and form/register UI. | Verified |
| FM-02 | Repeated soil readings are graphed only when their parameters, units, methods, depths, and time context are comparable; otherwise they remain separate observations. | `comparability.ts` and `comparability.test.ts` (6 unit tests). | Verified |
| FM-03 | SoilGrids shows property, depth, nominal resolution, Q0.05/Q0.50/Q0.95, retrieval date, and modeled-context label only from a real ISRIC WCS cell; no-data/provider errors show no estimate. | `soilgrids.py`, `test_soilgrids.py`, `soilGrids.test.ts`, and live WCS smoke test. | Verified — WCS adapter active; upstream uptime external |
| FM-04 | Soil sample and SoilGrids state do not silently affect Soil Zoning or Crop Fit. | State isolation tests and explicit architectural boundary. | Verified |
| FM-05 | CropSight's request carries its own center coordinates, radius, and date window; displayed results are labeled with actual source/provider and analysis period. | `monitoringApi.ts` and `cropsight.test.ts` verify validation/mapping; live Earth Engine execution awaits user setup. | Contract verified — live provider pending |
| FM-06 | Displayed CropSight method labels and summaries agree with the returned data; no spatial map is rendered when the response has no raster or zone geometry. | `VegetationMonitoringView.tsx` and `cropsight.test.ts`; K-means is the only enabled method and absence of spatial output is explicit. | Verified — aggregate output only |
| FM-07 | No-image, unavailable-provider, malformed-response, and authentication/quota failures do not display stale/prepared output as current. | `monitoringApi.ts` error classification and `cropsight.test.ts`; no benchmark toggle or fallback remains. | Verified |
| FM-08 | Satellite anomaly/scouting language does not claim a cause; VRA, irrigation, and yield claims remain absent until their separate validation gates pass. | `VegetationMonitoringView.tsx` scouting guidance and strict limitations. | Verified |
| FM-09 | Historical replay UI preserves source timestamps/units, bounded-history gaps, playback controls, model-quality disclosure, and non-operational anomaly semantics. | `telemetryApi.test.ts`, `telemetryViewModel.test.ts`, production build, and Phase 3 API tests. | Verified |

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
4. In Field Monitoring, create/import dated soil samples and compare only compatible repeated measurements. Query SoilGrids as separate nominal-250 m context; explain that no-data or provider outage gives no estimate and never fills a local sample or field cell.
5. Replay the Parma research series and explain its `%RH` units, source/treatment labels, model-versus-persistence holdout result, anomaly-candidate semantics, and lack of live/actuation behavior.
6. After the user configures Earth Engine and ensures the CropSight sub-application/dependencies are available, enter its independent circular AOI/date window and review only returned aggregate NDVI statistics/time series. Explain that the current response has no map-ready raster or zone outputs; do not claim a patch-level prescription or scouting coordinate.
7. Show the Leaf Diagnosis contract and Evidence & Methods; run a leaf classifier only after its separately built model and inference service pass Phase 5 acceptance.
8. Show the provenance chain, measured evaluation reports, and unavailable/deferred features.

If a required provider is unavailable during demonstration, show the explicit unavailable state and setup requirement. Do not substitute a canned screen as if the provider ran.

## Assumptions and stop gates

| Assumption/risk | Required handling |
| --- | --- |
| PlantVillage labels and physical-leaf split match the intended 17 classes. | Audit files, labels, counts, and split metadata; save a versioned manifest. |
| PlantDoc has exact supported label matches. | Audit labels and report only actual coverage. |
| CropSight runtime dependencies/configuration are complete. | Test the pinned source in an isolated environment, provide required packages/configuration outside the preserved source when possible, and record setup. |
| Earth Engine access/quota is available for the college demonstration. | Validate the configured noncommercial project and show distinct authentication/quota/image-coverage errors. |
| CropSight algorithm names match map outputs. | Verify source-to-display behavior; suppress or mark any known mismatch unavailable without claiming it is valid. |
| Public WCS availability can change or be temporarily unavailable. | Recheck at demonstration time; retry only the real request and show explicit provider/no-data errors. The adapter uses no credentials and does not create a substitute estimate. |
| Soil readings are comparable across time. | Preserve source, units, collection date, method, and depth; do not chart unlike measurements as one trend. |
| Real field photos generalize beyond controlled datasets. | State tested label scope, report cross-dataset evidence separately, and provide review/unsupported states. |
| Agronomy thresholds support Crop Fit. | Show raw supported factors/“Not assessed” until source, geography, units, thresholds, and tests exist. |
| 3D harms speed or access. | Build 2D interaction, instance geometry, bound the scene, and profile fallback/mobile paths. |
| Spline export or embed is restricted/heavy. | Keep optional, lazy, decorative, and replaceable by SVG/Three.js. |

Do not publish accuracy without the audited split/evaluation report; crop compatibility without sourced thresholds and tests; or VRA, irrigation, and yield estimates without dedicated validation. Do not enable production 3D by default for a device class without profiling and an equivalent accessible path. Do not add an asset before it passes the [TRD asset gate](TRD.md#asset-policy). The CropSight academic-use decision is recorded in Decision 0004; it does not establish a public redistribution right.

## Soil zoning implementation

The prior grid-brush refinement list is superseded by the implemented [Phase 2 sparse-sample UI contract](plans/phase-2-soil-zoning-ui-redesign.md). Do not implement brush-specific work against the new field-scale pipeline.

