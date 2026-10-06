# Product requirements document

**Status:** pre-build. No application, trained model, real-farm validation, or performance result is claimed.

## Product statement

KshetraSense is a local, interactive applied-ML demonstrator for apple, tomato, and potato. A user edits a reproducible synthetic soil field, runs crop-neutral soil clustering, compares supported soil-to-crop compatibility factors, and submits a leaf image to one shared crop-condition classifier. Every result must make its input source and limitations clear.

The product is educational and exploratory. It is not a farm-control system or a substitute for agronomic advice.

## Users and outcomes

| User | Desired outcome |
| --- | --- |
| Student or demonstrator | Edit a field patch, run a real clustering method, and explain what changed. |
| Reviewer or teacher | Trace an output to its input, method, configuration, version, and evaluation evidence. |
| Curious non-specialist | Explore the examples while distinguishing synthetic values, model output, and sourced rules. |

## MVP scope

1. A fixed-seed synthetic grid with unit-labelled pH, soil temperature, EC, N/P/K, and optional moisture with measurement context.
2. Cell and zone inspection; localized edits; previewed deterministic presets; undo/redo; and visible stale-result state after edits.
3. Crop-neutral K-means and Fuzzy C-means (FCM) zoning on valid, standardized soil features. Show zone summaries, adjacency, and FCM membership strengths where applicable.
4. A separate apple/tomato/potato pre-plant soil-compatibility view using versioned, sourced rules and supported measurements. Assess each crop independently; this is not a three-way probability split.
5. One shared, 17-label crop-condition image classifier using the fixed MobileNetV3-Small architecture, transfer-learned from ImageNet. Evaluate it on the audited, group-preserving split; model selection does not include alternative-backbone comparison.
6. Evidence and methodology information, with actual metrics only after they have been measured.
7. A functional Three.js / React Three Fiber field on capable devices, paired with a complete 2D workflow.

## Out of scope

- Real-time sensors, pumps, irrigation controls or replay, temporal moisture forecasting, or automatic actuation.
- A trained soil-to-crop recommender, yield prediction, planting certification, fertilizer quantities, deficiency diagnosis, or treatment/cure advice.
- A crop-cultivation probability or a normalized apple/tomato/potato percentage split in the MVP. The synthetic field has no crop outcome labels, and the current soil features are insufficient for full land-suitability assessment.
- Interpreting cluster IDs as crop identity, soil quality, or a prescription.
- Any required paid asset, hosted API, icon, font, model, or runtime.

A weather-driven soil-water-balance simulator is a possible later rules module. It requires sourced crop-stage parameters, explicit assumptions, deterministic tests, and a separate scope decision before any implementation.

## Product requirements

| ID | Requirement |
| --- | --- |
| PR-01 | A named scenario and seed reproduce the same initial grid. |
| PR-02 | Cell and zone inspectors show values, units, source, and applicable measurement context. Missing values remain missing. |
| PR-03 | Edits and presets are reversible and identify affected cells; each edit marks existing zoning results stale. |
| PR-04 | A zoning run records its method, parameters, seed, feature schema, exclusions, version, timing, diagnostics, and result. |
| PR-05 | K-means and FCM outputs are described correctly; FCM membership is never called model confidence. |
| PR-06 | Crop compatibility is independently computed for each crop with reasons, sources, units, version, and missing-data states. It cannot alter cluster assignments. |
| PR-07 | Leaf inference uses image pixels only. Selected crop, soil values, zone, and SHI are UI context and never model inputs. |
| PR-08 | Each result is labeled as synthetic/user input, model output, or rules output. |
| PR-09 | Selection, editing, zoning, inspection, and crop comparison remain usable without WebGL. |
| PR-10 | Unmeasured metrics are shown as “Not measured yet”; no placeholder score is presented as a result. |
| PR-11 | Crop-fit output is per-crop and never presented as a probability or forced to sum to 100%. Every displayed percentage states its metric and denominator; FCM membership remains cluster membership, not crop potential. |

## ML, data, and domain boundaries

### Leaf classification

- The target label map contains 17 PlantVillage crop-condition classes: four apple, ten tomato, and three potato classes. Audit actual files, spellings, counts, and class balance before fixing the map.
- Intended labels are Apple: scab, black rot, cedar apple rust, healthy; Tomato: bacterial spot, early blight, late blight, leaf mold, Septoria leaf spot, spider mites, target spot, yellow leaf curl virus, mosaic virus, healthy; Potato: early blight, late blight, healthy. Confirm each exact folder/manifest spelling during the audit.
- Use one RGB image resized to 224 × 224 with MobileNetV3-Small preprocessing. Soil values, zone, SHI, and selected-crop context are excluded from the inference input.
- Keep physical-leaf groups disjoint across train, validation, and test partitions using the dataset's `leaf_id` metadata; prefer its documented split if it fits the experiment.
- Train/select on PlantVillage. Treat PlantDoc as an exploratory cross-dataset check only; audit labels first and include only exact supported class matches. Report supported-class coverage separately.
- This is single-label classification. It does not establish disease severity, simultaneous diseases, or reliable performance on field photos. Scores are not calibrated probabilities unless calibration is evaluated.
- Save no uploaded image by default. A review threshold, if used, is chosen on validation data and reported with coverage and errors.

### Soil zoning

- Use pH, soil temperature, EC, N, P, K, and optional comparable moisture. Record moisture unit, depth, method, and timestamp; exclude stale or incomparable readings and show the reason.
- Coordinates locate cells and define adjacency; raw latitude/longitude are not soil features for Euclidean clustering. For real data, use a suitable local metric projection for spatial operations.
- Before a later real-field run, require cleaned georeferenced samples and a field boundary, map samples to cells, and choose cell size from sample spacing and intended use. Validate IDW or any alternative interpolation against held-out samples and label interpolated values as estimates.
- Synthetic grids must be fixed-seed and spatially coherent, not independently randomized cell by cell. Keep a separate synthetic benchmark with known planted regions.
- Evaluate cluster count using multiple diagnostics: synthetic recovery (such as adjusted Rand index), silhouette, seed/noise stability, contiguity, and minimum useful zone size. Silhouette alone does not select an agronomically useful result.
- Perturb inputs using documented measurement uncertainty when evaluating stability. Compare runs with a label-invariant score, and report a same-benchmark moisture ablation.
- Implement FCM with its own fuzzy objective and preserve the membership matrix. If zones are merged, merge only adjacent regions with an explicit multivariate distance rule and report that post-processing.
- A static moisture snapshot is not a water-balance state and is not a crop-fit factor by default. An SHI is included only after its formula and source are documented and double-counting is checked.

### Crop compatibility

- Keep clustering crop-neutral. Calculate compatibility or suitability independently per cell and crop from a versioned profile, then summarize within each zone with variation and data sufficiency visible. Cluster IDs and FCM memberships never identify crops.
- Define the land-use/production context before publishing a profile: target geography, crop and (where relevant) cultivar/rootstock, season or crop stage, rainfed/irrigated production system, input/management level, soil-test method/depth, and units. Numeric limits, interactions, sources, rule version, and boundary/missing-input behavior must be documented. Do not invent thresholds or weights from qualitative nutrient-demand statements.
- A full suitability assessment may require climate and growing-period data, water availability over the season, radiation, soil texture and effective depth, drainage/aeration, salinity, slope/topography, flooding, and other crop-specific constraints. The current synthetic feature set (pH, soil temperature, EC, N/P/K, optional spot moisture) is only a partial soil-factor demonstration. FAO's crop/land framework evaluates each crop under a defined production system against climate, soil, and landform conditions ([method](https://www.fao.org/4/W2962E/w2962e-04.htm)).
- Without supported inputs and sourced numeric criteria, show measured factors and “Not assessed”; do not fabricate a composite. Calcium and micronutrients not present in the input remain unmeasured. If a sourced factor aggregation is later approved, call it a compatibility index or suitability class—not a cultivation probability—and disclose its factors and assumptions.
- Do not force the three crop values to total 100%. Multiple crops may each be suitable, or none; independent crop-success events are not mutually exclusive. A future probability requires a defined outcome and horizon, representative field-by-crop-by-season outcome data, independent validation, calibration evidence, uncertainty, and a separate scope decision. If a percentage is used under a validated land-evaluation model, name its denominator (for example, per-crop modeled yield relative to that crop's attainable maximum); that is not a probability or a share among crops. See the [crop-suitability research note](research/crop-suitability-probability.md).
- Call current output a limited soil-to-crop compatibility estimate. Do not call it a recommendation, yield prediction, planting certificate, fertilizer plan, or success guarantee.

## Evaluation and success measures

The project is ready for a presentation when a reviewer can reproduce the scenario and each reported metric, compare model baselines, and identify whether displayed evidence is synthetic, user-provided, model-derived, or rule-derived.

- **Vision:** macro-F1, balanced accuracy, per-class precision/recall, confusion matrix, crop-level accuracy, class counts, artifact size, and warmed batch-one CPU median/p95 latency. Report PlantVillage test and eligible PlantDoc results separately.
- **Zoning:** recovery on planted synthetic regions, silhouette, stability across seeds/noise, contiguity, and moisture ablation on the same benchmark.
- **Rules:** tests for every published source/range/unit, boundary, missing value, and independence from zone labels. This verifies rule behavior, not crop-yield accuracy.
- **Rendering:** capture frame timing, draw calls, triangles, texture memory, transfer bytes, and load time on named desktop/mobile devices before claiming performance.

## Open product decisions

- Final audited class map, split, model checkpoint, and review threshold.
- Target geography/production context and supported crop-profile parameters; whether a sourced suitability class or index is justified. Any calibrated crop-success probability is future scope and requires outcome data and a separate decision.
- Initial synthetic value ranges, maximum supported grid, cluster-count range, and moisture-context validity rule.
- Named performance reference devices and whether a free-tier Spline vignette is worth including.

## References

- [PlantVillage dataset](https://github.com/spMohanty/PlantVillage-Dataset) and [dataset metadata/split documentation](https://github.com/spMohanty/PlantVillage-Dataset/blob/master/README_HF.md)
- [PlantDoc paper](https://arxiv.org/abs/1911.10317)
- [MobileNetV3 paper](https://arxiv.org/abs/1905.02244) and [Keras Applications](https://keras.io/api/applications/)
- [scikit-fuzzy FCM API](https://scikit-fuzzy.github.io/scikit-fuzzy/api/index.html)
- [FAO land evaluation framework](https://www.fao.org/4/T0715E/t0715e06.htm), [FAO crop and land suitability assessment](https://www.fao.org/4/i2713e/i2713e.pdf), and [crop-suitability research note](research/crop-suitability-probability.md)
- Later water-balance research only: [FAO-56 crop evapotranspiration](https://www.fao.org/4/X0490E/x0490e0b.htm) and [Open-Meteo historical weather API](https://open-meteo.com/en/docs/historical-weather-api)
