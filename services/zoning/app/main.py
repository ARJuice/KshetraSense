from __future__ import annotations

import os

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.crop_fit import evaluate_crop_fit
from app.crop_profiles import PROFILE_VERSION
from app.schemas import CropFitRequest, CropFitResponse, ZoningRequest, ZoningRunResponse
from app.service import ALGORITHM_VERSION, ZoningValidationError, run_zoning


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
    title="KshetraSense Zoning Service",
    version=ALGORITHM_VERSION,
    description="Local deterministic K-means/FCM zoning and zone-level crop-fit screening.",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "service": "kshetrasense-zoning",
        "algorithmVersion": ALGORITHM_VERSION,
        "cropProfileVersion": PROFILE_VERSION,
    }


@app.post("/v1/zoning/run")
@app.post("/api/v1/zoning/run", include_in_schema=False)
def zoning_run(request: ZoningRequest) -> ZoningRunResponse:
    try:
        return run_zoning(request)
    except ZoningValidationError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@app.post("/v1/crop-fit/evaluate")
@app.post("/api/v1/crop-fit/evaluate", include_in_schema=False)
def crop_fit_evaluate(request: CropFitRequest) -> CropFitResponse:
    try:
        return evaluate_crop_fit(request)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
