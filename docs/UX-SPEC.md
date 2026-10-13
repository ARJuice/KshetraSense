# UX specification

**Status:** historical UX contract for the previous grid-painting workflow. It is superseded for the current Soil Zoning workflow by the implemented boundary/sample UI in [Phase 2](plans/phase-2-soil-zoning-ui-redesign.md), which uses the `/v2` API. Do not use brush/preset interactions below as the current implementation spec. Product scope remains in the [PRD](PRD.md); backend contracts are in the [TRD](TRD.md) and phase plans.

The existing prototype UI is not the design baseline. Rebuild the experience from the user's jobs and real module boundaries. There is no presentation-only mock phase, no canned result, and no fake algorithm progress. Use synthetic fixtures only for tests/benchmarks or an explicitly labeled development diagnostic.

## Experience principles

1. **Make the next action obvious.** Users should understand where to begin, what data a module needs, and what happens after they run it.
2. **Show evidence and provenance.** Every map, score, time series, and measurement identifies whether it is user-supplied, measured, satellite-derived, modeled context, ML output, or rules output.
3. **Preserve module boundaries.** Soil Zoning, Crop Fit, Leaf Diagnosis, and Field Monitoring have separate results and state. A deliberate navigation/handoff may carry context only when the user chooses it.
4. **Make the spatial tool usable in 2D.** Three.js/R3F adds depth; controls, values, results, keyboard use, and essential map interaction remain available without WebGL.
5. **Use animation as truthful feedback.** Motion follows a real user action or returned result. Do not animate imagined clustering steps, satellite acquisition, yield, irrigation, or model confidence.

## Navigation and shell

| Destination | Purpose |
| --- | --- |
| Overview | Explain the four capabilities and direct the user to a useful starting task. |
| Field Lab | Inspect/edit soil data and run K-means or Fuzzy C-means Soil Zoning. |
| Crop Fit | A contextual panel within Field Lab for three separate, source-backed per-crop soil assessments. It is not a new global destination. |
| Leaf Diagnosis | Submit a leaf image to the shared MobileNetV3-Small classifier and inspect its actual result. |
| Field Monitoring | Separate workspace with Soil Investigation and Vegetation Monitoring. |
| Evidence & Methods | Explain datasets, algorithms, provenance, actual evaluation, and limitations. |

Keep one clear global status for the active field/project and data source where relevant. Do not use a global agronomic score or collapse module outputs into one “farm health” indicator.

## First-use journey

The first screen should briefly explain the available jobs, then let the user choose one. If required data/credentials are absent, offer the module's valid input route and explain what is needed; do not fill the page with invented outputs. A development benchmark may be available to developers but must be visibly labeled as synthetic and must not stand in for user data.

## Module journeys

### Soil Zoning — Field Lab

1. Select or create a soil dataset/field and review data source, supported features, units, and missing-measurement warnings.
2. Inspect cells and measurements. A cell or zone selection opens an accessible inspector with values, units, measurement context, and source.
3. Edit one parameter using the approved preset or brush interaction. Show affected cells and exact before/after values; support undo/redo. Any prior real result becomes stale without being discarded.
4. Select K-means or Fuzzy C-means, a supported cluster count, and the feature set; validate the request before enabling **Run zoning**.
5. On a real service response, show zone assignments, profiles, adjacency, diagnostics, and FCM membership where relevant. Show an indeterminate pending state tied to the real request; never invent progress, centroid motion, or convergence.

Zone identity uses labels/patterns as well as color. A map shows cluster similarity, not “good/bad soil,” a crop recommendation, or a treatment prescription. Cell height is a bounded visual encoding of a selected feature, not geospatial elevation.

### Crop Fit

Crop Fit remains a separate rules calculation accessed in the Field Lab context. The user explicitly selects a cell or zone and opens **Crop Fit**; the panel says what measurement set and rule/profile version it assessed. Show equal, independent Apple, Tomato, and Potato cards, factor-by-factor evidence, applicable sourced range, source, missingness, and within-zone variation. Do not rank crops or normalize values into a 100% probability split. Missing or unsupported factors say **Not assessed**.

### Leaf Diagnosis

1. Choose one supported local image format and display the privacy/size guidance before inference.
2. Submit the image and show progress only as supported by the actual request; a new request does not retain a result for a different image as if it were current.
3. Show the actual ranked supported classes, top class, model/preprocessing version, measured latency, and review/unsupported status.
4. Selected crop or zone may be shown as context only; it cannot change model input or scores. Never show a fabricated saliency map, diagnosis, cure, or confidence percentage.

### Field Monitoring

Field Monitoring has two separate views. Do not display SoilGrids as a sample or present NDVI as a soil measurement.

#### Soil Investigation

The user creates an investigation and enters a dated sample or imports a validated CSV. Each record shows location, collection date/time, sampling depth, method/source, measured parameter, original value/unit, and optional notes. If repeat readings are not comparable (for example, different depths or methods), show them as separate observations rather than a misleading trend.

An optional SoilGrids panel accepts a location/area, supported property, and depth layer. Show the modeled estimate and available uncertainty quantiles, native 250 m resolution, product/date provenance, and the label **Regional modeled context — not a field sample**. Keep this layer visually and semantically distinct from user-measured samples. It does not feed Soil Zoning or Crop Fit automatically.

Useful outputs are a sample register, sample-location map, parameter history where comparable repeat observations exist, missing-context cues, and the separate broad SoilGrids context panel. The initial experience is manual/imported investigations; it does not imply a live sensor network.

#### Vegetation Monitoring — CropSight

Vegetation Monitoring runs the pinned CropSight application as an independent local sub-application. It uses its own area and date state and is not coupled to KshetraSense Soil Zoning, Crop Fit, Leaf Diagnosis, or cadastral geometry.

Inputs are the center latitude/longitude, circular radius, date window, any supported clustering configuration, and optional crop/stage context used only by the app. Live retrieval requires a correctly configured Google Earth Engine project/account and available quota. Optional rainfall/CHIRPS information must have its own source label and availability state.

Show only data that the running CropSight path actually returns: its NDVI visualization/time series and supported zone summaries, acquisition dates, analysis parameters, coverage/quality context where available, and external-service status. Do not silently relabel a circle as a cadastral parcel. If imagery is unavailable, cloud/coverage is inadequate, authorization fails, or a displayed clustering method is inconsistent with its output, explain the specific limitation and do not substitute a prepared result.

The first useful tasks are seasonal pattern review and marking relatively underperforming patches for human scouting. A vegetation anomaly means **inspect here**, not a diagnosis. Variable-rate maps, irrigation decisions, and yield estimates are not implied by this view; they require separate validated data/models and later scope approval.

## Visual direction and interaction

The implementation agent has broad creative freedom to establish a distinctive, polished visual identity for a serious field-analysis tool. Do not inherit the prototype's palette, layout, or glass effects by default. Explore distinct art directions before settling, but do not build a throwaway mock product; validate concepts with lightweight sketches and then implement functional screens directly.

Keep the field/map visually dominant where spatial tasks matter, with clear legends, date/source labels, readable numeric values, and compact context panels. Use color plus text/pattern/shape for zone identity. Avoid decorative density that competes with evidence. Controls and descriptions stay in accessible DOM/SVG, not only in the WebGL canvas.

Use satisfying transitions for edits and result changes, but animate only actual state deltas or returned spatial outputs. Respect `prefers-reduced-motion`; do not block inspection behind a long reveal. No animation may imply a computation that has not happened.

## States and copy

| State | User-facing behavior |
| --- | --- |
| No input | State which input is required; no fabricated default result. |
| Incomplete/incompatible soil sample | Identify the missing unit, depth, method, or date; keep the record recoverable. |
| SoilGrids unavailable | Say regional context is unavailable; never replace it with a measured value. |
| CropSight not configured | Explain the Earth Engine setup requirement and provide a non-secret configuration status, not a fake map. |
| No usable imagery / poor coverage | Show date range and coverage information available from the service; do not claim reliable zones. |
| External service error | Keep user input, state the provider/error category, and offer retry when appropriate. |
| Analysis running | Indeterminate/request-linked progress only; announce completion or failure accessibly. |
| Stale real Soil Zoning result | Preserve the last immutable run, label it stale, and provide an explicit rerun action. |
| Unsupported/uncertain leaf input | State the supported classes and explain why review is needed. |
| No WebGL | Retain the complete 2D workflow and essential map information. |

Prefer “modeled regional context,” “satellite-derived vegetation pattern,” “soil measurement,” “compatibility factor,” and “needs review.” Avoid “confirmed stress,” “best crop,” “automatic treatment,” “yield forecast,” “prescription,” or “live sensor” unless a separately validated feature actually supports the term.

## Accessibility, responsive behavior, and motion

- Provide keyboard cell navigation, selection, editing, and action controls; no essential information is hover-only.
- Mirror essential canvas information in accessible DOM/SVG. Use visible focus and polite announcements for long-running request completion/failure and stale status.
- Target WCAG 2.2 AA contrast. Zone identity uses number/text and pattern in addition to color.
- Desktop uses the field canvas with inspector. Tablet moves context into a bottom sheet. Mobile defaults to 2D and a focused control/drawer layout.
- Respect `prefers-reduced-motion`; camera/ambient motion stops, and data updates settle immediately or with a brief fade.
- Pointer/touch camera controls must not capture page scrolling unexpectedly; primary controls remain in the DOM.

## 3D and decorative scene ownership

The functional field uses Three.js through React Three Fiber and derives geometry, colors, relief, and overlays from actual application data. The 2D mode is complete, not a loading placeholder. Labels, inspectors, legends, and accessible selection remain outside the 3D canvas. See [TRD](TRD.md) for budgets and fallback requirements.

Prepared Kenney GLBs and any later optional Spline/Three.js vignette are decorative only. No model, Spline scene, imported plant, or stylized satellite map may encode analytical values or imply live telemetry. Keep all core functions usable when decorations are removed.
