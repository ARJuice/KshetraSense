from __future__ import annotations

import asyncio
import math
from datetime import datetime
from typing import Literal

from fastapi import APIRouter, HTTPException, Query, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, ConfigDict, Field, model_validator

from .playback import PlaybackRangeError, datetime_to_epoch_ms
from .service import TelemetryService, get_telemetry_service
from .water_balance import evaluate_fao56_advisory

router = APIRouter(prefix="/v1/telemetry", tags=["telemetry"])


class PlaybackControlRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    action: Literal["play", "pause", "seek", "set_speed"]
    speed: Literal[1, 10, 60, 360] | None = None
    timestamp: datetime | None = None

    @model_validator(mode="after")
    def validate_action_fields(self) -> "PlaybackControlRequest":
        if self.action == "seek":
            if self.timestamp is None or self.speed is not None:
                raise ValueError("seek requires timestamp and does not accept speed")
        elif self.timestamp is not None:
            raise ValueError("timestamp is only accepted for seek")
        if self.action == "set_speed":
            if self.speed is None:
                raise ValueError("set_speed requires speed")
        elif self.speed is not None:
            raise ValueError("speed is only accepted for set_speed")
        return self


class WaterBalanceAdvisoryRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    currentVwcFraction: float = Field(ge=0.0, le=1.0)
    forecastVwcFractions: list[float] = Field(default_factory=list, max_length=24)
    fieldCapacityVwcFraction: float = Field(gt=0.0, le=1.0)
    wiltingPointVwcFraction: float = Field(ge=0.0, le=1.0)
    rootingDepthM: float = Field(gt=0.0, le=5.0)
    depletionFraction: float = Field(ge=0.1, le=0.8)
    calibrationSource: str = Field(min_length=3, max_length=256)

    @model_validator(mode="after")
    def validate_water_content_order(self) -> "WaterBalanceAdvisoryRequest":
        numeric_values = [
            self.currentVwcFraction,
            self.fieldCapacityVwcFraction,
            self.wiltingPointVwcFraction,
            self.rootingDepthM,
            self.depletionFraction,
            *self.forecastVwcFractions,
        ]
        if not all(math.isfinite(value) for value in numeric_values):
            raise ValueError("All water-balance numeric inputs must be finite")
        if self.wiltingPointVwcFraction >= self.fieldCapacityVwcFraction:
            raise ValueError("wiltingPointVwcFraction must be below fieldCapacityVwcFraction")
        if not self.calibrationSource.strip():
            raise ValueError("calibrationSource must not be blank")
        return self


def _service() -> TelemetryService:
    try:
        return get_telemetry_service()
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail=f"Historical telemetry is unavailable: {exc}",
        ) from exc


@router.get("/health")
def telemetry_health() -> dict:
    return _service().readiness()


@router.get("/metadata")
def telemetry_metadata() -> dict:
    return _service().metadata()


@router.get("/state")
def telemetry_state() -> dict:
    return _service().playback_state()


@router.post("/control")
def telemetry_control(request: PlaybackControlRequest) -> dict:
    service = _service()
    try:
        timestamp_ms = datetime_to_epoch_ms(request.timestamp) if request.timestamp is not None else None
        return service.control_playback(request.action, speed=request.speed, timestamp_ms=timestamp_ms)
    except PlaybackRangeError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.get("/stream")
def telemetry_stream(
    line_id: int | None = Query(default=None, ge=1, le=3),
) -> dict:
    return _service().snapshot(line_id)


@router.get("/history")
def telemetry_history(
    start: datetime,
    end: datetime,
    line_id: int = Query(ge=1, le=3),
    limit: int = Query(default=1000, ge=1, le=2000),
) -> dict:
    service = _service()
    try:
        start_ms = datetime_to_epoch_ms(start)
        end_ms = datetime_to_epoch_ms(end)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    if start_ms > end_ms:
        raise HTTPException(status_code=422, detail="start must not be after end")
    return service.history(line_id=line_id, start_ms=start_ms, end_ms=end_ms, limit=limit)


@router.post("/water-balance/advisory")
def water_balance_advisory(request: WaterBalanceAdvisoryRequest) -> dict:
    try:
        return evaluate_fao56_advisory(
            current_vwc_fraction=request.currentVwcFraction,
            forecast_vwc_fractions=request.forecastVwcFractions,
            field_capacity_vwc_fraction=request.fieldCapacityVwcFraction,
            wilting_point_vwc_fraction=request.wiltingPointVwcFraction,
            rooting_depth_m=request.rootingDepthM,
            depletion_fraction=request.depletionFraction,
            calibration_source=request.calibrationSource,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.websocket("/ws")
async def telemetry_websocket(websocket: WebSocket) -> None:
    try:
        service = _service()
    except HTTPException as exc:
        await websocket.close(code=1013, reason="Historical telemetry unavailable")
        return
    await websocket.accept()
    try:
        while True:
            await websocket.send_json(service.snapshot())
            await asyncio.sleep(1)
    except WebSocketDisconnect:
        return
    except RuntimeError:
        return
