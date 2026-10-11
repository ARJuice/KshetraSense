# KshetraSense zoning service

Local FastAPI service for deterministic soil zoning and zone-level crop-fit screening. It is deliberately independent from the browser UI and from leaf diagnosis / field monitoring.

## What it does

- Runs real K-means++ / Lloyd iterations or Bezdek Fuzzy C-means (FCM) over the selected soil features. The compact NumPy implementations are local and deterministic, rather than fixture lookups.
- Uses a recorded feature-wise z-score normalization policy and returns its parameters.
- Excludes incomplete cells rather than silently imputing values; excludes constant features because they cannot distinguish zones.
- Returns assignments, raw and normalized centroids, zone summaries, grid adjacency, a silhouette diagnostic, and FCM memberships when applicable.
- Evaluates the selected zone's mean values against the limited, versioned crop-profile rules in `app/crop_profiles.py`. It is an independent, per-crop compatibility screen—not a probability, crop ranking, yield estimate, or prescription.

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
| `POST /v1/crop-fit/evaluate` | Evaluate a caller-supplied selected-zone mean profile. |

`/v1/crop-fit/evaluate` intentionally takes only selected-zone measurements and context. It does not accept a zone ID, clustering assignment, or membership value, so it cannot influence or reinterpret zoning.

For the host UI, `/api/v1/zoning/run` is a compatibility alias. It accepts both the documented nested-cell request and the UI's compact request: `cluster_count`, `method: "fuzzy-c-means"`, and flat cell measurements. The response exposes the compact `assignments` map, plus `assignmentDetails` with coordinates and FCM memberships.

## Data and evidence boundaries

The crop profiles currently assess only pH. N/P/K, EC, soil temperature, moisture, drainage, texture, rooting depth, climate, cultivar, and management are returned as **not assessed** rather than invented rules. The documented pH ranges are contextual examples retained with source URLs; they are not a complete land-suitability evaluation. See `docs/research/crop-suitability-probability.md` in the repository for the product evidence boundary.

All results are request-local: this service neither persists field data nor calls external APIs. A production host must decide persistence, access control, and audit storage separately.
