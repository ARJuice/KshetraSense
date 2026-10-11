# KshetraSense

KshetraSense is a local, desktop-first smart-farming application for exploring soil zones, per-crop soil compatibility, leaf-image classification, and field monitoring. The repository contains an earlier UI prototype/scaffold; it is not the production implementation. The next build starts with working, production-intended features in functional increments. No real model, satellite-monitoring result, or farm validation is claimed until implemented and measured.

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

- Soil Zoning, Crop Fit, and Leaf Diagnosis remain independent analyses. Crop Fit remains a separate per-crop rules result and never becomes a three-crop 100% probability split.
- Field Monitoring is a separate destination with Soil Investigation (dated measured samples plus optional SoilGrids context) and Vegetation Monitoring (the independent CropSight/Sentinel-2 workflow). CropSight retains its own circle-of-interest and date inputs; it does not consume KshetraSense zoning, Crop Fit, or leaf outputs.
- The initial vegetation-monitoring goals are seasonal NDVI exploration and highlighting relative patches for human scouting. Variable-rate prescriptions, irrigation decisions, and yield estimation are not validated outputs and remain later work.
- The functional soil field is data-driven Three.js / React Three Fiber on capable devices, with a complete 2D mode for accessibility and devices without WebGL.
- Field cells, zones, overlays, and sensor markers are generated from geometry or SVG. Twelve lightweight Kenney GLBs are prepared as an optional palette for distant trees, sparse foliage/flowers, rocks, and a short background rail; use only a few at once, and never let them encode simulation data or represent live equipment.
- Spline may be considered for a decorative scene only after its free-tier export and embedding terms are checked. The scene must be optional and replaceable by a small Three.js hero or SVG.
- No paid runtime is required. Live CropSight use does require external Google Earth Engine project setup and quota availability; failures are shown honestly rather than replaced by mock results.
- Real-time sensor streams, automatic irrigation, prescription rates, yield estimates, crop-success probabilities, fertilizer dosing, and disease treatment remain out of scope for the initial functional release. Synthetic data is permitted for tests and benchmarks, not as a disguised user-visible result.
- There is no mock-first delivery phase. The old prototype UX is superseded and will be replaced during implementation; see [Decision 0004](docs/decisions/0004-field-monitoring-and-direct-build.md).

## How to keep the docs clear

Each topic has one living requirements document. Update that document when a requirement changes; add a decision record only for a significant architectural choice, rather than creating another parallel plan or checklist. The root README is the repository entry point, and the longer, versioned design documents live under `docs/`. This follows GitHub's README guidance and relative-link conventions, with the `docs/decisions/` location used by the MADR project's quick-start guidance for decision records ([GitHub README guidance](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-readmes), [MADR](https://github.com/adr/madr)).

## Status language

“Required” describes an MVP release condition. “Planned” describes a design decision that is not implemented or measured. “Open” means evidence or a product choice is still needed. A target is not a claim until it has been measured on a named reference device.
