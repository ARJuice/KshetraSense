# Phase 4: Field Monitoring UI Transformation

**Status:** Implemented and automated checks passed on 2026-10-14. SoilGrids WCS and CropSight Earth Engine were both live-smoke-tested locally on 2026-10-14; manual visual/accessibility review remains pending. Other machines still need their own Earth Engine project access and local authentication.
**Scope:** `src/features/monitoring/` — Soil Investigation, historical telemetry replay, and the independent CropSight vegetation workflow.
**Depends on:** Phase 3 telemetry API, ISRIC SoilGrids public WCS, and CropSight aggregate-analysis API. Live CropSight analysis requires an Earth Engine project, local credentials, quota, and imagery coverage. The project ID is selected through `EARTHENGINE_PROJECT` (default: `kshetrasense-earth-engine`); credentials remain outside the repository.
**Manual setup:** The current developer environment has Earth Engine access configured and verified. Any other machine must independently authenticate and use an authorized Earth Engine project; the rest of Field Monitoring works without it.

---

## 4.1 Product contract

Field Monitoring is a desktop-first work area with three distinct tasks:

1. **Soil Investigation:** review locally stored measured samples, starting from an empty register; show SoilGrids regional context only after a real provider is verified.
2. **Historical Telemetry Replay:** inspect the Parma tomato research trial supplied by Phase 3. This is historical data, not the user's farm, not a live WSN connection, and not bound to Soil Zoning or cadastral boundaries.
3. **Vegetation Monitoring:** use CropSight/Sentinel-2 for its own area and date inputs. It remains separate from Soil Investigation, the telemetry benchmark, soil zoning, and Crop Fit.

Do not remove the existing Soil Investigation workflow or its sample forms to make room for replay. A user can switch among these work areas without silently sharing values or presenting one module's data as another's. New installs no longer preload synthetic sample presets. Previously stored `seed-preset` rows are copied to a separate legacy archive and removed from the active register; manual/CSV rows are preserved. If browser storage prevents migration, retained synthetic rows are visibly marked as non-measurements and excluded from summaries/trends.

The former local SoilGrids coordinate formula was not a SoilGrids query and has been removed. `GET /v1/monitoring/soilgrids` queries the public ISRIC WCS for Q0.05/Q0.50/Q0.95 GeoTIFF subsets, selects the georeferenced cell containing the coordinate, and applies the official property scale factor. It supports eight documented properties and six standard depths. The result is nominal-250 m modeled regional context—not a sample or zoning input. Provider/no-data/malformed responses return HTTP 503 without a fallback. The beta REST API remains paused; ISRIC documents WCS for spatial subsets and WebDAV for global VRT data. See [Decision 0009](../decisions/0009-monitoring-data-provenance-and-provider-readiness.md), [Decision 0010](../decisions/0010-soilgrids-wcs-context-adapter.md), and the [WCS evidence note](../research/soilgrids-wcs-provider-verification.md).

---

## 4.2 Historical replay workflow

1. Open **Field Monitoring → Telemetry Replay**. Before data appears, show the persistent source badge: **“Historical research replay · Parma tomato trial · 2023 · not live telemetry.”**
2. Review the source, trial period, CC BY 4.0 attribution, feature units, and data-quality notes.
3. Choose **Trial line 1, 2, or 3**. Explain the published 100% / 60% / 30% Irriframe treatment labels; never rename them “Zone 1/2/3” or attach them to a field polygon.
4. Use Play/Pause, a bounded date-time scrubber, and `1× / 10× / 60× / 360×` playback speeds. Seeking outside the dataset range is rejected. End-of-data stops without looping.
5. Inspect raw observations with their actual source timestamps and units:
   - Soil humidity sensor output `%RH` (explicitly **not VWC**).
   - Soil EC `µS/cm` and soil temperature `°C` at 20 cm.
   - Shared air temperature `°C` and relative humidity `%RH` from the single environmental station.
   - Optional battery `%` only when present; missingness is common and must not be filled or changed to volts.
   - Optional `current_volume` meter field in its source-stated m³ unit, with an adjacent warning that scale/semantics are not independently validated. Never derive liters, L/min, an open valve, or a watering event from it.
6. Show the two-layer GRU output at +6/+12/+24 hours as a **soil humidity signal forecast (`%RH`, not VWC)**. Include the model/version, input-window completeness and interpolation count, held-out metrics, and persistence-baseline comparison. If a horizon does not beat persistence, state that plainly. Forecast points are exploratory and have no calibrated interval.
7. Show Isolation Forest results only as **review candidates** with an unsupervised score and the explanation that a candidate is not a diagnosed sensor fault or probability.
8. The replay screen never presents water-stress thresholds, irrigation need, valve state, flow, water deficit, gateway connectivity, or water savings based on this dataset. The separate calibrated-VWC FAO-56 endpoint remains API-only; Phase 4 does not expose a form or feed it the trial's `%RH` values.

**Implemented boundary:** Replay uses REST metadata/state/control/history and read-only WebSocket snapshots, with REST polling fallback. It displays source-aligned observations and gaps, a bounded 24-hour history chart, treatment-line comparison, `%RH` forecast points, holdout-vs-persistence MAE, and Isolation Forest review candidates. The FAO-56 endpoint remains separate and requires explicit calibrated-VWC/site inputs.

### Chart and data presentation

- Plot original soil humidity readings as measured points with their observation times; do not style them as VWC or silently connect long gaps. Air observations are identified as shared station context.
- Mark gaps and show the loader's interpolation count for model inputs. The forecast model's regularly aligned/interpolated matrix is not relabeled as a measured chart series.
- Allow a line-specific view and an all-lines comparison, but keep the treatment labels visible and do not imply transferability to another site.
- Display GDD/heat-unit source data only if a later task defines useful scope; Phase 4 does not infer ETc, rainfall, yield, crop stress, or irrigation scheduling from them.

---

## 4.3 Implemented component architecture

The UI remains organized around the existing monitoring feature and uses installed controls/chart dependencies. The implementation is intentionally compact:

```text
src/features/monitoring/
├── FieldMonitoringView.tsx
├── SoilInvestigationView.tsx      # Register, imports, regional-context state
├── SampleCoverageMap.tsx
├── TelemetryReplayView.tsx        # Replay/history/forecast/anomaly panels
├── VegetationMonitoringView.tsx   # CropSight aggregate outputs only
├── soilSampleStorage.ts           # Empty default + legacy seed migration
└── telemetryViewModel.ts          # Timestamp/gap-preserving chart series
```

`src/services/telemetryApi.ts` consumes Phase 3 `/v1/telemetry/metadata`, `/state`, `/control`, `/stream`, `/history`, and read-only WebSocket snapshots. `src/services/monitoringApi.ts` validates SoilGrids and CropSight requests/responses. SoilGrids queries real WCS coverages; no-data/provider results return errors rather than synthetic values. CropSight displays only the validated aggregate/time-series fields its API returns. Failures preserve inputs and show retryable status; no fabricated telemetry, benchmark, SoilGrids estimate, or CropSight spatial zones are substituted.

---

## 4.4 Visual and interaction requirements

- Preserve the app's clean ERP-style shell, restrained color system, and readable scientific units. Use badges and concise warnings for provenance; avoid decorative gauges or glowing status colors that imply a live system.
- Make playback controls keyboard accessible; expose play/pause state and current time to assistive technology; respect reduced motion.
- Use line patterns/labels as well as color in the comparison chart. Tooltips include units, source, observation timestamp, and whether a value is absent.
- Keep this view useful at the target desktop width and provide a clean narrow viewport fallback; the overall project remains desktop-first.
- Do not add 3D/GLB/Spline decoration to telemetry unless it communicates a real measured field geometry. This benchmark has no field polygon suitable for a KshetraSense 3D map.

---

## 4.5 Verification and acceptance

1. Source, attribution, dates, treatment labels, units, and `%RH`-not-VWC are shown. **Implemented.**
2. Playback, seek/speed controls, WebSocket/polling transport state, and API failures are represented; Field Monitoring tabs do not share result state. **Implemented; API and component logic tested.**
3. Raw observations retain timestamps/units and chart gaps; model-grid interpolation is disclosed separately. **Implemented and view-model tested.**
4. Forecast values, horizons, input completeness, holdout metrics, and persistence comparison match the API. The failed baseline comparison is explicit. **Implemented.**
5. Anomalies are review candidates only. No live gateway, valve, flow, VWC threshold, or actuation UI is shown. **Implemented.**
6. SoilGrids returns only real mapped WCS cells with documented units/quantiles and provenance; masked cells/provider failures show no estimate. Legacy preset records are archived or visibly disclaimed; CropSight shows no stale or fabricated result. **Implemented and tested; live WCS smoke test passed.**
7. CropSight only displays returned aggregate NDVI statistics, time series, optional rainfall, and unvalidated heuristic notes. Its current API provides no raster or spatial zones, so none are shown. **Implemented and tested with response fixtures. Live Earth Engine smoke test passed locally:** the published Parma tomato research-trial sensor locations were averaged to an approximate center (44.808726, 10.273005); a 50 m circular AOI for 2023-06-29 through 2023-09-14 returned 38 Sentinel-2 scenes, mean NDVI 0.347, standard deviation 0.158, range 0.103–0.604, a decreasing time-series trend, and rainfall context. These are historical research-site results, not a current farm assessment. The circle is an approximate demo AOI, not a cadastral boundary. Source: [published Parma tomato-trial dataset](https://pmc.ncbi.nlm.nih.gov/articles/PMC12002878/).
8. Automated verification (2026-10-14): `npm test` passed 46 tests in 13 files; `npm run typecheck` and `npm run build` passed; the full Python suite passed 75 tests. The Vite build reports the existing 824.24 kB `FieldScene3D` chunk above the 500 kB advisory threshold.
9. Manual browser/accessibility inspection is still pending. The UI automation safety check stopped before opening a confidently identified page URL, so a screenshot-based visual pass is not claimed.

### Remaining manual/provider gates

- The local Earth Engine project/authentication and CropSight live API path are verified; other machines require their own authorized project, credentials, dependencies, quota, and imagery coverage. Do not copy local credentials into the repository.
- Recheck live ISRIC WCS and Earth Engine availability at demonstration time; both are external services and may be down or rate-limited. Do not substitute local estimates or fabricated satellite results. The full-season CropSight request took about 200 seconds in this smoke test, so long date windows may be slow.
- A separately scoped UI may expose the calibrated-VWC FAO-56 endpoint later; never connect it to the replay's `%RH` signal.
- Manually verify browser accessibility/layout and profile the oversized 3D bundle in a later review.
