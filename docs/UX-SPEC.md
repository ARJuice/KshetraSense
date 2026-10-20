# UX specification

**Status:** Production UX specification for the KshetraSense decision-support application. Soil Zoning is implemented as the boundary and sparse-sample workflow defined in [Phase 2](plans/phase-2-soil-zoning-ui-redesign.md) using `/v2/zoning/run`. Field Monitoring is implemented as the three independent views in [Phase 4](plans/phase-4-field-monitoring-transformation.md). Leaf Diagnosis is implemented as the image-only MobileNetV3-Small workflow in [Phase 5](plans/phase-5-leaf-contract-and-verification.md). Product scope is in [PRD](PRD.md) and technical architecture is in [TRD](TRD.md).

The experience is built directly from real user workflows and explicit scientific boundaries. There is no presentation-only mock phase, no canned result, and no fake algorithm progress. Synthetic fixtures are available strictly for automated tests and clearly labeled demonstration datasets.

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
| Crop Fit | A contextual panel within Field Lab for three separate factor-by-factor crop reference reports. It is not a new global destination and does not make cultivation decisions. |
| Leaf Diagnosis | Submit a leaf image to the shared MobileNetV3-Small classifier and inspect its actual result. |
| Field Monitoring | Separate workspace with Soil Investigation, historical telemetry replay, and independent Vegetation Monitoring. |
| Evidence & Methods | Explain datasets, algorithms, provenance, actual evaluation, and limitations. |

Keep one clear global status for the active field/project and data source where relevant. Do not use a global agronomic score or collapse module outputs into one “farm health” indicator.

## First-use journey

The first screen should briefly explain the available jobs, then let the user choose one. If required data/credentials are absent, offer the module's valid input route and explain what is needed; do not fill the page with invented outputs. A development benchmark may be available to developers but must be visibly labeled as synthetic and must not stand in for user data.

## Module journeys

### Soil Zoning — Field Lab

1. **Boundary & Sample Input**: Provide a field polygon (WGS84 GeoJSON) and 3–50 georeferenced laboratory soil samples (pH, EC, N, P, K at a common depth). Samples can be entered manually or imported via CSV. Ten explicitly labeled demo datasets are provided for exploration.
2. **Analysis Parameters**: Configure grid resolution (e.g. 10 m), IDW power ($p=2$), and clustering algorithm (K-means++ or Fuzzy C-means with Auto-K silhouette sweep up to $K=6$).
3. **Live Execution**: The backend (`POST /v2/zoning/run`) converts GeoJSON to local UTM, clips cells to boundary, runs IDW spatial interpolation, computes the KshetraSense Soil Health Index (SHI), identifies optimal $K$ via silhouette maximization, merges adjacent clusters within variance tolerances, splits disjoint spatial components, and evaluates stability via sample perturbation ARI.
4. **Inspection & Layer Visualization**: Inspect the returned 2D field map or toggle the optional React Three Fiber 3D terrain. Switch between returned analytical layers: Management Zones, KshetraSense SHI, pH, Electrical Conductivity, Nitrogen, Phosphorus, Potassium, and FCM Membership probabilities.
5. **WSN Candidate Suggestions**: Review suggested wireless sensor node (WSN) medoids and gateway placement coordinates (labeled as geometric suggestions, radio-unvalidated). Export full JSON response for audit.

Zone identity uses labels/patterns as well as color. A map shows cluster similarity, not “good/bad soil,” a crop recommendation, or a treatment prescription. Cell height is a bounded visual encoding of a selected feature, not geospatial elevation.

### Crop Fit

Crop Fit is a selected-scope reference report inside the Field Lab, not a crop decision. For a cell, show its returned IDW estimates; for a zone, show the already-calculated area-weighted means of IDW cell estimates. Show the same observed pH, EC, N, P, and K values for Finger Millet (Ragi), Tomato, and Groundnut with columns for factor, cell/zone value, published interval/context, and a neutral report note. This is the current region-relevant report catalog; Leaf Diagnosis independently retains Apple/Tomato/Potato image labels. pH may be described as numerically inside/below/above its cited pH context only; do not turn that single-factor comparison into a crop verdict. Show EC's published ECe context without comparing an unverified generic EC value to it. For N/P/K, show the value and explain when method-/region-specific interpretation is required instead of inventing portable bands. Moisture and soil temperature say **Not measured in this workflow**. Show reference sources and contexts, and keep a clear statement that the user makes the cultivation decision. Do not rank crops, use green/red suitability badges, or normalize values into probabilities. Three method-unspecified synthetic bundles have a documented uniform -0.10 pH demonstration offset so no zone mean places all three cited pH intervals inside simultaneously; the within-field z-score clustering assignments are unchanged, though pH-based SHI values shift slightly. EC/NPK patterns remain visible without unsupported crop-status labels. Individual cell estimates may still fall in the intervals' overlap.

### Leaf Diagnosis

1. Choose one supported local image format and display the privacy/size guidance before inference.
2. Submit the image and show progress only as supported by the actual request; a new request does not retain a result for a different image as if it were current.
3. Show all 17 ranked supported classes, the top label, model/preprocessing versions, measured server processing time, and the mandatory manual-review notice. State that there is no out-of-domain detector, so images outside the trained labels can still receive a ranked class.
4. Selected crop or zone may be shown as context only; it cannot change model input or scores. Never show a fabricated saliency map, diagnosis, cure, or confidence percentage.

### Field Monitoring

Field Monitoring has three separate views; use the detailed current design in [Phase 4](plans/phase-4-field-monitoring-transformation.md). Do not display SoilGrids as a sample or present NDVI as a soil measurement.

#### Soil Investigation

The user creates an investigation and enters a dated sample or imports a validated CSV. Each record shows location, collection date/time, sampling depth, method/source, measured parameter, original value/unit, and optional notes. If repeat readings are not comparable (for example, different depths or methods), show them as separate observations rather than a misleading trend.

An optional SoilGrids panel queries ISRIC's public WCS for a location, supported property, and depth layer. It shows the median model estimate plus Q0.05/Q0.95 quantiles, nominal 250 m product resolution, property/depth, retrieval/source provenance, and the label **Regional modeled context — not a field sample**. Keep it visually and semantically distinct from user-measured samples. It does not feed Soil Zoning or Crop Fit automatically. Masked/no-data locations and WCS outages show no estimate and an explicit error; never replace them with a coordinate formula or stale result. New investigations start empty; legacy synthetic demo rows are archived and excluded from sample summaries/trends.

Useful outputs are a sample register, sample-location map, parameter history where comparable repeat observations exist, missing-context cues, and the separate broad SoilGrids context panel. The initial experience is manual/imported investigations; it does not imply a live sensor network.

#### Historical Telemetry Replay

Show a persistent attribution/time-period/not-live badge for the Parma 2023 trial. Preserve its 100%/60%/30% treatment labels, raw source timestamps, units, and missing values. Soil humidity is `%RH` sensor signal, not VWC. Display the GRU only as an experimental comparison, alongside holdout-versus-persistence metrics; the current model loses to persistence at all horizons. Isolation Forest produces review candidates, not faults. No KshetraSense zone, live gateway, irrigation action, valve, or flow is implied. The separate calibrated-VWC FAO-56 endpoint remains API-only; it is not surfaced from this `%RH` replay UI.

#### Vegetation Monitoring — CropSight

Vegetation Monitoring runs the pinned CropSight application as an independent local sub-application. It uses its own area and date state and is not coupled to KshetraSense Soil Zoning, Crop Fit, Leaf Diagnosis, or cadastral geometry.

Inputs are the center latitude/longitude, circular radius, date window, any supported clustering configuration, and optional crop/stage context used only by the app. Live retrieval requires a correctly configured Google Earth Engine project/account and available quota. Optional rainfall/CHIRPS information must have its own source label and availability state.

Show only data that the CropSight API actually returns: aggregate NDVI statistics, its per-scene mean-NDVI time series, optional rainfall context, source/provider, selected AOI/date window, and upstream heuristic text clearly marked unvalidated. The current response does not include an NDVI raster, pixel labels, zone polygons, or per-zone statistics; do not draw a substitute map or claim patch-level coordinates even when the request includes a K-means cluster count. Do not silently relabel a circle as a cadastral parcel. If the service, Earth Engine authorization/quota, or usable imagery is unavailable, explain the specific limitation and do not substitute a prepared result.

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
| SoilGrids no-data/provider error | Explain that the selected cell is masked or the public WCS is unavailable; do not show a substitute estimate. |
| Legacy soil demo records | Archive seed-preset provenance; if storage migration fails, retain a visible synthetic/not-a-measurement label and exclude the records from summaries/trends. |
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

The 3D field is completely procedural data geometry. No external 3D model files, decorative packs, or proprietary Spline assets are bundled. All core functions remain fully accessible in 2D and 3D without external asset downloads.
