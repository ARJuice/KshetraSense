from __future__ import annotations

import csv
import hashlib
import json
import math
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np

DATA_DIR = Path(__file__).resolve().parents[1] / "data"
RAW_DIR = DATA_DIR / "raw"
MANIFEST_PATH = DATA_DIR / "manifest.json"
FEATURE_KEYS = (
    "soilHumiditySignalPctRh",
    "soilTemperatureC",
    "soilElectricalConductivityUsCm",
    "airTemperatureC",
    "airRelativeHumidityPctRh",
)
LINE_TREATMENTS = {
    1: "100% of the trial's Irriframe recommendation",
    2: "60% of the trial's Irriframe recommendation",
    3: "30% of the trial's Irriframe recommendation",
}
GRID_STEP_MS = 10 * 60 * 1000
MAX_INTERPOLATION_GAP_MS = 30 * 60 * 1000
DISPLAY_TOLERANCE_MS = 5 * 60 * 1000


class DatasetError(RuntimeError):
    """Raised when a pinned telemetry source cannot be loaded safely."""


@dataclass(frozen=True)
class ObservationStream:
    timestamps_ms: np.ndarray
    values: dict[str, np.ndarray]
    raw_rows: int
    excluded_rows: int
    missing_values: dict[str, int]


@dataclass(frozen=True)
class LineData:
    line_id: int
    features: np.ndarray
    interpolated_features: np.ndarray
    soil_observed: dict[str, np.ndarray]
    soil_observation_timestamps_ms: np.ndarray
    soil_battery_percent: np.ndarray
    meter_current_volume_source_m3: np.ndarray
    meter_observation_timestamps_ms: np.ndarray
    anomaly_candidates: np.ndarray | None = None
    anomaly_scores: np.ndarray | None = None


@dataclass(frozen=True)
class ReplayDataset:
    timestamps_ms: np.ndarray
    lines: dict[int, LineData]
    air_observed: dict[str, np.ndarray]
    air_observation_timestamps_ms: np.ndarray
    metadata: dict[str, Any]


def _read_manifest() -> dict[str, Any]:
    try:
        manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise DatasetError("Telemetry data manifest is missing or invalid.") from exc

    for item in manifest.get("files", []):
        path = DATA_DIR / item["path"]
        try:
            digest = hashlib.sha256(path.read_bytes()).hexdigest()
            size = path.stat().st_size
        except OSError as exc:
            raise DatasetError(f"Pinned telemetry source is unavailable: {path.name}.") from exc
        if digest != item["sha256"] or size != item["sizeBytes"]:
            raise DatasetError(f"Pinned telemetry source failed integrity verification: {path.name}.")
    if len(manifest.get("files", [])) != 5:
        raise DatasetError("Telemetry manifest must pin all five source files.")
    return manifest


def _number(value: str | None) -> float:
    if value is None or not value.strip() or value.strip().upper() in {"NULL", "NA", "N/A"}:
        return math.nan
    try:
        number = float(value)
    except ValueError:
        return math.nan
    return number if math.isfinite(number) else math.nan


def _load_stream(
    filename: str,
    fields: tuple[str, ...],
    *,
    line_scoped: bool,
) -> dict[int, ObservationStream] | ObservationStream:
    path = RAW_DIR / filename
    grouped: dict[int, list[tuple[int, dict[str, float]]]] = {}
    raw_rows = 0
    excluded_by_line: dict[int, int] = {}
    missing_by_line: dict[int, dict[str, int]] = {}
    try:
        handle = path.open("r", encoding="utf-8-sig", newline="")
    except OSError as exc:
        raise DatasetError(f"Telemetry source is missing: {filename}.") from exc

    with handle:
        reader = csv.DictReader(handle)
        required = {"ts_generation", *fields}
        if line_scoped:
            required.add("line")
        if not reader.fieldnames or not required.issubset(reader.fieldnames):
            raise DatasetError(f"Telemetry source has an unexpected schema: {filename}.")

        for row in reader:
            raw_rows += 1
            timestamp = _number(row.get("ts_generation"))
            line_value = _number(row.get("line")) if line_scoped else 0
            if not math.isfinite(timestamp) or (
                line_scoped
                and (
                    not math.isfinite(line_value)
                    or not line_value.is_integer()
                    or int(line_value) not in LINE_TREATMENTS
                )
            ):
                key = int(line_value) if math.isfinite(line_value) and int(line_value) in LINE_TREATMENTS else 0
                excluded_by_line[key] = excluded_by_line.get(key, 0) + 1
                continue

            line_id = int(line_value) if line_scoped else 0
            values = {field: _number(row.get(field)) for field in fields}
            group = grouped.setdefault(line_id, [])
            group.append((int(round(timestamp)), values))
            missing = missing_by_line.setdefault(line_id, {field: 0 for field in fields})
            for field, value in values.items():
                missing[field] += int(not math.isfinite(value))

    def make_stream(items: list[tuple[int, dict[str, float]]], line_id: int) -> ObservationStream:
        items.sort(key=lambda item: item[0])
        times = np.asarray([item[0] for item in items], dtype=np.int64)
        if times.size == 0 or np.any(np.diff(times) <= 0):
            raise DatasetError(f"Telemetry source has no rows or duplicate timestamps: {filename}, line {line_id}.")
        values = {
            field: np.asarray([item[1][field] for item in items], dtype=np.float64)
            for field in fields
        }
        return ObservationStream(
            timestamps_ms=times,
            values=values,
            raw_rows=raw_rows,
            excluded_rows=sum(excluded_by_line.values()),
            missing_values=missing_by_line.get(line_id, {field: 0 for field in fields}),
        )

    if not line_scoped:
        if 0 not in grouped:
            raise DatasetError(f"Telemetry source contains no usable rows: {filename}.")
        return make_stream(grouped[0], 0)

    result = {line_id: make_stream(grouped.get(line_id, []), line_id) for line_id in LINE_TREATMENTS}
    return result


def _interpolate_to_grid(
    timestamps_ms: np.ndarray,
    values: np.ndarray,
    grid_ms: np.ndarray,
) -> tuple[np.ndarray, np.ndarray]:
    valid = np.isfinite(values)
    times = timestamps_ms[valid]
    samples = values[valid]
    aligned = np.full(grid_ms.shape, np.nan, dtype=np.float64)
    interpolated = np.zeros(grid_ms.shape, dtype=bool)
    if times.size == 0:
        return aligned, interpolated

    right = np.searchsorted(times, grid_ms, side="left")
    safe_right = np.minimum(right, times.size - 1)
    exact = (right < times.size) & (times[safe_right] == grid_ms)
    aligned[exact] = samples[safe_right[exact]]

    between = (~exact) & (right > 0) & (right < times.size)
    positions = np.flatnonzero(between)
    if positions.size:
        right_index = right[positions]
        left_index = right_index - 1
        gap = times[right_index] - times[left_index]
        bridge = gap <= MAX_INTERPOLATION_GAP_MS
        positions = positions[bridge]
        right_index = right_index[bridge]
        left_index = left_index[bridge]
        fraction = (grid_ms[positions] - times[left_index]) / (times[right_index] - times[left_index])
        aligned[positions] = samples[left_index] + fraction * (samples[right_index] - samples[left_index])
        interpolated[positions] = True
    return aligned, interpolated


def _nearest_source_indices(timestamps_ms: np.ndarray, grid_ms: np.ndarray) -> np.ndarray:
    indices = np.full(grid_ms.shape, -1, dtype=np.int64)
    right = np.searchsorted(timestamps_ms, grid_ms, side="left")
    safe_right = np.minimum(right, timestamps_ms.size - 1)
    left = np.maximum(right - 1, 0)
    choose_left = np.abs(grid_ms - timestamps_ms[left]) <= np.abs(timestamps_ms[safe_right] - grid_ms)
    nearest = np.where(choose_left, left, safe_right)
    distance = np.abs(timestamps_ms[nearest] - grid_ms)
    valid = distance <= DISPLAY_TOLERANCE_MS
    indices[valid] = nearest[valid]
    return indices


def _observed_on_grid(
    stream: ObservationStream,
    grid_ms: np.ndarray,
) -> tuple[dict[str, np.ndarray], np.ndarray]:
    indices = _nearest_source_indices(stream.timestamps_ms, grid_ms)
    valid = indices >= 0
    source_times = np.full(grid_ms.shape, -1, dtype=np.int64)
    source_times[valid] = stream.timestamps_ms[indices[valid]]
    observed: dict[str, np.ndarray] = {}
    for field, values in stream.values.items():
        aligned = np.full(grid_ms.shape, np.nan, dtype=np.float64)
        aligned[valid] = values[indices[valid]]
        observed[field] = aligned
    return observed, source_times


def _iso_utc(timestamp_ms: int) -> str:
    return datetime.fromtimestamp(timestamp_ms / 1000, tz=timezone.utc).isoformat().replace("+00:00", "Z")


def _interval_median_minutes(stream: ObservationStream) -> float:
    return round(float(np.median(np.diff(stream.timestamps_ms))) / 60_000, 3)


def load_replay_dataset() -> ReplayDataset:
    manifest = _read_manifest()
    soil_streams = _load_stream(
        "stuard_soil_data.csv",
        ("humidity", "temperature", "electrical_conductivity", "battery"),
        line_scoped=True,
    )
    environment = _load_stream(
        "stuard_environmental_data.csv",
        ("humidity", "temperature", "co2", "pressure", "battery"),
        line_scoped=False,
    )
    meters = _load_stream(
        "stuard_water_meter_data.csv",
        ("current_volume",),
        line_scoped=True,
    )
    assert isinstance(soil_streams, dict)
    assert isinstance(environment, ObservationStream)
    assert isinstance(meters, dict)

    start_ms = max([environment.timestamps_ms[0], *(soil_streams[line].timestamps_ms[0] for line in LINE_TREATMENTS)])
    end_ms = min([environment.timestamps_ms[-1], *(soil_streams[line].timestamps_ms[-1] for line in LINE_TREATMENTS)])
    grid_start_ms = ((int(start_ms) + GRID_STEP_MS - 1) // GRID_STEP_MS) * GRID_STEP_MS
    grid_end_ms = (int(end_ms) // GRID_STEP_MS) * GRID_STEP_MS
    if grid_end_ms <= grid_start_ms:
        raise DatasetError("Telemetry sources have no overlapping time range.")
    grid_ms = np.arange(grid_start_ms, grid_end_ms + 1, GRID_STEP_MS, dtype=np.int64)

    air_features: dict[str, np.ndarray] = {}
    air_interpolation: dict[str, np.ndarray] = {}
    for source_name, feature_name in (("temperature", "airTemperatureC"), ("humidity", "airRelativeHumidityPctRh")):
        values, flags = _interpolate_to_grid(environment.timestamps_ms, environment.values[source_name], grid_ms)
        air_features[feature_name] = values
        air_interpolation[feature_name] = flags
    air_observed, air_observation_times = _observed_on_grid(environment, grid_ms)

    lines: dict[int, LineData] = {}
    line_quality: dict[str, Any] = {}
    for line_id, soil_stream in soil_streams.items():
        soil_features: dict[str, np.ndarray] = {}
        interpolated: dict[str, np.ndarray] = {}
        for source_name, feature_name in (
            ("humidity", "soilHumiditySignalPctRh"),
            ("temperature", "soilTemperatureC"),
            ("electrical_conductivity", "soilElectricalConductivityUsCm"),
        ):
            soil_features[feature_name], interpolated[feature_name] = _interpolate_to_grid(
                soil_stream.timestamps_ms,
                soil_stream.values[source_name],
                grid_ms,
            )

        features = np.column_stack(
            [
                soil_features["soilHumiditySignalPctRh"],
                soil_features["soilTemperatureC"],
                soil_features["soilElectricalConductivityUsCm"],
                air_features["airTemperatureC"],
                air_features["airRelativeHumidityPctRh"],
            ]
        )
        interpolation_flags = np.column_stack(
            [
                interpolated["soilHumiditySignalPctRh"],
                interpolated["soilTemperatureC"],
                interpolated["soilElectricalConductivityUsCm"],
                air_interpolation["airTemperatureC"],
                air_interpolation["airRelativeHumidityPctRh"],
            ]
        )
        observed, observation_times = _observed_on_grid(soil_stream, grid_ms)
        meter_observed, meter_times = _observed_on_grid(meters[line_id], grid_ms)
        meter_values = meter_observed["current_volume"]
        meter_deltas = np.diff(meters[line_id].values["current_volume"])
        non_monotonic = int(np.count_nonzero(meter_deltas < 0))
        lines[line_id] = LineData(
            line_id=line_id,
            features=features,
            interpolated_features=interpolation_flags,
            soil_observed=observed,
            soil_observation_timestamps_ms=observation_times,
            soil_battery_percent=observed["battery"],
            meter_current_volume_source_m3=meter_values,
            meter_observation_timestamps_ms=meter_times,
        )
        line_quality[str(line_id)] = {
            "soilRows": int(soil_stream.timestamps_ms.size),
            "soilMedianIntervalMinutes": _interval_median_minutes(soil_stream),
            "soilBatteryMissingRows": soil_stream.missing_values["battery"],
            "meterRows": int(meters[line_id].timestamps_ms.size),
            "meterMedianIntervalMinutes": _interval_median_minutes(meters[line_id]),
            "meterNegativeRegisterChanges": non_monotonic,
            "modelGridRowsWithCompleteFeatures": int(np.isfinite(features).all(axis=1).sum()),
            "modelFeatureInterpolatedValues": int(interpolation_flags.sum()),
        }

    metadata = {
        "dataset": {
            "title": manifest["title"],
            "version": manifest["version"],
            "doi": manifest["doi"],
            "sourceUrl": manifest["sourceUrl"],
            "license": manifest["license"],
            "authors": manifest["authors"],
            "collectedPeriodLocal": manifest["collectedPeriodLocal"],
            "publishedPaperDoi": "10.1016/j.dib.2025.111521",
        },
        "sourceFiles": [
            {
                "path": item["path"],
                "sizeBytes": item["sizeBytes"],
                "sha256": item["sha256"],
            }
            for item in manifest["files"]
        ],
        "replayLabel": "Historical research replay · Parma tomato trial · 2023 · not live telemetry",
        "timeline": {
            "startUtc": _iso_utc(int(grid_ms[0])),
            "endUtc": _iso_utc(int(grid_ms[-1])),
            "stepMinutes": 10,
            "samples": int(grid_ms.size),
        },
        "featureUnits": {
            "soilHumiditySignalPctRh": "%RH sensor signal; not VWC",
            "soilTemperatureC": "°C at 20 cm",
            "soilElectricalConductivityUsCm": "µS/cm",
            "airTemperatureC": "°C; one shared environmental station",
            "airRelativeHumidityPctRh": "%RH; one shared environmental station",
        },
        "lines": [
            {"lineId": line_id, "treatment": LINE_TREATMENTS[line_id]}
            for line_id in LINE_TREATMENTS
        ],
        "dataQuality": {
            "sha256Verified": True,
            "environmentRows": int(environment.timestamps_ms.size),
            "environmentExcludedRows": environment.excluded_rows,
            "soilExcludedRows": soil_streams[1].excluded_rows,
            "meterExcludedRows": meters[1].excluded_rows,
            "environmentMedianIntervalMinutes": _interval_median_minutes(environment),
            "environmentBatteryMissingRows": environment.missing_values["battery"],
            "lineStats": line_quality,
            "meterInterpretation": "Source-reported current_volume in m³; unit scale/semantics not independently validated; no conversion or flow inference.",
            "interpolation": "Features are linearly resampled to the nominal 10-minute UTC model grid; a bracket may span at most 30 minutes, with no edge extrapolation. The count includes cadence alignment as well as short-gap bridging; raw observations and their timestamps remain separate.",
        },
    }
    return ReplayDataset(
        timestamps_ms=grid_ms,
        lines=lines,
        air_observed=air_observed,
        air_observation_timestamps_ms=air_observation_times,
        metadata=metadata,
    )
