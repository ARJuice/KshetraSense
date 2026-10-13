from __future__ import annotations

from itertools import permutations
import math

import numpy as np

from app.interpolation import ProjectedSoilSample, SOIL_PROPERTIES

DEFAULT_NOISE_ASSUMPTIONS = {
    "pH": {"kind": "absolute", "value": 0.1, "unit": "pH"},
    "ec": {"kind": "relative", "value": 0.05, "unit": "dS/m"},
    "nitrogen": {"kind": "relative", "value": 0.05, "unit": "mg/kg"},
    "phosphorus": {"kind": "relative", "value": 0.05, "unit": "mg/kg"},
    "potassium": {"kind": "relative", "value": 0.05, "unit": "mg/kg"},
}


class StabilityValidationError(ValueError):
    """Inputs do not describe comparable partitions or measurement uncertainty."""


def adjusted_rand_index(reference: list[int] | np.ndarray, candidate: list[int] | np.ndarray) -> float:
    """Compare two partitions without depending on the numeric cluster labels."""
    left = np.asarray(reference)
    right = np.asarray(candidate)
    if left.ndim != 1 or right.ndim != 1 or len(left) != len(right):
        raise StabilityValidationError("ARI label vectors must be one-dimensional and have equal length.")
    if len(left) < 2:
        return 1.0
    _, left_inverse = np.unique(left, return_inverse=True)
    _, right_inverse = np.unique(right, return_inverse=True)
    contingency = np.zeros((left_inverse.max() + 1, right_inverse.max() + 1), dtype=np.int64)
    np.add.at(contingency, (left_inverse, right_inverse), 1)
    choose_two = lambda counts: counts * (counts - 1) // 2
    index = int(choose_two(contingency).sum())
    left_pairs = int(choose_two(contingency.sum(axis=1)).sum())
    right_pairs = int(choose_two(contingency.sum(axis=0)).sum())
    total_pairs = len(left) * (len(left) - 1) / 2
    expected = left_pairs * right_pairs / total_pairs
    maximum = 0.5 * (left_pairs + right_pairs)
    denominator = maximum - expected
    if denominator == 0:
        return 1.0
    return float((index - expected) / denominator)


def align_cluster_labels(reference: np.ndarray, candidate: np.ndarray, cluster_count: int) -> np.ndarray:
    """Relabel a fixed-K partition to maximize cell agreement with the reference."""
    left = np.asarray(reference, dtype=int)
    right = np.asarray(candidate, dtype=int)
    if left.ndim != 1 or right.ndim != 1 or len(left) != len(right):
        raise StabilityValidationError("cluster label vectors must be one-dimensional and have equal length.")
    if cluster_count < 1 or np.any(left < 0) or np.any(right < 0) or np.any(left >= cluster_count) or np.any(right >= cluster_count):
        raise StabilityValidationError("cluster labels must lie between zero and cluster_count - 1.")
    overlap = np.zeros((cluster_count, cluster_count), dtype=np.int64)
    np.add.at(overlap, (left, right), 1)
    best = max(permutations(range(cluster_count)), key=lambda mapping: sum(overlap[mapping[candidate_id], candidate_id] for candidate_id in range(cluster_count)))
    return np.asarray([best[int(label)] for label in right], dtype=int)


def perturb_samples(samples: list[ProjectedSoilSample], rng: np.random.Generator) -> list[ProjectedSoilSample]:
    """Perturb original sample measurements, preserving locations and metadata."""
    perturbed: list[ProjectedSoilSample] = []
    for sample in samples:
        values = dict(sample.measurements)
        for property_name in SOIL_PROPERTIES:
            value = values[property_name]
            if property_name in sample.standard_uncertainty:
                sigma = sample.standard_uncertainty[property_name]
            else:
                assumption = DEFAULT_NOISE_ASSUMPTIONS[property_name]
                sigma = assumption["value"] if assumption["kind"] == "absolute" else abs(value) * assumption["value"]
            if not math.isfinite(sigma) or sigma < 0:
                raise StabilityValidationError(f"{property_name} standard uncertainty must be finite and non-negative.")
            updated = value + float(rng.normal(0.0, sigma))
            values[property_name] = min(14.0, max(0.0, updated)) if property_name == "pH" else max(0.0, updated)
        perturbed.append(
            ProjectedSoilSample(
                id=sample.id,
                latitude=sample.latitude,
                longitude=sample.longitude,
                easting_m=sample.easting_m,
                northing_m=sample.northing_m,
                measurements=values,
                standard_uncertainty=dict(sample.standard_uncertainty),
                depth_cm=sample.depth_cm,
                collection_date=sample.collection_date,
                lab_method=sample.lab_method,
            )
        )
    return perturbed


def noise_model_summary(samples: list[ProjectedSoilSample]) -> dict:
    supplied = {
        property_name: sum(property_name in sample.standard_uncertainty for sample in samples)
        for property_name in SOIL_PROPERTIES
    }
    return {
        "source": "reported sample standard uncertainty where supplied; otherwise project sensitivity assumptions",
        "assumptions": DEFAULT_NOISE_ASSUMPTIONS,
        "samplesWithReportedUncertaintyByProperty": supplied,
        "interpretation": "Sensitivity scenario, not a laboratory accuracy claim or calibrated confidence interval.",
    }
