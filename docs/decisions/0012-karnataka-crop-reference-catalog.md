# Decision 0012: Karnataka-relevant Crop Fit reference catalog

**Status:** Accepted  
**Date:** 2026-10-14

## Context

Crop Fit is a factor-by-factor soil reference report, not a crop classifier. The prior Apple/Tomato/Potato screen used invented EC and N/P/K bands in the UI, while Apple often appeared favorable from pH alone. The ten paired soil demos are method-unspecified synthetic scenarios near Bengaluru; they span acidic, near-neutral, and alkaline pH plus low/high N/P/K and EC patterns. Leaf Diagnosis has a separate PlantVillage Apple/Tomato/Potato label set.

The project needs a locally relevant three-crop reference catalog, but its measurements do not support full crop suitability, a verdict, or a percentage recommendation.

## Decision

1. Use **Finger Millet (Ragi), Tomato, and Groundnut** in the Soil Zoning Crop Fit report. ICAR lists finger millet and groundnut among Karnataka's important crops; UAS Bengaluru describes ragi, groundnut, pulses, fruits, and vegetables across its regional zones and documents groundnut/ragi research at Chintamani. UAS Bengaluru research also documents intensive tomato cultivation in the Eastern Dry Zone. This is a representative demonstration set, not an exhaustive crop list or field recommendation. See the [cited research note](../research/crop-fit-crop-selection.md).
2. Keep Leaf Diagnosis's Apple/Tomato/Potato class labels unchanged and independent. Soil-report crop selection does not change the future image model label map.
3. Return and display a published pH context per crop, with its source and caveats:
   - Finger Millet (Ragi): pH **4.5–8.0**, a broad, method-unspecified range reported in NIFTEM-T's technical report; do not narrow it to force out-of-range labels.
   - Tomato: pH **6.5–7.5** in TNAU guidance for well-drained loamy soil rich in organic matter; it is not calibrated to this sample method or Karnataka fields.
   - Groundnut: pH **5.3–6.6** in TNAU's crop-group soil-acidity table; test method and local cultivar calibration are unspecified.
4. Describe the pH state only as a comparison with that crop's cited pH interval. **No overall crop-level fit/suitability state, recommendation, ranking, composite, or probability is returned.** The reference intervals overlap; some demo zone means may fall inside all three pH contexts. That is not evidence that all three crops are suitable for the zone.
5. Show Tomato and Groundnut FAO salinity figures only as root-zone saturated-paste ECe context; do not compare the demo's generic EC to them. The FAO crop table has no finger-millet-specific ECe threshold. Do not substitute another millet's threshold.
6. Keep N/P/K values visible but unclassified. The CSVs identify only mg/kg and explicitly say the synthetic soil-test method is unspecified; analyte/extractant, regional calibration, crop system, and sampling context are missing. Do not use fertilizer application rates or tissue values as soil-test sufficiency bands. Moisture and soil temperature remain unmeasured in this field-zoning workflow.
7. Keep the ten input pairs explicitly synthetic and method-unspecified. For demo clarity, apply a uniform **-0.10 pH-only offset** to every sample in `balanced-reference`, `high-nutrient-mixed-ec`, and `mixed-nutrient-field`. This breaks the accidental all-three-pH-interval overlap in the corresponding zone means without altering field patterns, sample positions, EC, N/P/K, dates, or uncertainty. Because clustering z-scores each feature within each field, a uniform within-field pH translation preserves normalized profiles and cluster/zone assignments; the pH-based project SHI changes slightly and remains provisional. This is a display/test-data adjustment, not agronomic calibration or evidence of crop performance. Do not modify EC/N/P/K to simulate crop-specific low/high states without comparable test methods and validated regional interpretations.
8. Version the server profile catalog as `2026.10-crop-reference-report-v3`; the UI must render the returned profiles, factors, references, and source notes rather than maintain a second set of benchmark ranges.

## Questions considered and autonomous resolutions

| Question | Resolution |
|---|---|
| Which three crops best match the current Bengaluru-adjacent demos? | Finger Millet (Ragi), Tomato, Groundnut: they cover Karnataka dryland/oilseed and Eastern Dry Zone vegetable contexts better than Apple. |
| Should the synthetic measurements be adjusted to make zone reports distinguish the pH references? | Yes, narrowly: apply -0.10 pH uniformly to each sample in three explicitly synthetic scenarios. This removes the all-three overlap from their zone means while preserving z-score clustering assignments; it does not turn a pH comparison into suitability. Individual cells may still fall in the shared interval. |
| Can current EC and N/P/K values produce crop-specific normal/low/high states? | No. EC extraction/root-zone context and N/P/K soil-test methods are unspecified, so any numeric crop band would be unsupported. |
| Should the Leaf Diagnosis crops follow the Soil Zoning catalog? | No. Its image labels are a distinct model contract and remain Apple/Tomato/Potato. |

## Consequences and limitations

- Crop Fit shows measured/estimated pH, EC, N, P, and K values side by side with source-backed context. Only pH receives an inside/below/above interval comparison; every status is neutral and explicitly not a planting decision.
- Tomato's pH range is source-specific to a stated soil context, Ragi's is broad, and Groundnut's is a crop-group range. None is a Karnataka-calibrated decision threshold.
- Demo profiles are synthetic, not laboratory values or real cadastral farms. Their small pH-only display offset changes provisional SHI values but does not change standardized zone assignments; the bundles cannot validate crop response or real-world zoning accuracy.
- Detailed source descriptions, source links, and measurement comparability caveats are in [crop-fit-crop-selection.md](../research/crop-fit-crop-selection.md). The older [soil-reference-intervals.md](../research/soil-reference-intervals.md) remains historical for the former crop catalog.

