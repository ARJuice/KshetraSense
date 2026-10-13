# Product requirements document

**Status:** current product requirements. Phases 1–2 are implemented: the Soil Zoning workspace accepts a WGS84 boundary and measured samples, runs the field-scale backend, and shows the returned zones and selected-scope Crop Fit. No real-farm validation, calibrated agronomic score, radio coverage, or measured production performance is claimed. The five-phase implementation status is in [plans/README.md](plans/README.md).

## Product statement

KshetraSense is a local, interactive smart-farming application for apple, tomato, and potato. A user can define or import a field boundary, enter georeferenced soil samples, inspect crop-neutral management zones, and compare independent per-crop assessments for a selected cell or zone. Leaf-image diagnosis and soil/satellite investigation remain separate workflows. Every result must make its source, date, method, resolution, quality, and limitations clear.

The product is educational and exploratory. It is not a farm-control system or a substitute for agronomic advice.

## Users and outcomes

| User | Desired outcome |
| --- | --- |
| Student or demonstrator | Enter a field boundary and measured soil samples, run a real zoning method, and explain how returned zones were formed. |
| Reviewer or teacher | Trace an output to its input, method, configuration, version, and evaluation evidence. |
| Curious non-specialist | Explore working features while distinguishing user measurements, modeled context, model output, and sourced rules. |
| Farmer or field demonstrator | Review dated soil observations and relative vegetation patterns to decide where to inspect or sample next. |

## MVP scope

1. Synthetic soil fields may be used for tests and benchmark evaluation only; never present them as user field data or a current analysis result.
2. Field boundary and georeferenced sample entry/import with measurement units, common sampling depth, provenance, validation, and visible stale-result state when inputs change.
3. Crop-neutral K-means++ or Fuzzy C-means (FCM) zoning on the IDW-interpolated, standardized pH/EC/N/P/K surfaces. Show contiguous zone summaries, adjacency/post-processing, Auto-K diagnostics, and FCM membership strengths where applicable.
4. A separate apple/tomato/potato pre-plant soil-compatibility view using versioned, sourced rules and supported measurements. Assess each crop independently; this is not a three-way probability split.
5. One shared, 17-label crop-condition image classifier using the fixed MobileNetV3-Small architecture, transfer-learned from ImageNet. Evaluate it on the audited, group-preserving split; model selection does not include alternative-backbone comparison.
6. Evidence and methodology information, with actual metrics only after they have been measured.
7. A functional Three.js / React Three Fiber field on capable devices, paired with a complete 2D workflow.
8. A separate **Field Monitoring** destination with two independent areas: Soil Investigation and Vegetation Monitoring.
9. Soil Investigation records dated, located, user-entered or imported field/laboratory soil samples with parameter values, original units, depth, method, collection time, and provenance. It may show SoilGrids predictions as optional regional context, with the product's resolution, depth, uncertainty, and source visible.
10. Vegetation Monitoring uses the pinned CropSight application as an independent sub-application. It accepts CropSight's own circular area (center latitude/longitude and radius) and date window, retrieves imagery through its configured provider, and exposes only source outputs that pass a verification gate. It does not read or write Soil Zoning, Crop Fit, or Leaf Diagnosis state.
11. The first intended monitoring outcomes are seasonal NDVI exploration and relative underperforming-patch flagging for human scouting. No causal diagnosis or prescription follows from NDVI alone.

## Out of scope

- Real-time sensor streams, pumps, irrigation controls/replay, temporal soil-moisture forecasting, or automatic actuation.
- A trained soil-to-crop recommender, yield prediction, planting certification, fertilizer quantities, deficiency diagnosis, or treatment/cure advice.
- Validated variable-rate input prescriptions, irrigation decisions, and yield estimation from the initial Field Monitoring module. These remain later research/build goals requiring dedicated data, agronomic rules or crop-specific models, field validation, and separate acceptance criteria.
- A crop-cultivation probability or a normalized apple/tomato/potato percentage split in the MVP. The current input/result contracts contain no representative crop-outcome labels, and soil-only features are insufficient for full land-suitability assessment.
- Interpreting cluster IDs as crop identity, soil quality, or a prescription.
- Any required paid asset, API, model, or runtime. CropSight's live imagery workflow does require an external Earth Engine project/configuration and quota; the user-visible product must report unavailable access rather than invent a result.

A weather-driven soil-water-balance simulator is a possible later rules module. It requires sourced crop-stage parameters, explicit assumptions, deterministic tests, and a separate scope decision before any implementation.

## Product requirements

| ID | Requirement |
| --- | --- |
| PR-01 | Each completed field run records its boundary/sample fingerprint, seed, parameters, feature schema, versions, and diagnostics so the same declared request can be reproduced. No field dataset is silently preloaded. |
| PR-02 | Cell and zone inspectors show values, units, source, and applicable measurement context. Missing values remain missing. |
| PR-03 | Boundary, sample, or analysis-parameter changes preserve the prior immutable run and mark it stale; the sparse-sample field workflow does not imply cell-brush editing. |
| PR-04 | A field-scale zoning run records its method, parameters, seed, feature schema, exclusions, pipeline versions, processing duration, diagnostics, and result. |
| PR-05 | K-means and FCM outputs are described correctly; FCM membership is never called model confidence. |
| PR-06 | Crop compatibility is independently computed for each crop with reasons, sources, units, version, and missing-data states. It cannot alter cluster assignments. |
| PR-07 | Leaf inference uses image pixels only. Selected crop, soil values, zone, and SHI are UI context and never model inputs. |
| PR-08 | Each result is labeled as synthetic/user input, model output, or rules output. |
| PR-09 | Selection, editing, zoning, inspection, crop comparison, and all essential Field Monitoring information remain usable without WebGL. |
| PR-10 | Unmeasured metrics are shown as “Not measured yet”; no placeholder score is presented as a result. |
| PR-11 | Crop-fit output is per-crop and never presented as a probability or forced to sum to 100%. Every displayed percentage states its metric and denominator; FCM membership remains cluster membership, not crop potential. |
| PR-12 | Field Monitoring is a distinct product destination; no monitoring result silently alters Soil Zoning, Crop Fit, or Leaf Diagnosis inputs/results. |
| PR-13 | Every soil sample records location, collection date/time, source/method, depth where applicable, parameter, value, and original unit. Missing or incompatible values remain visibly missing; no implicit unit conversion is allowed. |
| PR-14 | SoilGrids output is labeled as modeled regional context at its native product resolution, with property, depth, uncertainty/quantile when available, retrieval/source provenance, and an explicit warning that it is not a field sample or fine-grained soil measurement. It is not an automatic input to Soil Zoning or Crop Fit. |
| PR-15 | CropSight remains a separate vegetation workflow with its own AOI/date state. It cannot consume Soil Zoning/Crop Fit/Leaf results by default. Displayed algorithms, raster layers, time series, and rainfall comparison must match the actual source output; known mismatches are unavailable until verified. |
| PR-16 | Initial monitoring language is limited to relative vegetation patterns, seasonal change, and scouting priorities. NDVI alone is not called water stress, disease, nutrient deficiency, yield, or a prescription. |
| PR-17 | No fixture-only or canned sample output is presented as a product result. Synthetic fixtures are allowed only for tests, benchmark evaluation, and explicit internal development diagnostics. |

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

- The implemented field-scale request requires a valid WGS84 GeoJSON Polygon and 3–50 in-boundary samples (5–10 recommended), all with the same explicit sampling-depth interval and exactly pH, EC, N, P, and K. Units are pH (dimensionless), EC (dS/m), N/P/K (mg/kg). Soil temperature and moisture are not inputs to this Phase 1 field pipeline.
- Project the boundary/samples to local UTM for distance and adjacency operations; raw latitude/longitude are never clustering features.
- IDW with fixed power p=2 produces per-cell estimates. Return LOOCV RMSE/MAE and nearest-sample distance; these diagnose interpolation but do not validate it against field truth.
- Standardize varying soil properties, exclude constant features with a reason, and select K by the maximum silhouette over K=2 through maxK (2–6); ties choose the smaller K. FPC is diagnostic only. FCM preserves cell-to-source-cluster memberships.
- Merge only adjacent clusters below the explicit multivariate standardized-centroid distance threshold, then split disconnected components; do not silently drop small components. Silhouette and ARI describe internal structure/sensitivity, not agronomic usefulness.
- Perturb the measured source samples using reported standard uncertainty when present and declared project assumptions otherwise. Report fixed-K ARI/flip/sensitivity metrics without a calibrated grade or 0.85 pass threshold.
- The KshetraSense SHI is a separate, project-defined provisional score with explicit nonlinear functions and weights. It is not an official USDA/NRCS index, not locally calibrated, not a crop-fit input, and not a probability.

### Crop compatibility

- Keep clustering crop-neutral. In the implemented workflow, evaluate the user-selected cell profile or returned zone mean independently for each crop using versioned rules. The current backend exposes a limited pH screen; unsupported factors stay “Not assessed.” Cluster IDs and FCM memberships never identify crops.
- Define the land-use/production context before publishing a profile: target geography, crop and (where relevant) cultivar/rootstock, season or crop stage, rainfed/irrigated production system, input/management level, soil-test method/depth, and units. Numeric limits, interactions, sources, rule version, and boundary/missing-input behavior must be documented. Do not invent thresholds or weights from qualitative nutrient-demand statements.
- A full suitability assessment may require climate and growing-period data, water availability over the season, radiation, soil texture and effective depth, drainage/aeration, salinity, slope/topography, flooding, and other crop-specific constraints. The current zoning result contains IDW estimates for pH, EC, and N/P/K; the implemented Crop Fit screen assesses only pH. This is a partial soil-factor demonstration, not full land evaluation. FAO's crop/land framework evaluates each crop under a defined production system against climate, soil, and landform conditions ([method](https://www.fao.org/4/W2962E/w2962e-04.htm)).
- Without supported inputs and sourced numeric criteria, show measured factors and “Not assessed”; do not fabricate a composite. Calcium and micronutrients not present in the input remain unmeasured. If a sourced factor aggregation is later approved, call it a compatibility index or suitability class—not a cultivation probability—and disclose its factors and assumptions.
- Do not force the three crop values to total 100%. Multiple crops may each be suitable, or none; independent crop-success events are not mutually exclusive. A future probability requires a defined outcome and horizon, representative field-by-crop-by-season outcome data, independent validation, calibration evidence, uncertainty, and a separate scope decision. If a percentage is used under a validated land-evaluation model, name its denominator (for example, per-crop modeled yield relative to that crop's attainable maximum); that is not a probability or a share among crops. See the [crop-suitability research note](research/crop-suitability-probability.md).
- Call current output a limited soil-to-crop compatibility estimate. Do not call it a recommendation, yield prediction, planting certificate, fertilizer plan, or success guarantee.

### Field Monitoring: Soil Investigation and Vegetation Monitoring

Field Monitoring is a separate destination, not an extension of Soil Zoning. It contains two explicitly separated evidence views:

**Soil Investigation** answers: “What did we measure at this location and time, and what broad regional soil context is available?” It is useful for organizing field/lab results, spotting gaps in sampling, and comparing observations across dates. It is not a sensor-control system or an automatic zoning input.

- **Inputs:** a user-named investigation/location; one or more soil sample records with coordinates, collection date/time, sampling depth, collection/lab method, source, parameter/value/original unit, and optional notes; or a validated CSV import using the same fields. Supported parameters should align with the project schema (pH, N/P/K, EC, soil temperature, and moisture only when its unit/depth/method/time are supplied). Do not silently infer missing values or convert units without a documented conversion.
- **Optional SoilGrids context:** a selected location or investigation area, a product-supported soil property, and a supported depth layer. Show the predicted estimate and available uncertainty quantiles, native 250 m scale, retrieval date, product version/source, and a visible “modeled regional context—not a field measurement” label. Use cached/downloaded data when available; the paused REST endpoint is not a required runtime dependency.
- **Outputs:** a dated sample register and map pins, parameter timelines only where repeated comparable measurements exist, completeness/method metadata, and a separate SoilGrids context panel. Do not create a single quality score or automatically pass observations into Soil Zoning/Crop Fit.
- **Limit:** no live sensors or sensor telemetry in the initial release. A future explicit export/handoff may be designed, but this module does not change existing zoning/crop/image calculations implicitly.

**Vegetation Monitoring** answers: “Where and how did satellite-observed vegetation patterns change during this date window, and where might a person scout?” It is useful for prioritizing field inspection, not identifying the cause of a pattern.

- **Inputs:** a circular area of interest defined by center latitude/longitude and radius, a start/end date, a CropSight-supported clustering selection/parameter where applicable, and optional crop/stage context for display only. Live analysis requires the CropSight provider configuration (Google Earth Engine project/authentication and available quota); rainfall context is optional and separately labeled.
- **Workflow:** invoke the pinned CropSight application as an isolated sub-application, keep its source and dependency environment separate from the existing analysis services, and maintain its own AOI, date, and result state. Do not pass Soil Zoning, Crop Fit, or Leaf Diagnosis data into it. The area remains circular; exact cadastral-polygon sharing is not part of this as-is integration.
- **Outputs:** only actual source-supported outputs after validation—NDVI map/composite or zone visualization where the original application provides it, acquisition/date coverage, per-area summaries, time-series views, and optional separately sourced rainfall context. Show method, dates, AOI, provider, quality/coverage, and errors. Do not imply pixel-level or in-field boundaries finer than the underlying imagery and AOI support.
- **Initial user value:** seasonal tracking and relative low-performing-patch scouting. Treat pattern flags as “inspect here,” not as a diagnosis.
- **Deferred goals:** variable-rate prescription maps require georeferenced rates, treatment rules, machinery/output compatibility, and field validation; irrigation decisions require water-status evidence such as comparable soil-moisture/weather/ET inputs and agronomic rules; yield estimation requires crop-specific stage/context and representative yield outcomes, model validation, and uncertainty. NDVI alone is insufficient for these claims.

The inspected CropSight revision's README advertises use cases beyond what its code demonstrably implements. The product must not present its recommendation strings, DBSCAN display path, or yield/irrigation/prescription claims as validated. See [Decision 0004](decisions/0004-field-monitoring-and-direct-build.md) and the [pinned integration audit](research/cropsight-soilgrids-integration-architecture.md).

## Evaluation and success measures

The project is ready for a college demonstration when a reviewer can use each functional module, trace outputs to data/method/version, reproduce reported metrics, and distinguish user measurements, external imagery, modeled context, model output, and rule output. The existence of a visually complete screen is not sufficient evidence that its analysis ran correctly.

- **Vision:** macro-F1, balanced accuracy, per-class precision/recall, confusion matrix, crop-level accuracy, class counts, artifact size, and warmed batch-one CPU median/p95 latency. Report PlantVillage test and eligible PlantDoc results separately.
- **Zoning:** recovery on planted synthetic regions, silhouette, stability across seeds/noise, contiguity, and moisture ablation on the same benchmark.
- **Rules:** tests for every published source/range/unit, boundary, missing value, and independence from zone labels. This verifies rule behavior, not crop-yield accuracy.
- **Soil Investigation:** sample import/entry validation, unit/context retention, time-series comparability rules, and clear distinction from SoilGrids estimates.
- **Vegetation Monitoring:** repeatable AOI/date request, source/method/output consistency, image coverage and invalid-pixel handling as actually available, request/error behavior, and an explicit audit that displayed map/algorithm matches returned data.
- **Rendering:** capture frame timing, draw calls, triangles, texture memory, transfer bytes, and load time on named desktop/mobile devices before claiming performance.

## Implementation-time verification choices

The product boundaries above are accepted. These details need evidence or implementation-level selection, but do not reopen the agreed module scope or direct-build approach:

- Final audited class map, split, model checkpoint, and review threshold.
- Target geography/production context and supported crop-profile parameters; whether a sourced suitability class or index is justified. Any calibrated crop-success probability is future scope and requires outcome data and a separate decision.
- Target soil-sample CSV schema and exact supported analyte unit conversions.
- Which CropSight result panels are exposed after the direct code path is validated; invalid/mismatched methods remain unavailable.
- Named performance reference devices and whether a free-tier Spline vignette is worth including.

## References

- [PlantVillage dataset](https://github.com/spMohanty/PlantVillage-Dataset) and [dataset metadata/split documentation](https://github.com/spMohanty/PlantVillage-Dataset/blob/master/README_HF.md)
- [PlantDoc paper](https://arxiv.org/abs/1911.10317)
- [MobileNetV3 paper](https://arxiv.org/abs/1905.02244) and [Keras Applications](https://keras.io/api/applications/)
- [scikit-fuzzy FCM API](https://scikit-fuzzy.github.io/scikit-fuzzy/api/index.html)
- [FAO land evaluation framework](https://www.fao.org/4/T0715E/t0715e06.htm), [FAO crop and land suitability assessment](https://www.fao.org/4/i2713e/i2713e.pdf), and [crop-suitability research note](research/crop-suitability-probability.md)
- Later water-balance research only: [FAO-56 crop evapotranspiration](https://www.fao.org/4/X0490E/x0490e0b.htm) and [Open-Meteo historical weather API](https://open-meteo.com/en/docs/historical-weather-api)
