# Decision 0009: Field Monitoring provenance and provider readiness

**Status:** accepted and implemented for Phase 4
**Date:** 2026-10-14
**Scope:** Soil Investigation, SoilGrids, CropSight vegetation monitoring, and historical telemetry replay.

## Context

The Phase 4 implementation audit found three ways a plausible-looking interface could overstate its evidence: the Soil Investigation register had synthetic preset rows in local storage, the local SoilGrids path generated coordinate-based values rather than retrieving ISRIC data, and the CropSight API did not return the raster or zone geometry needed for the spatial map shown by an earlier UI. Phase 4 also adds a user-facing replay for the Phase 3 historical trial, whose soil humidity signal is `%RH`, not calibrated volumetric water content (VWC).

The user directed the implementation to proceed autonomously, with Earth Engine setup deferred for later manual completion and no more clarification/grill questions. No question was sent to the user in this phase. The questions below are the implementation decisions considered and resolved without interrupting work.

## Decisions

### 1. Soil Investigation starts empty; legacy synthetic records are not measurements

- An unset soil-sample store means an empty register; do not insert a practice farm or generated sample records.
- Existing `seed-preset` records are copied to `kshetrasense:soil-samples:v1:legacy-presets` and removed from the active sample register. Existing manual-entry and CSV-import records are preserved.
- If local storage prevents the migration, retained seed records are labeled `Legacy synthetic demo preset — not a field measurement`, their misleading lab-report reference is removed, and the UI excludes them from measurement summaries and comparable trends.
- No user measurement is deleted by the migration. Legacy rows remain recoverable from the separate local archive.

### 2. SoilGrids remains unavailable until a real provider is verified

- Remove the former local coordinate/arithmetic formula. It was not an ISRIC SoilGrids query and must not be labeled or presented as modeled soil data.
- Validate request coordinates, property, and depth; return HTTP 503 while no verified data provider is configured. The UI shows the unavailable state and no estimate.
- At verification time, ISRIC's documentation states that the beta REST API is temporarily paused. It identifies WCS as the preferred route for spatial subsets and WebDAV as access to global VRT files. These are candidate real-data routes for a later adapter, not implemented providers.
- Any future estimate must carry actual product, property, depth, units, resolution, uncertainty/quantiles when available, retrieval/source metadata, and the modeled-context disclaimer. Do not feed it automatically into soil zoning or Crop Fit.

### 3. CropSight displays only outputs present in its actual response

- Preserve the independent circular AOI/date workflow and do not implicitly link it to cadastral boundaries, Soil Zoning, Crop Fit, leaf results, or the Parma telemetry trial.
- The response currently validated by the host contains aggregate NDVI statistics, a per-scene mean-NDVI time series, optional rainfall fields, and upstream heuristic strings. Display the heuristic strings only with an explicit unvalidated label.
- The endpoint does **not** return NDVI raster pixels, pixel cluster labels, zone polygons, or per-zone statistics. Delete synthetic benchmark results and generated zone-stat/map logic. Do not imply that a requested K-means count produces a visible spatial zone, prescription map, or patch-level scouting coordinate.
- Keep Earth Engine project/authentication/quota setup as a later user task. A missing/unreachable provider, invalid response, authentication failure, quota error, or no-image result must not reveal stale or fabricated results.
- Variable-rate application, irrigation decisions, yield estimation, and causal crop-stress diagnoses remain unsupported outputs.

### 4. Historical replay stays separate from an operational irrigation advisory

- Show the Parma source, attribution, period, line treatments, raw observation times, units, and data-quality context. Do not present research lines as KshetraSense fields or zones.
- Keep the GRU result as an experimental `%RH` signal forecast and show the holdout comparison. Since it does not beat persistence at the evaluated horizons, it is marked not for irrigation. Isolation Forest output remains an unsupervised review candidate, not a fault diagnosis.
- The separate calibrated-VWC FAO-56 API is not exposed as a replay control or inferred from `%RH`. Its endpoint remains available only for explicit calibrated-VWC and site inputs; a future UI must be separately scoped.

## Autonomous questions considered and answers

| Question considered during implementation | Decision |
| --- | --- |
| Should preloaded synthetic soil samples stay active to make the first screen look populated? | No. Start empty; archive old seed-provenance rows without discarding them. |
| Can a coordinate-based local formula be kept as a convenient SoilGrids approximation? | No. It has no SoilGrids data provenance; return unavailable until a real provider is verified. |
| Should CropSight display a zone map because the request accepts a cluster count? | No. The response lacks raster/label/geometry output, so only returned aggregate values and time series are displayed. |
| Should the telemetry replay expose FAO-56 advice from its soil-humidity signal? | No. The trial signal is `%RH`, not calibrated VWC; keep the advisory API separate. |
| Does deferred Earth Engine setup block finishing the rest of Field Monitoring? | No. Complete the validated UI/service boundary and leave the live-provider run for the user's later setup. |

## Consequences and open gates

- Fresh Field Monitoring is honest but less populated until a user imports/enters measurements or completes provider setup.
- SoilGrids has no working estimate in the current build. A future WCS/WebDAV adapter needs data/product mapping, validation, provenance, quantile handling, and tests before re-enablement.
- CropSight is usable as a form and validated result view after its separate API and Earth Engine configuration are available, but its present contract cannot provide spatial zoning or variable-rate outputs.
- The UI can be automated-tested against valid API response fixtures, but live Earth Engine execution is not verified until the user configures credentials/project and starts the service.
- Manual visual/accessibility review remains pending; automated browser inspection stopped before opening a confidently identified page URL.
- The frontend production build still emits a Vite advisory for the existing 824.24 kB `FieldScene3D` chunk, which exceeds the 500 kB warning threshold; it did not fail the build.

## Validation evidence

- Frontend: 45 tests across 13 files pass; `npm run typecheck` and `npm run build` pass.
- Backend: 62 Python tests pass. The SoilGrids API is directly checked to return HTTP 503 with an explicit provider-unavailable explanation; health reports the same unavailable status.
- CropSight tests validate the actual response contract, malformed/error handling, and absence of fabricated zones/benchmarks. They do not claim a live Earth Engine run.
- Telemetry API and view-model tests cover control/URL behavior, API errors, source timestamps, and gaps in chart data.

## References

- [ISRIC SoilGrids access FAQ](https://docs.isric.org/globaldata/soilgrids/SoilGrids_faqs_02.html) — current service note for the paused beta REST API and alternative access routes.
- [ISRIC SoilGrids WCS documentation](https://docs.isric.org/globaldata/soilgrids/wcs.html) — spatial subset access.
- [ISRIC SoilGrids WebDAV documentation](https://docs.isric.org/globaldata/soilgrids/WebDav.html) — global VRT access.
- Implementation contracts: [`Phase 4 plan`](../plans/phase-4-field-monitoring-transformation.md), [`PRD`](../PRD.md), and [`TRD`](../TRD.md).
