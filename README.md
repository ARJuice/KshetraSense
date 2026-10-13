# KshetraSense

KshetraSense is a local, desktop-first smart-farming application for soil zoning, zone-scoped crop-fit screening, and field monitoring. The current build replaces the former mock UX with a functional local zoning service and a clean three-module workspace. Leaf-image classification is intentionally not included in this build and will be developed separately.

## Current architecture status

Phases 1–2 are implemented. Soil Zoning accepts a WGS84 field polygon and 3–50 georeferenced lab samples (5–10 recommended), then submits the data to `POST /v2/zoning/run`: local UTM grid → IDW estimates → project-defined KshetraSense SHI → Auto-K K-means/FCM → contiguous zones and diagnostics. Samples require a common explicit depth interval and use pH (dimensionless), EC (dS/m), and N/P/K (mg/kg). The UI shows returned values and exposes Crop Fit for an explicitly selected cell or zone. See the [five-phase plan](docs/plans/README.md), [Phase 1 contract](docs/plans/phase-1-backend-algorithmic-core.md), and [Phase 2 implementation](docs/plans/phase-2-soil-zoning-ui-redesign.md).

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
- **Field Monitoring:** Soil Investigation and independent CropSight vegetation workflow remain separate from Soil Zoning. Google Earth Engine credentials/quota are required only for live CropSight analysis.
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
| [Frontend implementation plan](docs/FRONTEND-IMPLEMENTATION-PLAN.md) | Historical broad brief, superseded by the current phase plans. |
| [Glossary](GLOSSARY.md) | Canonical meanings for Field Monitoring, soil samples, SoilGrids context, vegetation zones, and NDVI. |
| [Crop-suitability research](docs/research/crop-suitability-probability.md) | Evidence on suitability classes, percentages, probability semantics, and the data needed for cultivation probabilities. |
| [Open-source architecture landscape](docs/research/open-source-architecture-landscape.md) | Backend, soil-mapping, zoning, crop-suitability, and agricultural-ML references with implementation lessons and caveats. |
| [External 3D asset research](docs/research/external-3d-asset-sources.md) | Source review and selected Kenney decorative assets; functional geometry stays procedural. |
| [Decision 0001](docs/decisions/0001-functional-field-and-assets.md) | Why the functional field uses R3F and why functional visuals are procedural. |
| [Decision 0002](docs/decisions/0002-mock-data-demo-first.md) | Superseded historical record of the mock-first proposal. |
| [Decision 0003](docs/decisions/0003-decorative-kenney-assets.md) | Historical Kenney GLB asset preparation; assets are optional and unused by the current zoning scene. |
| [Decision 0004](docs/decisions/0004-field-monitoring-and-direct-build.md) | Independent Field Monitoring scope, CropSight reuse boundary, SoilGrids role, and direct functional build. |
| [CropSight/SoilGrids integration research](docs/research/cropsight-soilgrids-integration-architecture.md) | Pinned-source audit, provider/data limitations, and evidence behind the integration decision. |
| [3D asset manifest](assets/3d/asset-manifest.json) | Machine-readable inventory, hashes, budgets, and provenance for the twelve local decorative GLBs. |

## Current product scope

- Soil Zoning and Crop Fit are one user workflow: select a calculated zone or field cell, then inspect independent per-crop rule checks for that exact mean/profile. Crop Fit never becomes a three-crop 100% probability split.
- Field Monitoring is a separate destination with Soil Investigation (dated measured samples plus optional SoilGrids context) and Vegetation Monitoring (the independent CropSight/Sentinel-2 workflow). CropSight retains its own circle-of-interest and date inputs; it does not consume KshetraSense zoning, Crop Fit, or leaf outputs.
- The initial vegetation-monitoring goals are seasonal NDVI exploration and highlighting relative patches for human scouting. Variable-rate prescriptions, irrigation decisions, and yield estimation are not validated outputs and remain later work.
- The functional soil field defaults to a keyboard-accessible SVG map. The optional, lazily loaded React Three Fiber scene uses returned field/cell geometry; it is capped at 768 cells and 20,000 estimated triangles. Pointer controls orbit/pan/zoom, and **Fit** resets the camera.
- Field cells and zones are procedural data geometry. The prepared Kenney GLBs are not currently loaded into the zoning scene; no decorative asset is required for analysis.
- Spline may be considered for a decorative scene only after its free-tier export and embedding terms are checked. The scene must be optional and replaceable by a small Three.js hero or SVG.
- No paid runtime is required. Live CropSight use does require external Google Earth Engine project setup and quota availability; failures are shown honestly rather than replaced by mock results.
- Real-time sensor streams, automatic irrigation, prescription rates, yield estimates, crop-success probabilities, fertilizer dosing, and disease treatment remain out of scope for the initial functional release. Synthetic data is permitted for tests and benchmarks, not as a disguised user-visible result.
- There is no mock-first delivery phase. The old prototype UX has been superseded; the implemented field workflow and its defaults are recorded in [Decision 0006](docs/decisions/0006-phase-2-soil-field-ui.md).

## How to keep the docs clear

Each topic has one living requirements document. Update that document when a requirement changes; add a decision record only for a significant architectural choice, rather than creating another parallel plan or checklist. The root README is the repository entry point, and the longer, versioned design documents live under `docs/`. This follows GitHub's README guidance and relative-link conventions, with the `docs/decisions/` location used by the MADR project's quick-start guidance for decision records ([GitHub README guidance](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-readmes), [MADR](https://github.com/adr/madr)).

## Status language

“Required” describes an MVP release condition. “Planned” describes a design decision that is not implemented or measured. “Open” means evidence or a product choice is still needed. A target is not a claim until it has been measured on a named reference device.
