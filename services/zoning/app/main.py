from __future__ import annotations

import os
import sys
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

project_root = Path(__file__).resolve().parents[3]
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

from services.telemetry.app.router import router as telemetry_router

from app.crop_fit import evaluate_crop_fit
from app.crop_profiles import PROFILE_VERSION
from app.schemas import (
    CropFitRequest,
    CropFitResponse,
    FieldZoningRequest,
    FieldZoningResponse,
    ZoningRequest,
    ZoningRunResponse,
)
from app.service import ALGORITHM_VERSION, ZoningValidationError, run_field_zoning, run_zoning
from app.soilgrids import (
    SOILGRIDS_VERSION,
    SoilGridsUnavailable,
    get_soilgrids_context,
)


def _cors_origins() -> list[str]:
    configured = os.getenv("CORS_ORIGINS")
    if configured:
        return [origin.strip() for origin in configured.split(",") if origin.strip()]
    return [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]


app = FastAPI(
    title="KshetraSense Analysis & Monitoring Service",
    version=ALGORITHM_VERSION,
    description="Local soil zoning and crop-fit, SoilGrids context, independent CropSight integration, and historical telemetry replay.",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(telemetry_router)

# Mount CropSight as an independent sub-application if available
cropsight_mounted = False
try:
    from services.cropsight.main import app as cropsight_app
    app.mount("/cropsight", cropsight_app)
    app.mount("/api/v1/cropsight", cropsight_app)
    cropsight_mounted = True
except Exception:
    cropsight_mounted = False


@app.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "service": "kshetrasense-zoning-and-monitoring",
        "algorithmVersion": ALGORITHM_VERSION,
        "cropProfileVersion": PROFILE_VERSION,
        "soilGridsVersion": SOILGRIDS_VERSION,
        "soilGridsStatus": "unavailable-until-verified-provider-configured",
        "cropsightMounted": cropsight_mounted,
    }


@app.post("/v1/zoning/run")
@app.post("/api/v1/zoning/run", include_in_schema=False)
def zoning_run(request: ZoningRequest) -> ZoningRunResponse:
    try:
        return run_zoning(request)
    except ZoningValidationError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@app.post("/v2/zoning/run", response_model=FieldZoningResponse)
def field_zoning_run(request: FieldZoningRequest) -> FieldZoningResponse:
    try:
        return run_field_zoning(request)
    except ZoningValidationError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@app.post("/v1/crop-fit/evaluate")
@app.post("/api/v1/crop-fit/evaluate", include_in_schema=False)
def crop_fit_evaluate(request: CropFitRequest) -> CropFitResponse:
    try:
        return evaluate_crop_fit(request)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@app.get("/v1/monitoring/soilgrids")
@app.get("/api/v1/monitoring/soilgrids", include_in_schema=False)
def soilgrids_endpoint(
    latitude: float = Query(..., ge=-90.0, le=90.0, description="WGS84 latitude"),
    longitude: float = Query(..., ge=-180.0, le=180.0, description="WGS84 longitude"),
    property: str = Query("phh2o", description="Soil property (e.g. phh2o, nitrogen, soc, cec, bdod, clay, sand, silt)"),
    depth: str = Query("0-5cm", description="Depth interval (e.g. 0-5cm, 5-15cm, 15-30cm, 30-60cm, 60-100cm, 100-200cm)"),
) -> dict:
    try:
        return get_soilgrids_context(latitude, longitude, property, depth)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except SoilGridsUnavailable as error:
        raise HTTPException(status_code=503, detail=str(error)) from error

