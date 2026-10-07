# KshetraSense

KshetraSense is a pre-build plan for a local, interactive applied-ML demonstrator for apple, tomato, and potato. It combines synthetic soil zoning, a separate source-backed crop-compatibility view, and a shared leaf-image classifier. The application, trained model, and performance results have not been built or measured yet.

## Documentation map

| File | Owns |
| --- | --- |
| [Product requirements](docs/PRD.md) | Product goals, MVP scope, ML/data plan, evidence boundaries, and success measures. |
| [UX specification](docs/UX-SPEC.md) | Screens, journeys, interactions, visual behavior, accessibility, and responsive behavior. |
| [Technical requirements](docs/TRD.md) | Architecture, domain contracts, 3D implementation, performance and asset budgets, and technical verification. |
| [Delivery plan](docs/DELIVERY.md) | Build phases, release acceptance criteria, evidence needed, assumptions, and risks. |
| [Frontend implementation plan](docs/FRONTEND-IMPLEMENTATION-PLAN.md) | Agent-ready implementation contract for the polished React/R3F frontend, contextual Crop Fit, fixture state, motion, and validation. |
| [Crop-suitability research](docs/research/crop-suitability-probability.md) | Evidence on suitability classes, percentages, probability semantics, and the data needed for cultivation probabilities. |
| [External 3D asset research](docs/research/external-3d-asset-sources.md) | Source review and selected Kenney decorative assets; functional geometry stays procedural. |
| [Decision 0001](docs/decisions/0001-functional-field-and-assets.md) | Why the functional field uses R3F and why functional visuals are procedural. |
| [Decision 0002](docs/decisions/0002-mock-data-demo-first.md) | The clickable mock-data demo that comes before the sequential implementation phases. |
| [Decision 0003](docs/decisions/0003-decorative-kenney-assets.md) | Why twelve small Kenney GLBs are prepared as a restrained decorative palette while the functional field remains procedural. |
| [3D asset manifest](assets/3d/asset-manifest.json) | Machine-readable inventory, hashes, budgets, and provenance for the twelve local decorative GLBs. |

## Current scope

- The final functional field is a data-driven Three.js / React Three Fiber view with a complete 2D mode for accessibility and devices without WebGL. The earlier desktop mock demo may be R3F-only, but still has keyboard-operable DOM controls; it does not satisfy or replace the final 2D requirement.
- Field cells, zones, overlays, and sensor markers are generated from geometry or SVG. Twelve lightweight Kenney GLBs are prepared as an optional palette for distant trees, sparse foliage/flowers, rocks, and a short background rail; use only a few at once, and never let them encode simulation data or represent live equipment.
- Spline may be considered for a decorative scene only after its free-tier export and embedding terms are checked. The scene must be optional and replaceable by a small Three.js hero or SVG.
- No paid asset, hosted API, icon, font, model, or runtime is required.
- Temporal moisture forecasting, irrigation, pumps, real sensor streams, crop recommendations, crop-cultivation probabilities, yield estimates, and fertilizer prescriptions are outside the MVP. Crop Fit reports supported per-crop factors/classes; it does not split a 100% probability among crops.
- The next planned visual milestone is a desktop, low-relief 2.5D mock-data demo with scenario choice, quick presets, and brush editing. It will use prepared zoning/crop/leaf examples rather than running those systems. The application and demo have not been built; see [Decision 0002](docs/decisions/0002-mock-data-demo-first.md).

## How to keep the docs clear

Each topic has one living requirements document. Update that document when a requirement changes; add a decision record only for a significant architectural choice, rather than creating another parallel plan or checklist. The root README is the repository entry point, and the longer, versioned design documents live under `docs/`. This follows GitHub's README guidance and relative-link conventions, with the `docs/decisions/` location used by the MADR project's quick-start guidance for decision records ([GitHub README guidance](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-readmes), [MADR](https://github.com/adr/madr)).

## Status language

“Required” describes an MVP release condition. “Planned” describes a design decision that is not implemented or measured. “Open” means evidence or a product choice is still needed. A target is not a claim until it has been measured on a named reference device.
