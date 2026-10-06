# Decision 0002: build a desktop mock-data field demo before implementation phases

**Status:** accepted as the next requested milestone
**Date:** 2026-10-07

## Context

The user wants to see and review the product experience before starting the sequential implementation phases. The first deliverable is a visual, interactive front-end demo with deterministic synthetic data. It should make the field, inspection, soil edits, zoning view, Crop Fit, and Leaf Diagnosis tangible without implying that an algorithm, trained model, or agronomic rule engine has run.

This demo is a presentation milestone only. It does not change the proposed React/TypeScript/Vite and Three.js/React Three Fiber front end, the planned Python/scikit-learn/scikit-fuzzy/TensorFlow/Keras boundaries, or the fixed MobileNetV3-Small 17-class application model. Those implementation decisions remain for their planned phases; this document does not prescribe or revise the backend architecture.

## Decision

Build the mock-data front end before Phase 0, then pause for the user's visual and journey review. Use a lightweight, low-relief Three.js/React Three Fiber field on desktop so the user can inspect the intended isometric experience. This prototype does not implement real K-means, Fuzzy C-means, crop rules, or leaf inference. All results that are not direct display of fixture values must be clearly labeled as mock/sample output.

The desktop prototype is the current review target. Mobile parity is not a demo acceptance condition. The later product still requires accessible DOM controls, keyboard operation, a complete 2D/no-WebGL path, and the performance/fallback checks in the PRD, UX specification, and TRD.

## Prototype experience

### Entry and field

- **Explore demo** opens a scenario chooser with **Garden East — Baseline** selected by default. The presenter may choose the baseline or one of the prepared named scenarios; no soil edit is applied without a deliberate selection.
- The starting fixture is deterministic: Garden East, seed `42`, an `18 × 12` grid (216 cells). The top bar shows **SYNTHETIC SCENARIO: Garden East (Seed #42)**. It is not live sensor telemetry.
- Render the field as a low-relief isometric 2.5D grid using instanced, procedural geometry. The default color/relief mode is a named soil attribute available in the fixture (Nitrogen); do not claim that the grid represents soil texture or real topography. Cell height is a bounded visual encoding of the selected attribute, not elevation.
- On desktop, drag to orbit/pan, scroll to zoom, and press `F` to fit/reset the camera to the whole field. Camera movement never changes soil values. Do not enable automatic camera drift.
- Hover identifies the one-based row/column and raises the cell by a subtle perceived ~2 px. Click selects the cell and shows four corner brackets. The live inspector shows the selected cell's synthetic values and units. Keep core text, controls, and values in the DOM rather than canvas-only.
- `Reset demo` restores Garden East seed 42, the initial values, camera fit, selected state, and sample-result state.

### Scenario chooser and quick presets

The chooser and toolbar expose deterministic examples based on the same seeded field:

| Example | Fixture effect |
| --- | --- |
| Garden East — Baseline | Restores the original field; “baseline” does not mean agronomically optimal. |
| Low Nitrogen Patch | Rows 4–8, columns 3–7: sets N to the seeded baseline value minus `18 mg/kg`. |
| High Salinity / EC Pocket | Rows 7–11, columns 7–10: sets EC to the seeded baseline value plus `1.20 dS/m`. |
| Acidic Wash | Rows 12–16, columns 3–6: sets pH to the seeded baseline value minus `0.8`. |

Coordinates are one-based. Selecting a named scenario loads its exact seed-42 baseline plus that one patch. Applying a toolbar preset to an already edited field sets only its declared feature in its declared cells to the same baseline-relative target; it does not compound on repeated clicks. Record one undo item. Visually outline the affected patch during the transition and keep an always-visible undo action (`Ctrl+Z`). Show the affected cells and changed feature in the inspector/history. The demo must not silently change unrelated features. Any extra mixed-feature preset must list every changed feature and delta.

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

### Zoning walkthrough

- Let the user choose K-means or Fuzzy C-means and `k=3` or `k=4` so the configuration and result layouts can be reviewed. The demo provides a prepared visual sample for each exposed method/count combination; each sample is labeled **MOCK OUTPUT — not calculated from current edits**.
- The control is **Show sample result** (or **Play demo zoning**), not wording that claims a computation occurred. The sample transition may reveal the prepared zones but must not show fake progress, a “normalization scan” that appears to modify real values, centroid convergence, Euclidean attraction, or algorithm-derived quality metrics.
- Soil edits preserve the prior sample and show an amber **ZONING OUT OF DATE — sample output is not calculated from current edits** banner. Showing a sample again does not clear the fact that it was not computed from those edits. Do not claim that a mock zoning view reflects arbitrary brush strokes. The real product may use **Zoning Out of Date — Re-run to compute new zones** only when a real zoning request is available.
- A sample may show fixed zone colors/patterns, optional fixture-based membership strengths, and a fixture-based zone summary. Mark FCM values as **membership strength, not confidence**. Do not show a fabricated silhouette score, inertia, iteration count, or geographic area.
- Use cell count (and optionally the share of the 216 synthetic cells) in place of acres/hectares; the mock grid has no real boundary or cell dimensions. `Not measured yet` is appropriate for silhouette or other diagnostics.
- Clicking a sample zone dims other cells to about 65% opacity, emphasizes the selected zone's boundary and label, and opens its fixture summary. Show mean and within-zone spread only when they are consistent with the prepared fixture, plus cell count. Do not add a map “centroid” marker unless it is explicitly calculated from member-cell map positions and labeled as a spatial center—not a K-means feature centroid.
- Keep the distinction clear in the presentation: the future real zoning phase may report actual normalized features, assignments, memberships, and diagnostics returned by the algorithm. Feature standardization transforms feature values; it does not flatten field geometry. A K-means centroid is a mean in the included feature space, not a geographic center-of-gravity marker unless a separate spatial position is explicitly computed. See [scikit-learn clustering](https://scikit-learn.org/stable/modules/clustering.html#k-means) and [feature standardization](https://scikit-learn.org/stable/modules/generated/sklearn.preprocessing.StandardScaler.html).

### Crop Fit

- After a sample zoning view, the user can select a zone and open **Compare in Crop Fit**. Pass the selected zone's displayed fixture summary as context; do not imply that a real compatibility engine ran.
- Show three equally weighted, independent cards: Apple, Tomato, and Potato. Each may show explicitly mock factor rows or **Not assessed**. Do not rank crops, show mock scores, or normalize the three crops into percentages totaling 100%.
- Explain that several crops, or none, could be suitable. The future rules phase may show independently sourced per-crop assessments only after its evidence and missing-data requirements are met. See the [crop-suitability research note](../research/crop-suitability-probability.md).

### Leaf Diagnosis

- Accept an arbitrary local image file for a local preview (for example, a test image or an image saved from the web). Do not upload, persist, or infer from that image in the mock demo.
- Provide a separate **Show sample result** action with a fixed, clearly labeled **MOCK OUTPUT — no model ran** 17-class example. Never imply that the uploaded image caused the canned result.
- In a deployed model phase, accepting an image does not guarantee that every online/field photo is supported. The fixed 17-class classifier can return only its supported labels and must expose unsupported/review behavior; performance on field photos must be evaluated rather than promised.

## Boundaries between demo and later product

| Capability | Mock-data demo | Later implementation |
| --- | --- | --- |
| Field | Desktop low-relief R3F scene; synthetic fixture values; presets and brush | Complete 2D path plus measured, performant R3F field; scenario/edit contracts |
| Zoning | Prepared sample views; no algorithm execution | Actual K-means/FCM results, versioned normalization, assignments, summaries, memberships, and computed diagnostics |
| Crop Fit | Three independent mock cards; no rule evaluation or probability | Source-backed per-crop rules and missing-data behavior; no three-crop probability split |
| Leaf Diagnosis | Arbitrary local preview plus separate canned result | Fixed MobileNetV3-Small 17-class inference with supported-label and review behavior |
| Data/telemetry | Synthetic values only | User-provided/validated inputs as later approved; no live sensor claim without integration |

No Spline scene or downloaded model is required. Functional field geometry and markers are procedural and must stay within the [TRD performance budgets](../TRD.md#performance-budgets).

## Demo completion gate

The demo is ready for review when:

1. A viewer can choose Garden East or a named synthetic scenario and reset to the exact seeded baseline.
2. Orbit/pan/zoom/fit, hover coordinates, click selection, corner brackets, and the live cell inspector work on the desktop review target.
3. Each quick preset deterministically changes only its declared patch/feature, shows the affected cells, records one undo item, and can be reset.
4. Manual brush edits a selected feature with discrete direction/strength/radius controls, gives visible feedback, and undoes one whole stroke as one item.
5. The field's color/relief encoding names its feature and never suggests actual terrain or sensor telemetry.
6. K-means/FCM sample controls can show their prepared `k=3`/`k=4` fixtures, while all results and missing diagnostics remain explicitly mock/not measured and stale after edits.
7. Crop Fit shows three equal independent examples without scores/ranking/probabilities; leaf accepts local images only for preview and never claims inference.
8. Reduced motion, keyboard actions, readable labels, and accessible DOM summaries remain usable. No paid asset/API/font/model or external 3D model is needed.
9. The user approves the look and journey before Phase 0 begins.

## After review

After approval, proceed through the [delivery phases](../DELIVERY.md) sequentially. The prototype's fake-free sample states are throwaway presentation fixtures, not model/algorithm results or evaluation evidence. Replace them with deterministic domain behavior and actual versioned services at the corresponding phases.
