# Decision 0002: build a desktop mock-data field demo before implementation phases

**Status:** accepted as the next requested milestone
**Date:** 2026-10-07

## Context

The user wants to see and review the product experience before starting the sequential implementation phases. The first deliverable is a visual, interactive front-end demo with deterministic synthetic data. It should make the field, inspection, soil edits, zoning view, Crop Fit, and Leaf Diagnosis tangible without implying that an algorithm, trained model, or agronomic rule engine has run.

This demo is a presentation milestone only. It does not change the proposed React/TypeScript/Vite and Three.js/React Three Fiber front end, the planned Python/scikit-learn/scikit-fuzzy/TensorFlow/Keras boundaries, or the fixed MobileNetV3-Small 17-class application model. Those implementation decisions remain for their planned phases; this document does not prescribe or revise the backend architecture.

## Decision

Build the mock-data front end before Phase 0, then pause for the user's visual and journey review. Use a lightweight, low-relief Three.js/React Three Fiber field on desktop so the user can inspect the intended isometric experience. This prototype does not implement real K-means, Fuzzy C-means, crop rules, or leaf inference. All results that are not direct display of fixture values must be clearly labeled as mock/sample output.

The desktop prototype is the current review target. Mobile parity and a complete 2D/no-WebGL rendering path are not demo acceptance conditions; those remain final-product requirements. The demo still requires DOM-based controls and an operable keyboard path for inspection, presets, and brush dabs, plus reduced-motion behavior. Review it at a minimum 1280 × 800 CSS-pixel desktop viewport at 100% browser zoom. This early scene is not evidence that the final 2D, accessibility, fallback, or performance gates have passed.

## Prototype experience

### Entry and field

- **Explore demo** opens a scenario chooser with **Garden East — Baseline** selected by default. The presenter may choose the baseline or one of the prepared named scenarios; no soil edit is applied without a deliberate selection.
- The starting fixture is deterministic: Garden East, seed `42`, an `18 × 12` grid (216 cells). The top bar shows **SYNTHETIC SCENARIO: Garden East (Seed #42)**. It is not live sensor telemetry.
- Render the field as a low-relief isometric 2.5D grid using instanced, procedural geometry. The default color/relief mode is a named soil attribute available in the fixture (Nitrogen); do not claim that the grid represents soil texture or real topography. Cell height is a bounded visual encoding of the selected attribute, not elevation.
- On desktop, drag to orbit/pan, scroll to zoom, and press `F` to fit/reset the camera to the whole field. Camera movement never changes soil values. Do not enable automatic camera drift.
- Hover identifies the one-based row/column and raises the cell by a subtle perceived ~2 px. Click selects the cell and shows four corner brackets. The live inspector shows the selected cell's synthetic values and units. Keep core text, controls, and values in the DOM rather than canvas-only.
- Loading any scenario is atomic: discard the active brush preview, edit history/redo stack, selected cell/zone, Crop Fit zone context, displayed zoning sample, local leaf preview/sample, and camera pose; load that scenario's exact values, show its named focus feature/legend, and fit the camera. Undo never crosses a scenario boundary. Focus feature is Nitrogen for Garden East and Low Nitrogen Patch, EC for High Salinity / EC Pocket, and pH for Acidic Wash. `Reset demo` returns to Garden East seed 42 with Nitrogen active and clears all demo-local preview/sample states.

### Scenario chooser and quick presets

The chooser and toolbar expose deterministic examples based on the same seeded field:

| Example | Fixture effect | Initial map feature |
| --- | --- | --- |
| Garden East — Baseline | Restores the original field; “baseline” does not mean agronomically optimal. | Nitrogen |
| Low Nitrogen Patch | Rows 4–8, columns 3–7: sets N to the seeded baseline value minus `18 mg/kg`. | Nitrogen |
| High Salinity / EC Pocket | Rows 7–11, columns 7–10: sets EC to the seeded baseline value plus `1.20 dS/m`. | EC |
| Acidic Wash | Rows 12–16, columns 3–6: sets pH to the seeded baseline value minus `0.8`. | pH |

Coordinates are one-based. Selecting a named scenario loads its exact seed-42 baseline plus that one patch. Applying a toolbar preset to an already edited field sets only its declared feature in its declared cells to the same baseline-relative target; it does not compound on repeated clicks. Record one undo item. Visually outline the affected patch during the transition and keep an always-visible undo action (`Ctrl+Z`). Show the affected cells and changed feature in the inspector/history. The demo must not silently change unrelated features. Any extra mixed-feature preset must list every changed feature and delta.

After a preset or brush edit, automatically make the edited feature the active map/color/relief feature and update the legend. A preset changes one declared feature in this demo. This ensures every accepted edit has an immediate visible field response even when the prior map was displaying another feature. Undo restores the prior values and map feature; redo restores the edited values and feature. A no-op preset creates no history item. `Esc` cancels an uncommitted brush preview without changing values or history.

All displayed values are fixture data, carry explicit units, and are labeled **synthetic demo values—not agronomic thresholds or advice**. The fixture contract must define ranges, edit bounds, and preset deltas before frontend construction. Do not invent crop-fit limits to make the scenarios look realistic.

### Manual brush editing

Quick presets and manual brush painting are both available; there are **no soil sliders** in this experience.

- The brush toolbar selects one feature, `Raise` or `Lower`, a discrete strength (`Light`, `Medium`, or `Strong`), and a footprint width (`1`, `3`, or `5` cells). These options come from the fixture's declared per-feature edit increments; they are buttons/selects, not continuous sliders.
- The mock-only input/edit bounds and display precision are below. They are chosen for control behavior only, not as agronomic thresholds, measurement accuracy, or crop recommendations.

  | Feature | Display/edit bounds | Step / precision |
  | --- | --- | --- |
  | pH | 3.0–9.5 | 0.1 |
  | EC | 0–8 dS/m | 0.01 dS/m |
  | Soil temperature | 0–50 °C | 0.1 °C |
  | N, P, K | 0–250 mg/kg | 1 mg/kg |

- Brush footprint width is 1, 3, or 5 cells. `Light`, `Medium`, and `Strong` change the brush-center cell by 2%, 5%, and 10% of the selected feature's declared display/edit span respectively; round to that feature's display precision. Taper toward the edge, clamp to bounds, and leave every other feature unchanged.
- In **Inspect** mode, left drag orbits and right drag pans; in **Brush** mode, left drag paints and right drag pans. Scroll zooms in either mode. Click selects in Inspect mode. `F` fits the field unless a text control has focus. Interpolate pointer movement so fast brush drags do not skip cells, and apply each cell at most once per stroke.
- Preview touched cells and their before/after values while painting. Commit a completed drag as one history action; Undo/Redo restores the complete stroke. A preset is likewise one history action.
- The expanding visual transition is a **decorative contour ripple**, not a physical propagation of nutrients, pressure, water, or soil change. Respect reduced-motion settings by replacing it with a brief non-spatial highlight.

Use pH as unitless, N/P/K in mg/kg, EC in dS/m, and soil temperature in °C for this mock fixture. Include moisture only if its unit and synthetic snapshot context (depth/method/time) are defined in the fixture. Keep missing values distinct from zero.

The inspector may use this fixed illustrative cell for the first visual review: row `12`, column `8`, pH `6.4`, N `48 mg/kg`, EC `1.42 dS/m`, P `24 mg/kg`, K `130 mg/kg`, and soil temperature `24.5 °C`. These are invented display values, not sourced observations or agronomic guidance. The full 216-cell fixture must be stored as exact deterministic data when implementation begins; runtime randomization is not part of the contract.

Before frontend implementation, author a versioned fixture manifest and exact cell data for every named scenario. The manifest must give stable scenario/fixture IDs and versions, all 216 cell records and units, patch definitions, stable zoning sample IDs for each exposed `scenario × method × k` combination, and sample zone assignments. Zone summaries and optional FCM membership strengths must be derived from or validated against those exact sample assignments/values. Include three equal Crop Fit mock cards labeled `MOCK / NOT ASSESSED`, and a fixed 17-label leaf sample labeled unrelated to the selected/uploaded file. These data files are kickoff implementation inputs and are intentionally not created during this planning-only step.

### Zoning walkthrough

- Let the user choose K-means or Fuzzy C-means and `k=3` or `k=4` so the configuration and result layouts can be reviewed. The demo provides a prepared visual sample for each exposed method/count combination. Before loading one, show **No sample result loaded**. Once loaded, keep a persistent **MOCK OUTPUT — prepared fixture, not an algorithm result** label; do not claim it was calculated from the current inputs.
- The control is **Show sample result** (or **Play demo zoning**), not wording that claims a computation occurred. The sample transition may reveal the prepared zones but must not show fake progress, a “normalization scan” that appears to modify real values, centroid convergence, Euclidean attraction, or algorithm-derived quality metrics.
- When inputs differ from the exact input snapshot present when the sample was opened, preserve the sample and show an amber **INPUTS CHANGED SINCE SAMPLE VIEW — sample output is unchanged and was not computed from these edits** notice. Compare input state, not an incrementing edit counter, so Undo back to the exact snapshot clears this notice. Opening/reopening a sample refreshes its comparison snapshot but never removes its persistent MOCK label or turns it into a computation. Do not claim that a mock zoning view reflects arbitrary brush strokes. The real product may use **Zoning Out of Date — Re-run to compute new zones** only for a prior real zoning request/result.
- A sample may show fixed zone colors/patterns, optional fixture-based membership strengths, and a fixture-based zone summary. Mark FCM values as **membership strength, not confidence**. Do not show a fabricated silhouette score, inertia, iteration count, or geographic area.
- Use cell count (and optionally the share of the 216 synthetic cells) in place of acres/hectares; the mock grid has no real boundary or cell dimensions. `Not measured yet` is appropriate for silhouette or other diagnostics.
- Clicking a sample zone dims other cells to about 65% opacity, emphasizes the selected zone's boundary and label, and opens its fixture summary. Show mean and within-zone spread only when they are consistent with the prepared fixture, plus cell count. Do not add a map “centroid” marker unless it is explicitly calculated from member-cell map positions and labeled as a spatial center—not a K-means feature centroid.
- Keep the distinction clear in the presentation: the future real zoning phase may report actual normalized features, assignments, memberships, and diagnostics returned by the algorithm. Feature standardization transforms feature values; it does not flatten field geometry. A K-means centroid is a mean in the included feature space, not a geographic center-of-gravity marker unless a separate spatial position is explicitly computed. See [scikit-learn clustering](https://scikit-learn.org/stable/modules/clustering.html#k-means) and [feature standardization](https://scikit-learn.org/stable/modules/generated/sklearn.preprocessing.StandardScaler.html).

### Crop Fit

- Crop Fit is always reachable from navigation. With no sample zone selected, show a neutral prompt to choose a sample zone and three equal cards marked **MOCK / NOT ASSESSED**; do not show a blank page or imply assessments exist. After a sample zone is selected, pass its displayed fixture summary as context; do not imply that a real compatibility engine ran. Scenario changes clear this zone context.
- Show three equally weighted, independent cards: Apple, Tomato, and Potato. Each may show explicitly mock factor rows or **Not assessed**. Do not rank crops, show mock scores, or normalize the three crops into percentages totaling 100%.
- Explain that several crops, or none, could be suitable. The future rules phase may show independently sourced per-crop assessments only after its evidence and missing-data requirements are met. See the [crop-suitability research note](../research/crop-suitability-probability.md).

### Leaf Diagnosis

- Accept a local JPEG, PNG, or WebP image up to 10 MB and 16 megapixels for an in-browser preview (for example, a test image or image saved from the web). Do not accept remote URLs, upload, persist, or infer from that image in the mock demo. Give clear unsupported-format, oversize, and decode-error feedback; allow replace and clear.
- Provide a separate **Show sample result** action with a fixed, clearly labeled **MOCK OUTPUT — no model ran; unrelated to preview image** class example and the supported 17-label list. Never imply that the uploaded image caused the canned result. Do not show numeric confidence/probability, ranked scores, latency, or a model version as if inference occurred. Switching scenario or resetting the demo clears both local preview and sample result.
- In a deployed model phase, accepting an image does not guarantee that every online/field photo is supported. The fixed 17-class classifier can return only its supported labels and must expose unsupported/review behavior; performance on field photos must be evaluated rather than promised.

## Boundaries between demo and later product

| Capability | Mock-data demo | Later implementation |
| --- | --- | --- |
| Field | Desktop low-relief R3F scene; synthetic fixture values; presets and brush | Complete 2D path plus measured, performant R3F field; scenario/edit contracts |
| Zoning | Prepared sample views; no algorithm execution | Actual K-means/FCM results, versioned normalization, assignments, summaries, memberships, and computed diagnostics |
| Crop Fit | Three independent mock cards; no rule evaluation or probability | Source-backed per-crop rules and missing-data behavior; no three-crop probability split |
| Leaf Diagnosis | Arbitrary local preview plus separate canned result | Fixed MobileNetV3-Small 17-class inference with supported-label and review behavior |
| Data/telemetry | Synthetic values only | User-provided/validated inputs as later approved; no live sensor claim without integration |

No Spline scene or downloaded model is required for task completion. The small, optional decorative Kenney accents are governed by [Decision 0003](0003-decorative-kenney-assets.md); functional field geometry and markers remain procedural and must stay within the [TRD performance budgets](../TRD.md#performance-budgets).

## Demo completion gate

The demo is ready for review when:

1. A viewer can choose Garden East or a named synthetic scenario and reset to the exact seeded baseline.
2. Orbit/pan/zoom/fit, hover coordinates, click selection, corner brackets, and the live cell inspector work on the desktop review target.
3. Each quick preset deterministically changes only its declared patch/feature, shows the affected cells, records one undo item, and can be reset.
4. Manual brush edits a selected feature with discrete direction/strength/radius controls, gives visible feedback, and undoes one whole stroke as one item.
5. The field's color/relief encoding names its feature and never suggests actual terrain or sensor telemetry.
6. K-means/FCM sample controls show “No sample result loaded” until selected, then retain an explicit mock label; edits produce the defined inputs-changed notice without presenting the sample as a stale real result.
7. Crop Fit shows three equal independent examples without scores/ranking/probabilities; leaf accepts local images only for preview and never claims inference.
8. Reduced motion, keyboard actions, readable labels, and accessible DOM summaries remain usable. No paid asset/API/font/model or external 3D model is needed.
9. The user approves the look and journey before Phase 0 begins.

## After review

After approval, proceed through the [delivery phases](../DELIVERY.md) sequentially. The prototype's fake-free sample states are throwaway presentation fixtures, not model/algorithm results or evaluation evidence. Replace them with deterministic domain behavior and actual versioned services at the corresponding phases.
