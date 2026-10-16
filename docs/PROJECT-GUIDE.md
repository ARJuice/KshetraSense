# KshetraSense: project and data-flow guide

This guide explains the current project in plain language: what each screen does, where its data comes from, how the backend processes it, what the machine-learning methods mean, and what each result can and cannot tell you.

The guide follows the current application code and the current README. The phase plans are useful design history; if an older plan describes behavior differently, use the current code and root README as the description of what runs today.

## 1. The project in one view

KshetraSense is a local, browser-based farm-analysis workspace. It has several independent tools:

| Area | What you give it | What it returns | What it does not do |
| --- | --- | --- | --- |
| Soil Zoning | A field boundary and 3–50 laboratory soil samples | Interpolated soil-property maps, clusters, contiguous management zones, diagnostics, and suggested sensor locations | It does not turn interpolated cells into laboratory measurements or make a fertilizer prescription |
| Crop Fit reference report | A selected soil cell or zone, plus measurement context | Separate pH, salinity, and nutrient reference notes for finger millet, tomato, and groundnut | It does not choose a crop, rank crops, or estimate yield or crop success |
| Soil Investigation | Manually entered or CSV-imported observations | A local sample register, comparable trend charts, and optional SoilGrids context | It does not automatically send these observations into Soil Zoning |
| Historical Telemetry Replay | A selected line in a published 2023 tomato-trial dataset | Time playback, charts, anomaly-review flags, and exploratory humidity-signal forecasts | It is not connected to current sensors and cannot control irrigation |
| Vegetation Monitoring / CropSight | A circular location, date window, and requested cluster count | Sentinel-2 NDVI summaries and scene-by-scene values, with optional rainfall context | The current response does not include a usable zone map or raster |
| Leaf Diagnosis | One JPEG or PNG leaf image | A ranked list of 17 supported Apple, Potato, and Tomato classes | It does not confirm a disease, measure severity, or recommend treatment |
| Methodology & Limits | No data | Explanations of the project’s methods and boundaries | It is not another analysis pipeline |

These are intentionally separate analyses. There is no single “farm health” score that combines soil tests, satellite readings, telemetry, and leaf images.

## 2. How the application is put together

The browser interface is a React and TypeScript application built with Vite, Tailwind CSS, and Lucide icons. Its main entry is the app shell in `src/app/App.tsx`; Soil Zoning is the initial screen. The shell switches between Soil Zoning, Leaf Diagnosis, Field Monitoring, and Methodology & Limits. Field Monitoring contains three more screens: Soil Investigation, Historical Telemetry Replay, and Vegetation Monitoring.

A local FastAPI application in `services/zoning/app/main.py` serves the soil-zoning API and mounts the other backend functions. The same local server exposes the leaf and telemetry APIs, the SoilGrids endpoint, and the separate CropSight sub-application. CropSight is mounted at `/cropsight` and also at `/api/v1/cropsight`.

~~~mermaid
flowchart LR
    Browser["React + TypeScript UI"]
    API["Local FastAPI service"]
    Zoning["Soil Zoning pipeline"]
    CropFit["Crop Fit references"]
    SG["ISRIC SoilGrids WCS"]
    Tel["Historical telemetry replay"]
    Leaf["Leaf image classifier"]
    CS["CropSight sub-application"]
    EE["Google Earth Engine"]
    S2["Sentinel-2 imagery"]
    CH["CHIRPS rainfall"]
    Local["Browser localStorage"]
    Trial["Pinned Parma trial files"]
    Model["Versioned MobileNet model"]

    Browser -->|"boundary + samples"| API
    API --> Zoning
    Browser -->|"selected cell or zone"| API
    API --> CropFit
    Browser -->|"property + depth query"| API
    API --> SG
    Browser -->|"replay controls and reads"| API
    API --> Tel
    Trial --> Tel
    Browser -->|"one image"| API
    API --> Leaf
    Model --> Leaf
    Browser -->|"AOI + dates"| API
    API --> CS
    CS --> EE
    EE --> S2
    EE --> CH
    Browser <-->|"saved soil register"| Local
~~~

The frontend service files convert screen input into API requests and validate parts of the returned response. The backend validates the request again before analysis. Soil Zoning and Crop Fit are local calculations. SoilGrids and CropSight need external network services; CropSight also needs a working Earth Engine project and authentication on the machine running the backend.

### Where the main code lives

| Path | Role |
| --- | --- |
| `src/main.tsx`, `src/app/App.tsx` | React entry point and top-level screens |
| `src/features/zoning/` | Soil Zoning workflow, input forms, diagnostics, map, cell and zone inspection |
| `src/features/zoning/field/` | Field data types, imports, geometry helpers, map layers, and optional 3D scene |
| `src/features/monitoring/` | Soil Investigation, telemetry replay, and CropSight screens |
| `src/features/leaf/` | Leaf image upload, preview, and prediction display |
| `src/services/` | Browser-to-API clients and response validation |
| `src/components/ui/` | Reusable visual components; these do not perform farm analysis |
| `services/zoning/app/` | FastAPI routes, soil zoning, interpolation, clustering, SHI, Crop Fit, and SoilGrids |
| `services/telemetry/app/` | Dataset loading, replay controls, forecast, anomaly review, and water-balance advisory |
| `services/leaf/` | Image checks, model, inference route, and training/data tools |
| `services/cropsight/main.py` | Current Earth Engine-backed CropSight API |
| `services/cropsight/app.py` and `services/cropsight/modules/` | Older, separate CropSight prototype code; the current React screen calls `main.py` |
| `data/demo/soil-zoning/` | Explicitly selected synthetic Soil Zoning examples |
| `services/telemetry/data/` | Pinned source files for the historical trial replay |

The visual helpers in `src/components/ui/` include animated text, counters, click effects, a field reticle, and spotlight cards. They change presentation only; they are not model inputs or analytical results.

### Backend module responsibilities

| Module | Responsibility |
| --- | --- |
| `services/zoning/app/main.py` | Creates the FastAPI app, applies local CORS settings, registers routes, and mounts telemetry, leaf, and CropSight |
| `schemas.py` | Defines and validates the request/response shapes and allowed values |
| `spatial.py` | Validates the field polygon, selects UTM, and builds the clipped cell grid |
| `interpolation.py` | Projects soil samples, runs IDW, and calculates leave-one-out errors |
| `algorithms.py` and `clustering.py` | Implement K-means, FCM, silhouette-based Auto-K, cluster merging, and connected-zone splitting |
| `service.py` | Orchestrates the complete v2 zoning request, SHI calculation, diagnostics, summaries, stability, and response |
| `shi.py` and `wsn_placement.py` | Calculate project-defined SHI and geometric sensor/gateway candidates |
| `crop_fit.py` and `crop_profiles.py` | Return versioned, factor-by-factor crop reference comparisons |
| `soilgrids.py` | Calls ISRIC’s WCS, validates the raster response, applies property scaling, and returns quantiles and provenance |
| `services/telemetry/app/dataset.py` and `service.py` | Load/pin/align the trial data and create stream/history responses |
| `playback.py` and `router.py` | Maintain replay time, validate playback actions, and expose HTTP/WebSocket routes |
| `forecast.py` and `anomaly.py` | Load/evaluate the GRU forecast and build the Isolation Forest review flags |
| `water_balance.py` | Evaluate the independent FAO-56 VWC threshold advisory |
| `services/leaf/preprocessing.py`, `inference.py`, and `router.py` | Validate and resize images, verify/load weights, run inference, and return ranked classes |
| `services/leaf/model_factory.py`, `train.py`, and `dataset.py` | Define the CNN, training stages, data manifest, group-aware split, and stored metrics |
| `services/cropsight/main.py` | Current Earth Engine API for NDVI series/statistics, requested K-means count, rainfall context, and heuristic notes |

## 3. Data types and units

A value can only be interpreted correctly if its source, unit, depth, and method are known. These are the main data contracts:

| Data | Main fields or values | Units and meaning |
| --- | --- | --- |
| Soil Zoning sample | ID, latitude, longitude, depth interval, pH, EC, nitrogen, phosphorus, potassium; optional date, lab method, and uncertainty | pH is dimensionless; EC is dS/m; N, P, and K are mg/kg |
| Soil Zoning cell | Cell geometry and estimated values for those same five properties | A modelled estimate created from samples by IDW; not a physical sample |
| NDVI | Sentinel-2 red band B4 and near-infrared band B8 | Unitless ratio from −1 to +1 |
| CHIRPS precipitation | Daily precipitation | mm/day on a much coarser grid than Sentinel-2 |
| SoilGrids | Eight modelled soil properties for a requested depth layer | Property-specific; for example pH, g/kg, %, or kg/dm³ |
| Historical telemetry | Soil humidity signal, soil temperature, soil EC, air temperature, air humidity | Source reports soil and air humidity as %RH; soil EC is µS/cm |
| Leaf input | One JPEG or PNG image | Decoded to RGB pixels and resized to 224 × 224 |
| FAO-56 advisory input | Explicit VWC, field capacity, wilting point, root depth, and depletion fraction | VWC is m³/m³; water depth is mm |

A common source of confusion is that the project has more than one electrical-conductivity or moisture context. Soil Zoning’s lab EC is in dS/m. The historical trial’s soil EC is in µS/cm. The trial humidity value is a sensor-reported %RH signal, not volumetric water content (VWC). Those values should not be substituted for each other.

## 4. Soil Zoning, step by step

Soil Zoning turns a field outline and a small set of soil tests into a map. Only the sample locations are measured. The values between them are estimated.

### 4.1 Inputs and validation

The current Soil Zoning screen starts without a preselected farm. You can draw or import a boundary, add samples manually, or import a CSV. The boundary is a GeoJSON Polygon in WGS84 longitude/latitude coordinates. The browser workflow accepts a Polygon or a GeoJSON Feature containing a Polygon; the API contract is a Polygon. The main CSV fields are:

- `id`
- `latitude` and `longitude`
- `depth_cm`
- `ph`
- `ec`
- `nitrogen`
- `phosphorus`
- `potassium`

Collection date, laboratory method, and per-property standard uncertainty can also be supplied.

The API requires 3–50 samples. Five to ten well-distributed samples are recommended by the project for a small field, but that is guidance, not a guarantee that coverage is sufficient. It requires unique sample IDs, the same depth interval for every sample, exactly the five supported soil properties, finite numbers, pH from 0 to 14, and nonnegative values for the other measurements. Coordinates must be inside the field and outside any polygon hole. Sample locations within 1 cm of one another are rejected.

The API also returns warnings when fewer than five samples are used, depth is unknown, collection dates or lab methods are mixed/incomplete, and for the general limitation that grid-cell values are interpolated estimates rather than measurements with known lab accuracy.

A run can use 5 m or 10 m cells; the default is 10 m. It allows at most 5,000 retained cells and guards against more than 100,000 candidate grid cells. The project’s synthetic demo bundles are examples for trying the software, not measured farm or laboratory results. You must select one explicitly.

The main v2 request settings are:

| Request field | Meaning | Current default / allowed values |
| --- | --- | --- |
| `boundary` | WGS84 GeoJSON Polygon | Required |
| `samples` | Soil measurements and sample locations | Required; 3–50 samples |
| `cellSizeM` | Grid spacing | 10 m by default; 5 or 10 m |
| `method` | Clustering algorithm | FCM by default; `fcm` or `kmeans` |
| `maxK` | Largest K tested by Auto-K | 6 by default; 2–6 |
| `seed` | Repeatable random initialization | 42 by default |
| `mergeThresholdZ` | Maximum standardized-profile distance for merging touching clusters | 0.5 by default; 0–2 |
| `perturbationRuns` | Number of measurement-noise scenarios | 10 by default; 0–50 |
| `fcm.fuzziness` | FCM membership softness parameter m | 2 by default; greater than 1 through 5 |
| `fcm.maxIterations` | Maximum FCM updates | 150 by default; 1–1,000 |
| `fcm.tolerance` | Stop when maximum membership change is below this value | 0.00001 by default; greater than 0 through 0.1 |

### 4.2 Make a metric grid

Latitude and longitude are angular coordinates, so the service cannot use their raw degrees as distances. It chooses the Universal Transverse Mercator (UTM) zone for the field, projects the polygon and sample locations into metres, then lays a regular square grid over the projected boundary.

A cell is included when its centre falls inside the field polygon. Its visible footprint is clipped to the polygon, so cells on the edge can have less area than a full square. The service keeps each cell’s row, column, centre, area, geometry, and WGS84 location. Those rows and columns are later used to find adjacent cells.

The implementation supports UTM latitudes from 80°S to 84°N and does not support a boundary crossing the antimeridian. If a small field contains no cell centres at the selected spacing, the request is rejected rather than inventing a grid.

### 4.3 Estimate soil values between the samples with IDW

For every cell centre, the service estimates each of the five properties separately using inverse distance weighting (IDW). The current power parameter is 2. In plain language, a nearby sample gets more influence than a faraway sample, and influence falls with the square of distance.

~~~text
estimated value at a cell =
    sum(sample value × 1 / distance²)
    divided by
    sum(1 / distance²)
~~~

The distance is straight-line Euclidean distance in the field’s projected UTM coordinates, measured in metres. Every supplied sample participates in each cell estimate; this implementation does not cut off distant samples at a search radius. The same set of samples is used for pH, EC, nitrogen, phosphorus, and potassium. IDW has no learned parameters and does not infer soil processes; it is a deterministic interpolation rule.

Each cell retains its estimated values and its distance to the nearest sample. The service also reports leave-one-out cross-validation for each property: it temporarily hides one sample, predicts that sample from the others, repeats for each sample, then reports mean absolute error (MAE) and root mean squared error (RMSE). This checks how the sample pattern and IDW rule reproduce the supplied points. It does not directly measure error at every unsampled cell, and it is not a confidence interval.

### 4.4 Put the soil measurements on comparable scales

pH, EC, nitrogen, phosphorus, and potassium have different units and numeric ranges. Before clustering, the service z-score standardizes each property across the field’s cell estimates:

~~~text
z = (cell value − field mean for that property) / field standard deviation
~~~

After this conversion, a one-unit difference means roughly one field standard deviation for that property. This prevents a property with larger raw numbers from dominating only because of its units. Features that are constant across the field are excluded from clustering because they cannot distinguish cells.

The clustering uses the soil-property values. It does not include cell latitude/longitude or geometric distance as clustering features, and cells are not weighted by area during clustering. Spatial arrangement is handled afterward.

### 4.5 Cluster the estimated soil profiles

The request can use ordinary K-means or fuzzy C-means (FCM). The UI defaults to FCM. Both are unsupervised methods: they group cells by similarity in the five standardized soil values. They are not trained against known “good soil,” crop yield, or expert-labelled zone examples.

#### K-means

K-means represents each cell as a five-number vector, starts with K centres, assigns each cell to its nearest centre, and recalculates each centre as the average of the cells assigned to it. It repeats assignment and averaging until labels and centres stop changing or it reaches its iteration limit.

The implementation uses K-means++ initialization, which spreads starting centres according to squared distance from the nearest centre. This makes starting points less likely to bunch together. The configured random seed makes the run repeatable for the same input and environment. The maximum iteration count is 300. “Inertia” in the response is the sum of squared distances from cells to their assigned cluster centres; it is a diagnostic, not the criterion used to select K.

#### Fuzzy C-means

FCM also calculates cluster centres, but it gives each cell a membership value for every cluster instead of initially making a single all-or-nothing assignment. The membership values for one cell sum to 1. A fuzziness parameter m controls how soft the memberships are; the default is m = 2. The implementation repeatedly recalculates centres using membership-weighted averages and updates memberships from each cell’s distance to each centre. It stops when membership changes fall below the tolerance or the iteration limit is reached.

For display and zone construction, the cell gets the cluster with its largest membership as its hard cluster label. The individual membership values remain available as a map layer and diagnostic. They describe the FCM partition, not calibrated probabilities that a cell truly belongs to a zone. The Fuzzy Partition Coefficient (FPC) is a summary of how crisp or diffuse the memberships are, not a confidence score.

#### How the service chooses K

The service tests candidate K values from 2 through the configured maximum, capped at 6 and further capped by the number of cells and distinct soil profiles. For each candidate it runs the selected clustering method and calculates the silhouette score on the standardized profiles. It picks the K with the highest defined silhouette score; ties go to the smaller K.

A silhouette score compares how close a cell is to its own cluster with how close it is to the nearest other cluster. For a cell, if a is its average distance to other cells in its own cluster and b is its average distance to the nearest alternative cluster, the score is (b − a) / max(a, b). Its range is −1 to +1: larger positive values generally mean cells sit closer to their own cluster than to alternatives. It is a geometric separation measure, not a measure of soil quality or proof that the chosen number of zones is agronomically correct. K-means inertia and FCM’s FPC are also reported, but they do not replace silhouette in the Auto-K selection rule.

### 4.6 Turn clusters into contiguous map zones

A feature-based clustering can give the same label to far-apart parts of a field, or create small speckles. The service therefore post-processes the cluster labels:

1. It finds clusters that touch along a grid edge.
2. It compares their average standardized soil profiles.
3. It repeatedly merges the closest touching pair while their profile distance is at or below the configured merge threshold (default 0.5 z-score units).
4. It then splits any remaining disconnected pieces into separate zones using four-neighbour connectivity: cells connect through an edge, not just a diagonal.

The response keeps both the original cluster ID and the final contiguous zone ID. Therefore, a final zone is a spatial component of a cluster after merging and splitting, and the total number of final zones can differ from selected K. The zone IDs are labels, not rankings: zone 0 is not inherently better than zone 1.

For each final zone, the service summarizes the soil values and SHI using cell-area-weighted means. This is important at irregular field edges, where clipped cells can have different areas.

### 4.7 SHI is a separate screening calculation

The Soil Health Index (SHI) is a project-defined 0–100 weighted score calculated for each estimated cell. It is not used as an input to K-means or FCM and does not determine Auto-K. Clustering groups the standardized soil profile; SHI is calculated separately after cluster labels are found.

Each property first receives a project-defined score from 0 to 1:

- pH: bell-shaped score with its centre at 6.5 and spread parameter 0.8.
- EC: a decreasing logistic score with midpoint 2.0 dS/m; lower EC receives a higher score.
- Nitrogen: an increasing logistic score with midpoint 60 mg/kg.
- Phosphorus: an increasing logistic score with midpoint 25 mg/kg.
- Potassium: an increasing logistic score with midpoint 150 mg/kg.

The component scores are combined with the default weights pH 25%, EC 20%, nitrogen 20%, phosphorus 15%, and potassium 20%, then multiplied by 100. The calculation is deterministic. These curves and weights are project assumptions; they are not locally calibrated soil-health thresholds, a USDA/NRCS index, crop suitability, yield probability, or a fertilizer prescription. A high SHI should not be read as “this field will produce a high yield.”

The code uses these component shapes (N, P, and K values are in mg/kg):

~~~text
pH score = exp(−(pH − 6.5)² / (2 × 0.8²))
EC score = 1 / (1 + exp(2.5 × (EC − 2.0)))
N score  = 1 / (1 + exp(−0.06 × (N − 60)))
P score  = 1 / (1 + exp(−0.12 × (P − 25)))
K score  = 1 / (1 + exp(−0.03 × (K − 150)))
SHI      = 100 × (0.25 × pH score + 0.20 × EC score
                    + 0.20 × N score + 0.15 × P score + 0.20 × K score)
~~~

### 4.8 Check sensitivity and suggest sensor locations

The default stability check runs 10 perturbed scenarios. If a sample contains a standard uncertainty for a property, the service uses it. Otherwise, it uses project defaults: pH noise with standard deviation 0.1 pH units and 5% relative noise for EC and N/P/K. For each scenario it perturbs sample values, reruns IDW, then reruns clustering with the already selected K and the same seed. It does not repeat Auto-K selection.

The response reports adjusted Rand Index (ARI) comparisons of the resulting zone partitions, per-cell cluster-label flip rates, and the spread of each cell’s SHI across scenarios. ARI near 1 means partitions are very similar; around 0 means agreement is near what chance alone would produce. These results describe sensitivity to the chosen noise assumptions. They are not formal confidence intervals, and the assumed measurement noise may not match a particular laboratory.

For a Wireless Sensor Network (WSN) layout, the service suggests one candidate sensor location per final zone: the in-zone cell medoid, the cell whose centre has the smallest total distance to the other cell centres in that zone. It suggests one gateway/cluster-head point using the geometric median of those candidate nodes, projected back into the field. This is geometric planning only; radio range, obstacles, power, cost, and actual network coverage are not validated.

### 4.9 What the zoning response contains

The current `POST /v2/zoning/run` response includes:

- A run ID, input fingerprint, timestamp, processing time, method, selected K, and final zone count.
- Field area, projected CRS, cell size, grid coverage, and boundary.
- The submitted samples, warnings, interpolation method, IDW power, and per-property cross-validation.
- The standardization means and standard deviations, included features, and any constant features excluded from clustering.
- Per-cell geometry, estimated values, nearest-sample distance, SHI and its components, original cluster ID, final zone ID, and FCM memberships when FCM is used.
- Per-zone summaries, Auto-K sweep, merge log, stability report, and WSN/gateway candidate locations.
- Algorithm and profile version information.

The frontend can display the management-zone layer, pH, EC, N, P, K, SHI, and FCM membership layers. It also shows sample coverage and warnings, the Auto-K/silhouette diagnostics, merge history, selected cell or zone details, and a JSON export of the result. The main map is a 2D SVG view. An optional 3D view uses React Three Fiber/Three.js and is capped at 768 cells and 20,000 triangles; it is a visualization of the same estimates, not a separate model.

### 4.10 Crop Fit: reference comparisons for one selection

The Crop Fit report is a separate request made for the selected cell or zone. A selected cell sends that cell’s estimated profile; a selected zone sends area-weighted zone means. The versioned report (profile version `2026.10-crop-reference-report-v3`) compares pH context for three crops:

| Crop | Configured pH range | Reference shown by the report |
| --- | --- | --- |
| Finger millet / Ragi (*Eleusine coracana*) | 4.5–8.0 | [NIFTEM-T millet technical report](https://niftem-t.ac.in/pmfme/maltdpr.pdf) |
| Tomato (*Solanum lycopersicum*) | 6.5–7.5 | [Tamil Nadu Agricultural University tomato guidance](https://agritech.tnau.ac.in/horticulture/horti_vegetables_tomato_Soil.html) |
| Groundnut (*Arachis hypogaea*) | 5.3–6.6 | [Tamil Nadu Agricultural University acidity-tolerance table](https://www.agritech.tnau.ac.in/pdf/3.pdf) |

Each crop is shown separately with its cited source and context. A factor can be marked below, within, or above the pH reference range, context required, or not provided.

The request also carries free-text context for source scope, soil-test method, sample depth, and EC method so the report can keep those comparability limits visible alongside the numbers.

EC is shown as context but is not assigned a threshold status because the salinity-response data in [FAO’s water-quality guidance](https://www.fao.org/4/y4263e/y4263e0e.htm) use root-zone saturated-paste ECe, while the field input is a single-depth EC value with an unverified test method. N/P/K are shown as context because mg/kg values alone do not identify the extraction method or local crop calibration. Moisture and soil temperature are not supplied by the zoning request. The report therefore has no overall “fit” verdict, crop ranking, percentage chance, or planting recommendation.

## 5. Field Monitoring

Field Monitoring is a tabbed area of the UI, not a shared model. The three tabs use different data and storage paths.

### 5.1 Soil Investigation

Soil Investigation lets you enter or import soil records. Records can include date, location, pH, EC, N/P/K, depth, laboratory method, source, notes, and optional moisture or temperature context. CSV data are validated in the browser. The active sample register is kept in browser localStorage; it is not a server-side database.

During migration from an older UI, synthetic preset records are archived or kept visibly marked as synthetic and are excluded from active measurement summaries.

Trend charts group observations so measurements are only compared when their parameter, unit, depth, and method are compatible. For example, a pH reading at 0–15 cm with one test method is not silently merged into a series for a different depth or extraction method. These records are not automatically forwarded to Soil Zoning: a zoning run takes its own boundary and sample request.

### 5.2 SoilGrids context

From Soil Investigation, you can ask the ISRIC SoilGrids 2.0 Web Coverage Service (WCS) for a modeled value at a coordinate, property, and depth. The backend fetches the public raster subset and returns the 5th, 50th, and 95th percentiles. The displayed mapped value is the 50th percentile (Q50). The Q05–Q95 spread describes model quantiles; it is not a lab result or a guaranteed confidence interval.

The UI supports eight properties across six depth intervals:

| Property | Meaning | Returned unit |
| --- | --- | --- |
| `phh2o` | pH in water | pH |
| `nitrogen` | Total nitrogen | g/kg |
| `soc` | Soil organic carbon | g/kg |
| `cec` | Cation exchange capacity at pH 7 | cmol(c)/kg |
| `bdod` | Bulk density | kg/dm³ |
| `clay`, `sand`, `silt` | Soil texture fractions | % |

Depth intervals are 0–5, 5–15, 15–30, 30–60, 60–100, and 100–200 cm. SoilGrids has nominal 250 m resolution, so it is regional model context, not a measurement of the user’s field. Provider errors or masked locations are returned as errors; the app does not invent a replacement value. SoilGrids is not an input to Soil Zoning or Crop Fit.

The adapter applies property-specific scale factors from the source product before returning displayed values: 10 for pH-in-water, SOC, CEC, and texture; 100 for total nitrogen and bulk density. The frontend still displays each property in the unit shown in the table.

### 5.3 Historical Telemetry Replay

The replay uses a published, static tomato trial from Parma, Italy, collected from 2023-06-29 through 2023-09-13 local time. The crop was HEINZ 1301; three experimental lines received 100%, 60%, and 30% of the Irriframe-recommended irrigation quantity. The five pinned files are `raw/indicators.csv`, `raw/README.TXT`, `raw/stuard_environmental_data.csv`, `raw/stuard_soil_data.csv`, and `raw/stuard_water_meter_data.csv`. The loader verifies their sizes and SHA-256 hashes against the manifest. The dataset is attributed to [Mendeley Data version 2](https://data.mendeley.com/datasets/35wh56287y/2) (DOI 10.17632/35wh56287y.2, CC BY 4.0). The data are for demonstration and model evaluation, not a current KshetraSense farm.

The source reports soil-sensor humidity as %RH, with soil sensors at 20 cm. It also contains soil temperature and soil EC (µS/cm), one shared weather station with air temperature and %RH, source-reported water-meter values, and sometimes-missing battery values. The meter column is named `current_volume` and is labeled m³ in the source, but its unit scale and semantics are not independently validated. The service preserves it without interpreting the reading as flow, litres, a valve state, or actual water delivered. The shared air station is not three independent air sensors.

#### Preparing the replay and model inputs

The loader checks the pinned source files and handles source-format irregularities such as repeated headers. It keeps original observations distinct from the model’s nominal 10-minute UTC grid. For model inputs, values are linearly interpolated only between bracketing observations no more than 30 minutes apart; there is no edge extrapolation. Missing or long-gap windows can make a forecast unavailable. The playback view associates original readings with the replay cursor only when they are within five minutes; raw observations remain identifiable, and model-interpolated/resampled values are not presented as new sensor measurements.

Playback is process-local and read-only. The UI can play, pause, seek, and use speeds of 1×, 10×, 60×, or 360×. HTTP routes control and read the playback; a WebSocket sends read-only snapshots, with the UI falling back to HTTP polling if the socket is unavailable. State resets if the backend process restarts. History requests are bounded to 2,000 points.

#### GRU forecast

The Gated Recurrent Unit (GRU) model reads 144 ten-minute steps, or 24 hours, of five features:

1. Soil humidity signal (%RH).
2. Soil temperature (°C).
3. Soil EC (µS/cm).
4. Shared air temperature (°C).
5. Shared air humidity (%RH).

It forecasts the same soil humidity signal at +6, +12, and +24 hours. It does not forecast volumetric water content or irrigation demand.

The network has a 64-unit GRU layer, 0.1 dropout, a 32-unit GRU layer, then a three-value dense output. That output represents a predicted change from the latest signal (a residual); it is added to the “persistence” forecast, which simply assumes the latest value stays constant. Training uses chronological 70% / 15% / 15% splits, fits scaling on training rows only, uses Huber loss and Adam at a 0.001 learning rate, and stops early based on validation loss. The training configuration caps runs at 40 epochs with batches of 256 and validation-loss patience of 10.

On the held-out portion, the GRU MAE is 0.378, 1.265, and 0.980 %RH for the three horizons. The persistence baseline MAE is 0.083, 0.140, and 0.204 %RH. Since persistence performed better at every horizon, the GRU is an educational evaluation artifact, not an operational irrigation forecast or recommendation.

#### Isolation Forest anomaly-review signal

An Isolation Forest is fitted on the first 70% of the timeline across the three lines. It uses soil humidity, soil temperature, soil EC, and the absolute changes in humidity and EC. The implementation uses 100 trees and a configured contamination fraction of 2%. It marks unusual-looking rows for review; lower decision scores are more outlying.

There are no ground-truth fault labels for this dataset. An anomaly flag is not proof of a faulty sensor or a probability that the reading is wrong.

#### Separate FAO-56 water-balance endpoint

The telemetry service also has an API-only advisory route based on FAO-56 (Food and Agriculture Organization Irrigation and Drainage Paper 56). It requires explicit calibrated VWC inputs, current and forecast values, field capacity, wilting point, rooting depth, depletion fraction p, and a calibration-source note.

It calculates:

~~~text
TAW = 1000 × (field capacity − wilting point) × rooting depth
RAW = p × TAW
threshold VWC = field capacity − p × (field capacity − wilting point)
~~~

TAW is total available water and RAW is readily available water, in mm. If current or supplied forecast VWC reaches or falls below the calculated threshold, the response says human review is recommended. The route does not calculate crop evapotranspiration, effective rainfall, irrigation efficiency, irrigation volume, or any valve action. It cannot verify the calibration source. It is not connected to the trial’s %RH humidity signal and is not exposed as an interactive Field Monitoring screen.

## 6. Vegetation Monitoring and satellite interpretation

CropSight is an independent circular-area satellite workflow. It does not consume Soil Zoning, Soil Investigation, telemetry, or leaf-classifier results.

### 6.1 What the user selects

The UI asks for centre latitude and longitude, a circle radius from 10 to 10,000 m, a start and end date, a crop context, and a requested K from 2 to 7. Its initial values are a 250 m radius, K = 3, and crop context “Other,” but coordinates and dates are blank, so there is no default field to analyze. It offers Rabi, Kharif, and trailing-90-day date presets and shows whether the API is reachable. The screen currently submits the K-means method. Earth Engine must be authenticated and configured on the machine running the backend; the frontend reports API/provider failures instead of substituting a prepared satellite result.

Earth Engine’s date filter uses a half-open interval: the start date is included and the end date is excluded. This matters when interpreting a date range shown in the form.

### 6.2 Satellite source and NDVI formula

The backend queries Google Earth Engine’s `COPERNICUS/S2_HARMONIZED` ImageCollection, filters by the circle, dates, and image-level `CLOUDY_PIXEL_PERCENTAGE < 20`, then calculates NDVI for each image using Sentinel-2 band B8 and band B4:

~~~text
NDVI = (B8 − B4) / (B8 + B4)
~~~

| Band | Sensor data | Catalogue pixel size | Use in this calculation |
| --- | --- | --- | --- |
| B4 | Red, around 665 nm | 10 m | Red reflectance in the denominator and subtraction |
| B8 | Near-infrared, around 842 nm | 10 m | NIR reflectance in the numerator and addition |

The catalogue stores these reflectance bands with a 0.0001 scale factor. Because the same multiplicative scale appears in both numerator and denominator, it cancels in the NDVI ratio; the application uses Earth Engine’s normalized-difference operation directly.

B4 is red light and B8 is near-infrared (NIR). Green vegetation absorbs much of the red light and reflects NIR, so a higher NDVI often corresponds to more green canopy. NDVI is not a direct diagnosis of crop health, water stress, nutrient deficiency, or yield. Crop type, growth stage, bare soil, shadow, residue, clouds, and atmospheric conditions can all affect it.

The code uses the harmonized Sentinel-2 Level-1C top-of-atmosphere (TOA) collection. A helper comment calls it surface reflectance, but the actual collection ID is TOA, and this application code does not add an atmospheric-correction step. The catalog identifies B4 and B8 as 10 m bands and their reflectance scaling. The app filters whole scenes using cloud metadata; it does not apply a pixel-level cloud and shadow mask, so contaminated pixels may remain.

### 6.3 Composite statistics and the time series are different calculations

For the spatial summary, the service builds a pixel-by-pixel median composite across the filtered images. It calculates mean, standard deviation, minimum, and maximum pixel NDVI over the circle from that composite at 10 m scale.

For the time series, it calculates one mean NDVI for each available image over the circle. The response includes each scene date and its AOI mean, plus the average of those scene means. These values are not the same statistic as the spatial mean of the median composite. With at least three images, the service fits a simple line to the scene values in sequence order to label the trend “increasing” or “decreasing.” It is a lightweight summary, not a time-weighted crop-growth model.

### 6.4 What CropSight K-means actually clusters

The mounted API’s clustering function attempts to train Earth Engine’s Weka K-means clusterer using samples of the median image’s single NDVI band, then applies that clusterer to the NDVI image. In this path, the clustering feature is NDVI alone. It does not include soil pH/NPK, pixel coordinates, crop type, or a spatial-neighbour rule. It is a different K-means use from Soil Zoning. The current UI only sends K-means; if another method label is sent directly to the API, the backend still falls back to K-means rather than running DBSCAN or another method.

The code reports the requested number of zones, but it does not return the clustered image, a pixel-label raster, or zone geometries in the API response. The current frontend therefore has no CropSight management-zone map to draw. Treat `zones_identified` as the requested K count reported by the implementation, not a count of validated contiguous field regions. Cluster labels in an image are also arbitrary identifiers; they do not automatically mean low, medium, or high vigor.

### 6.5 Rainfall and recommendation notes

The optional rainfall series uses CHIRPS daily precipitation through Earth Engine. CHIRPS combines satellite and station information at roughly 0.05° resolution, about 5.5 km, with precipitation reported in mm/day. The service averages each daily image over the circle using a 5,000 m scale and limits extraction to at most 100 images. That is coarse regional rainfall context relative to 10 m Sentinel-2 pixels.

CropSight also returns simple hand-written notes based on mean NDVI thresholds, selected crop string, and requested zone count. Although rainfall is fetched, it is not used in those recommendation rules; the supplied growth stage is not used in the calculation either. The crop-info route can return static lookup values for Wheat (NDVI 0.4–0.9; 80 mm/month), Corn/Maize (0.5–0.9; 120 mm/month), Rice (0.4–0.8; 180 mm/month), Soybeans (0.4–0.9; 100 mm/month), Cotton (0.4–0.8; 70 mm/month), Sugarcane (0.5–0.9; 150 mm/month), and Other (0.3–0.8; 100 mm/month). Those values are reference figures, are not used to compute the analysis, and do not make it an agronomic model. The UI describes recommendations as unvalidated. Do not use them as confirmed fertilizer, irrigation, or yield advice.

The current CropSight screen displays aggregate NDVI statistics, a scene time-series chart, trend, rainfall context when available, and heuristic notes. Its response contains those summary values, the requested zone count, processing time, recommendation strings, and optional rainfall totals/series. It does not return a Sentinel raster, GeoTIFF, zone polygons, or per-pixel results.

## 7. Leaf Diagnosis

Leaf Diagnosis is an image-only classifier. The frontend previews the selected image and sends one file to `POST /v1/leaf/predict`. Soil, zone, satellite, and telemetry values are not inputs to this model.

### 7.1 Image checks and preparation

The service accepts one JPEG or PNG no larger than 10 MiB. It checks that the bytes really decode as the declared image type, limits each dimension to 8,192 pixels and the full image to 25 million pixels, applies EXIF orientation, converts to RGB, and resizes the full image to 224 × 224 with bilinear interpolation. It does not crop to a leaf. The pixel input range is 0–255; MobileNetV3’s built-in preprocessing handles model normalization. The image bytes are processed for the request and are not saved by this module. EXIF location/orientation metadata is not passed to the model.

### 7.2 Model and training data

The model is a supervised convolutional neural network (CNN), MobileNetV3-Small, initialized with ImageNet weights. Its feature-extraction backbone is followed by dropout at 0.2 and a dense layer with a 17-class softmax output. During training, the model first freezes the backbone and learns the classifier head; it then fine-tunes the last 30 non-BatchNormalization backbone layers. Training augmentation includes horizontal flips, rotation, and zoom. It uses sparse categorical cross-entropy and Adam, with inverse-frequency sample weights to balance classes; validation loss selects the saved checkpoint, with early stopping in each stage.

Training uses the color images from [PlantVillage](https://github.com/spMohanty/PlantVillage-Dataset) for these 17 labels:

- Apple: Apple scab, Black rot, Cedar apple rust, healthy.
- Potato: Early blight, Late blight, healthy.
- Tomato: Bacterial spot, Early blight, Late blight, Leaf Mold, Septoria leaf spot, Spider mites (two-spotted spider mite), Target Spot, Tomato Yellow Leaf Curl Virus, Tomato mosaic virus, healthy.

The service README records the pinned dataset revision, archive hash, and dataset-card license (CC BY-SA 3.0). The related research paper is Mohanty, Hughes, and Salathé, [“Using Deep Learning for Image-Based Plant Disease Detection”](https://doi.org/10.3389/fpls.2016.01419).

The audited source contained 23,483 supported images before overlap exclusions. Ten images in five leaf groups were excluded after split auditing; 18,820 remain in the source training partition and 4,653 in the held-out test partition. A 5-fold stratified group split selects training and validation groups from the training partition, grouping by physical leaf ID and exact-image hash so the same leaf or image does not cross between those splits.

On the held-out PlantVillage test set, the stored metrics are 92.97% accuracy, 93.52% macro-F1, 93.14% macro-precision, and 94.22% macro-recall. These figures describe this dataset split, not real field or phone-camera performance. PlantVillage uses controlled image backgrounds. The model has no supported-domain detector, so an unsupported plant or poor photo can still receive a ranked class. Softmax scores are uncalibrated model scores, not probabilities that a prediction is correct. Every result is marked for manual review. The output contains the top class, crop and condition labels, healthy/disease-associated label, all 17 ranked scores, model metadata, and limitations. It does not estimate severity, identify simultaneous conditions, or recommend treatment.

Before inference, the backend checks that the model artifact hash, class map, preprocessing version, and input/output shapes match the metadata. Missing or incompatible weights cause a service-unavailable response rather than a fallback prediction.

Inference runs on a GPU when a compatible PyTorch CUDA device is available and otherwise uses the CPU. The returned metadata includes the measured server inference latency.

## 8. Storage, external services, and boundaries

| Item | Where it lives |
| --- | --- |
| Soil Investigation sample register | Browser localStorage |
| Soil Zoning request and returned map | Sent to the local API for calculation and held in the current UI session; the user can export the response JSON |
| Historical telemetry data | Pinned local source files; playback state lives in backend process memory and resets on restart |
| Leaf image | Used for the inference request; not saved by the leaf module |
| Leaf model | Versioned model artifact and metadata under `services/leaf/models/` |
| SoilGrids result | Retrieved from the external ISRIC WCS when requested; no synthetic fallback |
| CropSight result | Queried from Earth Engine at run time; no prepared result is substituted when the provider/authentication is unavailable |

There is no central project database that joins these modules. A sample stored in Soil Investigation does not automatically enter zoning; a telemetry line is not attached to a zoning zone; satellite NDVI is not merged with the SHI; and a leaf prediction does not update field status.

## 9. Main API routes

The browser normally calls the local FastAPI service at `http://127.0.0.1:8000`. The current routes are:

| Route | Purpose |
| --- | --- |
| `GET /health` | Local service readiness and algorithm/profile/provider versions |
| `POST /v2/zoning/run` | Current boundary + sparse-samples Soil Zoning pipeline |
| `POST /v1/zoning/run` | Older compatibility route that accepts already-built grid cells |
| `POST /v1/crop-fit/evaluate` | Factor-by-factor crop reference report |
| `GET /v1/monitoring/soilgrids` | SoilGrids property/depth query |
| `GET /v1/telemetry/health`; `GET /v1/telemetry/metadata`; `GET /v1/telemetry/state`; `GET /v1/telemetry/stream`; `GET /v1/telemetry/history` | Replay readiness, provenance, controls/state, current stream, and bounded history |
| `POST /v1/telemetry/control` | Play, pause, seek, and replay speed |
| `WS /v1/telemetry/ws` | Read-only replay snapshots |
| `POST /v1/telemetry/water-balance/advisory` | Separate FAO-56 advisory from supplied calibrated VWC |
| `POST /v1/leaf/predict` | One-image leaf classifier |
| `GET /cropsight/health`; `POST /cropsight/analyze-field` | CropSight readiness and satellite analysis |
| `GET /cropsight/crop-info/{crop_type}` | CropSight reference text for NDVI/rainfall |

The older zoning route remains for compatibility; the current Soil Zoning screen uses v2. Similarly, the older CropSight Streamlit/prototype files are not the path used by the current React UI.

Compatibility aliases also exist for the older `/api/v1/zoning/run`, `/api/v1/crop-fit/evaluate`, and `/api/v1/monitoring/soilgrids` paths. The `/v1` and `/api/v1` route forms call the same respective handlers; telemetry and leaf routes use the `/v1` prefix.

## 10. How to run the local application

The root README is the source for current setup requirements. At a high level, the backend is run from `services/zoning` on port 8000, and the Vite frontend is run from the repository root on port 5173:

~~~powershell
# Terminal 1: from services/zoning, after creating the venv and installing requirements
python -m uvicorn app.main:app --reload --port 8000

# Terminal 2: from the repository root, after npm install
npm run dev
~~~

The frontend defaults to the local API at `http://127.0.0.1:8000`; `VITE_ZONING_API_URL` can override that base and `VITE_CROPSIGHT_API_URL` can set CropSight’s URL separately. The backend can restrict allowed browser origins with `CORS_ORIGINS`. Earth Engine access is a separate setup requirement for CropSight: the backend supports an `EARTHENGINE_PROJECT` environment variable and expects the machine’s Earth Engine authentication/project setup to work. Soil Zoning, Soil Investigation’s local register, replay, and leaf inference do not require a live Earth Engine query.

## 11. ML and analysis methods at a glance

| Method | Where used | What goes in | What comes out | How to interpret it |
| --- | --- | --- | --- | --- |
| IDW | Soil Zoning | Measured sample coordinates and one property at a time | Estimated value per grid cell | Spatial interpolation, not a learned classifier |
| Z-score standardization | Soil Zoning before clustering | Five cell-property estimates | Comparable scaled features | Changes scale; it does not improve measurement quality |
| K-means | Soil Zoning, optionally CropSight | Soil profile vectors in zoning; single NDVI band in CropSight | Hard cluster labels | Unsupervised grouping; IDs are arbitrary |
| Fuzzy C-means | Soil Zoning default | Same standardized soil profiles | Membership across clusters plus a winning label | Membership is not calibrated probability |
| Silhouette | Soil Zoning Auto-K | Candidate hard partitions and scaled profiles | Separation score per K | Chooses a geometrically separated partition, not agronomic truth |
| SHI | Soil Zoning | Interpolated pH, EC, N, P, K | Project-defined 0–100 screen | Hand-coded score; separate from clustering |
| GRU | Historical replay | 24 hours of five 10-minute sensor/weather features | Humidity-signal values at +6/+12/+24 h | Supervised sequence model; loses to persistence on this holdout |
| Isolation Forest | Historical replay | Sensor values and changes | Outlier-review flag and score | Unsupervised anomaly screen, not a fault diagnosis |
| MobileNetV3-Small CNN | Leaf Diagnosis | RGB leaf image | Ranked one-of-17 class scores | Supervised image classification; scores are uncalibrated |

A clustering algorithm does not know the names “good soil” or “bad soil.” It only groups inputs that are numerically similar under its chosen distance rule. Crop Fit, SHI, IDW, SoilGrids, and NDVI each answer different questions.

## 12. Abbreviation and term glossary

### Project, data, and geography

| Short form | Full form or plain-language meaning |
| --- | --- |
| AOI | Area of Interest; the circular region queried by CropSight |
| API | Application Programming Interface; a defined way for the browser and services to exchange requests and responses |
| ARI | Adjusted Rand Index; a score comparing two cluster/zone partitions while adjusting for chance agreement |
| B4 / B8 | Sentinel-2 Band 4 (red) / Band 8 (near-infrared) |
| CC BY 4.0 | Creative Commons Attribution 4.0 International license |
| CEC | Cation Exchange Capacity; a soil measure related to the amount of positively charged nutrients soil can hold |
| CHIRPS | Climate Hazards Group InfraRed Precipitation with Station data |
| CNN | Convolutional Neural Network; a neural network commonly used for images |
| CORS | Cross-Origin Resource Sharing; a browser security setting that controls which website origins may call an API |
| CSS | Cascading Style Sheets; the language used to style web pages |
| CRS | Coordinate Reference System; defines how map coordinates relate to Earth |
| CSV | Comma-Separated Values; a plain-text table format |
| DOI | Digital Object Identifier; a persistent identifier for a publication or dataset |
| EC | Electrical Conductivity; a measure affected by dissolved salts and the test method |
| ECe | Electrical conductivity of a saturated soil-paste extract; a specific salinity measurement context |
| Earth Engine / GEE | Google Earth Engine; Google’s cloud geospatial processing platform |
| EPSG | Historically, European Petroleum Survey Group; its geodetic parameter dataset assigns CRS codes such as EPSG:4326 |
| EXIF | Exchangeable Image File Format; metadata that can include image orientation or camera/location details |
| FAO | Food and Agriculture Organization of the United Nations |
| FCM | Fuzzy C-means; clustering that gives each item a membership across clusters |
| FPC | Fuzzy Partition Coefficient; a summary of how crisp the FCM memberships are |
| GeoJSON | Geographic JavaScript Object Notation; a JSON format for geographic features |
| GRU | Gated Recurrent Unit; a recurrent neural-network layer for sequence data |
| GET | HTTP method commonly used to read or retrieve a resource |
| HTTP / HTTPS | Hypertext Transfer Protocol / Hypertext Transfer Protocol Secure |
| ID | Identifier; a value used to distinguish a sample, cell, run, or other record |
| IDW | Inverse Distance Weighting; nearer samples contribute more to an estimate |
| ISRIC | International Soil Reference and Information Centre, the SoilGrids provider |
| JPEG | Joint Photographic Experts Group image format |
| JSON | JavaScript Object Notation; a structured text format used by the APIs |
| K | The requested number of clusters; it is a parameter, not an abbreviation |
| K-means++ | A method for choosing spread-out initial centres for K-means |
| LOOCV | Leave-One-Out Cross-Validation; hide one sample at a time to check predictions against known samples |
| MAE | Mean Absolute Error; average absolute difference between predicted and observed values |
| ML | Machine Learning |
| MSI | MultiSpectral Instrument; the imaging instrument on Sentinel-2 |
| N / P / K | Nitrogen / Phosphorus / Potassium |
| NPK | Short form for nitrogen, phosphorus, and potassium considered together |
| NDVI | Normalized Difference Vegetation Index |
| NIR | Near-Infrared light |
| NLL | Negative Log-Likelihood; a measure of how much probability a classifier assigned to the correct class |
| OGC | Open Geospatial Consortium; publishes standards such as WCS |
| pH | Conventionally expanded as “potential of hydrogen”; a logarithmic measure of acidity/alkalinity |
| RGB | Red, Green, Blue colour channels |
| REST | Representational State Transfer; a common style for web APIs |
| RH / %RH | Relative Humidity / the percentage-style unit reported by the trial’s sensor |
| RMSE | Root Mean Squared Error; error metric that gives larger errors more influence |
| SHA-256 | Secure Hash Algorithm with a 256-bit digest; used to check that pinned files and model weights match their recorded hashes |
| SHI | Soil Health Index; here, the project’s own screening score |
| SOC | Soil Organic Carbon |
| TAW | Total Available Water; FAO-56 water held between field capacity and wilting point over a root depth |
| TOA | Top of Atmosphere; the Sentinel-2 reflectance product used by the current CropSight code |
| UTC | Coordinated Universal Time |
| UI | User Interface; the screens and controls through which a person uses the application |
| URL | Uniform Resource Locator; a web address |
| UTM | Universal Transverse Mercator; a metre-based map projection chosen by geographic zone |
| VWC | Volumetric Water Content; water volume per soil volume, expressed here as m³/m³ |
| WCS | Web Coverage Service; an OGC standard for querying geospatial coverage/raster data |
| Weka | Waikato Environment for Knowledge Analysis; the data-mining toolkit whose K-means clusterer CropSight calls through Earth Engine |
| WGS84 | World Geodetic System 1984; the latitude/longitude reference system used by the input boundary |
| WSN | Wireless Sensor Network |
| WS | WebSocket; a persistent connection used here to send replay snapshots |
| L1C | Sentinel-2 Level-1C processing product; the collection used here is top-of-atmosphere reflectance |
| NRCS | Natural Resources Conservation Service, an agency of the United States Department of Agriculture |
| PNG | Portable Network Graphics image format |
| Q05 / Q50 / Q95 | The 5th, 50th (median), and 95th percentiles returned for SoilGrids |
| POST | HTTP method commonly used to submit data for processing or creation |
| RAW | Readily Available Water; the FAO-56 fraction of TAW before the threshold is reached |
| USDA | United States Department of Agriculture |
| SVG | Scalable Vector Graphics; the format used for the 2D field map |
| TXT | Text file extension; the telemetry bundle retains the source README.TXT |
| MiB | Mebibyte; 1,048,576 bytes (the leaf upload limit is 10 MiB) |
| cm | Centimetre |
| m | Metre |
| m² | Square metre |
| m³ | Cubic metre |
| dS/m | Decisiemens per metre, an EC unit |
| mg/kg | Milligrams per kilogram, used for the zoning N/P/K inputs |
| µS/cm | Microsiemens per centimetre, used for the trial’s soil EC signal |
| mm/day | Millimetres of precipitation per day |
| nm | Nanometre; a unit of wavelength |
| g/kg | Grams per kilogram |
| cmol(c)/kg | Centimoles of electrical charge per kilogram, the unit used for SoilGrids CEC |
| kg/dm³ | Kilograms per cubic decimetre, the unit used for SoilGrids bulk density |
| °C | Degrees Celsius |
| 2D / 3D | Two-dimensional / three-dimensional; the zoning map has a 2D view and optional 3D view |

### Model, statistics, and agronomy terms

| Term | Meaning in this project |
| --- | --- |
| Accuracy | Fraction of test images whose top predicted class matches the label |
| Adam | Adaptive Moment Estimation; an optimizer used to adjust neural-network weights during training |
| BatchNormalization | A neural-network layer; the leaf model’s fine-tuning stage keeps these backbone layers frozen |
| Dropout | Training technique that temporarily disables part of a layer to reduce over-reliance on specific activations |
| F1 | Harmonic mean of precision and recall; macro-F1 averages the class-wise F1 scores equally |
| Field capacity (FC) | Water content after excess water has drained from soil |
| Inertia | K-means sum of squared distances from each cell to its assigned centre |
| Macro-precision / macro-recall | Precision / recall calculated for each class and averaged equally across classes |
| Median composite | Per-pixel median across the filtered satellite images |
| Precision | Of items predicted as a class, the share that truly belongs to it |
| Recall | Of items truly in a class, the share the model identifies |
| Silhouette | A score comparing a point’s average distance to its own cluster with its distance to the nearest other cluster |
| Softmax | Output transformation that makes class scores sum to 1; it does not by itself calibrate them as correctness probabilities |
| Wilting point (WP) | Soil water content below which a plant generally cannot extract water effectively |
| Huber loss | Training loss that is quadratic for small errors and less sensitive to very large errors than squared error |
| Persistence baseline | Forecast that holds the latest observed target value constant into the future |
| Contamination | Isolation Forest setting for the expected fraction of outlying training observations; here set to 2% |
| Depletion fraction (p) | FAO-56 fraction of total available water that may be depleted before the threshold is reached |
| Rooting depth | Effective crop root depth used in the FAO-56 available-water calculation |
| Softmax score | Relative model output among its supported classes, not a verified chance of correctness |

## 13. Reference documents

The project’s current setup and feature summary is in the [root README](../README.md). The current service notes are the [Soil Zoning README](../services/zoning/README.md), [Telemetry README](../services/telemetry/README.md), [Leaf Diagnosis README](../services/leaf/README.md), and [CropSight README](../services/cropsight/README.md). The plans index and phase notes are in [docs/plans/README.md](plans/README.md), with individual notes for [the zoning backend](plans/phase-1-backend-algorithmic-core.md), [the zoning UI](plans/phase-2-soil-zoning-ui-redesign.md), [telemetry](plans/phase-3-wsn-telemetry-service.md), [Field Monitoring](plans/phase-4-field-monitoring-transformation.md), and [Leaf Diagnosis](plans/phase-5-leaf-contract-and-verification.md). The [domain glossary](../GLOSSARY.md) adds project terminology. The older [Project Plan](Project-Plan.md) is marked as superseded planning history, so planned features there should not be assumed to be present.

The satellite descriptions above can be checked against the official Earth Engine catalog pages for [Sentinel-2 Harmonized](https://developers.google.com/earth-engine/datasets/catalog/COPERNICUS_S2_HARMONIZED) and [CHIRPS Daily](https://developers.google.com/earth-engine/datasets/catalog/UCSB-CHG_CHIRPS_DAILY). The CropSight implementation should be read from `services/cropsight/main.py`; the separate files under `services/cropsight/modules/` belong to an older prototype.

