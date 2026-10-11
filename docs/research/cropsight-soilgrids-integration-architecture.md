# CropSight, Sentinel-2 NDVI, and SoilGrids integration architecture

**Research snapshot:** 2026-10-11  
**Status:** Evidence snapshot and pre-decision architecture analysis. Its original architecture recommendation is superseded by [Decision 0004](../decisions/0004-field-monitoring-and-direct-build.md).  
**Focus:** Domain model, geospatial data pipeline, analytical methods, deployment, and validation. UI/UX redesign is intentionally out of scope.

> **Current decision update (2026-10-11):** After reviewing this research, the user chose an independent Field Monitoring module and directed KshetraSense to use the inspected CropSight files as-is where possible, with CropSight's own circular area/date inputs and no dependency on Soil Zoning, Crop Fit, or Leaf Diagnosis. The user also chose SoilGrids as separate regional context and a direct functional build with no mock-first phase. The earlier recommendations below for a native shared-boundary satellite pipeline and for not reusing CropSight are retained as historical research alternatives, not current requirements. This user direction does not alter the factual source audit, fix CropSight code defects, or establish a license grant.

## Executive recommendation at research time (superseded)

KshetraSense can gain a useful **satellite vegetation-monitoring and NDVI-zoning module**, but should integrate the *capability and workflow pattern* represented by CropSight—not transplant the CropSight application wholesale. Build a native, independently testable module that shares a canonical field/parcel boundary with soil zoning, accepts a Sentinel-2 product through a replaceable data-provider adapter, records processing provenance, and returns separate vegetation-zone results. The current CropSight repository is a prototype: its README claims more algorithms and reports than the inspected main app path demonstrates, its DBSCAN branch returns a K-means raster, and the README's MIT claim is not backed by a license file visible in the current repository root. Do not copy or vendor its code until its license is verified at a pinned revision.

SoilGrids can be an **optional regional soil-context layer**, not a source of fine-grained soil values for each small field cell. SoilGrids is a global machine-learning prediction product at 250 m, with standard depth layers and prediction quantiles; ISRIC explicitly cautions against local/farm-scale use. It cannot resolve the within-parcel variability that the Phase 1 grid aims to describe, and its REST API is currently documented as paused. Keep it out of the required runtime and out of the default soil-zoning feature vector.

The major architecture shift is to make a **field/parcel geometry and its provenance the shared spatial foundation**. Keep the current synthetic soil zoning, later measured-soil zoning, satellite vegetation zoning, and SoilGrids context as distinct analytical products over that common boundary. Do not combine their values into one clustering or claim a crop-success probability until resolution, time alignment, field outcomes, and validation justify it.

## Scope and evidence boundaries

This report answers whether and how the capabilities could fit into KshetraSense. The supplied `Phase_1_Algorithm (1).pdf` is treated as historical design context, not as instructions or evidence that its algorithms have been implemented or validated. Its Phase 1 proposal describes a field polygon from GPS survey, cadastral map, or GIS digitization; a uniform example grid of 5 m or 10 m; soil-sample mapping by nearest-k averaging, IDW, or Kriging; pH, moisture, N/P/K, EC, and SHI features; silhouette-based K selection; K-means/FCM; SHI-based adjacency merging; robustness perturbations; and zone polygon/profile/adjacency outputs, with WSN clusters as a later use. Those are requirements and hypotheses to resolve, not measured results.

The current [README](../../README.md), [PRD](../PRD.md), [TRD](../TRD.md), and [Project Plan](../Project-Plan.md) describe a pre-build/local-first demonstrator with synthetic soil zoning, future K-means/FCM and MobileNetV3-Small modules, and crop compatibility kept separate. The current codebase has a React/TypeScript/Vite demo and fixtures, but its field is still a synthetic 18×12 grid: it does not yet define a georeferenced parcel, CRS, raster, or soil-sample contract. The proposed local Python boundary in the TRD is still a design proposal; there is no implemented geospatial or Python backend. This report therefore recommends a future structure, not a claim about existing runtime behavior.

## What CropSight contributes—and what should not be copied blindly

CropSight’s [README at the inspected commit](https://github.com/Priyam-28/CropSight/blob/05083d810e3df64c8c2f49c0dcf4342a890a1b63/README.md) describes a Streamlit field-analysis workflow: choose a center/radius and date window, retrieve Sentinel-2, compute NDVI, make a median composite, cluster pixels, inspect a time series, and optionally compare against CHIRPS rainfall. It claims K-means, DBSCAN, Mean Shift, GMM, algorithm comparison, CSV/PDF reports, and crop-specific insights. This is a useful workflow reference for the *shape* of an end-to-end satellite feature. The code and license observations below are pinned to commit `05083d810e3df64c8c2f49c0dcf4342a890a1b63` (the `main` SHA observed on 2026-10-11), so they can be revisited even if `main` changes.

Source inspection of that revision’s [`app.py`](https://github.com/Priyam-28/CropSight/blob/05083d810e3df64c8c2f49c0dcf4342a890a1b63/app.py) makes several important distinctions:

- Its main interface offers K-means and DBSCAN, not all four methods in the README. It uses `COPERNICUS/S2_HARMONIZED`; Google’s catalog identifies that collection as Level-1C top-of-atmosphere reflectance, not Level-2A surface reflectance. A KshetraSense implementation should select and document the product deliberately; the recommended default for vegetation-index analysis is Level-2A surface reflectance.
- The app calculates one-band NDVI and runs Earth Engine Weka K-means for the K-means path. Its DBSCAN path computes Python DBSCAN labels, but then returns a K-means image for display; the raster presented as DBSCAN is therefore not the DBSCAN result in that path. See [`app.py` around the zoning functions](https://github.com/Priyam-28/CropSight/blob/05083d810e3df64c8c2f49c0dcf4342a890a1b63/app.py).
- The repository also has a separate [`main.py` FastAPI interface](https://github.com/Priyam-28/CropSight/blob/05083d810e3df64c8c2f49c0dcf4342a890a1b63/main.py). It accepts center coordinates, circular radius, dates, a method/parameters, and optional crop context; its response exposes aggregate statistics, zone count, timing, time series, rainfall aggregates, and recommendation strings, but not the NDVI raster, per-pixel labels, or zone polygons needed for a shared KshetraSense parcel map. The API clustering path uses Earth Engine K-means for methods other than K-means, so the requested method and returned algorithm must be verified together.
- The pinned [`requirements.txt`](https://github.com/Priyam-28/CropSight/blob/05083d810e3df64c8c2f49c0dcf4342a890a1b63/requirements.txt) covers the API dependencies but omits packages imported by the Streamlit mapping/plotting app. The API also hardcodes an Earth Engine project identifier and suppresses initialization errors. Treat the Streamlit app and API as distinct entry points with separately audited dependencies/configuration; neither should be assumed to start correctly from the listed requirements alone.
- The README describes prescription-like use cases, but source code and a working display do not validate irrigation, fertilizer, pest, or yield decisions. NDVI is an optical vegetation signal, not a diagnosis of why a plant looks different. CropSight’s fixed crop/NDVI text and ARIMA rainfall forecast should not be treated as validated agronomic recommendations or forecasting evidence.
- The README says MIT and links to `LICENSE`, but that revision’s [root listing](https://github.com/Priyam-28/CropSight/tree/05083d810e3df64c8c2f49c0dcf4342a890a1b63) does not show the file and the commit-pinned [`LICENSE` path returns 404](https://github.com/Priyam-28/CropSight/blob/05083d810e3df64c8c2f49c0dcf4342a890a1b63/LICENSE). GitHub’s [licensing guidance](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/licensing-a-repository) says public visibility alone does not grant general rights to reproduce, modify, or distribute code when no license is present. If a valid MIT grant is confirmed later, it still carries the notice/permission-text condition in the [MIT license](https://opensource.org/license/mit). The user subsequently chose to proceed with the source for a non-public college project; this is a recorded user risk decision, not verification of permission. Preserve provenance and any notices, and review rights again before any broader distribution. Also audit dependencies, satellite data terms, and service terms separately; a code license does not grant those rights.

The repository was inspected as source, not installed or run. The recommendation is consequently about architectural lessons, not a claim that CropSight is unusable in every context. Its main useful lesson is the transparent sequence **boundary → imagery → quality mask → index/composite → zones → field/zone summaries**. KshetraSense should own each stage and test that the zone raster, returned labels, vectorized zone polygons, and reported algorithm all agree.

## Is Sentinel-2 NDVI zoning useful to a farmer?

Potentially, as a **monitoring and investigation aid**. Within a known field and a comparable crop-growth window, a spatial pattern or persistent low/high vegetation response can help prioritize scouting, soil sampling, or a conversation with an agronomist. Repeated observations can show whether a pattern is persistent or seasonal. Research on dynamic irrigation zones combines Sentinel-2 NDVI time series with soil-moisture measurements and root-zone simulation; that is evidence for a multimodal workflow, not evidence that NDVI alone yields an irrigation prescription ([Fontanet et al., 2020](https://doi.org/10.1016/j.agwat.2020.106207)).

Do **not** present an NDVI cluster as a soil nutrient zone, disease diagnosis, yield estimate, or cause-specific stress map. A low value can have multiple causes, and an index by itself cannot separate them. Do not generate fertilizer/irrigation quantities from NDVI-only clustering. A responsible first release can report “relative vegetation pattern for this date window; inspect or sample this area” and preserve the user’s ability to compare it with soil tests and field observations.

Sentinel-2’s red band B04 and near-infrared band B08 are each 10 m; NDVI is `(B08 − B04) / (B08 + B04)` ([USGS NDVI overview](https://www.usgs.gov/special-topics/remote-sensing-phenology/science/ndvi-foundation-remote-sensing-phenology)). The constellation has a nominal five-day revisit at the equator under the two-satellite configuration described by the [ESA Sentinel-2 handbook](https://sentinels.copernicus.eu/documents/247904/685211/Sentinel-2_User_Handbook), not a guarantee of a cloud-free measurement every five days. Cloud, shadow, missing data, crop stage, and field geometry make usable observations less frequent and uneven. Each result should show the acquisition/composite window and valid-pixel coverage, and comparisons should use similar crop stages/windows. The native pixel size is not sub-pixel precision: a 10 m pixel covers 100 m², so narrow/small parcels may contain only a few interior pixels and be dominated by mixed boundary pixels. A study of smallholder fields also discusses edge/mixed-pixel limitations for Sentinel-2 ([Sentinel-2 resolution study](https://www.mdpi.com/2072-4292/13/24/5108)).

## SoilGrids: appropriate and inappropriate roles

ISRIC describes SoilGrids 2.0 as a global soil-property mapping system produced using machine learning from soil-profile observations and environmental covariates. The product is 250 m, has six standard depth intervals (0–5, 5–15, 15–30, 30–60, 60–100, 100–200 cm), and offers prediction quantiles. Its mapped properties include pH, total nitrogen, organic carbon, texture, bulk density, coarse fragments, and CEC; these are not equivalent to every lab analyte (for example, mapped total N is not a field-specific plant-available N test). See [ISRIC’s overview](https://docs.isric.org/globaldata/soilgrids/SoilGrids_faqs.html) and [layers/quantiles](https://docs.isric.org/globaldata/soilgrids/SoilGrids_faqs_01.html).

ISRIC’s [scale guidance](https://docs.isric.org/globaldata/soilgrids/SoilGrids_faqs_04.html) says the global product is best for broad/continental-scale use and is not advised for local/farm-scale decisions. A 250 m pixel is 6.25 hectares; resampling it into 5 m or 10 m cells only repeats/interpolates a coarse estimate and invents detail. Keep its source, map version, property, depth, quantile, pixel support, and uncertainty visible. Do not treat it as a local lab result, fill missing field samples with it without an explicit estimation method, or mix it into the default within-field K-means/FCM feature vector.

Plausible optional uses are limited to regional context, broad comparison when a parcel spans meaningful mapped coverage, or an explicit “modelled background estimate” alongside (not replacing) local measurements. If local samples exist, the product could be compared in a separate validation study; they should not be silently calibrated against one another. SoilGrids is licensed CC BY 4.0, subject to attribution ([ISRIC access policy](https://docs.isric.org/globaldata/soilgrids/SoilGrids_faqs_02.html)). As checked on 2026-10-11, ISRIC says its beta REST API is temporarily paused and provides no restoration estimate; WCS is its recommended way to obtain subsets and WebDAV provides map files. Therefore a REST-call-on-every-field-load design is not viable. Treat SoilGrids as an optional cached/imported data adapter, or omit it from the first real-data milestone.

## Reconcile the attached Phase 1 proposal with the current plan

The PDF’s boundary-first approach is a strong foundation: use an explicit field polygon and keep outputs clipped to that geometry. But its example algorithms need decisions and validation before they become requirements. The current Project Plan more carefully advises against selecting cluster count by silhouette alone and against merging on SHI alone; preserve that caution rather than adopting the PDF’s simpler expressions as settled science.

| PDF proposal | Architecture treatment |
| --- | --- |
| Boundary from GPS survey, cadastral map, or manual digitization | Support these as *boundary sources*, each with provenance, CRS, date, and quality. A cadastral parcel may be a legal/administrative parcel rather than the exact cultivated area; allow a validated working-field polygon without overwriting the source parcel. Never imply the map validates ownership or actual use. |
| Uniform 5 m / 10 m grid | Keep the soil-analysis grid independent from the Sentinel pixel grid. Choose soil cell size from sample spacing, instrument support, intended use, and held-out validation. Align NDVI work to the actual Sentinel-2 10 m grid; do not downscale imagery to the soil cell size and imply finer observation. |
| Nearest-k, IDW, or Kriging for sample-to-cell values | These are candidate interpolation/statistical methods, not ground truth. Record method and parameters; compare using spatially held-out or leave-location-out samples, report error/coverage, and mask/exclude areas outside defensible sample support. Make “measured” versus “interpolated” explicit. |
| pH, moisture, N/P/K, EC, SHI as a single clustering vector | Version the feature schema with units, methods, depth, timestamp, missing-data policy, normalization and weight. Define SHI formula and evidence first; test whether it duplicates or double-weights source features. Keep satellite NDVI out of this vector in the first release. |
| Choose K by maximum silhouette | Use silhouette as one diagnostic, not the decision rule. Also evaluate synthetic recovery, seed/noise stability, spatial contiguity, minimum useful area/size, interpretability, and field outcome alignment where available. K-means is not spatially constrained and may assign one label to disconnected patches. |
| Merge adjacent cells when `|ΔSHI| < ε`; possibly reassign boundary cells | Require an explicit, versioned multivariate distance/merge rule, adjacency definition, minimum-zone constraints and audit trail. A scalar SHI-only merge can hide differences in pH/EC/N/P/K; boundary reassignment changes geometry and must be recorded and tested. Do not apply the same merge rule automatically to NDVI zones. |
| Perturb features to assess robustness | Keep and strengthen this: specify perturbation distributions from measurement uncertainty, rerun with fixed experiment protocol, use label-invariant comparisons, and report stability per layer and zone. |
| Export zones, profiles, adjacency graph; WSN clusters feed Phase 2 | Persist/export polygons, cell labels, summaries, inputs, provenance, and adjacency as a reproducible Phase 1 artifact. A WSN cluster relationship belongs to a later sensor-network phase and must not be inferred from a satellite/soil zone ID. |

## Recommended architecture

```text
                    Canonical Field / Parcel Registry
             geometry + CRS + source + revision + quality
                                │
       ┌────────────────────────┼────────────────────────┐
       │                        │                        │
 Soil Survey Pipeline    Sentinel-2 Pipeline     SoilGrids Adapter
 sample points + tests   L2A scenes + quality     optional 250 m layers
       │                        │                        │
 interpolation surfaces   NDVI composites/time     coarse context only
       │                        │                        │
 Soil zones (K/FCM)      vegetation zones/statistics     │
       └────────────────────────┴────────────────────────┘
                                │
                  Separate, provenance-backed results
                 compare across layers only after validation

   Leaf-image MobileNetV3-Small inference remains an independent module.
```

### 1. Parcel and working-field boundary registry

Make a field geometry—not a grid row/column—the spatial root for future real-data analysis. A field should have a stable ID and a geometry revision. Keep the original imported/surveyed boundary untouched and create a separately identified working-field boundary if the farmer or agronomist edits the cropped area. Record whether geometry came from GPS, a cadastral source, manual GIS, or synthetic fixture; source/license, collection date, coordinate accuracy/quality if known, area, CRS, and any transformations. Validate polygon closure/validity, holes, self-intersections, and area before running analytics. Keep source coordinates for interchange and transform to a suitable local metric CRS for distance, grid, area, buffering, and interpolation. Record that CRS and transformation in every run.

Do not assume a cadastral polygon equals planted area, sensor footprint, or agronomic management area. The farm boundary is an analytical mask, not evidence of legal title. Verify the applicable cadastral dataset’s source, accuracy, update date, permission, and local use conditions independently.

For the synthetic demo, preserve an offline/fixed-seed path. It can use a clearly synthetic local geometry and generated data without a real location or remote service. Later, the same domain contract can accept a georeferenced parcel. This avoids turning a satellite backend into a prerequisite for trying the demo.

### 2. Separate analytical pipelines over the same boundary

**Soil Survey Zoning:** ingest laboratory or sensor observations with coordinates, analyte, unit, method, depth, timestamp, source, and quality. Validate location and units; decide whether values can be compared across methods/depths; interpolate only after selecting and validating a method. Produce soil-valued cells/surfaces, K-means or FCM labels, membership strength (for FCM), zone means/variance, adjacency, exclusions, and diagnostics. Keep cluster IDs crop-neutral. Do not use SoilGrids or NDVI to silently impute missing field samples.

**Vegetation Monitoring/Zoning:** query a replaceable source adapter for Sentinel-2 Level-2A surface reflectance for the parcel and date window. Cloud/shadow mask at pixel level; a scene-wide cloud percentage alone is not a parcel-level quality mask. Compute NDVI from B04/B08, apply the boundary mask, and retain per-pixel valid observation count/coverage. Produce both time-window composites and per-parcel/per-zone time series. A median across per-scene NDVI and NDVI computed from median reflectance are not identical; choose and version one method. Use comparable crop stages/windows in temporal comparisons. Fail/flag the run when valid coverage is inadequate rather than fabricating zones from gaps.

For the first zoning baseline, evaluate a small number of transparent approaches: e.g. ordered NDVI classes/quantiles when the goal is relative vigor bands, and K-means on NDVI or a well-defined multi-date vegetation feature vector when the goal is an unsupervised partition. A one-band K-means describes index ranges, not necessarily spatially contiguous management zones. If connected polygons are required, add a separately documented adjacency/contiguity post-process and verify that vectorized output matches the raster labels. Avoid shipping DBSCAN/Mean Shift/GMM merely because CropSight’s README names them; add an algorithm only when its behavior, spatial meaning, parameters, and outputs are tested.

**SoilGrids Context:** optional provider/import flow retrieves only the field’s necessary mapped properties and depth/quantile metadata. It returns a distinct coarse contextual layer with uncertainty and source attribution. It cannot replace local samples or be used to create synthetic fine-grained texture.

**Cross-layer comparison (later, opt-in):** compare vegetation zones, soil zones, observations, and contextual layers over one boundary. Do not combine them into a single clustering model by default: soil measurements may describe a different depth/date/support than 10 m surface reflectance; SoilGrids is coarser still. A future fused-zone experiment needs explicit alignment, time-window policy, standardization/weights, missingness treatment, spatial validation, sensitivity analysis, and independent agronomic outcome data. Until then, show co-location/correlation as exploratory, not causal.

### 3. Versioned data and result contracts

Use explicit contracts so that a raster provider or clustering implementation can be replaced without changing the field identity. Minimum fields:

| Contract | Required content |
| --- | --- |
| `FieldBoundary` | Field ID, boundary revision, source type/reference, geometry, source CRS, working CRS, date, declared area, validation/quality metadata, and a flag distinguishing synthetic geometry from georeferenced geometry. |
| `SoilObservation` | Field ID, point geometry/CRS, analyte, value/unit, method, sample depth, timestamp, lab/sensor/source, QC status, and missing/invalid reason. |
| `GridSpec` | Analysis layer and revision, metric CRS, cell size, grid origin/alignment, geometry, intersection fraction with working boundary, and source support. Keep the Sentinel native grid separate from the soil interpolation grid. |
| `RasterLayerManifest` | Provider/product/collection, acquisition scene IDs/dates, bands/scale factor, surface-reflectance product, cloud-mask method/version, temporal composite rule, CRS/transform, pixel size, nodata definition, valid-observation count/coverage, input boundary hash, and artifact hash. |
| `AnalysisRun` | Run ID; layer type (`soil`, `vegetation`, `context`); immutable input references/hashes; algorithm and version; parameters, feature schema/units/normalization, seed; excluded cells/pixels and reasons; software versions; diagnostics; run time; status; and output hashes. |
| `ZoneResult` | Run ID, raster/cell labels, vector polygons, stable zone labels, area, per-feature summaries/distributions, uncertainty or FCM memberships where relevant, adjacency graph, valid-data coverage, and cautions. Do not encode “crop recommendation” in the cluster ID. |

Export vector outputs as GeoJSON or GeoPackage with CRS/provenance preserved; keep raster source/intermediate products in a georeferenced raster format such as GeoTIFF/COG rather than shipping full-resolution arrays through the browser. API names/paths are intentionally not frozen here; freeze schema and semantics first.

### 4. Proposed implementation boundary and external services

Keep React/TypeScript as the browser client and extend the TRD’s proposed local Python boundary with geospatial processing modules. Use GDAL/rasterio (or rioxarray), pyproj, and Shapely/GeoPandas where justified after an install/build test. The initial single-user/local architecture does not need a distributed queue or cloud database: use a local job/status record and disk artifact cache; add a durable task queue only if measured job duration/concurrency requires it. Browser requests should pass field/run IDs and compact statistics/vector data; raster acquisition, credentials, clipping, reprojection, and calculations belong behind the service boundary. Never put provider credentials in the client.

Define a `SatelliteProvider` interface and keep the demo provider offline. For real imagery, Copernicus Data Space publishes STAC and other data-access APIs; it is an appropriate candidate adapter, subject to implementing user authentication, checking current transfer/compute quotas, and caching only permitted products. CDSE documentation describes free/open data and processing for registered users with configured capacity plus user quotas. Sentinel data itself is free/full/open under Copernicus policy, but API/service access is not an unlimited or permanent no-quota compute guarantee. Google Earth Engine can be an alternative adapter for eligible research/noncommercial use, but it requires a registered Cloud project; commercial operational use requires a paid configuration, and current noncommercial access is quota/tier controlled. Therefore Earth Engine is not the default or a mandatory runtime. Recheck current terms and quotas at implementation. See [Copernicus STAC](https://documentation.dataspace.copernicus.eu/APIs/STAC.html), [CDSE access model](https://documentation.dataspace.copernicus.eu/Ecosystem.html), [CDSE quotas](https://documentation.dataspace.copernicus.eu/Quotas.html), [Earth Engine access](https://developers.google.com/earth-engine/guides/access), [commercial transition](https://developers.google.com/earth-engine/guides/transition_to_commercial), and [noncommercial tiers](https://developers.google.com/earth-engine/guides/noncommercial_tiers).

For Sentinel-2, prefer an L2A surface-reflectance collection (the official Earth Engine catalog calls it `COPERNICUS/S2_SR_HARMONIZED`) rather than CropSight’s `COPERNICUS/S2_HARMONIZED` TOA collection. B04/B08 are 10 m; cloud/shadow masks and their source changes need to be documented and tested. Earth Engine’s catalog notes historical QA60 mask changes; use a current, explicit SCL/cloud-probability policy and validate its false clear/false cloud behavior for target seasons. Sources: [L2A catalog](https://developers.google.com/earth-engine/datasets/catalog/COPERNICUS_S2_SR_HARMONIZED), [L1C catalog](https://developers.google.com/earth-engine/datasets/catalog/COPERNICUS_S2_HARMONIZED), [cloud probability](https://developers.google.com/earth-engine/datasets/catalog/COPERNICUS_S2_CLOUD_PROBABILITY), and [Copernicus Sentinel-2 product docs](https://documentation.dataspace.copernicus.eu/Data/SentinelMissions/Sentinel2.html).

For SoilGrids, use a separately cached/imported subset via the documented WCS/WebDAV route instead of relying on its paused REST API. If the software is distributed, retain CC BY attribution for every product used. The synthetic demo and zone algorithms must continue working when either external provider is unavailable.

### 5. AI/ML boundary and claims

| Component | Method | What the output means—and does not mean |
| --- | --- | --- |
| Soil interpolation | IDW is deterministic distance-weighted interpolation; Kriging is geostatistical prediction. These are not automatically ML. | Estimated spatial surface from chosen samples/model; needs spatial hold-out validation and uncertainty/support reporting. |
| Soil zones | K-means and FCM are unsupervised clustering methods (ML); feature scaling/schema and FCM membership matrix must be retained. | Groups similar measured/interpolated soil feature vectors under the chosen setup. A label or membership is not crop suitability/probability. |
| Sentinel NDVI | NDVI arithmetic is a deterministic index; K-means/other clustering of NDVI is unsupervised ML. | Relative spectral vegetation response in the acquisition window. Not ground truth for a soil property, cause of stress, yield, or remedy. |
| SoilGrids | Upstream global mapping uses ML over observations and covariates. | Regional model estimate at 250 m with depth/quantiles; this is not a KshetraSense model result or a field measurement. |
| Crop-specific compatibility | Existing PRD keeps this a separate sourced-rules assessment, not an ML output. | Independent per-crop limited compatibility factors; no forced 100% split. NDVI clusters must not change this. |
| Leaf image model | Existing plan retains one shared MobileNetV3-Small classifier. | Leaf-image classification remains independent. It does not validate soil/satellite zones, and soil/parcel/NDVI must not leak into image-model input. |

No supervised crop-stress, disease-from-satellite, yield-estimation, or prescription model is justified by importing CropSight. Those would need a defined target, representative field/season labels, group/spatially independent testing, external validation, calibration where probabilities are exposed, and an explicit scope decision.

## Phased implementation recommendation

1. **Architecture contract first:** add parcel/boundary provenance, CRS handling, field-boundary revision, and versioned run/result metadata without removing the fixed-seed synthetic demo. Decide how a legal cadastral parcel differs from the working-field boundary.
2. **Real soil-zone path:** ingest geolocated samples with analyte units/depth/method; choose grid scale from sampling support; validate interpolation; implement soil K-means/FCM and diagnostics; emit clipped polygons/profiles/adjacency. Resolve SHI semantics and replace silhouette-only K selection or SHI-only merging with documented multi-criterion checks before using them.
3. **Offline satellite vertical slice:** use a small, licensed/attributed sample fixture and local compute to prove product selection, cloud mask, NDVI, parcel clip, 10 m grid, coverage statistics, vectorization, reproducibility, and API payloads without user credentials or live API calls.
4. **Optional online Sentinel adapter:** add CDSE-backed fetch/cache only after registration, quota, authentication, data terms, latency, error/retry, and no-coverage behavior are tested. Keep GEE optional and gated by eligibility/cost configuration. A snapshot/fixture path must keep demos reproducible when providers are offline.
5. **Optional SoilGrids context:** only after the parcel registry and provenance contracts are working; start with one explicit property/depth/quantile and an attribution/uncertainty display. Do not feed these 250 m values into cell-scale zones.
6. **Field validation and any fusion:** compare NDVI zone persistence to scouting/sample/yield/management observations under a defined crop, location, season, and practice. Only then consider joint soil–vegetation zones, irrigation use, fertilizer advice, or yield outputs.

## Key risks and release gates

| Risk | Required guardrail |
| --- | --- |
| Cadastral boundary is stale, inaccurate, or not the cultivated footprint | Preserve source and revision; permit a distinct working-field boundary; show geometry quality; do not represent it as verified legal ownership. |
| 5–10 m soil grid or 10 m pixels overstate evidence | Match output resolution to measurement support; report pixel/sample count, valid coverage, and resolution; no resampling language that suggests new detail. |
| Cloud/shadow gaps or seasonal timing distort NDVI zones | Current per-pixel mask, valid-observation coverage threshold, date window and stage context; suppress low-quality runs; compare like-for-like windows. |
| K-means zones are disconnected or sensitive to settings | Report feature schema, scaling, seed, stability, contiguity and diagnostics; do not call label order a suitability rank; test raster/vector agreement. |
| IDW/Kriging produces confident-looking surfaces beyond sample support | Hold-out error, uncertainty/support mask, bounded interpolation, source labels, and “estimate” status; avoid extrapolation beyond accepted distance. |
| SoilGrids copied onto a finer grid | Keep it a separate coarse layer; preserve depth and quantile; no false cell-level variation or substitution for lab values. |
| External provider or terms change | Adapter boundary, provider/version manifest, cache, offline fixtures, explicit auth/quota handling, provider fallback, and recheck of current terms. |
| CropSight license or dependency rights are unclear | Do not copy the current source based only on README wording; require verifiable license at the exact pinned revision and audit transitive dependencies/data terms. |
| Results are interpreted as prescriptions/probabilities | Label vegetation zones as exploratory monitoring; no causal diagnosis or per-crop success probability without validated outcome datasets and calibrated methods. |

## Decisions still needed before implementation

- Target geography and applicable cadastral boundary source; who supplies it, its allowed use, accuracy, CRS and update process.
- Whether `Field` means cadastral parcel, planted/cultivated polygon, or both (recommended: preserve both identities where they differ).
- Soil sample density, lab/test methods, analytes, depth, date/freshness limits, and validation plan; exact grid resolution should follow these, not just the PDF’s examples.
- SHI formula, unit/normalization, and whether it adds information beyond pH/EC/N/P/K/moisture.
- Satellite product/provider decision (CDSE local processing recommended as the first online candidate; Earth Engine optional); account/quotas and offline behavior.
- Sentinel time-window and crop-stage rules, minimum clear-pixel coverage, cloud-mask policy, and which output is required: field average/time series, NDVI range classes, or contiguity-aware zones.
- Whether rainfall context is needed in the first satellite module. CHIRPS in CropSight is a separate coarse weather layer; it should not be mistaken for field-scale measurement or an accurate future rainfall forecast.
- What field observations will validate “useful” zones; until then, keep output explicitly exploratory and do not advertise management prescriptions.

## Bottom line

The strongest restructure is **parcel-centered, layered analytics**, not “make CropSight the whole backend.” Add a native Sentinel-2 vegetation module sharing the field boundary; retain soil survey zoning as its own measurement-driven layer; make SoilGrids optional regional context; preserve the local synthetic/offline path; and keep MobileNetV3-Small and crop-compatibility rules independent. The practical farmer-facing value can be scouting and sampling prioritization, but the analytics must stay descriptive until validated against field observations. A true architecture change is needed in the domain/data layer and processing boundary, while the exact UI can be rebuilt later without changing those contracts.

## Source register

### KshetraSense and supplied design context

- [KshetraSense README](../../README.md), [PRD](../PRD.md), [TRD](../TRD.md), and [Project Plan](../Project-Plan.md).
- User-supplied `Phase_1_Algorithm (1).pdf` (four-page historical design proposal; its contents are summarized in this report as proposals, not validation).
- [Related research: farmOS, SoilGrids, PyAEZ, and CropSight technical overview](farmos-soilgrids-pyaez-cropsight-technical-overview.md).

### CropSight and licensing

- CropSight at inspected commit [`05083d810e3df64c8c2f49c0dcf4342a890a1b63`](https://github.com/Priyam-28/CropSight/tree/05083d810e3df64c8c2f49c0dcf4342a890a1b63): [README](https://github.com/Priyam-28/CropSight/blob/05083d810e3df64c8c2f49c0dcf4342a890a1b63/README.md), [`app.py`](https://github.com/Priyam-28/CropSight/blob/05083d810e3df64c8c2f49c0dcf4342a890a1b63/app.py), [`main.py`](https://github.com/Priyam-28/CropSight/blob/05083d810e3df64c8c2f49c0dcf4342a890a1b63/main.py), and [checked `LICENSE` path](https://github.com/Priyam-28/CropSight/blob/05083d810e3df64c8c2f49c0dcf4342a890a1b63/LICENSE).
- [GitHub: Licensing a repository](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/licensing-a-repository) and [OSI MIT License](https://opensource.org/license/mit).

### Sentinel-2 and access

- Copernicus Data Space [STAC API](https://documentation.dataspace.copernicus.eu/APIs/STAC.html), [access model](https://documentation.dataspace.copernicus.eu/Ecosystem.html), [quotas](https://documentation.dataspace.copernicus.eu/Quotas.html), and [Sentinel-2 products](https://documentation.dataspace.copernicus.eu/Data/SentinelMissions/Sentinel2.html).
- [ESA Sentinel-2 User Handbook](https://sentinels.copernicus.eu/documents/247904/685211/Sentinel-2_User_Handbook) and [USGS NDVI overview](https://www.usgs.gov/special-topics/remote-sensing-phenology/science/ndvi-foundation-remote-sensing-phenology).
- Google Earth Engine catalog: [Level-2A surface reflectance harmonized](https://developers.google.com/earth-engine/datasets/catalog/COPERNICUS_S2_SR_HARMONIZED), [Level-1C TOA harmonized](https://developers.google.com/earth-engine/datasets/catalog/COPERNICUS_S2_HARMONIZED), [cloud probability](https://developers.google.com/earth-engine/datasets/catalog/COPERNICUS_S2_CLOUD_PROBABILITY); service use: [access](https://developers.google.com/earth-engine/guides/access), [commercial transition](https://developers.google.com/earth-engine/guides/transition_to_commercial), [noncommercial tiers](https://developers.google.com/earth-engine/guides/noncommercial_tiers).
- Fontanet, M. et al. (2020), [Dynamic Management Zones for Irrigation Scheduling](https://doi.org/10.1016/j.agwat.2020.106207); [smallholder Sentinel-2 spatial-resolution study](https://www.mdpi.com/2072-4292/13/24/5108).

### SoilGrids

- ISRIC [overview/model and 250 m product](https://docs.isric.org/globaldata/soilgrids/SoilGrids_faqs.html), [layers and uncertainty quantiles](https://docs.isric.org/globaldata/soilgrids/SoilGrids_faqs_01.html), [access/status/license](https://docs.isric.org/globaldata/soilgrids/SoilGrids_faqs_02.html), [scale guidance](https://docs.isric.org/globaldata/soilgrids/SoilGrids_faqs_04.html), and [WCS subset service](https://docs.isric.org/globaldata/soilgrids/wcs.html).
