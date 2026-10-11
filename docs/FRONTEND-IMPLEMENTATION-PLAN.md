# KshetraSense UI/UX and frontend implementation plan

**Status:** production-intended implementation brief. Replace the existing prototype UX with a fresh design and working feature flows. This plan supersedes the mock-first instructions in [Decision 0002](decisions/0002-mock-data-demo-first.md); see [Decision 0004](decisions/0004-field-monitoring-and-direct-build.md).

**Audience:** the implementing agent and project maintainers. **Purpose:** turn the product and technical requirements into a coherent, aesthetically strong application without inventing analytical results or coupling independent modules.

## 1. Read these documents first

- [PRD](PRD.md) — product scope, user outcomes, functional module inputs/outputs, limitations, and evidence gates.
- [TRD](TRD.md) — architecture, contracts, accessibility, privacy, and performance budgets.
- [UX specification](UX-SPEC.md) — journeys, screen states, accessibility, and truthful interactions.
- [Delivery plan](DELIVERY.md) — actual functional build sequence and acceptance criteria.
- [Glossary](../GLOSSARY.md) — canonical module terminology.
- [Decision 0001](decisions/0001-functional-field-and-assets.md) — functional field geometry and asset policy.
- [Decision 0003](decisions/0003-decorative-kenney-assets.md) — prepared optional Kenney GLBs.
- [Decision 0004](decisions/0004-field-monitoring-and-direct-build.md) — independent Field Monitoring and no mock-first phase.
- [3D asset manifest](../assets/3d/asset-manifest.json) and [asset research](research/external-3d-asset-sources.md) — exact ready-to-use decorative files and provenance.

The old `mock-demo/index.html` and current prototype UI are not design baselines. Do not port their styling, controls, or fake results. Product behavior and useful domain rules remain available in the PRD/TRD/UX spec; visual composition and interaction presentation should be redesigned from scratch.

## 2. Product architecture and implementation contract

The frontend has four separate user-facing capabilities:

1. **Field Lab / Soil Zoning:** soil field data, edits, K-means/FCM requests, and actual returned zones.
2. **Crop Fit:** a separate sourced rules evaluation for Apple, Tomato, and Potato, opened contextually from a selected cell/zone. It never changes clustering or becomes a three-crop probability split.
3. **Leaf Diagnosis:** the fixed shared MobileNetV3-Small 17-class image model, with real inference and review states.
4. **Field Monitoring:** separate Soil Investigation and Vegetation Monitoring views. Soil Investigation records dated samples and optionally displays SoilGrids regional context. Vegetation Monitoring launches/hosts the pinned CropSight application as an isolated local sub-application with its own center/radius/date inputs.

Keep React/TypeScript/Vite for the primary shell and accessible 2D/R3F field; use stable service contracts for the existing Python algorithm/model work. CropSight retains a separate Python/Streamlit environment and state. Do not share analysis results across modules implicitly. See [Decision 0004](decisions/0004-field-monitoring-and-direct-build.md) for the exact boundary and scope.

**No mock phase:** implement working vertical slices directly. A screen may have honest input-required, no-credentials, no-data, loading, error, or unsupported states; it may not show a prepared zoning result, canned crop score, fabricated leaf prediction, or fake satellite image as if a real computation had run. Synthetic samples remain in tests/benchmarks only and must be marked as such in developer tools.

## 3. Design latitude and method

Give the implementing agent substantial creative latitude and expect strong design judgment. Aesthetics, information hierarchy, interaction quality, and first-use comprehension are first-class engineering requirements—not a skin applied after features work. Explore distinct concepts that vary composition, density, navigation, cartographic style, and use of depth; explain the chosen direction briefly. Use lightweight sketches if helpful, but do not build a disposable mock app or delay functional implementation for a visual-demo approval gate.

Use design thinking practically: understand the primary user's job, frame the real decision they need to make, explore alternatives, choose based on comprehension and evidence, then refine the actual working product through usability review. Do not ask the user to choose every color, spacing value, transition, or icon. Ask only where a decision changes scope, data meaning, safety of a claim, or a significant trade-off.

Creative exploration may include an authored field-cartography instrument, a tactile soil lab, or another stronger concept. Do not assume the current dark palette, glass treatment, or neon accents are approved. Avoid generic SaaS cards, arbitrary glow, visual noise, or farm-game promises. Use typography, hierarchy, material, terrain, pattern, contour, and restrained motion to make the experience distinct and legible.

## 4. First-use experience

Open to a clear product overview with direct entry to the user's jobs. Do not make an arbitrary synthetic scenario appear to be a real farm. Let the user choose among Soil Zoning, Leaf Diagnosis, and Field Monitoring; explain the input needed and provenance before an action. Crop Fit appears in the Field Lab context when a user chooses a cell/zone.

For Soil Zoning, the first useful action is to load or create a real soil dataset/field, inspect its units and source, and run a real zoning request. If required data is absent, show an informative no-data state and offer the supported input path. A synthetic benchmark can be selected by a developer/tester for verification, but not presented as evidence from a farm.

The first Field Monitoring route offers two clearly separate jobs:

- **Investigate soil:** enter a sample or import validated rows; see when/where/how it was measured. Request SoilGrids only as optional coarse context.
- **Monitor vegetation:** open CropSight, enter its own center coordinate, radius, and date range, then review actual NDVI/time-series output. Require explicit provider setup; never substitute fixture maps.

The user should always know which data belongs to which module and whether the current result is measured, satellite-derived, modeled context, model output, or rules output.

## 5. Screen behavior

### Global shell

- Provide a concise overview and primary navigation for Field Lab, Leaf Diagnosis, Field Monitoring, and Evidence & Methods. Crop Fit stays contextual within Field Lab.
- Display active module, data source, and request status without inventing a global farm-health score.
- Keep controls in accessible DOM elements. Use meaningful empty/loading/error states instead of filled-in demo cards.

### Field Lab / Soil Zoning

- Build the 2D functional field interaction and data contract with the first real zoning slice; add the 2.5D R3F presentation as part of production development, not as a fake-data milestone.
- Show a source badge, units, selected attribute, map legend, and method/configuration. Provide cell/zone inspection, before/after edits, Undo/Redo, request-linked pending/error states, and stale-result handling.
- Keep the no-slider choice: deterministic named presets and a selected-feature brush for editing supported inputs. Controls cannot change hidden/unrelated parameters.
- The result view is settled from real service assignments and diagnostics. Never draw pretend centroid travel, Euclidean filaments, convergence pulses, or zone merges without the corresponding returned computation.
- The 2.5D field uses instanced/procedural geometry for cells, boundaries, contours, and overlays. Optional decorative GLBs stay outside selectable data cells and remain subordinate.

### Crop Fit

- Open in the Field Lab context for a selected cell or zone. Clearly show the profile/rule version and which actual measurements are assessed.
- Present three equal, independent crop assessments with factor states, sourced ranges, missing values, and within-zone variation.
- Do not rank crops, prescribe inputs, or show a 100%-sum crop probability.

### Leaf Diagnosis

- Provide an image selection/privacy path and run actual inference through the fixed model service.
- Show the actual supported class scores, model/preprocessing version, measured inference duration, and review/unsupported state. Never show canned outputs or decorative saliency as an inference result.

### Field Monitoring — Soil Investigation

- Provide a simple investigation list/detail flow. Each sample has location, collection time, source/method, depth where relevant, measured parameter, original value/unit, and optional notes.
- Support manual input and a validated CSV import. Show sample positions and a timeline only for comparable repeated observations.
- Show SoilGrids in a distinct context panel with property, depth, native scale, uncertainty if available, product/source/date, and a clear modeled/not-measured label.
- Do not auto-feed samples or SoilGrids into Soil Zoning or Crop Fit. No live sensor stream is in the first release.

### Field Monitoring — Vegetation Monitoring / CropSight

- Present the CropSight integration as an independent sub-application reachable from Field Monitoring. Preserve its source files and environment separately; make the boundary between KshetraSense navigation and CropSight analysis visually clear.
- Collect the CropSight-supported center latitude/longitude, circular radius, date window, and any supported optional crop/stage context. The circular AOI is not a cadastral polygon.
- Show only real CropSight outputs from the running service. Identify imagery source, dates, method, coverage/quality where available, and external-service availability. Keep rainfall context separate and source-labeled.
- Default useful outcomes to seasonal tracking and a prompt to scout relative underperforming areas. Do not claim why a patch differs. Do not show VRA prescriptions, irrigation decisions, or yield estimates until a separately approved and validated feature exists.
- If GEE authentication/quota, image coverage, or the service is unavailable, retain user inputs and show a specific actionable error; no cached/demo result is relabeled as current.

## 6. Visual and motion quality

Compose the primary workspace around the task: generous map area for spatial work, a compact but legible tool rail, and an inspector/analysis panel that can collapse. Use strong typography, measured whitespace, precise tables, memorable cartographic details, and a palette with accessible semantic contrast. Avoid making every metric a card. Use patterns or outlines in addition to zone color.

Keep interaction responses quick and causally accurate: hover/selection, brush footprint, preset extent, undo, result update, and module transitions. Any ripple/contour animation must represent actual changed cells or returned boundaries. Use reduced-motion behavior and do not delay a task behind an animation.

## 7. Technical, accessibility, and performance constraints

- React, TypeScript, and Vite for the host UI; Three.js/React Three Fiber for the data-responsive 2.5D field.
- Keep labels, values, legends, forms, and interaction semantics in DOM/SVG. Implement the complete 2D/no-WebGL workflow, keyboard cell access, visible focus, and WCAG 2.2 AA contrast.
- Desktop is the primary target. Keep tablet/mobile responsive without making phone parity the first implementation bottleneck; mobile defaults to 2D.
- Honor `prefers-reduced-motion`; dispose GPU resources; instance repeated cells/markers; keep all rendering within [TRD budgets](TRD.md#performance-budgets).
- No per-cell React mesh/material, no required remote fonts/icon packs/assets, no post-processing by default, no runtime asset download, and no Spline dependency for core tasks.
- Preserve the fixed MobileNetV3-Small architecture and avoid changing the deferred Python/Keras/TensorFlow model workflow outside its contracts.
- Treat CropSight as an isolated local sub-application. No credentials in frontend code, no shared module store, no hidden data transfer. Document all its providers and its separate license caveat.

## 8. Implementation sequence and acceptance

Follow [Delivery](DELIVERY.md); do not create a mock-first route. Each vertical slice must include its real input flow, processing/service contract, output state, provenance, accessible presentation, tests, and meaningful error handling before proceeding. The interface may start with one functional module and grow without pretending unfinished modules are complete.

The frontend implementation is ready for review when:

- the old prototype UI is replaced rather than cosmetically restyled;
- Soil Zoning, Crop Fit, and Leaf Diagnosis remain separate in data and meaning;
- Soil Investigation persists measured sample provenance and presents SoilGrids separately;
- CropSight is reachable as an independent sub-application with its own AOI/date inputs and no module coupling;
- every displayed output came from a real user request or is clearly a non-user-facing test artifact;
- actual returned results drive the map, analysis panel, and motion;
- 2D, keyboard, reduced motion, failure states, and performance budgets pass.

This plan directs a complete functional implementation, not a throwaway visual demo. The present work updates the implementation brief only; application code remains untouched until separately requested.
