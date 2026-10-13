# Decision 0008: Keep the GRU as an evaluation artifact, not an operational forecast

**Status:** Accepted
**Date:** 2026-10-14
**Related:** [Phase 3 telemetry contract](../plans/phase-3-wsn-telemetry-service.md), [Decision 0007](0007-phase-3-telemetry-evidence-and-boundaries.md)

## Decision question considered autonomously

Does the trained GRU perform well enough to be presented as a useful forecast or used to support irrigation decisions?

## Evidence

The model was trained with chronological 70/15/15 splits, training-only scaling, and 352 held-out forecast windows per horizon. Its target is the Parma trial's source-reported soil-humidity `%RH` sensor signal; it is not VWC. Holdout MAE against a last-reading persistence baseline was:

| Horizon | GRU MAE (%RH) | Persistence MAE (%RH) | Result |
| --- | ---: | ---: | --- |
| +6 h | 0.378 | 0.083 | GRU is worse |
| +12 h | 1.265 | 0.140 | GRU is worse |
| +24 h | 0.980 | 0.204 | GRU is worse |

The exact MAE/RMSE/R², split boundaries, source-file hashes, sample counts, and per-line metrics are preserved in [`soil_signal_gru_metadata.json`](../../services/telemetry/models/soil_signal_gru_metadata.json).

## Choice

Retain the small trained model as a reproducible educational benchmark so the project can demonstrate temporal preprocessing, model training, holdout evaluation, and comparison to a baseline. Keep its API status `exploratory_only`, expose the measured baseline comparison, and clearly state that the current artifact does not beat persistence at any horizon. Do not call it an operational forecast, imply root-zone moisture, derive an irrigation recommendation from it, or hide the result by reporting training/validation scores instead.

The separately calibrated-VWC FAO-56 endpoint remains an independent human-review advisory. It does not consume this model's `%RH` output or control hardware.

## Consequences

- Phase 4 must display the persistence comparison and the evaluation-only limitation next to GRU values; the product should not turn them into action badges or watering triggers.
- A future replacement requires new representative data, an explicit target/measurement contract, chronological held-out testing, baseline comparisons, and a new decision record before any operational language.
- The current model's numerical predictions remain useful only as experimental outputs for inspection and evaluation, not as evidence of irrigation utility.
