# KshetraSense zoning service

Local FastAPI service for legacy grid zoning, field-scale sparse-sample zoning, and zone-level crop-fit screening. It is deliberately independent from the browser UI and from leaf diagnosis / field monitoring.

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

The interactive OpenAPI contract is then available at `http://127.0.0.1:8000/docs`. The service permits the local Vite origins `http://localhost:5173` and `http://127.0.0.1:5173`; extend `CORS_ORIGINS` only for an intentional local port change.

Run focused tests with:

```powershell
python -m pytest -q
```

## Endpoints

| Endpoint | Purpose |
| --- | --- |
| `GET /health` | Local service status and algorithm/rule versions. |
| `POST /v1/zoning/run` | Validate cells and run `kmeans` or `fuzzy-c-means`. |
| `POST /v2/zoning/run` | Run the boundary + sparse-sample field pipeline and return per-cell estimates, contiguous zones, diagnostics, and candidate locations. |
| `POST /v1/crop-fit/evaluate` | Evaluate a caller-supplied selected-zone mean profile. |

`/v1/crop-fit/evaluate` intentionally takes measurements and their declared scope/context, not a zone ID, clustering assignment, or membership value. It therefore cannot influence or reinterpret zoning.

For the host UI, `/api/v1/zoning/run` is a compatibility alias. It accepts both the documented nested-cell request and the UI's compact request: `cluster_count`, `method: "fuzzy-c-means"`, and flat cell measurements. The response exposes the compact `assignments` map, plus `assignmentDetails` with coordinates and FCM memberships.

The current frontend still uses the v1 grid endpoint. Phase 2 migrates Soil Zoning to v2 and calls `/v1/crop-fit/evaluate` for a user-selected zone; the v2 endpoint itself does not run or persist Crop Fit.

The v2 request requires pH, EC, nitrogen, phosphorus, and potassium for every sample, with a common explicit `depthCm`. Units are pH (dimensionless), EC (dS/m), and N/P/K (mg/kg). Cell size is 5 or 10 m; the request is capped at 5,000 retained grid cells. A lab sample is measured input; returned per-cell values are IDW estimates. The response records `processingDurationMs` for the completed field pipeline.

## Data and evidence boundaries

The crop profiles currently assess only pH. N/P/K, EC, soil temperature, moisture, drainage, texture, rooting depth, climate, cultivar, and management are returned as **not assessed** rather than invented rules. The documented pH ranges are contextual examples retained with source URLs; they are not a complete land-suitability evaluation. See `docs/research/crop-suitability-probability.md` in the repository for the product evidence boundary.

The KshetraSense SHI is a versioned provisional score, not an official USDA/NRCS index, a crop-specific score, or a probability. The stability report is sensitivity under declared noise assumptions, not a confidence interval. Medoid and gateway outputs are geometric suggestions; `radioCoverageValidated` is false.

All results are request-local: this service neither persists field data nor calls external APIs. A production host must decide persistence, access control, and audit storage separately.
