# KshetraSense

KshetraSense is a local, desktop-first smart-farming application for soil zoning, zone-scoped crop-fit screening, and field monitoring. The current build replaces the former mock UX with a functional local zoning service and a clean three-module workspace. Leaf-image classification is intentionally not included in this build and will be developed separately.

## Current architecture status

Phases 1–4 are implemented and verified; Phase 5 (leaf contract and defense materials) remains planned. Soil Zoning accepts a WGS84 field polygon and 3–50 georeferenced lab samples (5–10 recommended), then submits the data to `POST /v2/zoning/run`: local UTM grid → IDW estimates → project-defined KshetraSense SHI → Auto-K K-means/FCM → contiguous zones and diagnostics. Samples require a common explicit depth interval and use pH (dimensionless), EC (dS/m), and N/P/K (mg/kg). The UI shows returned values and exposes Crop Fit for an explicitly selected cell or zone. See the [five-phase plan](docs/plans/README.md), [Phase 1 contract](docs/plans/phase-1-backend-algorithmic-core.md), and [Phase 2 implementation](docs/plans/phase-2-soil-zoning-ui-redesign.md).

The local FastAPI service exposes an attributed historical Parma tomato-trial replay under `/v1/telemetry/`, now available in Field Monitoring. The 2023 dataset is not live KshetraSense telemetry; its soil humidity target is the source-reported `%RH` sensor signal, not calibrated VWC. The experimental GRU did **not** beat the persistence baseline at 6, 12, or 24 hours, so the UI marks it as not for irrigation. There is no valve control or zone binding. Field Monitoring also contains separate Soil Investigation and CropSight vegetation views. SoilGrids currently returns an explicit unavailable response until a real ISRIC-backed provider is configured; CropSight requires a separately running service and user-provided Earth Engine setup, and its current API exposes aggregate NDVI/time-series data rather than a raster or spatial zone map. See the [Phase 3 contract](docs/plans/phase-3-wsn-telemetry-service.md), [Phase 4 implementation](docs/plans/phase-4-field-monitoring-transformation.md), and [telemetry service notes](services/telemetry/README.md).

SHI is a provisional KshetraSense screen, not an official USDA/NRCS index or crop-success probability. IDW outputs are estimates from sparse samples; WSN/gateway coordinates are geometric suggestions, not radio-validated installation locations. No field-validation claim is made.

## Run the current build

The zoning page needs both local processes. The browser app never falls back to a prepared zoning or crop-fit result if the service is unavailable.

```powershell
# Terminal 1 — local zoning and crop-fit service
Set-Location services/zoning
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```

```powershell
# Terminal 2 — React workspace
npm install
npm run dev
```

Open the local Vite address shown by the second command (`http://localhost:3000/` or `http://127.0.0.1:3000/`). The Soil Zoning workspace starts empty by design. Import a WGS84 GeoJSON Polygon and enter measured soil samples or import a CSV with `id`, `latitude`, `longitude`, `depth_cm`, `ph`, `ec`, `nitrogen`, `phosphorus`, and `potassium`. Optional columns are `collection_date`, `lab_method`, and `uncertainty_ph`, `uncertainty_ec`, `uncertainty_nitrogen`, `uncertainty_phosphorus`, `uncertainty_potassium`.

### What is working now

- **Sparse-sample field setup:** Empty-by-default boundary upload, manual or CSV sample input, in-field pin placement, units/depth validation, and analysis parameters.
- **Returned analysis map:** Full 2D map with returned clipped cell geometry, pH/EC/N/P/K, project-defined SHI, zone and FCM membership layers, cell/zone inspection, diagnostics, and actual-response JSON export.
- **Optional 3D field:** Dynamically loaded R3F view, orbit/pan/zoom and Fit controls, batched returned geometry, and an enforced 768-cell / 20,000-estimated-triangle ceiling. The 2D map remains complete when the 3D budget is exceeded.
- **Cell- or zone-scoped Crop Fit:** Separate source-backed Apple, Tomato, and Potato assessments; the current rules evaluate pH only, show unsupported factors as not assessed, and do not claim probabilities.
- **Historical telemetry replay:** Deterministic local playback, source/provenance metadata, bounded raw history, experimental sensor-signal GRU and unsupervised review candidates. The separate calibrated-VWC-only FAO-56 advisory remains API-only; the replay UI does not present it as an output of the `%RH` trial.
- **Soil Investigation:** Manual and CSV samples start empty and remain separate from zoning. Legacy synthetic preset rows are archived and not treated as measurements. SoilGrids is explicitly unavailable until a real provider adapter is configured; no coordinate-derived values are shown.
- **CropSight vegetation monitoring:** Its own circular AOI/date inputs and live service call. The UI displays only returned aggregate NDVI statistics, per-scene series, optional rainfall context, and clearly marked upstream heuristic notes. The current response does not include a raster, pixels, or spatial zones. Google Earth Engine setup is deferred to the user.
- **No disguised data:** The first Soil Zoning view contains no practice farm or precomputed result. Synthetic data is limited to tests and explicitly labeled benchmarks.

## Documentation map

| File | Owns |
| --- | --- |
| [Product requirements](docs/PRD.md) | Product goals, MVP scope, ML/data plan, evidence boundaries, and success measures. |
| [UX specification](docs/UX-SPEC.md) | Historical grid-UI contract; the completed Phase 2 plan records the current Soil Zoning workflow. |
| [Technical requirements](docs/TRD.md) | Current architecture, domain contracts, 3D implementation, performance/asset budgets, and technical verification. |
| [Delivery plan](docs/DELIVERY.md) | Release acceptance criteria and link to the current five-phase implementation sequence. |
| [Five-phase master plan](docs/plans/README.md) | Current backend/UI/telemetry/monitoring/leaf phase sequence and status. |
| [Phase 1 backend contract](docs/plans/phase-1-backend-algorithmic-core.md) | Field boundary, sample, IDW, SHI, clustering, stability, and WSN-candidate API details. |
| [Phase 2 soil UI plan](docs/plans/phase-2-soil-zoning-ui-redesign.md) | Implemented `/v2` boundary/sample workflow, returned geometry/layers, diagnostics, and selected-scope Crop Fit. |
| [Phase 3 telemetry contract](docs/plans/phase-3-wsn-telemetry-service.md) | Implemented historical replay API, pinned data/model artifacts, unit boundaries, and measured forecast quality. |
| [Phase 4 monitoring UI plan](docs/plans/phase-4-field-monitoring-transformation.md) | Completed three-view Field Monitoring UI, provider boundaries, and verification status. |
| [Phase 5 leaf contract](docs/plans/phase-5-leaf-contract-and-verification.md) | Planned image-only MobileNetV3-Small interface, verification, and academic-defense contract. |
| [Frontend implementation plan](docs/FRONTEND-IMPLEMENTATION-PLAN.md) | Historical broad brief, superseded by the current phase plans. |
| [Glossary](GLOSSARY.md) | Canonical meanings for soil zoning, historical telemetry replay, SoilGrids, vegetation zones, and NDVI. |
| [Crop-suitability research](docs/research/crop-suitability-probability.md) | Evidence on suitability classes, percentages, probability semantics, and the data needed for cultivation probabilities. |
| [Open-source architecture landscape](docs/research/open-source-architecture-landscape.md) | Backend, soil-mapping, zoning, crop-suitability, and agricultural-ML references with implementation lessons and caveats. |
| [External 3D asset research](docs/research/external-3d-asset-sources.md) | Source review and selected Kenney decorative assets; functional geometry stays procedural. |
| [Decision 0001](docs/decisions/0001-functional-field-and-assets.md) | Why the functional field uses R3F and why functional visuals are procedural. |
| [Decision 0002](docs/decisions/0002-mock-data-demo-first.md) | Superseded historical record of the mock-first proposal. |
| [Decision 0003](docs/decisions/0003-decorative-kenney-assets.md) | Historical Kenney GLB asset preparation; assets are optional and unused by the current zoning scene. |
| [Decision 0004](docs/decisions/0004-field-monitoring-and-direct-build.md) | Independent Field Monitoring scope, CropSight reuse boundary, SoilGrids role, and direct functional build. |
| [Decision 0007](docs/decisions/0007-phase-3-telemetry-evidence-and-boundaries.md) | Telemetry dataset evidence, units, runtime, and non-actuation boundaries. |
| [Decision 0008](docs/decisions/0008-gru-holdout-quality-and-use.md) | GRU holdout result and why its forecasts remain evaluation-only. |
| [Decision 0009](docs/decisions/0009-monitoring-data-provenance-and-provider-readiness.md) | Empty-by-default soil records, SoilGrids provider gate, CropSight output limits, and replay boundaries. |
| [CropSight/SoilGrids integration research](docs/research/cropsight-soilgrids-integration-architecture.md) | Pinned-source audit, provider/data limitations, and evidence behind the integration decision. |
| [3D asset manifest](assets/3d/asset-manifest.json) | Machine-readable inventory, hashes, budgets, and provenance for the twelve local decorative GLBs. |

## Current product scope

- Soil Zoning and Crop Fit are one user workflow: select a calculated zone or field cell, then inspect independent per-crop rule checks for that exact mean/profile. Crop Fit never becomes a three-crop 100% probability split.
- Field Monitoring is a separate destination with Soil Investigation, historical telemetry replay, and independent CropSight vegetation monitoring. New soil investigations start empty; legacy synthetic demo rows are archived. SoilGrids remains unavailable until a verified ISRIC data adapter is configured. The three workflows do not silently consume one another's data; CropSight retains its own circle-of-interest and date inputs.
- The current CropSight response supplies aggregate NDVI statistics and a per-scene time series (plus optional rainfall context and upstream heuristic strings), but no raster, pixel labels, zone polygons, or per-zone statistics. The UI does not draw substitute zones or claim patch-level scouting coordinates.
- The initial vegetation-monitoring goals are seasonal NDVI exploration and highlighting relative patches for human scouting. Variable-rate prescriptions, irrigation decisions, and yield estimation are not validated outputs and remain later work.
- The functional soil field defaults to a keyboard-accessible SVG map. The optional, lazily loaded React Three Fiber scene uses returned field/cell geometry; it is capped at 768 cells and 20,000 estimated triangles. Pointer controls orbit/pan/zoom, and **Fit** resets the camera.
- Field cells and zones are procedural data geometry. The prepared Kenney GLBs are not currently loaded into the zoning scene; no decorative asset is required for analysis.
- Spline may be considered for a decorative scene only after its free-tier export and embedding terms are checked. The scene must be optional and replaceable by a small Three.js hero or SVG.
- No paid runtime is required. Live CropSight use does require external Google Earth Engine project setup and quota availability; failures are shown honestly rather than replaced by mock results.
- Live sensor streams, automatic irrigation, prescription rates, yield estimates, crop-success probabilities, fertilizer dosing, and disease treatment remain out of scope for the initial release. The historical replay is explicitly labeled, and its GRU did not beat persistence; it is not operationally predictive. Synthetic data is permitted for tests and benchmarks, not as a disguised user-visible result.
- There is no mock-first delivery phase. The old prototype UX has been superseded; the implemented field workflow and its defaults are recorded in [Decision 0006](docs/decisions/0006-phase-2-soil-field-ui.md).

## How to keep the docs clear

Each topic has one living requirements document. Update that document when a requirement changes; add a decision record only for a significant architectural choice, rather than creating another parallel plan or checklist. The root README is the repository entry point, and the longer, versioned design documents live under `docs/`. This follows GitHub's README guidance and relative-link conventions, with the `docs/decisions/` location used by the MADR project's quick-start guidance for decision records ([GitHub README guidance](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-readmes), [MADR](https://github.com/adr/madr)).

## Status language

“Required” describes an MVP release condition. “Planned” describes a design decision that is not implemented or measured. “Open” means evidence or a product choice is still needed. A target is not a claim until it has been measured on a named reference device.
