# CropSight Remote Sensing Sub-Service

[![FastAPI](https://img.shields.io/badge/FastAPI-Sub--App-009688.svg?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Google Earth Engine](https://img.shields.io/badge/Google_Earth_Engine-API-4285F4.svg?logo=google&logoColor=white)](https://earthengine.google.com)
[![Copernicus Sentinel-2](https://img.shields.io/badge/Copernicus-Sentinel--2-004B87.svg)](https://developers.google.com/earth-engine/datasets/catalog/COPERNICUS_S2_HARMONIZED)
[![CHIRPS Daily](https://img.shields.io/badge/CHIRPS-Precipitation-brightgreen.svg)](https://developers.google.com/earth-engine/datasets/catalog/UCSB-CHG_CHIRPS_DAILY)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](../../LICENSE)

CropSight is an independent remote sensing sub-service integrated into **KshetraSense** for satellite vegetation monitoring. It retrieves Copernicus Sentinel-2 surface reflectance imagery and CHIRPS daily precipitation data via Google Earth Engine to compute Normalized Difference Vegetation Index (NDVI) statistics, time-series trajectories, and exploratory spatial clustering.

Integrated and adapted from the open-source repository [Priyam-28/CropSight](https://github.com/Priyam-28/CropSight). Distributed as part of KshetraSense under the project's [MIT License](../../LICENSE).

---

## 🛰️ Integration Architecture in KshetraSense

In KshetraSense, CropSight is mounted as a FastAPI sub-application under `/cropsight` and `/api/v1/cropsight` by `services/zoning/app/main.py`. The React frontend calls this endpoint from the **Vegetation Monitoring** tab in the Field Monitoring workspace.

```
React Client ────> POST /cropsight/analyze-field ────> Google Earth Engine
                                                         ├── Copernicus Sentinel-2
                                                         └── CHIRPS Rainfall
```

### Data Boundaries & Truthful Representation
- **Decoupled Workflow**: CropSight operates on its own circular Area of Interest (center latitude/longitude and radius) and date window; it does not read or write Soil Zoning or Crop Fit state.
- **Aggregate Output**: The FastAPI response returns aggregate NDVI statistics (mean, std, min, max), a per-scene NDVI time-series, and rainfall context. It does not return raster pixels or cadastral zone boundaries.
- **No Substitute Data**: If Earth Engine authentication is missing or cloud coverage prevents retrieval, the service returns an explicit HTTP 500 error detailing the issue rather than serving fabricated satellite imagery.

---

## 📡 API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/cropsight/` | `GET` | Root health check and service description |
| `/cropsight/health` | `GET` | Sub-application health status (`{"status": "healthy"}`) |
| `/cropsight/crop-info/{crop}` | `GET` | Returns baseline NDVI reference range and optimal rainfall for specified crop |
| `/cropsight/analyze-field` | `POST` | Fetches Sentinel-2 imagery, calculates median NDVI, extracts time-series, and clusters vegetation |

### Analyze Field Payload Example
```json
{
  "latitude": 30.9015,
  "longitude": 75.8524,
  "buffer_size": 250,
  "start_date": "2026-01-01",
  "end_date": "2026-03-31",
  "clustering_method": "K-Means",
  "num_zones": 3,
  "crop_type": "Wheat",
  "crop_growth_stage": "Vegetative"
}
```

---

## ⚙️ Configuration & Prerequisites

### 1. Google Earth Engine Setup
Live satellite queries require an active Google Earth Engine account.

Authenticate on your machine:
```bash
earthengine authenticate
```

### 2. Environment Variables
Configure your GCP Project ID in `.env` (or `services/cropsight/.env`):
```env
EARTHENGINE_PROJECT=your-gcp-earthengine-project-id
```

If not configured, the service defaults to `kshetrasense-earth-engine`.

---

## 🧪 Testing

The CropSight integration is verified as part of the KshetraSense backend test suite:

```powershell
services\zoning\.venv\Scripts\python.exe -m pytest services/zoning/tests/test_monitoring_api.py -v
```

---

## 📜 Attribution & License

- **Upstream Author**: [Priyam-28](https://github.com/Priyam-28/CropSight)
- **License**: MIT License
- **Data Providers**: European Space Agency (Copernicus Sentinel-2), Climate Hazards Center UC Santa Barbara (CHIRPS), Google Earth Engine.
