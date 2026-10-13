from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Sequence

import numpy as np

from app.spatial import DiscretizedField, GridCell

SOIL_PROPERTIES = ("pH", "ec", "nitrogen", "phosphorus", "potassium")


class InterpolationValidationError(ValueError):
    """Sample data cannot safely be interpolated."""


@dataclass(frozen=True)
class ProjectedSoilSample:
    id: str
    latitude: float
    longitude: float
    easting_m: float
    northing_m: float
    measurements: dict[str, float]
    standard_uncertainty: dict[str, float] = field(default_factory=dict)
    depth_cm: str = "0-15"
    collection_date: str | None = None
    lab_method: str | None = None


@dataclass(frozen=True)
class InterpolatedCell:
    cell_id: str
    row: int
    column: int
    center_utm: tuple[float, float]
    center_wgs84: tuple[float, float]
    area_m2: float
    geometry_wgs84: dict
    values: dict[str, float]
    nearest_sample_distance_m: float


@dataclass(frozen=True)
class InterpolatedField:
    cells: list[InterpolatedCell]
    sample_locations: list[dict]
    cross_validation: dict[str, dict[str, float | int]]
    interpolation_method: str
    power_parameter: float


def idw_predict(
    target_xy: np.ndarray,
    sample_xy: np.ndarray,
    sample_values: np.ndarray,
    power: float = 2.0,
    coincident_tolerance_m: float = 0.01,
) -> np.ndarray:
    """Predict values using inverse-distance weights in projected metres."""
    targets = np.asarray(target_xy, dtype=float)
    samples = np.asarray(sample_xy, dtype=float)
    values = np.asarray(sample_values, dtype=float)
    if targets.ndim == 1:
        targets = targets.reshape(1, -1)
    if samples.ndim != 2 or samples.shape[1] != 2 or not len(samples):
        raise InterpolationValidationError("sample_xy must be a non-empty array of x/y coordinate pairs.")
    if targets.ndim != 2 or targets.shape[1] != 2:
        raise InterpolationValidationError("target_xy must contain x/y coordinate pairs.")
    if values.ndim != 1 or len(values) != len(samples):
        raise InterpolationValidationError("sample_values must contain one value per sample coordinate.")
    if not math.isfinite(power) or power <= 0:
        raise InterpolationValidationError("power must be finite and positive.")
    if not math.isfinite(coincident_tolerance_m) or coincident_tolerance_m < 0:
        raise InterpolationValidationError("coincident_tolerance_m must be finite and non-negative.")
    if not np.isfinite(targets).all() or not np.isfinite(samples).all() or not np.isfinite(values).all():
        raise InterpolationValidationError("coordinates and values must be finite.")

    distances = np.linalg.norm(targets[:, None, :] - samples[None, :, :], axis=2)
    predictions = np.empty(len(targets), dtype=float)
    for row, row_distances in enumerate(distances):
        coincident = row_distances <= coincident_tolerance_m
        if np.any(coincident):
            predictions[row] = float(values[coincident].mean())
            continue
        weights = np.power(row_distances, -power)
        predictions[row] = float(np.dot(weights, values) / weights.sum())
    return predictions


def interpolate_field(
    samples: Sequence[ProjectedSoilSample],
    field: DiscretizedField,
    properties: Sequence[str] = SOIL_PROPERTIES,
    power: float = 2.0,
) -> InterpolatedField:
    """Interpolate each requested soil property and compute leave-one-out errors."""
    if not 3 <= len(samples) <= 50:
        raise InterpolationValidationError("IDW requires 3 to 50 soil samples.")
    if not properties or len(set(properties)) != len(properties):
        raise InterpolationValidationError("properties must be a non-empty list without duplicates.")
    unknown = set(properties) - set(SOIL_PROPERTIES)
    if unknown:
        raise InterpolationValidationError(f"Unsupported interpolation properties: {', '.join(sorted(unknown))}.")

    sample_xy = np.asarray([(sample.easting_m, sample.northing_m) for sample in samples], dtype=float)
    duplicate_distances = np.linalg.norm(sample_xy[:, None, :] - sample_xy[None, :, :], axis=2)
    np.fill_diagonal(duplicate_distances, np.inf)
    if np.any(duplicate_distances <= 0.01):
        raise InterpolationValidationError("sample locations must be separated by more than 0.01 m.")

    target_xy = np.asarray([cell.center_utm for cell in field.cells], dtype=float)
    predictions: dict[str, np.ndarray] = {}
    cross_validation: dict[str, dict[str, float | int]] = {}
    for property_name in properties:
        if any(property_name not in sample.measurements for sample in samples):
            raise InterpolationValidationError(f"Every sample must include {property_name}.")
        observed = np.asarray([sample.measurements[property_name] for sample in samples], dtype=float)
        if not np.isfinite(observed).all():
            raise InterpolationValidationError(f"{property_name} sample values must be finite.")
        predictions[property_name] = idw_predict(target_xy, sample_xy, observed, power)
        errors = []
        for held_out in range(len(samples)):
            training = np.arange(len(samples)) != held_out
            estimate = idw_predict(
                sample_xy[held_out], sample_xy[training], observed[training], power
            )[0]
            errors.append(float(observed[held_out] - estimate))
        error_array = np.asarray(errors, dtype=float)
        cross_validation[property_name] = {
            "sampleCount": len(samples),
            "rmse": float(np.sqrt(np.mean(error_array**2))),
            "mae": float(np.mean(np.abs(error_array))),
        }

    nearest_distances = np.min(np.linalg.norm(target_xy[:, None, :] - sample_xy[None, :, :], axis=2), axis=1)
    interpolated_cells = [
        InterpolatedCell(
            cell_id=cell.id,
            row=cell.row,
            column=cell.column,
            center_utm=cell.center_utm,
            center_wgs84=cell.center_wgs84,
            area_m2=cell.area_m2,
            geometry_wgs84=cell.geometry_wgs84,
            values={property_name: float(predictions[property_name][index]) for property_name in properties},
            nearest_sample_distance_m=float(nearest_distances[index]),
        )
        for index, cell in enumerate(field.cells)
    ]
    locations = [
        {
            "id": sample.id,
            "latitude": sample.latitude,
            "longitude": sample.longitude,
            "eastingM": sample.easting_m,
            "northingM": sample.northing_m,
            "measurements": dict(sample.measurements),
            "standardUncertainty": dict(sample.standard_uncertainty),
            "depthCm": sample.depth_cm,
            "collectionDate": sample.collection_date,
            "labMethod": sample.lab_method,
        }
        for sample in samples
    ]
    return InterpolatedField(
        cells=interpolated_cells,
        sample_locations=locations,
        cross_validation=cross_validation,
        interpolation_method="IDW",
        power_parameter=float(power),
    )
