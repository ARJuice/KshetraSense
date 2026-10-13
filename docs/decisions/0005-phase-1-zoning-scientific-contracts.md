# Decision 0005: Phase 1 zoning scientific contracts

**Status:** accepted
**Date:** 2026-10-14

## Context

Before implementing the five-phase redesign, three consequential questions were raised about the Phase 1 plan. The answers below preserve the intended screening and deployment features while preventing the software from presenting assumptions as validated agronomic or radio-engineering facts.

## Questions and decisions

**User confirmation (2026-10-14):** The user answered yes to all three questions below and explicitly confirmed use of SHI. The accepted decisions and boundaries are recorded here rather than duplicated in a new decision file.

### Q1 — Should the pipeline use SHI, and what does clustering consume?

**Decision:** Use the full standardized pH, EC, nitrogen, phosphorus, and potassium feature vector for Auto-K clustering. Calculate the weighted, nonlinear composite separately and retain the name **KshetraSense Soil Health Index (SHI)** because it is part of the requested product. Clearly label it as a project-defined, provisional screening score—not an official USDA/NRCS index, crop-specific suitability, or probability. Crop Fit remains a separate crop-specific assessment. The API uses pH (dimensionless), EC (dS/m), and N/P/K (mg/kg), while preserving sample depth and laboratory-method provenance when supplied.

**Reason:** Different soil profiles can produce a similar composite score. Clustering the full profile avoids losing those distinctions; keeping SHI separate preserves its intended explanatory use without giving it authority it has not earned.

### Q2 — How should zones merge and sensor locations be described?

**Decision:** Merge only adjacent clusters whose standardized multivariate profiles meet the documented similarity rule. Split disconnected components into separate management/deployment zones. Do not silently delete small components using an unspecified minimum-area rule. A zone medoid and field-constrained geometric-median gateway location are suggested planning coordinates only; they are not validated for radio coverage, terrain, power, access, or installation feasibility.

**Reason:** A single SHI difference can hide important nutrient or salinity differences. Spatially disconnected pieces should not imply that one sensor monitors both. A radio-optimal claim would require a radio/link-budget and field-obstacle model that is outside this phase.

### Q3 — How should stability validation perturb measurements?

**Decision:** Perturb the original sample measurements, then rerun interpolation and clustering at the selected K to estimate conditional zone stability. Report the ARI distribution and per-cell label-flip rates. Any default noise values are named assumptions unless supplied from the lab; do not assign a universal pass/fail grade or use the proposed 0.85 cutoff as a validated acceptance threshold.

**Reason:** Independent noise added to every interpolated cell does not represent uncertainty in the sparse source samples. Stability is conditional on the selected K and the stated noise model, so the report must expose those assumptions rather than imply general confidence.

## Consequences

- Phase 1 responses include both the continuous interpolated cell surfaces and final contiguous zone components, with provenance and diagnostics.
- Silhouette selects K on the standardized soil-feature vectors; FCM silhouette uses maximum-membership hard labels while preserving the fuzzy memberships separately.
- The SHI score is explanatory and does not feed Auto-K, crop fit, or WSN site feasibility.
- Google Earth Engine credentials and any other provider setup remain deferred to the phase that requires them.

## Autonomous implementation clarifications

No additional user questions were asked for these details; they were resolved from the accepted scientific/data-integrity constraints:

- Every sample must provide an explicit, nonblank depth interval, and all samples in one zoning run must use the same interval. A silent `0–15 cm` default could misstate the source data. Missing or mixed collection dates/laboratory methods are retained and warned about rather than silently treated as comparable.
- No unverified Parma, Punjab, or Bangalore “realistic farm” sample bundle is shipped. A future preset must have traceable boundary/sample provenance and compatible units/depth, or be clearly confined to test-only synthetic data.
- Phase 1 returns a versioned JSON response but does not persist a deployment artifact or hand off candidate nodes to a telemetry console that does not yet exist.
- FCM's membership update is vectorized without changing its deterministic reference output. A local 5,000-cell FCM run with two sensitivity reruns measured 7.6 seconds after this change; this is a development stress check, not a cross-device performance guarantee.
- Because the measured 5,000-cell run already takes several seconds, the synchronous API defaults to 10 sensitivity reruns while allowing 0–50. The UI should expose this count and describe 50 as a more detailed, potentially slower analysis; ten is a responsiveness default, not a statistical pass threshold.
