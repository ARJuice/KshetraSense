# UX specification

**Status:** pre-build interaction contract. The [PRD](PRD.md) owns product scope; this document owns the user-facing behavior and presentation.

**Demo scope:** the first desktop mock-data prototype is governed by [Decision 0002](decisions/0002-mock-data-demo-first.md). That decision overrides the real-service/run behavior below where it specifies prepared sample outputs. It also fixes the prototype's no-slider preset-and-brush interactions, input/sample state labels, and scenario cleanup. The demo requires keyboard-operable DOM controls and brush dabs, but not a complete 2D/no-WebGL renderer; that remains a final-product requirement. The later product requirements below still describe real algorithm, rule, and model behavior; none of those computations are part of the mock demo.

## Experience principles

1. **Show cause and effect.** A user edit changes visible inputs and marks dependent results stale. Animation follows a real operation and result.
2. **Label evidence.** Synthetic/user data, model output, and rules output have distinct labels and explanatory copy.
3. **Keep the field understandable in 2D.** The 3D view adds depth, but controls, values, results, keyboard use, and the main task must remain available without WebGL.
4. **Use calm, precise visuals.** Favor a clear field map, readable values, units, patterns, and restrained motion over dense gauges and decorative effects.

## Navigation and shared shell

| Area | Purpose |
| --- | --- |
| Overview | Explain the active scenario and link to the main tasks. |
| Field Lab | Edit soil values, run zoning, and inspect cells/zones. |
| Crop Fit | A contextual Field Lab drawer tab for the selected cell/zone; it is not a global navigation destination. |
| Leaf Diagnosis | Upload one image and inspect the shared classifier result. |
| Evidence & Metrics | Show methods, datasets, measured metrics, and known limitations. |

Keep one active scenario visible in the top bar with its source label and seed. The shell's primary destinations are Field Lab, Leaf Diagnosis, and Evidence & Metrics; Crop Fit remains within Field Lab so selection context is never lost. For the mock demo, Explore opens a scenario chooser with Garden East seed 42 selected by default; a presenter may choose Baseline, Low Nitrogen Patch, High Salinity / EC Pocket, or Acidic Wash. Put undo/redo and reset near the scenario controls. A scenario change starts a clean walkthrough: discard brush preview/history, cell/zone selection and context, sample result, local leaf preview/sample, and camera pose; load its exact fixture, show its focus feature/legend (Nitrogen for Garden East and Low Nitrogen Patch, EC for High Salinity, pH for Acidic Wash), and fit the camera. Reset returns to Garden East/Nitrogen and clears all demo-local states. Put task-specific settings near the relevant workspace. Do not put an unmeasured global score in the shell.

## Core journeys

### Edit soil and rerun zoning

1. Open the scenario chooser, start from the selected Garden East seed, and identify its synthetic-data status.
2. Select a cell or region and inspect values, units, and measurement context.
3. Apply a deterministic named preset or use the manual brush to edit one selected feature; expose affected cells and exact changes.
4. In the real product, show the prior result as stale while preserving it. In the demo, show “No sample result loaded” until the user chooses K-means or FCM and a supported cluster count and opens a prepared sample. Keep that sample labeled as a fixture, not a computed result; if soil inputs then differ from the sample-view snapshot, show the amber notice specified in Decision 0002.
5. In the real product, start a zoning request and show an indeterminate pending state. On success, display returned zones, summaries, adjacency, and FCM memberships if applicable. In the mock demo, use only the clearly labeled prepared sample flow in Decision 0002.

### Compare crop compatibility

1. Crop Fit opens as a contextual tab/panel in the existing Field Lab drawer; it is not a global route. In the real product, select a zone (or inspect a cell) and open it for that scope. In the demo, before a sample zone is selected, its disabled/prompt state explains how to select a zone; after selection, it shows that sample-zone context without hiding the field.
2. Show equal, non-ranked Apple, Tomato, and Potato cards.
3. Let the user inspect observed value, unit, applicable range, source/profile version, and factor explanation.
4. Mark missing or unsupported factors as “Not assessed.” Show within-zone variation and input sufficiency.
5. Keep each crop assessment independent. Do not turn zoning labels, FCM cluster-membership strengths, or normalized rule scores into a crop probability. Do not show Apple/Tomato/Potato values as a 100%-sum probability split; more than one crop may be suitable, or none may be.

### Inspect a leaf result

1. In the real product, choose an image and see accepted formats, local-use/privacy information, and the current image. In the mock demo, a local JPEG/PNG/WebP within the documented size limits may be previewed but is never uploaded or inferred; the canned class example and 17-label list are separate, with no fabricated scores or latency.
2. Start inference and wait for the actual result without fabricated percentage progress.
3. Show the top class, all 17 ranked scores, model/preprocessing versions, latency, and review/unsupported state.
4. If crop context was selected, show mismatch as informational context after inference; never change the scores.

## Screen requirements

### Overview

If an Overview is present, explain KshetraSense in one sentence, show the current scenario and provenance, and provide direct entry to Field Lab and Leaf Diagnosis—not a duplicate Crop Fit route. Distinguish the three evidence types: unsupervised zoning, supervised image classification, and transparent rules. A future water-balance feature may appear as a clearly disabled post-MVP item.

### Field Lab

The main workspace contains a field stage, a compact tool/control area, and a contextual inspector. Map modes are mutually exclusive and clearly titled: **Soil attribute**, **Zoning**, and **Membership** (only after an FCM result). Each has its own legend and units/meaning.

- Soil mode uses a sequential value scale for the selected attribute, defaulting to synthetic Nitrogen. Cell inspection shows exact values and units.
- The desktop field is a low-relief isometric 2.5D view. Drag orbits/pans, scroll zooms, and `F` fits/resets the camera; camera movement does not modify data. Show a subtle hover reticle, one-based row/column tooltip, and a perceived ~2 px cell lift. Clicking selects the cell and locks four corner brackets to it.
- The synthetic field's color and bounded relief encode the explicitly selected soil attribute, not soil texture or real elevation. Label the attribute and legend. Keep the synthetic scenario/seed badge visible and never present it as sensor telemetry.
- Zoning mode shows zone number, distinct pattern, color, and an outline. It labels the map as crop-neutral.
- Membership mode shows membership strength for the selected FCM cluster and states that it is not confidence.
- Selecting a cell opens a right-side inspector drawer with a restrained translucent/glass treatment; keep text contrast independent of blur and fall back to a solid surface if blur is unavailable or costly. Respect reduced-motion when it slides in. The inspector shows cell values/source context, or zone means, min–max ranges, standard deviation (when calculated), cell count, neighboring zones, and run method. Prefer standard deviation/range over raw variance in user-facing summaries because they remain in the feature's display units. Show geographic area only when cell dimensions and the field boundary are defined; otherwise show cell count (or an explicitly scoped share of cells).
- Sensor markers are optional, visual-only hypothetical sampling locations with the tooltip “Illustrative; no live sensor stream.” They do not animate as if they are collecting data.
- There are no soil sliders. Quick presets apply named, deterministic local scenarios such as Low Nitrogen Patch, High Salinity / EC Pocket, and Acidic Wash. Manual brush painting selects one feature, Raise/Lower direction, discrete strength, and discrete footprint width. Show touched cells and before/after values; clamp to declared fixture bounds and do not silently change other features.
- After a preset or brush edit, automatically make the edited feature the active field/map/legend feature so the edit has an immediate visible response even if the prior view showed another attribute. Undo restores the prior feature selection; redo restores the edited feature. Scenario changes clear edit history, selection, sample/crop context, and active brush preview as defined in Decision 0002.
- A completed brush drag is one undo/redo action. Preset application is also one action. Keep Undo and Reset discoverable; `Ctrl+Z` undoes the last completed edit.
- The mock demo includes Baseline plus the three localized examples in Decision 0002. Future presets such as lower-moisture or mixed-feature contrasts require an explicitly defined, context-qualified fixture and must describe synthetic contrasts, not agronomic recommendations. Every preset starts from a reproducible scenario state.
- Brush movement paints a soft footprint with interpolated pointer samples so quick strokes do not skip cells. A contour ripple may be used as a decorative edit transition only; it must not imply that nutrients, water, or pressure physically propagate. Reduce or remove the ripple under `prefers-reduced-motion`.
- Every change marks a prior real zoning result stale. In the mock demo, preserve the prepared sample under its persistent mock label and use the separate inputs-changed notice from Decision 0002; undoing to the exact sample-view input snapshot clears that notice. A no-op preset adds no history entry, and `Esc` cancels an uncommitted brush preview.

### Zoning interaction

Validate configuration before enabling Run zoning. Pending feedback is indeterminate and tied to the actual service request. Settle the visualization only from the returned assignments. Do not fabricate intermediate K-means/FCM iterations, seed locations, progress percentages, merges, or metrics that the service did not return. A failure preserves edits and the previous result. In the mock demo, `Show sample result` is not a zoning request: show an explicit empty state beforehand, then a persistent mock-fixture label; use the separate inputs-changed notice after edits rather than calling the sample a stale run.

Do not place a feature-space K-means centroid on the map as though it were a geographic center. A map marker is permissible only for a separately computed spatial summary of member-cell positions, and must be named accordingly. A field's zone area requires declared geospatial cell dimensions/boundaries; otherwise show cell count or assessed-cell share. A silhouette value must come from an actual run and be labeled as a diagnostic, not agronomic quality.

K-means and FCM group feature vectors and do not by themselves promise contiguous geographic regions. Draw map outlines around the assigned cell components as they are; merge disconnected components only when a separately specified spatial post-process actually performs and reports that operation. Mock fixtures may use hand-authored contiguous patches, but must remain labeled as samples rather than algorithm outcomes.

### Crop Fit (contextual Field Lab panel)

Display all three crops at equal emphasis within the Field Lab drawer while retaining the selected field zone in view. For each factor, show status, observed value/unit if available, cited range/source, profile version, and reason. The user may highlight matching cells from a factor explanation. Do not rank cards or describe the highest count as a recommendation.

If a future, region-specific ruleset supports an aggregate, label it as a soil-compatibility index or suitability class and explain its factors and assumptions—not as a chance/probability. Any percentage must state its denominator and scope. A research-based yield-potential percentage, if ever added, is relative to that crop's own modeled attainable maximum; it is not interchangeable with probability and must not be normalized against the other crops. A class-area display may show the percent of assessed cells in a selected zone falling into each suitability class for one crop at a time; state the assessed-cell denominator and show the not-assessed share separately. It must not imply that crop shares divide a fixed 100% across the three crops.

Only add a cultivation-probability view after the PRD's outcome-data, independent-validation, and calibration gates are satisfied. Define “success,” time horizon, geography, crop/variety, and management assumptions in visible context; show uncertainty and evidence coverage. Treat each crop's success as an independent probability unless the product explicitly models a single mutually exclusive decision with a “none/unknown” option. See the [crop-suitability research note](research/crop-suitability-probability.md).

### Leaf Diagnosis

Keep uploaded image and result metadata side by side where space allows. A new upload clears the prior real result presentation until its own inference completes. In the mock demo, accept local JPEG/PNG/WebP files up to 10 MB and 16 megapixels for preview only; show format/size/decode errors and allow replacement/clear. A preview never triggers inference. Keep the fixed 17-class sample result visibly unrelated to the preview. Show the supported-label limitation and a review state without alarming language. Do not show decorative model heatmaps; any saliency display must come from the actual deployed model.

### Evidence & Metrics

Organize the view into vision, zoning, data/splits, and known limits. Show only metrics with a linked, versioned report. Before measurement, say “Not measured yet” and show the planned evaluation method. Prefer accessible SVG/HTML charts; 3D charts are unnecessary.

## Visual system

Use a restrained dark mineral/soil base with legible high-contrast text. Suggested semantic accents: cyan for model/zoning output, amber for sourced rules and review states, green for crop/vegetation cues, and ochre for manual soil edits. These colors supplement text and patterns; they never carry meaning alone. Use tabular numerals for readings and always show units.

Use system fonts by default, inline SVG or simple CSS geometry for functional icons, and parametric SVG/Three.js shapes for crop silhouettes, sensor markers, root layers, and field cues. No remote font, icon, stock-photo, or model download is required.

## States and copy

| State | Required behavior/copy intent |
| --- | --- |
| No zoning yet | Explain how to select a method and run zoning. |
| Stale zoning | Say inputs changed since the run; preserve the old result as stale. |
| Missing measurement | Use “Not measured” or “Not assessed,” never a neutral/zero placeholder. |
| Zoning failure | “Zoning could not run. Your edits are still here.” Offer retry and details. |
| Unsupported/review image | State the supported labels or reason the result needs review. |
| No WebGL | Show the complete 2D field with a non-blocking 3D unavailable note. |
| Mock demo: no sample | Say “No sample result loaded”; do not show a stale-result banner before a sample exists. |
| Mock demo: sample displayed | Keep a persistent mock-fixture label. After inputs diverge from the viewed snapshot, say the sample is unchanged and was not computed from those edits. |

Prefer “model score,” “synthetic,” “compatibility factor,” “not assessed,” and “needs review.” Avoid “best crop,” “disease confirmed,” “automatic cure,” “real-time sensor,” yield, fertilizer, or pump claims.

## Accessibility, responsive behavior, and motion

- Provide keyboard cell navigation with arrow keys and Enter/Space selection; offer a tabular/list alternative for dense field data. In brush mode, arrows move the brush target and Enter/Space applies one brush dab; preset buttons remain keyboard-operable. This is the non-drag alternative to painting and is required even for the R3F-only desktop mock. A completed pointer stroke remains a single undo action. The complete 2D/no-WebGL path remains a final-product requirement, not a mock-demo gate.
- Mirror essential canvas information in accessible DOM/SVG. Use visible focus and polite announcements for zoning completion/failure and stale status. Do not announce high-frequency hover coordinates.
- Target WCAG 2.2 AA contrast. Zone identity uses number/text and pattern in addition to color. No required value or explanation is hover-only.
- Desktop uses a field canvas with inspector. Tablet moves the inspector into a bottom sheet. Mobile defaults to 2D and uses a drawer/stepper for controls.
- Respect `prefers-reduced-motion`: stop camera drift, ripples, shimmer, and stagger; use immediate or brief opacity changes. Limit ambient loops to two, pause them when hidden, and reduce decorative work if frame rate drops below 45 FPS.
- Pointer/touch camera controls must not capture page scrolling unexpectedly; keep primary controls in the DOM.

## 3D and decorative scene ownership

The desktop functional field uses Three.js through React Three Fiber. Its data and interactions remain owned by the application. The first mock demo may use the low-relief 2.5D presentation before the later production profiling/fallback phase, but must stay within the existing small-scene budgets. Labels, inspectors, legends, and accessible selection remain outside the 3D canvas. See the [technical requirements](TRD.md) for budgets and fallback requirements.

Spline can be used only for a free-tier-compatible decorative Overview/empty-state scene after its current export and embedding limitations are verified. It must be lazy, removable, and have a static SVG or lightweight Three.js fallback. If its limits or payload are inconvenient, use the fallback without changing any task.
