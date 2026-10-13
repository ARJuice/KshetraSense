from __future__ import annotations

from datetime import datetime, timezone
from functools import lru_cache
from importlib.metadata import version
from typing import Any

import numpy as np

from .dataset import LINE_TREATMENTS, LineData, ReplayDataset, load_replay_dataset
from .forecast import MODEL_VERSION, WINDOW_STEPS, SoilSignalForecaster
from .playback import PlaybackController


def _finite(value: Any) -> float | None:
    number = float(value)
    return number if np.isfinite(number) else None


def _observation_time(timestamp_ms: int) -> str | None:
    if timestamp_ms < 0:
        return None
    return datetime.fromtimestamp(timestamp_ms / 1000, tz=timezone.utc).isoformat().replace("+00:00", "Z")


class TelemetryService:
    def __init__(self, dataset: ReplayDataset, forecaster: SoilSignalForecaster):
        from .anomaly import apply_anomaly_screen

        self.dataset = apply_anomaly_screen(dataset)
        self.forecaster = forecaster
        self.playback = PlaybackController(self.dataset.timestamps_ms)
        self._cached_forecast_index = -1
        self._cached_forecasts: dict[int, dict[str, Any]] = {}

    def readiness(self) -> dict[str, Any]:
        return {
            "status": "ready",
            "datasetVersion": self.dataset.metadata["dataset"]["version"],
            "modelVersion": MODEL_VERSION,
            "replayIsHistorical": True,
        }

    def metadata(self) -> dict[str, Any]:
        model = self.forecaster.metadata
        dataset_metadata = {key: value for key, value in self.dataset.metadata.items() if key != "anomalyScreenFit"}
        return {
            **dataset_metadata,
            "apiVersion": "telemetry-v1",
            "forecastModel": {
                "modelVersion": model["modelVersion"],
                "framework": model["framework"],
                "featureOrder": model["featureOrder"],
                "windowSteps": model["windowSteps"],
                "horizonsHours": model["horizonsHours"],
                "sampleCounts": model["sampleCounts"],
                "splitBoundaries": model["splitBoundaries"],
                "holdoutMetrics": model["holdoutMetrics"],
                "qualityDisposition": model["qualityDisposition"],
                "limitations": model["limitations"],
            },
            "anomalyScreen": {
                **self.dataset.metadata["anomalyScreenFit"],
                "scikitLearnVersion": version("scikit-learn"),
                "interpretation": "Unsupervised review candidate, not a fault diagnosis or probability.",
            },
            "capabilities": {
                "historicalReplay": True,
                "liveTelemetry": False,
                "fao56AdvisoryRequiresCalibratedVwc": True,
                "actuation": False,
                "zoneBinding": False,
            },
        }

    def playback_state(self) -> dict[str, Any]:
        return self.playback.state()

    def control_playback(
        self,
        action: str,
        *,
        speed: int | None = None,
        timestamp_ms: int | None = None,
    ) -> dict[str, Any]:
        return self.playback.control(action, speed=speed, timestamp_ms=timestamp_ms)

    def _forecast(self, line: LineData, index: int) -> dict[str, Any]:
        if self._cached_forecast_index != index:
            self._cached_forecast_index = index
            self._cached_forecasts = {}
        if line.line_id in self._cached_forecasts:
            return self._cached_forecasts[line.line_id]

        if index + 1 < WINDOW_STEPS:
            result = {"status": "unavailable", "reason": "A complete 24-hour input window is not available yet."}
        else:
            start = index - WINDOW_STEPS + 1
            window = line.features[start : index + 1]
            if not np.isfinite(window).all():
                result = {"status": "unavailable", "reason": "The 24-hour input window contains a data gap over 30 minutes."}
            else:
                result = self.forecaster.predict(
                    window,
                    int(line.interpolated_features[start : index + 1].sum()),
                )
        self._cached_forecasts[line.line_id] = result
        return result

    def _anomaly(self, line: LineData, index: int) -> dict[str, Any]:
        if line.anomaly_candidates is None or line.anomaly_scores is None:
            return {"status": "unavailable", "reason": "Anomaly screen is unavailable."}
        score = _finite(line.anomaly_scores[index])
        if score is None:
            return {"status": "unavailable", "reason": "The current reading lacks enough prior data for screening."}
        candidate = bool(line.anomaly_candidates[index])
        return {
            "status": "review_candidate" if candidate else "no_candidate",
            "candidate": candidate,
            "score": score,
            "scoreMeaning": "Lower scores are more isolated by the unsupervised training fit; not a probability.",
            "reviewRequired": candidate,
        }

    def _line_observation(self, line: LineData, index: int) -> dict[str, Any]:
        soil_observed_at = _observation_time(int(line.soil_observation_timestamps_ms[index]))
        air_observed_at = _observation_time(int(self.dataset.air_observation_timestamps_ms[index]))
        meter_observed_at = _observation_time(int(line.meter_observation_timestamps_ms[index]))
        air = self.dataset.air_observed
        return {
            "lineId": line.line_id,
            "historicalTreatment": LINE_TREATMENTS[line.line_id],
            "soilObservation": {
                "observedAtUtc": soil_observed_at,
                "humiditySignalPctRh": _finite(line.soil_observed["humidity"][index]),
                "temperatureC": _finite(line.soil_observed["temperature"][index]),
                "electricalConductivityUsCm": _finite(line.soil_observed["electrical_conductivity"][index]),
                "batteryPercent": _finite(line.soil_battery_percent[index]),
                "humidityMeaning": "sensor-reported %RH signal; not VWC",
            },
            "sharedEnvironmentalObservation": {
                "observedAtUtc": air_observed_at,
                "temperatureC": _finite(air["temperature"][index]),
                "relativeHumidityPctRh": _finite(air["humidity"][index]),
                "co2Ppm": _finite(air["co2"][index]),
                "pressureHpa": _finite(air["pressure"][index]),
                "batteryPercent": _finite(air["battery"][index]),
                "sharedAcrossLines": True,
            },
            "waterMeter": {
                "field": "current_volume",
                "sourceReportedValue": _finite(line.meter_current_volume_source_m3[index]),
                "sourceUnit": "m³ as stated by dataset authors",
                "observedAtUtc": meter_observed_at,
                "interpretation": "Raw historical meter field; scale/semantics not independently validated; no flow or actuation inference.",
            },
        }

    def _line_snapshot(self, line: LineData, index: int) -> dict[str, Any]:
        return {
            **self._line_observation(line, index),
            "forecast": self._forecast(line, index),
            "anomalyReview": self._anomaly(line, index),
        }

    def snapshot(self, line_id: int | None = None) -> dict[str, Any]:
        state = self.playback_state()
        index = int(state["index"])
        selected = [line_id] if line_id is not None else list(LINE_TREATMENTS)
        return {
            "replayLabel": self.dataset.metadata["replayLabel"],
            "simulatedTimestampUtc": state["timestamp"],
            "playback": {key: state[key] for key in ("speed", "isPlaying", "startUtc", "endUtc")},
            "lines": [self._line_snapshot(self.dataset.lines[item], index) for item in selected],
        }

    def history(
        self,
        *,
        line_id: int,
        start_ms: int,
        end_ms: int,
        limit: int,
    ) -> dict[str, Any]:
        start_index = int(np.searchsorted(self.dataset.timestamps_ms, start_ms, side="left"))
        end_index = int(np.searchsorted(self.dataset.timestamps_ms, end_ms, side="right"))
        indices = np.arange(start_index, min(end_index, len(self.dataset.timestamps_ms)), dtype=np.int64)
        truncated = indices.size > limit
        if truncated:
            indices = np.unique(np.linspace(0, indices.size - 1, num=limit, dtype=np.int64))
            indices = np.arange(start_index, min(end_index, len(self.dataset.timestamps_ms)), dtype=np.int64)[indices]
        line = self.dataset.lines[line_id]
        return {
            "lineId": line_id,
            "historicalTreatment": LINE_TREATMENTS[line_id],
            "replayLabel": self.dataset.metadata["replayLabel"],
            "truncated": truncated,
            "samples": [
                {
                    "timestampUtc": _iso_utc(int(self.dataset.timestamps_ms[index])),
                    **self._line_observation(line, int(index)),
                }
                for index in indices
            ],
        }


def _iso_utc(timestamp_ms: int) -> str:
    return datetime.fromtimestamp(timestamp_ms / 1000, tz=timezone.utc).isoformat().replace("+00:00", "Z")


@lru_cache(maxsize=1)
def get_telemetry_service() -> TelemetryService:
    dataset = load_replay_dataset()
    forecaster = SoilSignalForecaster()
    return TelemetryService(dataset, forecaster)
