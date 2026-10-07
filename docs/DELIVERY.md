# Delivery plan and acceptance

**Status:** pre-build. The phases and checks below describe planned work; they do not imply that code or verification has been completed.

## Delivery phases

Before Phase 0, build and review the desktop 2.5D mock-data visual demo described in [Decision 0002](decisions/0002-mock-data-demo-first.md). This presentation prototype may use a lightweight R3F field before the production 2D workflow is complete, but it is not the production renderer and does not implement ML or rules modules. It uses presets and brush painting (no sliders), deterministic fixtures, and clearly labeled sample results. Once the user approves its look and flow, continue through the production phases below in order.

| Phase | Deliverable | Exit condition |
| --- | --- | --- |
| 0. Resolve evidence and contracts | Audit the 17-class label map/splits, agree on soil features and units, research supported crop-profile sources, settle service boundary, and name target devices. | No invented labels, agronomic thresholds, or performance claims; domain contracts are versioned. |
| 1. Scenario and 2D Field Lab | Deterministic grid, inspection, local edits/presets, undo/redo, keyboard/table access, and stale state. | Edit-and-inspect journey works without WebGL. |
| 2. Real zoning | K-means/FCM execution, immutable results, summaries, adjacency, memberships, and synthetic benchmark. | Run metadata and benchmark evidence are available; no fabricated result. |
| 3. Crop Fit | Versioned sourced profiles, factor explanations, missing state, and zone variation. | All visible rules have source/unit/boundary tests; no unsupported aggregate or 100%-normalized crop-probability split. |
| 4. Leaf diagnosis and evidence | Audited shared-model inference, 17-class UI, review state, evaluation report, methodology route. | Model and preprocessing versions match; measured metrics are reproducible. |
| 5. Production R3F field integration and profiling | Complete production Three.js/R3F scene, tied to real scenario/run state, with 2D parity, accessibility, error fallback, and profiling. The earlier mock-demo scene is not considered this deliverable. | Hard budgets in [TRD](TRD.md) pass on named references. |
| 6. Optional decoration | Evaluate an SVG/Three.js vignette or optional Spline hero. | It is removable, free-tier compatible, lazy, and has no acceptance criterion dependent on it. |

The mock demo has its own completion gate: at a 1280 × 800 CSS-pixel desktop viewport and 100% browser zoom, a first-time user chooses Garden East or a named synthetic scenario, inspects a cell in the low-relief isometric field, applies a Quick Preset or paints a feature with the discrete manual brush, and sees the changed cells/history plus the truthful sample-input status. The path includes keyboard inspection and brush dabs; a complete 2D/no-WebGL rendering fallback and phone parity are final-product requirements, not demo gates. Crop Fit remains navigable before a zone is selected and explains how to load sample-zone context. Prepared zoning, Crop Fit, and leaf examples have persistent mock labels. No real clustering, model inference, or agronomic rule evaluation is claimed in that prototype.

Weather/water balance remains post-MVP and requires its own approval after sourced crop-stage parameters, uncertainty assumptions, and deterministic tests are ready.

## Release acceptance criteria

All required rows need their stated evidence before calling the MVP demo-ready.

| ID | Pass condition | Evidence |
| --- | --- | --- |
| AC-01 | Same named seed creates the same initial synthetic grid and units on repeated loads. | Determinism test and scenario manifest. |
| AC-02 | Cell/zone inspection shows value, unit, source, and relevant measurement context; missing data is not rendered as zero. | UI test and capture. |
| AC-03 | Previewed edits/presets affect only recorded cells; undo/redo restores exact input state. | Domain test. |
| AC-04 | In the final product, any soil change marks a prior real zoning result stale and retains the prior immutable result. The mock demo instead follows the separate no-sample / mock-sample / inputs-changed states in Decision 0002. | Integration test and mock state-transition test. |
| AC-05 | K-means/FCM run records parameters, seed, features/exclusions, versions, timing, diagnostics, and assignments. | Serialized run fixtures. |
| AC-06 | Incomparable moisture is excluded with a visible reason; comparable moisture may be included. | Context-validation test and capture. |
| AC-07 | FCM memberships are correctly mapped and described as membership strength, not confidence. | Algorithm/UI tests. |
| AC-08 | Soil, zoning, and membership modes have distinct titles/legends; zone meaning does not rely on color alone. | Accessibility/visual review. |
| AC-09 | Crop cards show factor status, value/unit when present, source/profile version, and missing-data state. | Rules/UI integration test. |
| AC-10 | Compatibility output is unchanged when only cluster labels change and never names a best/recommended crop. | Unit test and copy scan. |
| AC-11 | Leaf result contains the 17 ranked classes, model/preprocessing/map versions, latency, and review/unsupported state. | Model contract test. |
| AC-12 | Leaf inference receives no zone, soil, SHI, or selected-crop feature; context mismatch cannot change scores. | Request-schema test. |
| AC-13 | Final-MVP no-WebGL mode supports selection, edit, zoning, inspection, and Crop Fit; this is not a prerequisite for the earlier R3F-only mock demo. | Browser run with WebGL disabled. |
| AC-14 | Keyboard-only path reaches field actions; no required information depends on hover; reduced-motion stops decorative travel/loops. | Accessibility and manual check. |
| AC-15 | Desktop controls fit at 1280 px; mobile defaults to 2D. | Responsive capture/test. |
| AC-16 | Performance trace meets documented budgets on named desktop/constrained devices. | Versioned profile report. |
| AC-17 | UI contains no real sensor, pump, irrigation, fertilizer, cure, yield, or guarantee claim. | Copy and visual review. |
| AC-18 | Metrics appear only when linked to a measured report; otherwise the page says “Not measured yet.” | UI test and artifact audit. |
| AC-19 | Any imported asset has license, provenance, checksum, transfer size, and geometry metadata. | Asset-manifest audit. |
| AC-20 | Every published rule range has source, unit, version, boundary/missing-data behavior, and test coverage. | Rule test report. |
| AC-21 | Crop-fit values are independently labeled per crop; no normalized three-crop 100% “probability” is shown. Any displayed percentage names its denominator, scope, and source; cultivation probabilities remain absent until a defined outcome, representative data, independent validation, and calibration evidence exist. | UI copy/interaction test and linked crop-profile or probability-validation report. |

## Demonstration walkthrough

1. Choose Garden East seed 42 (or a named synthetic variant), orbit/pan/zoom the field, and inspect a cell.
2. Apply a deterministic Quick Preset or paint with the manual brush; demonstrate Undo and the truthful inputs-changed notice if a sample is already open.
3. Open the prepared K-means/FCM sample fixture for a supported cluster count; explain its persistent mock label and that no algorithm ran.
4. Open Crop Fit before and after selecting a sample zone; explain the context prompt, three independent mock cards, and no-probability boundary.
5. Preview a local leaf image, then separately show the canned mock class example and supported 17-label list; explain that no model ran and display no fabricated confidence scores.
6. Open Evidence & Metrics and distinguish measured findings from planned evaluation.

## Assumptions to resolve

| Assumption | Required validation |
| --- | --- |
| PlantVillage metadata supports the intended labels and physical-leaf split. | Audit files, labels, counts, and split metadata; save a versioned manifest. |
| PlantDoc has exact supported label matches. | Audit labels and report only actual coverage. |
| Suitable agronomy/extension sources define unit-compatible pre-plant soil ranges. | Record source, geography, method, units, crop/stage, version, and tests. |
| A synthetic field can demonstrate coherent patterns reproducibly. | Same-seed test and planted-region benchmark. |
| Reference devices can meet the 3D budget. | Profile the initial and maximum grids. |
| Spline export/embedding remains usable on the free tier. | Verify current limits only if evaluating Spline; otherwise omit. |

## Risk register and stop gates

| Risk | Handling |
| --- | --- |
| Controlled leaf images do not represent field photos. | State tested label scope; report cross-dataset evidence separately; provide review/unsupported states. |
| Unsourced crop thresholds appear to give advice. | Show raw supported factors/“Not assessed”; do not publish aggregate scores until sourced and tested. |
| A normalized crop score is mistaken for cultivation probability. | Keep crop outputs independent; disclose any index/class/percentage denominator; require validated outcome data and calibration before probability wording. |
| Moisture readings are not comparable. | Exclude and explain; keep spot moisture outside crop fit by default. |
| 3D harms speed or access. | Complete 2D first, instance geometry, bound the scene, and profile fallback/mobile paths. |
| Spline is restricted or heavy. | Keep it optional, lazy, decorative, and replaceable by SVG/Three.js. |
| Motion implies algorithm steps that did not occur. | Keep zoning internals out of the mock animation; label prepared samples. In production, animate only validated requests and returned results. |
| Asset license/provenance is uncertain. | Reject the model and generate the cue procedurally. |

Do not publish accuracy without the audited split and evaluation report. Do not publish quantitative crop compatibility without sourced thresholds and tests. The desktop-only mock prototype is an explicit visual-review exception; do not enable production 3D by default for a device class without profiling and an equivalent accessible path. Do not add a downloaded model before it passes the [TRD asset gate](TRD.md#asset-policy).
