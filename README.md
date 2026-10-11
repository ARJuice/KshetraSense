# KshetraSense

KshetraSense is a local, desktop-first smart-farming application for soil zoning, zone-scoped crop-fit screening, and field monitoring. The current build replaces the former mock UX with a functional local zoning service and a clean three-module workspace. Leaf-image classification is intentionally not included in this build and will be developed separately.

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

Open the local Vite address shown by the second command (normally `http://127.0.0.1:5173`). The first run starts on the clearly labeled **Practice field**; its zones are calculated live. Import a real grid CSV to replace it. Required columns are `row`, `column`, `ph`, `nitrogen`, `phosphorus`, `potassium`, `ec`, and `soil_temperature`.

### What is working now

- Local deterministic K-means++ and Fuzzy C-means, including normalization, memberships, diagnostics, zone summaries, and validation of incomplete/constant data.
- Zone- or cell-scoped Crop Fit: it evaluates the selected zone mean or an explicitly selected cell. The current source-backed rule set screens pH and leaves N/P/K, EC, temperature, moisture, and missing land factors explicitly unassessed rather than inventing thresholds.
- Soil Investigation with validated manual records, local CSV preview/import, provenance, and a relative coordinate sketch.
- Honest integration boundaries: SoilGrids and CropSight inputs/status are visible but no external request, imagery, NDVI, recommendation, or measured context is fabricated.

## Documentation map

| File | Owns |
| --- | --- |
| [Product requirements](docs/PRD.md) | Product goals, MVP scope, ML/data plan, evidence boundaries, and success measures. |
| [UX specification](docs/UX-SPEC.md) | Screens, journeys, interactions, visual behavior, accessibility, and responsive behavior. |
| [Technical requirements](docs/TRD.md) | Architecture, domain contracts, 3D implementation, performance and asset budgets, and technical verification. |
| [Delivery plan](docs/DELIVERY.md) | Functional build sequence, release acceptance criteria, evidence needed, and risks. |
| [Frontend implementation plan](docs/FRONTEND-IMPLEMENTATION-PLAN.md) | Agent-ready contract for building the real React/R3F experience directly, with no fixture-only product phase. |
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
