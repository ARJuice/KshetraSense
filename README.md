# KshetraSense

KshetraSense is a pre-build plan for a local, interactive applied-ML demonstrator for apple, tomato, and potato. It combines synthetic soil zoning, a separate source-backed crop-compatibility view, and a shared leaf-image classifier. The application, trained model, and performance results have not been built or measured yet.

## Documentation map

| File | Owns |
| --- | --- |
| [Product requirements](docs/PRD.md) | Product goals, MVP scope, ML/data plan, evidence boundaries, and success measures. |
| [UX specification](docs/UX-SPEC.md) | Screens, journeys, interactions, visual behavior, accessibility, and responsive behavior. |
| [Technical requirements](docs/TRD.md) | Architecture, domain contracts, 3D implementation, performance and asset budgets, and technical verification. |
| [Delivery plan](docs/DELIVERY.md) | Build phases, release acceptance criteria, evidence needed, assumptions, and risks. |
| [Crop-suitability research](docs/research/crop-suitability-probability.md) | Evidence on suitability classes, percentages, probability semantics, and the data needed for cultivation probabilities. |
| [Decision 0001](docs/decisions/0001-functional-field-and-assets.md) | Why the functional field uses R3F and why functional visuals are procedural. |
| [Decision 0002](docs/decisions/0002-mock-data-demo-first.md) | The clickable mock-data demo that comes before the sequential implementation phases. |
| [3D asset manifest](assets/3d/asset-manifest.json) | Machine-readable inventory and limits for 3D visuals; currently records zero downloaded models. |

## Current scope

- The functional field is a data-driven Three.js / React Three Fiber view. A complete 2D mode remains available for mobile, accessibility, and devices without WebGL.
- Field cells, zones, overlays, sensor markers, crop cues, and root layers are generated from simple geometry or SVG. No model download is needed for the current simulation.
- Spline may be considered for a decorative scene only after its free-tier export and embedding terms are checked. The scene must be optional and replaceable by a small Three.js hero or SVG.
- No paid asset, hosted API, icon, font, model, or runtime is required.
- Temporal moisture forecasting, irrigation, pumps, real sensor streams, crop recommendations, crop-cultivation probabilities, yield estimates, and fertilizer prescriptions are outside the MVP. Crop Fit reports supported per-crop factors/classes; it does not split a 100% probability among crops.
- The next planned visual milestone is a desktop, low-relief 2.5D mock-data demo with scenario choice, quick presets, and brush editing. It will use prepared zoning/crop/leaf examples rather than running those systems. The application and demo have not been built; see [Decision 0002](docs/decisions/0002-mock-data-demo-first.md).

## How to keep the docs clear

Each topic has one living requirements document. Update that document when a requirement changes; add a decision record only for a significant architectural choice, rather than creating another parallel plan or checklist. The root README is the repository entry point, and the longer, versioned design documents live under `docs/`. This follows GitHub's README guidance and relative-link conventions, with the `docs/decisions/` location used by the MADR project's quick-start guidance for decision records ([GitHub README guidance](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-readmes), [MADR](https://github.com/adr/madr)).

## Status language

“Required” describes an MVP release condition. “Planned” describes a design decision that is not implemented or measured. “Open” means evidence or a product choice is still needed. A target is not a claim until it has been measured on a named reference device.
