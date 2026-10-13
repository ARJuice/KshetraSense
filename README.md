# KshetraSense

KshetraSense is a local, desktop-first smart-farming application for soil zoning, zone-scoped crop-fit screening, and field monitoring. The current build replaces the former mock UX with a functional local zoning service and a clean three-module workspace. Leaf-image classification is intentionally not included in this build and will be developed separately.

## Current architecture status

Phase 1's sparse-sample backend is implemented at `POST /v2/zoning/run`: WGS84 field polygon + georeferenced pH/EC/N/P/K samples → UTM grid → IDW estimates → project-defined SHI → Auto-K K-means/FCM → contiguous zones and diagnostics. It requires 3–50 samples (5–10 recommended), a common explicit depth interval, and uses pH dimensionless, EC dS/m, and N/P/K mg/kg. The current UI still calls the legacy `/v1/zoning/run`; migrating the field workflow and connecting selected-zone Crop Fit is Phase 2, not yet complete. See the [five-phase plan](docs/plans/README.md) and [Phase 1 contract](docs/plans/phase-1-backend-algorithmic-core.md).

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

Open the local Vite address shown by the second command (`http://localhost:3000/` or `http://127.0.0.1:3000/`). The first run starts on the clearly labeled **Practice field**; its zones are calculated live. Import a real grid CSV to replace it. Required columns are `row`, `column`, `ph`, `nitrogen`, `phosphorus`, `potassium`, `ec`, and `soil_temperature`.

### What is working now

- **Panoramic Soil Workspace:** Expansive hero field canvas (`clamp(580px, 74vh, 840px)`) with collapsible Run Config (left) and Inspector (right) panels, and a single-click "Focus" zen mode expanding the canvas to 100% width.
- **Unified 3D & 2.5D Field Modes:** Seamless toggle between 3D Realistic (instanced low-relief soil pedestals framed by 12 Kenney Nature Kit models in a seeded natural perimeter) and 2.5D Atlas Map (isometric grid with WCAG AA patterns and locked survey brackets from commit `0efec7b`).
- **Tactile Micro-Interactions:** Cartographic guidelines and surveyor corner brackets (`FieldReticle`), tactile radial spark bursts on clicks and brush dabs (`ClickSpark`), live coordinate HUD with glyph descramble (`DecryptedText`), and custom cursors (`cursor-field-reticle`, `cursor-field-brush`).
- **Local Deterministic Zoning:** Real K-means++ and Fuzzy C-means execution with normalization, membership matrices, silhouette diagnostic, iterations count, and zone profiles.
- **Zone- or Cell-Scoped Crop Fit:** Sourced evidence checks for Apple, Tomato, and Potato evaluated against exact zone means or cell profiles.
- **Soil Investigation:** Validated manual records, local CSV preview/import, provenance metadata, and relative coordinates.
- **Honest Integration Boundaries:** SoilGrids and CropSight inputs/status are clearly labeled; no external telemetry or recommendation is fabricated.
- **Phase 1 backend:** The new field-scale request/response is tested; the existing user interface has not yet migrated to it.

## Documentation map

| File | Owns |
| --- | --- |
| [Product requirements](docs/PRD.md) | Product goals, MVP scope, ML/data plan, evidence boundaries, and success measures. |
| [UX specification](docs/UX-SPEC.md) | Historical grid-UI spec; Phase 2 plan is the current Soil Zoning interaction contract. |
| [Technical requirements](docs/TRD.md) | Current architecture, domain contracts, 3D implementation, performance/asset budgets, and technical verification. |
| [Delivery plan](docs/DELIVERY.md) | Release acceptance criteria and link to the current five-phase implementation sequence. |
| [Five-phase master plan](docs/plans/README.md) | Current backend/UI/telemetry/monitoring/leaf phase sequence and status. |
| [Phase 1 backend contract](docs/plans/phase-1-backend-algorithmic-core.md) | Field boundary, sample, IDW, SHI, clustering, stability, and WSN-candidate API details. |
| [Phase 2 soil UI plan](docs/plans/phase-2-soil-zoning-ui-redesign.md) | Frontend migration contract for `/v2` and zone-scoped Crop Fit. |
| [Frontend implementation plan](docs/FRONTEND-IMPLEMENTATION-PLAN.md) | Historical broad brief, superseded by the current phase plans. |
| [Glossary](GLOSSARY.md) | Canonical meanings for Field Monitoring, soil samples, SoilGrids context, vegetation zones, and NDVI. |
| [Crop-suitability research](docs/research/crop-suitability-probability.md) | Evidence on suitability classes, percentages, probability semantics, and the data needed for cultivation probabilities. |
| [Open-source architecture landscape](docs/research/open-source-architecture-landscape.md) | Backend, soil-mapping, zoning, crop-suitability, and agricultural-ML references with implementation lessons and caveats. |
| [External 3D asset research](docs/research/external-3d-asset-sources.md) | Source review and selected Kenney decorative assets; functional geometry stays procedural. |
| [Decision 0001](docs/decisions/0001-functional-field-and-assets.md) | Why the functional field uses R3F and why functional visuals are procedural. |
| [Decision 0002](docs/decisions/0002-mock-data-demo-first.md) | Superseded historical record of the mock-first proposal. |
| [Decision 0003](docs/decisions/0003-decorative-kenney-assets.md) | Why twelve small Kenney GLBs are prepared as a restrained decorative palette while the functional field remains procedural. |
| [Decision 0004](docs/decisions/0004-field-monitoring-and-direct-build.md) | Independent Field Monitoring scope, CropSight reuse boundary, SoilGrids role, and direct functional build. |
| [CropSight/SoilGrids integration research](docs/research/cropsight-soilgrids-integration-architecture.md) | Pinned-source audit, provider/data limitations, and evidence behind the integration decision. |
| [3D asset manifest](assets/3d/asset-manifest.json) | Machine-readable inventory, hashes, budgets, and provenance for the twelve local decorative GLBs. |

## Current product scope

- Soil Zoning and Crop Fit are one user workflow: select a calculated zone or field cell, then inspect independent per-crop rule checks for that exact mean/profile. Crop Fit never becomes a three-crop 100% probability split.
- Field Monitoring is a separate destination with Soil Investigation (dated measured samples plus optional SoilGrids context) and Vegetation Monitoring (the independent CropSight/Sentinel-2 workflow). CropSight retains its own circle-of-interest and date inputs; it does not consume KshetraSense zoning, Crop Fit, or leaf outputs.
- The initial vegetation-monitoring goals are seasonal NDVI exploration and highlighting relative patches for human scouting. Variable-rate prescriptions, irrigation decisions, and yield estimation are not validated outputs and remain later work.
- The current functional soil field uses an interactive React Three Fiber view: drag to orbit, right-drag to pan, scroll to zoom, and switch to the keyboard-accessible 2.5D SVG map when WebGL is unsuitable. The R3F grid uses instancing and a capped device-pixel ratio.
- Field cells and zones are procedural data geometry. The R3F scene uses only a few small Kenney GLBs (two trees, grass and a fence rail) as perimeter decoration; they never encode simulation data or represent live equipment.
- Spline may be considered for a decorative scene only after its free-tier export and embedding terms are checked. The scene must be optional and replaceable by a small Three.js hero or SVG.
- No paid runtime is required. Live CropSight use does require external Google Earth Engine project setup and quota availability; failures are shown honestly rather than replaced by mock results.
- Real-time sensor streams, automatic irrigation, prescription rates, yield estimates, crop-success probabilities, fertilizer dosing, and disease treatment remain out of scope for the initial functional release. Synthetic data is permitted for tests and benchmarks, not as a disguised user-visible result.
- There is no mock-first delivery phase. The old prototype UX is superseded and will be replaced during implementation; see [Decision 0004](docs/decisions/0004-field-monitoring-and-direct-build.md).

## How to keep the docs clear

Each topic has one living requirements document. Update that document when a requirement changes; add a decision record only for a significant architectural choice, rather than creating another parallel plan or checklist. The root README is the repository entry point, and the longer, versioned design documents live under `docs/`. This follows GitHub's README guidance and relative-link conventions, with the `docs/decisions/` location used by the MADR project's quick-start guidance for decision records ([GitHub README guidance](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-readmes), [MADR](https://github.com/adr/madr)).

## Status language

“Required” describes an MVP release condition. “Planned” describes a design decision that is not implemented or measured. “Open” means evidence or a product choice is still needed. A target is not a claim until it has been measured on a named reference device.
