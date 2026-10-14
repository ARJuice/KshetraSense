# Decision 0011: Factor-by-factor crop reference report and automatic K

**Status:** Accepted
**Date:** 2026-10-14

## Context

The previous Crop Fit screen returned a crop-level state after comparing pH, even though its other soil factors were not evaluated. This made Apple appear “suitable” in many zones because its cited pH interval was broad, not because the app had established that the zone could support an orchard. The selected v2 cell/zone profile already includes pH, EC, nitrogen, phosphorus, and potassium. Zone summaries already contain the field service's area-weighted means of the IDW-estimated cell values.

The user asked the report to expose those values beside crop reference context, avoid deciding or claiming that a crop is fit, add at least ten usable GeoJSON/CSV demonstrations with dates and complete inputs, and clarify why a cluster-count control appeared when Auto-K was expected.

## Decision

1. Keep Crop Fit inside Soil Zoning, but make it a **factor-by-factor reference report**, not a crop classifier or planting decision.
2. For each selected cell or zone, show the observed pH, EC, N, P, and K value for Apple, Tomato, and Potato. A cell value is an IDW estimate. A zone value is the field service's area-weighted mean of IDW-estimated cell values, not another laboratory measurement.
3. Compare pH numerically with the cited pH interval only. Phrase the state as a numeric relation to that interval, not a whole-crop status. Make all state badges visually neutral.
4. Show published EC salinity context, but do not compare the generic field EC value with a threshold: FAO references use root-zone mean ECe from a saturated-paste extract, while the current field input does not verify that method or sampling context.
5. Keep N/P/K visible but do not invent universal numeric bands. The field schema only says mg/kg; it does not identify nutrient analyte, extractant, regional calibration, or crop-specific production context. Moisture and soil temperature are not field-zoning inputs and remain “Not measured in this workflow.”
6. Do not return a crop-level assessment state, rank crops, provide a recommendation, calculate a composite, or describe an output as “fit,” “suitable,” or a probability. The report note describes the measurement/reference relationship and limitations; the user makes the cultivation decision.
7. Auto-K selects the final K from the valid silhouette sweep. The current UI fixes the search ceiling at 6, tests valid candidates from K=2 through K=6, and shows the selected K and sweep in diagnostics. The API retains `maxK` as a search-ceiling parameter for other callers; it is not the selected cluster count.
8. Include ten paired synthetic GeoJSON boundary and soil-sample CSV bundles for deliberate demonstrations and parser tests. Every pair is clearly marked synthetic and has complete required values, common depth, collection date, method disclaimer, and illustrative uncertainty. These files are not farm, cadastral, or laboratory records.

## Questions considered and autonomous resolutions

| Question considered | Resolution |
| --- | --- |
| Should the app declare a crop fit based on one or several incomplete soil factors? | No. Remove crop-level verdicts; retain factor-level evidence only. |
| Should a numeric normal/good range be filled in for every displayed factor? | No. Show a source-backed range only where the unit/method/scope support it; otherwise show why comparison needs more context. Fabricated or non-comparable ranges are worse than an explicit gap. |
| Is a zone mean already computed, or should Crop Fit calculate a new average? | Use `meanSoilValues` already returned by the field API. It is an area-weighted average of interpolated cell values; do not average the raw samples or recalculate it in the UI. |
| Is K a manual choice? | No in the current workflow. Auto-K selects it; the UI's fixed ceiling of 6 is only the upper candidate bound. |
| Should the ten demo bundles be presented as realistic farms? | No. They are explicitly synthetic and intended to exercise uploads, interpolation, varying measurements, Crop Fit rows, and dates—not to substantiate agronomic conclusions. |

## Consequences and limitations

- Apple no longer receives a positive crop-level label simply because a zone pH lies in one cited interval.
- A pH interval is still a contextual numeric comparison; source region, sample depth, and method may not match the user's field.
- FAO EC figures are salinity/yield-response references, not target ranges. They are displayed but not applied to generic EC.
- N/P/K, moisture, temperature, drainage, texture, climate, rooting depth, cultivar, crop stage, and management do not support a complete land-evaluation conclusion here.
- Synthetic examples can validate the upload and computation path but cannot validate real-field performance.
- Silhouette Auto-K is an internal clustering diagnostic; it does not validate agronomic usefulness or guarantee a meaningful number of management zones.

## Evidence

- Source comparison and method limits: [Soil reference interval research](../research/soil-reference-intervals.md).
- Implementation contract: [TRD Crop compatibility](../TRD.md#crop-compatibility) and [Phase 2 Crop Fit](../plans/phase-2-soil-zoning-ui-redesign.md#237-cellzone-scoped-crop-fit).
- Synthetic upload files: [`data/demo/soil-zoning`](../../data/demo/soil-zoning/README.md).
