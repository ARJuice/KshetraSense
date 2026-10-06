> **Superseded planning archive — not the current source of truth.** Use [PRD](PRD.md), [UX specification](UX-SPEC.md), [TRD](TRD.md), and [Delivery plan](DELIVERY.md) for current requirements. The first visual demo is defined in [Decision 0002](decisions/0002-mock-data-demo-first.md). This older plan predates the desktop 2.5D preset-and-brush demo and contains superseded slider/phase-order wording.

\# KshetraSense — Project and ML Plan



\*\*Status:\*\* architecture plan only; the application and model results have not been built or measured yet. Scope updated on 2026-10-05: the active MVP excludes temporal moisture forecasting and irrigation/pump simulation. A static moisture reading remains an optional, time-stamped soil-zoning feature and may be shown as context; it is not a crop-suitability rule input by default.



\## 1. Project in one paragraph



KshetraSense is a local, interactive smart-farming ML demonstrator for apple, tomato, and potato. A user edits soil readings on a synthetic field, inspects crop-neutral zones and a separate crop-compatibility overlay, then uploads a leaf image for a shared crop-and-condition classifier. The MVP has two ML tasks—supervised multi-class image classification and unsupervised soil clustering—plus a transparent, non-ML crop-compatibility rules layer. A static moisture snapshot can be used in zoning only when its measurement context is comparable; temporal forecasting and pump control are not part of this demonstrator. It is not connected to real sensors or pumps, and synthetic zoning or rule-based compatibility is not evidence of agronomic performance on a real farm.



\## 2. What the user can do



1\. Open a field map and select a soil zone or cell.

2\. Edit a patch of soil readings—such as moisture, pH, EC, or N/P/K—or select a reproducible preset such as “low nitrogen patch.”

3\. Run K-means or Fuzzy C-means and inspect the updated map, cluster summaries, and fuzzy membership strengths. Clusters are based only on soil similarity.

4\. Inspect a separate, explainable soil-to-crop compatibility overlay for apple, tomato, and potato in each zone, including the measured factors that support or limit each profile and any missing measurements.

5\. Upload a leaf image. One shared classifier returns scores across its supported apple, tomato, and potato crop-condition classes; the app shows an uncertain/review state and warns if the predicted crop conflicts with the crop selected from the zone.

The interface labels each result as \*\*user-provided soil data\*\*, \*\*uploaded image\*\*, \*\*synthetic field\*\*, \*\*model output\*\*, or \*\*rule-based compatibility estimate\*\*. It contains no animated or simulated pump behavior.



\## 3. ML tasks and input/output mapping



| Module | Method/model | Model inputs | Training/fit target | Output shown to user |

| --- | --- | --- | --- | --- |

| Three-crop leaf diagnosis | **One shared MobileNetV3-Small 17-class classifier**, transfer-learned from ImageNet, is the fixed MVP application model. Do not compare alternative backbones for model selection or build three separate crop models for the MVP. | One RGB leaf image, resized to 224×224 and preprocessed exactly as required by MobileNetV3-Small. Soil values, zone ID, and selected-crop context are not classifier inputs. | Supervised crop-condition labels from PlantVillage: 4 apple, 10 tomato, and 3 potato classes. Keep physical-leaf groups disjoint across splits. | 17 class scores, top crop-condition class, optional review/uncertain result, selected-crop mismatch warning, model version, inference time. Scores are not called calibrated probabilities unless calibration is tested. |

| Soil zoning | \*\*K-means\*\* and \*\*Fuzzy C-means\*\* as two unsupervised methods. | One soil-feature vector per grid cell: pH, context-qualified moisture, soil temperature, EC, N, P, and K. Exclude moisture from a real-data run if measurement unit/depth/method/timing are not comparable; standardize fitted features. Use a Phase 0 SHI only if its definition and source are available; test whether including it double-counts its component measurements. Coordinates locate cells on the map but are not silently treated as soil measurements. | No class labels. Fit clusters to the current grid after a user edits it. K-means requires a chosen cluster count; Fuzzy C-means returns membership strengths for the chosen count. | Colored cell-to-cluster map, zone polygons/summaries, cluster centers, adjacency graph, and— for Fuzzy C-means—membership strengths. Explain that clusters mean similar input profiles, not “good/bad soil” or a fertilizer prescription. |

| Crop compatibility overlay | \*\*Transparent, source-backed rules; not a trained crop recommender.\*\* Compute independently after zoning for apple, tomato, and potato. The MVP is pre-plant soil compatibility, not stage-specific fertilizer advice. | Per-cell/zone soil measurements and a versioned crop-profile table with units, geography, production assumptions, applicable crop/stage, source, and explicit rule parameters. A single spot moisture reading is contextual only; do not score it as crop suitability unless a sourced rule defines a comparable measurement protocol and interpretation. Missing fields remain missing rather than being guessed. | No training labels. The rules compare measured soil attributes with documented pre-plant crop-relevant ranges/conditions. The qualitative nutrient-demand table is a factor checklist, not a supervised dataset or a source of numeric thresholds. | Per-crop factor-by-factor compatibility, reasons, data sufficiency/missing-field flags, and zone summary distribution. Any sourced aggregate must be called an index or suitability class, identify its assumptions and denominator, and remain independent per crop; never force the three crop values to sum to 100% or call them cultivation probabilities. Clearly label outputs as limited soil-profile comparisons—not recommendations, yield predictions, planting certification, fertilizer dosing, or a guarantee of crop success. |



\### Specific model boundaries



\- The shared leaf classifier uses pixels and crop-condition labels only. It must not use zone, SHI, nutrients, or selected-crop context to influence its image prediction; selected crop is used only for a UI mismatch warning.

\- The 17-way PlantVillage task is single-label classification. It does not establish disease severity or reliably represent multiple simultaneous conditions; do not display a severity estimate or multi-disease diagnosis.

\- K-means and Fuzzy C-means are real unsupervised ML methods, but they are not supervised classifiers and do not have disease-style labels. The interactive grid is generated data until georeferenced field samples are collected.

\- Crop compatibility is a separately computed rules output, not an ML prediction. Show it only when its profile ranges, units, and formula are sourced and documented; otherwise show “insufficient data” and raw measurements. It is not a yield forecast, planting certificate, deficiency diagnosis, fertilizer amount, or disease treatment. An SHI or any additional agronomic claim also needs its own explicit, sourced definition.



\### Scope decisions and rationale



\- \*\*Use one shared 17-class vision model for the MVP.\*\* PlantVillage labels already pair crop and condition, so one model can predict both and support a crop-mismatch warning with one training/evaluation/deployment pipeline. Separate per-crop models could specialize, but would require three checkpoints and would not independently identify a crop mismatch. Compare crop-level and per-class recall; reconsider specialist models later only if measured shared-model weaknesses justify the extra complexity.

\- \*\*Use a transparent crop-compatibility rules overlay, not a trained crop recommender.\*\* The supplied nutrient table describes relative needs, not labeled soil-to-crop outcomes. A defensible learned recommender would need representative soil measurements paired with crop, location, stage, management, and outcomes across enough fields/seasons. Until such data exists, sourced pre-plant profiles are more honest and explainable, and may show “not assessed” where inputs or evidence are missing.

\- \*\*Remove temporal moisture forecasting and pump replay from the MVP.\*\* The cited series may support a standalone forecasting study, but it has no documented spatial/crop mapping into our synthetic zones and its raw units, gaps, and event schema remain unaudited. That would create a disconnected third ML task. Historical event replay cannot validate pump effects without measuring or modeling how an intervention changes later moisture; random pump animation is not a substitute. Keep a static moisture snapshot only as a zoning feature when its measurement context is comparable; do not use it as a crop-suitability factor by default. Reconsider forecasting only if a zone-linked dataset and a clear, validated decision use become available. This was historical planning context and is not a current demo requirement.



\## 4. Data plan



\### Leaf images



\- Use the three relevant crop families in \[PlantVillage](https://github.com/spMohanty/PlantVillage-Dataset): apple (scab, black rot, cedar apple rust, healthy), tomato (bacterial spot, early blight, late blight, leaf mold, Septoria leaf spot, spider mites, target spot, tomato yellow leaf curl virus, tomato mosaic virus, healthy), and potato (early blight, late blight, healthy)—17 crop-condition labels total. Audit actual files, class counts, label spellings, and class balance before fixing the app’s label map. The dataset repository’s metadata includes `leaf\_id` and documents a group-preserving split; prefer its official split, or make any custom train/validation/test split by `leaf\_id` so views of one physical leaf never cross partitions.

\- Train and select on PlantVillage. Use only exact crop-condition matches from \[PlantDoc](https://arxiv.org/abs/1911.10317) as a separately reported, exploratory cross-dataset check for any of the three crops. Audit its labels first; do not force unmatched diseases into one of the 17 classes.

\- PlantVillage’s controlled images are not a guarantee of field performance. The upload UI should say when an image is outside the tested classes or conditions.



\### Soil-zoning grids



\- Generate a deterministic 2D grid with coherent spatial patches/gradients and plausible, unit-labelled soil fields. Avoid independent random values per cell, which create meaningless salt-and-pepper maps.

\- The interactive editor changes a selected region or applies a named preset; it does not silently generate new random values on each run. Moisture is a \*\*snapshot feature\*\*, not a water-balance state: label its unit, sensor depth, and reading time; for any real-data run, compare only readings collected with compatible methods/depths and sufficiently similar conditions, and exclude stale or incomparable values. Synthetic moisture values are reproducible test inputs, not field observations.

\- Align the eventual real-data pipeline with the Phase 1 Algorithm document: require Phase 0’s cleaned/normalized georeferenced samples and land-readiness result, accept the field boundary, map samples to grid cells, then cluster the soil attributes. Until those inputs exist, demonstrate the same cell-to-feature workflow on synthetic data and label it clearly. Choose real cell size based on sample spacing and intended use, not an arbitrary map resolution.

\- For real samples, project coordinates into an appropriate local metric coordinate system for distance/area operations. Compare IDW or another interpolation method against held-out measured samples; label interpolated values as estimates, not direct observations. Do not feed raw latitude/longitude into soil-feature Euclidean clustering.

\- Evaluate a bounded range of cluster counts using silhouette together with stability, contiguity, and minimum useful zone size. Do not select K solely by maximizing silhouette; it is a diagnostic, not a farm-management objective.

\- Implement Fuzzy C-means with its membership weights and fuzzy objective; the standard K-means squared-distance objective is not the Fuzzy C-means objective. Compare hard labels and fuzzy memberships separately.

\- Build the zone adjacency graph and report each zone’s mean/range for its soil features and SHI when available. Any merge should be between adjacent regions and use a documented multivariate soil-profile distance; SHI difference alone can hide offsetting nutrient/pH differences.

\- Test stability by perturbing inputs according to documented sensor/measurement uncertainty over repeated runs, then compare partitions with a label-invariant score such as adjusted Rand index. A visual impression of similar maps is not enough.

\- Run a moisture ablation on the same fixed benchmark (all soil features versus all except moisture) and report how zone assignments/stability change. This checks that transient snapshot moisture is not dominating zones; it does not prove the resulting zones are agronomically optimal.

\- For method evaluation, keep a separate synthetic benchmark with known planted regions. Measure cluster recovery (e.g. adjusted Rand index), silhouette, stability under noise/seeds, and map contiguity. Do not report synthetic benchmark scores as real-farm accuracy.

\- Phase 1 should export zone polygons, zone-wise profiles, and adjacency data as a documented handoff for a later WSN phase; sensor placement and cluster-head selection remain out of scope here.



\### Crop-compatibility profiles — transparent rules, not a trained recommender



\- Keep the ML zoning step crop-neutral: fit K-means/Fuzzy C-means on soil features first. Compute crop compatibility separately for each cell from the measured profile, then summarize its distribution within each zone; do not turn cluster IDs into crop labels.

\- Maintain versioned apple, tomato, and potato pre-plant profiles with source URL, geography, crop/stage, soil-test method, units, supported parameters, applicable ranges, and the scoring/rule version. Obtain numeric thresholds from suitable agronomy or extension sources before showing a score. Do not invent cutoffs or weights from a qualitative nutrient-demand table; in-season nutrition advice is outside this version unless stage-specific sources and measurements are added. A spot moisture reading is not a proxy for long-term water availability or water-holding capacity and stays outside the compatibility score unless the source explicitly supports that measurement and use.

\- For each crop and cell, show factor-level matches/limitations and a compatibility summary only for the measured, supported factors. Use a composite only when weights and thresholds are documented; label it as an index/class, never as probability, and do not normalize crop values to a 100% total. Otherwise show factor statuses without collapsing them into one score. Aggregate cell results to each zone with a robust summary and range, plus the share of cells with adequate inputs; do not rely on a cluster mean alone to hide within-zone variation.

\- The current zoning schema covers pH, optional/context-qualified moisture, soil temperature, EC, and N/P/K. For comparable real-data zoning runs, record moisture unit, depth, method, and timestamp; keep these metadata out of the feature vector and do not combine stale, differently collected snapshots. Calcium and micronutrients such as B/Zn are not currently guaranteed inputs: show them as “not measured” unless the user supplies a compatible soil-lab value. Do not infer their values from crop type or disease images.

\- The supplied crop-needs table is useful for identifying candidate factors, but its relative nutrient-demand statements are not numeric soil thresholds, crop-response labels, or fertilizer recipes. Do not train a crop recommender from it. A trained recommender would require representative labeled soil/crop/outcome data (for example, yield or crop success with location, stage, and management context), and is deferred until such data is identified and quality-checked.

\- Call the output a \*\*soil-to-crop compatibility estimate\*\*, not a cultivation probability, crop recommendation, yield prediction, planting certificate, or guarantee. Never output fertilizer quantities from this overlay. A true probability requires defined success outcomes, representative field-by-crop-by-season data, independent validation, calibration, and a separate scope decision.



\## 5. Evaluation plan



\### Image classifier



\- Report macro-F1, balanced accuracy, per-class precision/recall, confusion matrix, and class counts.

\- Also report crop-identification accuracy and crop-condition macro-F1, since the shared output contains both crop and condition. Inspect errors across crop families (for example, similar disease names across tomato and potato).

\- Report PlantVillage test and any eligible PlantDoc cross-dataset results separately; include only audited, genuinely matching labels and report the supported-class coverage.

\- Measure batch-one CPU median/p95 inference latency and exported artifact size on the same named device/runtime. Benchmark after warm-up; do not infer speed from parameter count alone.

\- If a low-confidence review threshold is used, choose it on validation data and report coverage and errors. Do not present raw softmax values as calibrated confidence by default.



\### Soil clustering



\- Compare K-means and Fuzzy C-means on the same normalized synthetic grids and cluster counts.

\- Show silhouette as an internal diagnostic, not as ground truth. Use the benchmark’s known planted regions for recovery scores, and report seed/noise stability and contiguity separately.

\- Present the user-edited map as an interactive demonstration, not as a test set or agronomic recommendation.



\### Crop-compatibility rules



\- Unit-test every rule against its documented thresholds, units, source, and missing-data behavior. Include boundary cases and verify that unavailable calcium/micronutrient values are reported as not assessed rather than silently treated as adequate.

\- Review the per-cell and zone summaries for all three crops; confirm the overlay does not change clustering labels and that within-zone ranges/data sufficiency remain visible.

\- Test rule boundaries and missing-input behavior. This is rule verification, not evidence of crop-yield prediction accuracy.

\- Do not score the compatibility overlay as an ML model or claim agronomic accuracy without independent labeled field outcomes.



\## 6. Proposed local software structure



\- \*\*Frontend:\*\* local web dashboard with a field-grid editor, per-zone apple/tomato/potato compatibility comparison, multi-crop leaf upload, model/metric panels, and reproducible scenario controls.

\- \*\*Python API/services:\*\* endpoints for leaf inference, clustering, and crop-compatibility rules. Keep ML inference separate from rule logic.

\- \*\*ML libraries:\*\* TensorFlow/Keras for the image model; scikit-learn for preprocessing, metrics, and K-means; `scikit-fuzzy` `cmeans` for the Fuzzy C-means comparison. Feed it the expected features-by-samples layout and preserve the returned membership matrix for the UI.

\- \*\*Artifacts:\*\* versioned model weights, preprocessing configuration, 17-class map, feature schema, crop-profile/rule versions and sources, dataset/split manifests, and evaluation reports. Save no uploaded leaf images by default.



Proposed local flow:



```text

User interface

&#x20; ├─ Soil editor ──> standardize features ──> K-means / Fuzzy C-means ──> crop-neutral zones + summaries

&#x20; │                                                                  └─> sourced crop rules ──> per-cell compatibility ──> apple/tomato/potato zone summaries + reasons

&#x20; └─ Leaf upload ──> image preprocessing ──> shared MobileNetV3-Small (17 classes) ──> crop-condition scores + review/mismatch state

```



\### Optional post-MVP add-on: weather-driven soil-water-balance simulator



This is a \*\*later rule-based simulation module\*\*, not a third ML model, a moisture forecaster, or evidence that the system controls real irrigation. It is considered only after the core zoning, compatibility, and leaf-classification modules are built and evaluated.



\*\*Purpose:\*\* let a user select a location and crop/stage, fetch weather inputs, and explore how a simplified estimate of root-zone water changes over days. It makes the demo's weather interaction concrete without pretending that a weather API is a physical soil sensor.



\*\*Daily state update:\*\* maintain estimated available water in a conceptual root-zone store, bounded by a documented lower limit and field-capacity upper limit. For each simulated day:



```text

estimated water(t+1)

&#x20; = clamp(estimated water(t)

&#x20;         + effective rainfall

&#x20;         + simulated irrigation

&#x20;         − crop water use,

&#x20;         lower bound, field capacity)



crop water use = crop coefficient (Kc, by crop and growth stage) × reference evapotranspiration (ET₀)

```



\- Fetch \*\*precipitation\*\* and \*\*ET₀\*\* from a weather API such as Open-Meteo. ET₀ is preferable to temperature-only drying because it incorporates temperature, humidity, wind, and solar radiation in the FAO-56 Penman–Monteith estimate. Rain is not assumed to enter the root zone completely: use a clearly documented, simple effective-rainfall rule and cap the store at field capacity; the excess is displayed as estimated drainage/runoff.

\- Select apple, tomato, or potato and an explicit growth stage. Read the stage-specific `Kc` from a versioned, sourced crop-profile table. Do not use one permanent coefficient per crop or infer crop stage from a leaf image.

\- Initialize the store with a user-entered or synthetic static moisture value that includes unit, depth, method, and timestamp. Map it to the conceptual root-zone scale only when that mapping is documented; otherwise start from a named scenario such as `moderately wet` and label it synthetic.

\- Show a daily chart containing rainfall, ET₀, simulated irrigation, estimated water, lower threshold, and field-capacity ceiling. Call the output \*\*estimated soil-water balance\*\*, never measured soil moisture.



\*\*Simulation modes:\*\*



1\. \*\*Scheduled scenario:\*\* simulate a fixed application such as a chosen amount at 8 PM each day. This is a what-if baseline, not a recommended schedule.

2\. \*\*Threshold-rule scenario:\*\* when estimated water crosses a documented crop/stage lower threshold, add a configured simulated irrigation amount on the next allowed irrigation time. The result is an alert such as “estimated root-zone water below configured threshold; review irrigation,” not a command to turn on a pump.

3\. \*\*Compare scenarios:\*\* show estimated irrigation total, dry-threshold days, and estimated overflow/drainage days for scheduled versus threshold-rule behavior under the same weather sequence. These are simulator outputs, not measured water savings or yield effects.



\*\*Validation and safety boundaries:\*\*



\- Unit-test arithmetic, clamping, rainfall/irrigation accounting, thresholds, and missing-weather handling with hand-calculated scenarios. Replay historical weather only as a deterministic software test; it does not validate soil estimates against a farm sensor.

\- Do not claim water saving, crop-health improvement, irrigation accuracy, or agronomic validation unless estimated state is compared with independently measured root-zone moisture and the intervention is evaluated in field conditions.

\- Weather APIs represent a grid cell, not a farm microclimate. Soil texture, rooting depth, slope, mulch, drainage, irrigation uniformity, and local rain can materially alter water balance; expose these as documented assumptions or leave them as fixed scenario parameters.

\- Keep the module separate from K-means/FCM and the leaf classifier. Weather values do not modify the image model's disease prediction, and this simulator does not train on the weather API response.



Suggested API/UI seam after MVP: a weather-adapter service fetches weather by selected coordinates and date range; a pure simulator service receives normalized daily weather, crop-stage profile, soil-store parameters, and schedule/rule configuration; the frontend renders source-labelled inputs, assumptions, chart, and alerts. Cache the fetched weather response with source, coordinates, timezone, retrieval time, and units for reproducible scenarios.



\## 7. Suggested build order



1\. **Build the mock-data frontend first.** Create the visual, interactive demo with deterministic local fixtures, named presets, soil sliders, and clearly labeled mock results. It does not run clustering, crop rules, or image inference. Review and approve its look and flow before starting Phase 0; see [Decision 0002](decisions/0002-mock-data-demo-first.md) and the [delivery plan](DELIVERY.md).

2\. After approval, resolve Phase 0 evidence and contracts: audit the 17-class dataset and group-preserving split, agree on soil features and units, source supported crop profiles, and settle implementation contracts.

3\. Build the deterministic scenario and complete 2D Field Lab, including inspection, localized edits, presets, undo/redo, and stale-result behavior.

4\. Implement real K-means and Fuzzy C-means zoning, then evaluate them against the fixed synthetic recovery/stability benchmark.

5\. Add the compatibility overlay only after sourcing unit-compatible apple/tomato/potato soil profiles; test missing-field handling and explainability. If suitable numeric sources are unavailable, show profile factors and “not assessed” rather than fabricate a suitability score.

6\. Train and evaluate the fixed shared MobileNetV3-Small 17-class leaf classifier using the audited group-preserving split and sealed PlantVillage test set; perform an eligible separate cross-dataset check.

7\. Add the functional R3F field enhancement after the complete 2D workflow and core product modules are in place; verify its performance and fallback budgets.

8\. Finish reproducibility documentation, limitations, example inputs, and the demo walkthrough.

9\. **Only after the MVP is complete:** add the weather-driven soil-water-balance simulator with source-backed crop/stage parameters, explicit assumptions, deterministic test cases, and no real-actuation claim.



\## 8. MVP boundaries and success criteria



\*\*In scope:\*\* apple, tomato, and potato leaf diagnosis across the 17 audited PlantVillage crop-condition labels using one shared classifier; interactive synthetic, crop-neutral soil zoning with optional, context-qualified static moisture as an input; a separately computed, source-backed soil-to-crop compatibility overlay for all three crops (only for supported/available measurements, with spot moisture shown as context rather than scored by default); a local browser UI; repeatable metrics.



\*\*Out of scope:\*\* temporal moisture forecasting, irrigation/pump replay or animation, real pumps/sensors, real-farm zone claims, a trained soil-to-crop recommender, yield prediction, full agronomic crop recommendations, automatic fertilizer dosing, and disease cures/treatment prescriptions. A weather-driven soil-water-balance simulator is a documented \*\*post-MVP add-on\*\*, not part of the MVP and not proof of irrigation performance. The app may display a static moisture reading and use it in zoning only when the measurement context is appropriate; it does not model water dynamics. The PlantVillage label set is not a complete disease catalogue; unsupported diseases/crops must be marked unsupported or uncertain.



The project is ready to present when a reviewer can reproduce each reported metric, trace every displayed prediction to a model and input, compare ML results with a baseline, see the difference between measured and synthetic data, and understand exactly which actions are model predictions versus rules.



\## References



\- \[PlantVillage dataset](https://github.com/spMohanty/PlantVillage-Dataset)

\- \[PlantVillage class map, `leaf\_id`, and group-preserving split documentation](https://github.com/spMohanty/PlantVillage-Dataset/blob/master/README\_HF.md)

\- \[PlantDoc paper and dataset description](https://arxiv.org/abs/1911.10317)

\- \[MobileNetV3 paper](https://arxiv.org/abs/1905.02244)

\- \[Keras Applications](https://keras.io/api/applications/)

\- \[scikit-fuzzy Fuzzy C-means API](https://scikit-fuzzy.github.io/scikit-fuzzy/api/index.html)

\- \[FAO-56 crop evapotranspiration and crop-coefficient method](https://www.fao.org/4/X0490E/x0490e0b.htm)

\- \[Open-Meteo weather variables, including precipitation and FAO-56 ET₀](https://open-meteo.com/en/docs/historical-weather-api)
