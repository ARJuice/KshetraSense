# Technical overview: farmOS, SoilGrids, PyAEZ, and CropSight

**Checked:** 2026-10-11  
**Scope:** purpose, architecture/data flow, features, data, AI/ML or other analytical methods, outputs, evidence and limitations. This is a technical comparison for KshetraSense; it is not a UI/UX review or an implementation decision.

## Evidence and reading guide

Official project documentation, project repositories, and source code are used as primary evidence. The SoilGrids 2.0 paper is an independently published methods paper. PyAEZ’s scientific basis is described by FAO/IIASA and the project’s cited references; the project’s own current documentation is used for its present software state. CropSight descriptions in its README are **project-owner claims**, while implementation notes below come from read-only inspection of the repository’s `main` branch source. No application was executed, no predictions were reproduced, and no service was queried for agronomic results. Therefore, code inspection establishes what the checked source appears to implement, not that it runs successfully or is scientifically validated.

## At a glance

| Project | What it is | AI/ML or analytical method | Typical output | Strongest lesson for KshetraSense |
| --- | --- | --- | --- | --- |
| [farmOS](https://farmos.org/) | Open-source farm management and recordkeeping platform | No AI/ML in the checked core; its core is a Drupal application with structured entities, workflows, imports, APIs, and deterministic logic | Versioned farm records, relationships, maps, time-series data, and API resources | Preserve observation provenance, units, time, depth, method, IDs, and revision history |
| [SoilGrids](https://soilgrids.org/) | Global digital soil-mapping system | Quantile Regression Forest (QRF), a supervised tree-ensemble ML method, trained on soil profiles and environmental covariates | Global soil-property raster estimates at 250 m, depth layers, and uncertainty quantiles | Treat gridded estimates as scale-limited priors with uncertainty—not field measurements |
| [PyAEZ](https://github.com/un-fao/pyaez) | Python implementation of Agro-Ecological Zoning / land evaluation | Primarily process-based crop simulation and deterministic constraints/rules; not a trained ML predictor | Crop-specific potential/attainable yield and suitability outputs, subject to input and version | Full suitability needs climate, soil, terrain, crop and management context—not only NPK/pH |
| [CropSight](https://github.com/Priyam-28/CropSight) | Repository prototype for satellite NDVI field zoning | K-means clustering is visible in the documented Streamlit entrypoint; an ARIMA rainfall forecast is classical time-series statistics; other algorithm claims differ from code | NDVI map/zone visualization, vegetation and rainfall summaries, template recommendations | Keep algorithm identity attached to rendered output; separate claims, actual implementation, and validation |

These projects solve different problems. farmOS is a data/workflow platform; SoilGrids is a global spatial prediction product; PyAEZ is a crop/land evaluation model; CropSight is a small geospatial application prototype. They are not interchangeable and none validates KshetraSense’s current crop-fit values as probabilities.

## 1. farmOS

### Purpose and architecture

farmOS is a web-based farm management, planning, and recordkeeping system. It is built on Drupal and represents farm information as a domain model rather than as a single analysis table. Core record categories include **Assets**, **Logs**, **Quantities**, **Data streams**, **Files**, **Terms**, **Plans**, and related records. Assets represent managed things (for example land, plants, animals, equipment, sensors, materials, or groups); logs record events or observations associated with assets, locations, quantities, and dates. The [data model](https://farmos.org/model/), [Asset](https://farmos.org/model/type/asset/), [Log](https://farmos.org/model/type/log/), and [Plan](https://farmos.org/model/type/plan/) documentation describe these entities and their relationships.

The practical flow is roughly:

1. A user, importer, sensor connector, or custom module creates structured records.
2. Assets identify things and locations; logs record what happened, when, and to what; quantities and terms add typed values and classifications.
3. Data streams support sensor/equipment time-series or other repeated values. The documented data-stream module can store a basic stream in SQL or let a custom stream plugin access external data.
4. Drupal entity types, bundles, and modules provide extension points; CSV import uses Drupal’s Migrate API.
5. Drupal JSON:API exposes resources and schema information, with clients such as farmOS.js and farmOS.py available for integration. See the [API](https://farmos.org/development/api/), [entity type development guide](https://farmos.org/development/module/entities/), [data streams guide](https://farmos.org/development/module/data_stream/), and [CSV import guide](https://farmos.org/development/module/csv/).

The current farmOS 4.x [Composer manifest](https://raw.githubusercontent.com/farmOS/farmOS/4.x/composer.json) identifies a Drupal 11-based PHP application and its core package dependencies. The official [installation guide](https://farmos.org/hosting/install/) documents deployment and database options. This is a modular web application with a durable relational data model and API—not a Python ML service.

### Does farmOS core use AI/ML?

**No, not in the core functionality evidenced by the checked official documentation and 4.x dependency manifest.** The documented core covers recordkeeping, entity relationships, imports, APIs, sensor/data-stream handling, and deterministic farm-management workflows. I found no model training, model inference, or ML framework in the checked core manifest or core data-model descriptions. This is a bounded finding about the checked core, not a claim that no third-party or custom farmOS module could ever integrate analytics or an ML service.

### Outputs, evaluation, and limitations

farmOS outputs records and relationships that can be inspected through the application and API; data streams can be represented and visualized as tables/graphs or exported. Its purpose is not to estimate yield, cluster soil, classify leaves, or provide statistical prediction intervals, so “model accuracy” is not a core product metric. Record quality depends on what users and integrations enter, the schema and units chosen, and the quality of source measurements. The platform supplies the recordkeeping structure; it does not make a soil test scientifically representative by itself.

The repository identifies the core as GPL-2.0; the checked 4.x manifest specifies GPL-2.0-or-later. That describes farmOS software licensing, not the license of any data later entered into an instance. ([Repository](https://github.com/farmOS/farmOS), [4.x manifest](https://raw.githubusercontent.com/farmOS/farmOS/4.x/composer.json).)

### What KshetraSense can learn

Borrow the **data semantics**, not the stack: separate measurement events from derived estimates; retain stable IDs, source, timestamp, depth, method, units, and edit/revision history; distinguish field assets, samples, and analysis runs; and expose explicit versioned contracts. This does not imply that KshetraSense needs Drupal, PostgreSQL, or a farm-record product scope in the current demo.

## 2. SoilGrids

### Purpose, data, and model

SoilGrids is ISRIC’s global digital soil-mapping system. The peer-reviewed [SoilGrids 2.0 methods paper](https://soil.copernicus.org/articles/7/217/2021/) describes predictions at **250 m** spatial resolution, produced from roughly **240,000 georeferenced soil profiles** and more than **400 environmental covariates**. Profile observations are harmonized through the World Soil Information Service (WoSIS); covariates describe environmental conditions such as climate, vegetation, terrain/elevation, geology, land cover, and hydrology. The exact covariate stack and profiles vary by target property and data availability.

SoilGrids uses two related prediction paths: the **mean** layer is computed with the default Random Forest algorithm, while the **median and quantile** layers (Q0.50, Q0.05, Q0.95) are computed with Quantile Regression Forests. Both are supervised tree-ensemble ML methods: soil-property observations are targets, covariates are predictors, and the fitted models predict values for locations without a measured profile. The methods paper describes covariate screening/selection and spatially stratified cross-validation. This is not a mechanistic crop-growth simulator and does not predict whether a specific crop will succeed. ([ISRIC model/output explanation](https://docs.isric.org/globaldata/soilgrids/SoilGrids_faqs_01.html), [methods paper](https://soil.copernicus.org/articles/7/217/2021/).)

The documented mapped properties include soil organic carbon, total nitrogen, coarse fragments, pH in water, cation-exchange capacity, bulk density, and texture fractions. Products use six standard depth intervals: **0–5, 5–15, 15–30, 30–60, 60–100, and 100–200 cm**. The service publishes quantile layers, including central estimates and lower/upper quantiles intended to express predictive uncertainty; the paper evaluates prediction-interval coverage (PICP) and reports that coverage varies by property and depth rather than being a uniform guarantee.

### Outputs, scale, and uncertainty

The output is a set of global raster surfaces indexed by property and depth, with quantile values. These are model estimates conditioned on training data and covariates. The uncertainty layers are useful: a point estimate without its prediction interval would hide how weakly a location may be supported. But a nominal interval is not a promise that every individual field’s true value falls within it, and it is not a confidence score for a crop recommendation.

The model is designed for global mapping and broad regional use. ISRIC’s [scale guidance](https://docs.isric.org/globaldata/soilgrids/SoilGrids_faqs_04.html) cautions against using SoilGrids at local/farm scale. A 250 m pixel cannot resolve a small field’s internal patches, nor should it be relabeled as a measured value for each of KshetraSense’s synthetic grid cells. Training profiles are geographically uneven, some profiles have unknown sampling dates, and measured soil properties vary with sampling depth, method, land management, and time. The paper discusses validation and mapping limitations, including how spatial sampling and depth affect accuracy.

### Access and current service status

**As checked on 2026-10-11**, ISRIC’s official [access/FAQ page](https://docs.isric.org/globaldata/soilgrids/SoilGrids_faqs_02.html) (last updated 2026-01-27) still says the SoilGrids REST API v2.0 is temporarily paused because of service issues, with no restoration date given. The same page says the REST API is beta, has no uptime/support guarantee, and sets a fair-use limit of five calls per minute when available. It lists alternatives: WMS for visualization, WCS for subsets, WebDAV for full map data, and Google Earth Engine. Full raster products are large: the page says an individual map is about 5 GB and all maps for a property across depths/quantiles about 120 GB. Data is published under **CC BY 4.0**; follow ISRIC attribution guidance. This status is a snapshot of ISRIC’s cited page, not a live uptime test.

### What KshetraSense can learn

SoilGrids is a possible **contextual prior** for future regional exploration, not a replacement for lab tests or a runtime dependency for the frontend/demo. If used later, preserve property, depth, quantile, map version, spatial resolution, extraction date, and citation. Never transfer its point estimate into a synthetic cell while implying it is ground truth; its prediction interval and scale limitation must remain visible.

## 3. PyAEZ

### Purpose and two versions to distinguish

PyAEZ implements the FAO Agro-Ecological Zoning framework in Python. AEZ evaluates land for specified crops and production systems by combining climate, crop requirements, soil, terrain, water availability, and management assumptions. It is a crop/land evaluation workflow, not simply a soil nutrient recommender.

There are two relevant software snapshots:

- **PyAEZ v2.2** is the last tagged release visible in the older [AIT-GIC repository](https://github.com/gicait/PyAEZ/releases/tag/v2.2), released 2023-12-10. Its documentation and release notes cover the v2 module structure and inputs. The v2.2 release identifies an MIT license in the [package metadata](https://pypi.org/project/PyAEZ/).
- **PyAEZ 3.0** is the current FAO repository’s development version, not a finalized release. Its [v3 README](https://github.com/un-fao/pyaez/blob/main/PyAEZ3.0/README.md) says interfaces, calculation procedures, inputs, and repository layout may change; several detailed input/output documents remain “to be documented.” The current repository points users to a `LICENSE` file, but the checked `CITATION.cff` lists its license as `SEE-LICENSE-IN-REPOSITORY`; I therefore do not infer a v3 license here. Do not assume v2.2 API details are identical to v3.

FAO’s [PyAEZ page](https://www.fao.org/geospatial/data-and-tools/tools/python-package-for-agro-ecological-zoning-(pyaez)/en) describes the package and its development context. The current [FAO repository README](https://github.com/un-fao/pyaez/blob/main/README.md) describes the framework, modules, and main calculations. It also cites FAO/IIASA methods and states the need for local data, suitable parameters, and calibration/validation where possible.

### Workflow and modules

The current v3 notebook flow is **M0 → M1 → M2 → M3 → M4 → M5**:

| Stage | Documented role | Typical analysis represented |
| --- | --- | --- |
| Module 0 | Input and scenario preparation | Prepare climate, crop, soil, terrain, and user-defined production/management inputs |
| Module I | Climate regime | Derive agro-climatic and temperature/moisture regimes and growing-period characteristics |
| Module II | Crop simulation | Simulate crop calendars, biomass, crop water requirements, and attainable yield |
| Module III | Climatic constraints | Apply crop-specific climate constraints or climate-related yield reductions |
| Module IV | Soil and terrain constraints | Evaluate soil quality/suitability and terrain/slope effects |
| Module V | Agro-ecological suitability | Integrate climate, crop, soil, and terrain outputs into final suitability/yield results |

These module roles are the current project’s self-description; the v3 README explicitly says details may evolve. The older v2.2 package split soil and terrain into separate Modules IV and V and included Module VI for economic suitability. Its release notes identify crop/crop-cycle parameter input from Excel, climate and water calculations, Excel tables for climate constraints, soil suitability factors, a seven-layer soil-input routine based on HWSD v2 marked experimental, and terrain-factor maps. For exact legacy API behavior, use the versioned [v2.2 repository/release materials](https://github.com/gicait/PyAEZ/releases/tag/v2.2), not the v3 branch.

### AI/ML versus process models and rules

PyAEZ’s core method is a **sequential process-based/agronomic model plus deterministic land-evaluation factors**, not a trained ML classifier. Its documented calculations include length of growing period, reference/crop evapotranspiration, crop water balances and requirements, crop calendars, biomass/attainable yield, climatic constraints, soil suitability, and slope/terrain constraints. Some factors are supplied through crop-specific lookup tables or suitability rules. These methods use agronomic equations, parameter tables, and production assumptions; a Python numerical library or JIT compiler, if used to run them, does not make them AI/ML.

Consequently, its suitability result is conditional on selected crop/variety parameters, climate period, soil/terrain layers, water regime, and management scenario. A suitability class or yield estimate from this framework is **not automatically a calibrated probability of cultivation success**. Probabilistic interpretation would require defined outcome data and independent calibration/validation.

### Inputs, outputs, validation, and limitations

The current v3 README allows global, national, or local inputs, including station/gridded climate, crop calendars and locally calibrated crop parameters, soil maps or surveys, elevation/terrain, and agricultural production/management scenarios. It says output files and formats are still incompletely documented. The older version’s outputs include intermediate crop/climate factors and soil/terrain suitability maps, with v2.2 release notes naming `fc3`, `fc4`, and `fc5` maps. Do not treat those legacy names or output structures as guaranteed v3 contracts.

The framework’s own limitations section says outputs depend on input quality/representativeness, spatial and temporal resolution, crop parameter appropriateness, management/water assumptions, and the applicability of algorithms to the assessment conditions. A model result should be calibrated and validated against observations where possible. An independent 2023 comparison study of PyAEZ and AquaCrop in Nepal is an example of a specific research comparison, not a universal endorsement of either model for every field ([study](https://www.sciencedirect.com/science/article/pii/S2211464523000829)).

### What KshetraSense can learn

PyAEZ is a useful **scope check** for what a broad “crop suitability” claim entails: crop-specific requirements, growing season/climate, water, effective soil depth and constraints, terrain, and management. KshetraSense’s current pH, EC, N/P/K, temperature, and optional moisture snapshot is only a partial soil-factor view. If the app shows a crop result, it should name the limited evidence and missing inputs; it should not present an AEZ-like suitability percentage or “probability” without implementing and validating the full method and defining its denominator.

## 4. CropSight

### What the repository says it does

CropSight’s [README](https://github.com/Priyam-28/CropSight/blob/main/README.md) describes a Streamlit application that accepts a field center/radius and dates, gets Sentinel-2 imagery through Google Earth Engine, computes NDVI, aggregates a median image, clusters pixels into zones, extracts NDVI and CHIRPS rainfall time series, and generates statistics/insights. Its README claims K-Means, DBSCAN, Mean Shift, and Gaussian Mixture Models (GMM); crop-specific insights; interactive maps; algorithm parameter tuning; CSV and PDF report export; and side-by-side comparison. These are README/self-description claims, not independently evaluated capabilities.

### What source inspection verifies

The repository’s documented launch command is `streamlit run app.py`. In the checked [`app.py`](https://github.com/Priyam-28/CropSight/blob/main/app.py), the primary application:

- Uses `COPERNICUS/S2_HARMONIZED`, filters the collection by date, geometry, and `CLOUDY_PIXEL_PERCENTAGE < 20`, computes NDVI from B8 and B4, and creates a median NDVI image. It obtains a CHIRPS daily precipitation series from `UCSB-CHG/CHIRPS/DAILY`.
- Offers K-Means and DBSCAN in that UI path. The K-Means path uses Earth Engine’s `ee.Clusterer.wekaKMeans`. The DBSCAN path samples NDVI pixels to the Python side and runs scikit-learn DBSCAN, but the code then builds/returns a K-Means image for map visualization; the DBSCAN labels are not rendered as the zone raster. Thus a reported DBSCAN run is not a faithful DBSCAN zone map in the checked path.
- Computes field-level NDVI summaries and uses threshold/template logic for recommendations (for example, fixed NDVI cutoffs and crop-specific text). This is deterministic rule logic, not a trained crop-health or soil model. The code does not establish the scientific source or local validation of those thresholds.
- Imports `statsmodels` ARIMA and forecasts rainfall using **ARIMA(1,0,1)** after filling missing dates with zero; it returns forecast intervals. A seven-day rolling average is calculated but is not the forecast output. This is classical statistical time-series forecasting, not ML/AI. The checked source does not provide evidence of backtesting, forecast-error evaluation, or interval calibration.
- Produces a downloadable plain-text `.txt` analysis report in `app.py`. I did not find a PDF export path there. CSV download is present for time-series data, but the README’s general CSV/PDF zone-statistics claim is not established by the checked primary app path.
- Does not expose the README’s side-by-side algorithm-comparison workflow in the main `app.py` interface. A separate [`ndvi_segmentation.py`](https://github.com/Priyam-28/CropSight/blob/main/ndvi_segmentation.py) contains another Streamlit variant with an algorithm-comparison tab, but its DBSCAN/MeanShift/GMM branches also calculate sample labels and then return a K-Means base raster for visualization. Its comparison content is not evidence of a rigorous clustering benchmark; the listed pros/cons are descriptive, and timing alone is not a quality evaluation.

The repository also contains [`main.py`](https://github.com/Priyam-28/CropSight/blob/main/main.py), a FastAPI API with `/health`, `/analyze-field`, and `/crop-info/{crop_type}` endpoints. It is separate from the README’s documented Streamlit entrypoint, so its presence should not be read as proof that the README’s app is a deployed API. In `main.py`, only the exact K-Means selection executes an Earth Engine Weka K-Means path; other method values explicitly fall back to K-Means despite imports for DBSCAN/MeanShift/GMM. Recommendations again use fixed NDVI thresholds. I found no evidence in the checked repository that its `main.py` is the active or production entrypoint; describing it as an additional API implementation/prototype is more accurate than calling it definitively stale.

The checked [`requirements.txt`](https://github.com/Priyam-28/CropSight/blob/main/requirements.txt) pins FastAPI, Uvicorn, Pydantic, Earth Engine API, pandas, NumPy, scikit-learn, and python-multipart. It does not list several packages imported by the Streamlit application, including Streamlit, statsmodels, and visualization packages; the README’s `pip install -r requirements.txt` setup may therefore be incomplete for the documented Streamlit path unless those dependencies are installed separately. This is a manifest/source comparison only; the app was not run.

### AI/ML, uncertainty, and limitations

The checked code includes clustering algorithms, but the only method-faithful zone raster clearly supported by the primary Streamlit path is K-Means; the DBSCAN computation is not faithfully connected to its visualization. The use of a clustering algorithm is unsupervised ML, but that alone does not make CropSight’s recommendations AI. ARIMA is statistical forecasting, and fixed cutoffs are rules. GMM can be probabilistic as a clustering method, but its presence as an import or README option does not establish a functioning, calibrated crop-success probability; the variant inspected does not render its own labels as the zone raster.

The primary app visualizes satellite vegetation index values, not soil lab properties. NDVI may help describe canopy greenness/vegetation dynamics, but by itself it does not identify a unique cause of low vegetation or demonstrate yield. The reviewed code did not establish independent field-label evaluation, cluster-quality validation, prescription-response evaluation, or ARIMA forecast backtesting. It should be treated as an educational/prototype workflow, not a verified agronomic recommendation system.

The README claims MIT licensing, but the usual `main/LICENSE` raw path returned 404 during this check. Thus MIT is **README-stated but not verified from the referenced license file** as of the check date; verify before reusing code. ([README license claim](https://github.com/Priyam-28/CropSight/blob/main/README.md#license), [checked raw LICENSE path](https://raw.githubusercontent.com/Priyam-28/CropSight/main/LICENSE).)

### What KshetraSense can learn

CropSight demonstrates an end-to-end geospatial workflow pattern—acquire data, derive an index, aggregate, cluster, summarize, and report—but its input signals differ from KshetraSense’s soil readings and synthetic field. The main lesson is methodological integrity: name the algorithm that actually generated the displayed pixels; test that raster labels equal returned labels; track data source, date window, feature schema, and parameters; keep rules separate from model output; and evaluate recommendations and forecasts against suitable field observations. Avoid hard runtime reliance on external data APIs in a mock-data demo.

## KshetraSense-specific synthesis

| Reference | Reusable principle | Not justified by this reference |
| --- | --- | --- |
| farmOS | Provenance-rich, typed, versionable observations and analysis records | Adopting Drupal or treating recorded values as verified measurements without method/context |
| SoilGrids | Preserve spatial scale, depth, quantiles, and estimate-vs-observation status | Filling 18×12 cells from 250 m estimates or treating a global raster as field truth |
| PyAEZ | State crop, season, climate, water, terrain, soil, and management assumptions; validate modeled outputs | Calling a partial soil compatibility score a calibrated cultivation probability |
| CropSight | Maintain transparent acquisition→features→algorithm→rendering contracts and test end-to-end consistency | Assuming README-listed algorithms, forecast skill, or recommendations are independently validated |

For the current KshetraSense scope, keep zoning, crop compatibility, and leaf-image classification as separate analytical products with their own inputs and evidence labels. A soil cluster is not a crop identity. A rules-based compatibility result is not a learned probability. A leaf classifier’s image output does not validate the soil zone. The four references support careful provenance and explicit method boundaries; they do not by themselves establish KshetraSense’s future backend architecture or agronomic thresholds.

## Source register

### Primary project documentation and code

- farmOS: [data model](https://farmos.org/model/), [assets](https://farmos.org/model/type/asset/), [logs](https://farmos.org/model/type/log/), [plans](https://farmos.org/model/type/plan/), [API](https://farmos.org/development/api/), [entity types](https://farmos.org/development/module/entities/), [data streams](https://farmos.org/development/module/data_stream/), [CSV imports](https://farmos.org/development/module/csv/), [current 4.x Composer manifest](https://raw.githubusercontent.com/farmOS/farmOS/4.x/composer.json), [repository](https://github.com/farmOS/farmOS).
- SoilGrids: [SoilGrids 2.0 paper](https://soil.copernicus.org/articles/7/217/2021/), [official layers/model explanation](https://docs.isric.org/globaldata/soilgrids/SoilGrids_faqs_01.html), [official access/FAQ and service status](https://docs.isric.org/globaldata/soilgrids/SoilGrids_faqs_02.html), [official scale guidance](https://docs.isric.org/globaldata/soilgrids/SoilGrids_faqs_04.html).
- PyAEZ: [FAO PyAEZ page](https://www.fao.org/geospatial/data-and-tools/tools/python-package-for-agro-ecological-zoning-(pyaez)/en), [current FAO repository README](https://github.com/un-fao/pyaez/blob/main/README.md), [v3 README/status](https://github.com/un-fao/pyaez/blob/main/PyAEZ3.0/README.md), [v3 citation metadata](https://github.com/un-fao/pyaez/blob/main/CITATION.cff), [AIT-GIC v2.2 release](https://github.com/gicait/PyAEZ/releases/tag/v2.2), [PyPI package metadata](https://pypi.org/project/PyAEZ/).
- CropSight: [README](https://github.com/Priyam-28/CropSight/blob/main/README.md), [`app.py`](https://github.com/Priyam-28/CropSight/blob/main/app.py), [`main.py`](https://github.com/Priyam-28/CropSight/blob/main/main.py), [`ndvi_segmentation.py`](https://github.com/Priyam-28/CropSight/blob/main/ndvi_segmentation.py), [`requirements.txt`](https://github.com/Priyam-28/CropSight/blob/main/requirements.txt), [raw LICENSE path checked](https://raw.githubusercontent.com/Priyam-28/CropSight/main/LICENSE).

### Independent published study

- [PyAEZ and AquaCrop comparison for climate-change impacts on crop yields in Nepal (2023)](https://www.sciencedirect.com/science/article/pii/S2211464523000829). This is one context-specific published comparison, not an evaluation of every PyAEZ release or every KshetraSense use case.
