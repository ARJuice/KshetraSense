# KshetraSense zoning service

Local FastAPI service for legacy grid zoning, field-scale sparse-sample zoning, zone-level crop-fit screening, and the isolated historical telemetry replay API. It is deliberately independent from the browser UI and does not share state between zoning, Crop Fit, and telemetry.

## What it does

- Runs real K-means++ / Lloyd iterations or Bezdek Fuzzy C-means (FCM) over the selected soil features. The compact NumPy implementations are local and deterministic, rather than fixture lookups.
- Uses a recorded feature-wise z-score normalization policy and returns its parameters.
- Excludes incomplete cells rather than silently imputing values; excludes constant features because they cannot distinguish zones.
- Returns assignments, raw and normalized centroids, zone summaries, grid adjacency, a silhouette diagnostic, and FCM memberships when applicable.
- Evaluates caller-supplied selected-zone means or a selected-cell profile against the limited, versioned crop-profile rules in `app/crop_profiles.py`. It is an independent, per-crop compatibility screen—not a probability, crop ranking, yield estimate, or prescription.
- Runs `POST /v2/zoning/run` from a WGS84 GeoJSON Polygon plus 3–50 georeferenced samples (5–10 recommended): IDW p=2 estimates, project-defined SHI, silhouette Auto-K K-means/FCM, adjacent-profile merging, connected-component splitting, sample-perturbation sensitivity, and geometric WSN/gateway candidates.

## Run locally

From this directory, create an isolated environment and install dependencies:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```

The interactive OpenAPI contract is then available at `http://127.0.0.1:8000/docs`. The service permits the local Vite origins on ports 3000 and 5173 for both `localhost` and `127.0.0.1`; set `CORS_ORIGINS` only when intentionally using another origin.

Run focused tests with:

```powershell
python -m pytest -q
```

## Endpoints

| Endpoint | Purpose |
| --- | --- |
| `GET /health` | Local service status and algorithm/rule versions. |
| `GET /v1/telemetry/health` | Verify pinned historical data and model readiness; does not indicate a live sensor connection. |
| `GET /v1/telemetry/metadata`, `/state`, `/stream`, `/history` | Dataset provenance, replay state, current historical observations, and bounded history. |
| `POST /v1/telemetry/control` | Play/pause, bounded UTC seek, or set playback speed (1/10/60/360). |
| `WS /v1/telemetry/ws` | Read-only historical snapshots. |
| `POST /v1/telemetry/water-balance/advisory` | Independent FAO-56 TAW/RAW screen; requires explicit VWC fractions and site calibration inputs. |
| `GET /cropsight/health`, `POST /cropsight/analyze-field` | Optional CropSight sub-application, mounted only when its Python imports are available; live Earth Engine access still requires user configuration. Aliased under `/api/v1/cropsight/`. |
| `GET /v1/monitoring/soilgrids` | Validates coordinates/property/depth; returns HTTP 503 until a real, verified ISRIC data provider is configured. It never estimates from coordinates. |
| `POST /v1/zoning/run` | Validate cells and run `kmeans` or `fuzzy-c-means`. |
| `POST /v2/zoning/run` | Run the boundary + sparse-sample field pipeline and return per-cell estimates, contiguous zones, diagnostics, and candidate locations. |
| `POST /v1/crop-fit/evaluate` | Evaluate a caller-supplied selected-cell or selected-zone profile. |

`/v1/crop-fit/evaluate` intentionally takes measurements and their declared scope/context, not a zone ID, clustering assignment, or membership value. It therefore cannot influence or reinterpret zoning.

SoilGrids is intentionally unavailable in the current build. The previous local coordinate-derived formula was not backed by SoilGrids data and has been removed. ISRIC currently reports the beta REST API paused and points users to WCS for spatial subsets or WebDAV for global VRT products ([ISRIC access FAQ](https://docs.isric.org/globaldata/soilgrids/SoilGrids_faqs_02.html)). Do not return a successful prediction until a real provider path, property/depth/unit mapping, source metadata, and uncertainty handling have been verified.

CropSight is mounted as a sub-application under `/cropsight` (and `/api/v1/cropsight`) only if its imports succeed in the zoning environment; `GET /health` exposes `cropsightMounted` for this mount state. That flag means the app mounted, not that Earth Engine authentication, project access, quota, or imagery coverage is valid. Install/configure its dependencies and Earth Engine access before attempting live analysis. The current API response does not return raster or spatial-zone outputs; the host UI intentionally shows only validated aggregate/time-series fields.

For the host UI, `/api/v1/zoning/run` is a compatibility alias. It accepts both the documented nested-cell request and the UI's compact request: `cluster_count`, `method: "fuzzy-c-means"`, and flat cell measurements. The response exposes the compact `assignments` map, plus `assignmentDetails` with coordinates and FCM memberships.

The current Soil Zoning workspace uses `/v2/zoning/run` and then calls `/v1/crop-fit/evaluate` for an explicitly selected cell or zone mean; the zoning endpoint itself does not run or persist Crop Fit. The `/v1/zoning/run` endpoint remains available to older consumers.

The v2 request requires pH, EC, nitrogen, phosphorus, and potassium for every sample, with a common explicit `depthCm`. Units are pH (dimensionless), EC (dS/m), and N/P/K (mg/kg). Cell size is 5 or 10 m; the request is capped at 5,000 retained grid cells. A lab sample is measured input; returned per-cell values are IDW estimates. Each cell's `geometry` is its exact WGS84 Polygon/MultiPolygon footprint clipped to the field boundary. The response records `processingDurationMs` for the completed field pipeline.

The frontend displays all supported cells in 2D. Its optional 3D scene is lazy-loaded and disabled above 768 cells or a conservative 20,000-triangle scene estimate; this renderer cap does not reduce the service's 5,000-cell API limit.

## Data and evidence boundaries

The crop profiles currently assess only pH. N/P/K, EC, soil temperature, moisture, drainage, texture, rooting depth, climate, cultivar, and management are returned as **not assessed** rather than invented rules. The documented pH ranges are contextual examples retained with source URLs; they are not a complete land-suitability evaluation. See `docs/research/crop-suitability-probability.md` in the repository for the product evidence boundary.

The KshetraSense SHI is a versioned provisional score, not an official USDA/NRCS index, a crop-specific score, or a probability. The stability report is sensitivity under declared noise assumptions, not a confidence interval. Medoid and gateway outputs are geometric suggestions; `radioCoverageValidated` is false.

The telemetry routes replay the pinned [Mendeley v2 Parma tomato trial](../telemetry/data/README.md), not a user's field or live devices. Soil humidity remains the source-reported `%RH` signal—not VWC—and the current GRU does not beat persistence at 6/12/24 hours, so it is evaluation-only. Isolation Forest output is a review candidate, not a fault diagnosis. No route controls a valve or binds trial lines to zones. See [`services/telemetry/README.md`](../telemetry/README.md) for route, model, data, and safety details.

All results are request-local: this service neither persists field data nor calls external APIs. A production host must decide persistence, access control, and audit storage separately.
