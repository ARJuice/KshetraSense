from __future__ import annotations

import hashlib
import json
from collections import defaultdict
from datetime import UTC, datetime

import numpy as np

from app.algorithms import fuzzy_c_means, kmeans_plus_plus, silhouette_score
from app.schemas import ZoningRequest

ALGORITHM_VERSION = "zoning-1.0.0"
NORMALIZATION_VERSION = "zscore-1"


class ZoningValidationError(ValueError):
    pass


def run_zoning(request: ZoningRequest) -> dict:
    prepared = _prepare_matrix(request)
    data = prepared["data"]
    means = data.mean(axis=0)
    std_devs = data.std(axis=0)
    normalized = (data - means) / std_devs

    is_fcm = request.method in {"fcm", "fuzzy-c-means"}
    if not is_fcm:
        result = kmeans_plus_plus(normalized, request.clusterCount, request.seed)
        labels = result.labels
        memberships = None
        algorithm_diagnostics = {
            "inertia": _number(result.inertia),
            "iterations": result.iterations,
            "converged": True,
            "centerSnapshots": _center_snapshots(result.center_history, means, std_devs, prepared["features"]),
        }
        centers_normalized = result.centers
    else:
        result = fuzzy_c_means(
            normalized,
            request.clusterCount,
            request.seed,
            request.fcm.fuzziness,
            request.fcm.maxIterations,
            request.fcm.tolerance,
        )
        labels = result.labels
        memberships = result.memberships
        algorithm_diagnostics = {
            "objective": _number(result.objective),
            "fuzzyPartitionCoefficient": _number(result.fpc),
            "iterations": result.iterations,
            "converged": result.converged,
            "centerSnapshots": _center_snapshots(result.center_history, means, std_devs, prepared["features"]),
        }
        centers_normalized = result.centers

    centers_raw = centers_normalized * std_devs + means
    assignments = _assignments(prepared["cells"], labels, memberships)
    zones = _zone_summaries(
        prepared["cells"], data, labels, memberships, prepared["features"], centers_raw, std_devs
    )
    run_id = _run_id(request, prepared["features"])
    return {
        "runId": run_id,
        "scenarioId": request.scenarioId,
        "gridRevision": request.gridRevision,
        "method": "fuzzy-c-means" if is_fcm else "kmeans",
        "clusterCount": request.clusterCount,
        "parameters": {
            "clusterCount": request.clusterCount,
            "seed": request.seed,
            **({"fcm": request.fcm.model_dump()} if is_fcm else {}),
        },
        "versions": {"algorithm": ALGORITHM_VERSION, "normalization": NORMALIZATION_VERSION},
        "featureSchema": {
            "requested": request.features,
            "included": prepared["features"],
            "excluded": prepared["excludedFeatures"],
            "normalization": [
                {"feature": feature, "mean": _number(means[index]), "stdDev": _number(std_devs[index])}
                for index, feature in enumerate(prepared["features"])
            ],
        },
        "excludedCells": prepared["excludedCells"],
        "assignments": {item["cellId"]: item["zoneId"] for item in assignments},
        "assignmentDetails": assignments,
        **(
            {"memberships": {item["cellId"]: item["memberships"] for item in assignments}}
            if memberships is not None
            else {}
        ),
        "zones": zones,
        "adjacency": _adjacency(prepared["cells"], labels),
        "diagnostics": {
            **algorithm_diagnostics,
            "silhouette": _optional_number(silhouette_score(normalized, labels)),
            "includedCellCount": len(prepared["cells"]),
            "excludedCellCount": len(prepared["excludedCells"]),
            "clusterSizes": [int(np.sum(labels == zone_id)) for zone_id in range(request.clusterCount)],
        },
        "silhouetteScore": _optional_number(silhouette_score(normalized, labels)),
        "inputFingerprint": _input_fingerprint(request, prepared["features"]),
        "createdAt": datetime.now(UTC).isoformat(),
    }


def _prepare_matrix(request: ZoningRequest) -> dict:
    cells = []
    excluded_cells = []
    for cell in request.cells:
        missing = [feature for feature in request.features if cell.values.get(feature) is None]
        if missing:
            excluded_cells.append({"cellId": cell.id, "reason": f"Missing requested feature(s): {', '.join(missing)}"})
        else:
            cells.append(cell)
    if len(cells) < request.clusterCount:
        raise ZoningValidationError(
            f"At least {request.clusterCount} complete cells are required after exclusions; received {len(cells)}."
        )
    full_data = np.asarray([[cell.values[feature] for feature in request.features] for cell in cells], dtype=float)
    variable_indices = [index for index in range(len(request.features)) if not np.isclose(full_data[:, index].std(), 0.0)]
    excluded_features = [
        {"feature": feature, "reason": "No variation across complete cells; cannot distinguish zones."}
        for index, feature in enumerate(request.features)
        if index not in variable_indices
    ]
    if not variable_indices:
        raise ZoningValidationError("No requested feature has variation across complete cells.")
    variable_data = full_data[:, variable_indices]
    unique_profiles = len(np.unique(variable_data, axis=0))
    if unique_profiles < request.clusterCount:
        raise ZoningValidationError(
            f"At least {request.clusterCount} distinct complete soil profiles are required after exclusions; received {unique_profiles}."
        )
    return {
        "cells": cells,
        "data": variable_data,
        "features": [request.features[index] for index in variable_indices],
        "excludedFeatures": excluded_features,
        "excludedCells": excluded_cells,
    }


def _assignments(cells, labels: np.ndarray, memberships: np.ndarray | None) -> list[dict]:
    assignments = []
    for index, cell in enumerate(cells):
        item = {"cellId": cell.id, "row": cell.row, "column": cell.column, "zoneId": int(labels[index])}
        if memberships is not None:
            item["memberships"] = [_number(value) for value in memberships[index]]
        assignments.append(item)
    return assignments


def _zone_summaries(cells, data, labels, memberships, features, centers_raw, normalization_std_devs) -> list[dict]:
    zones = []
    for zone_id in range(len(centers_raw)):
        member_indices = np.where(labels == zone_id)[0]
        members = [cells[index] for index in member_indices]
        member_data = data[member_indices]
        zone = {
            "zoneId": zone_id,
            "cellIds": [cell.id for cell in members],
            "cellCount": len(members),
            "featureMeans": {feature: _number(member_data[:, index].mean()) for index, feature in enumerate(features)},
            "featureStdDevs": {feature: _number(member_data[:, index].std()) for index, feature in enumerate(features)},
            "mean": _frontend_feature_names(
                {feature: _number(member_data[:, index].mean()) for index, feature in enumerate(features)}
            ),
            # Numeric aggregate is the mean within-zone variance after each retained feature's
            # own standardization; raw-unit variances remain available per feature.
            "variance": _number(np.var(member_data / normalization_std_devs, axis=0).mean()),
            "varianceDefinition": "mean feature-wise variance in z-score feature space",
            "varianceByFeature": {feature: _number(member_data[:, index].var()) for index, feature in enumerate(features)},
            "centerRaw": {feature: _number(centers_raw[zone_id, index]) for index, feature in enumerate(features)},
            "spatialCenter": {
                "row": _number(np.mean([cell.row for cell in members])),
                "column": _number(np.mean([cell.column for cell in members])),
            },
        }
        if memberships is not None:
            zone["meanMembership"] = _number(memberships[member_indices, zone_id].mean())
        zones.append(zone)
    return zones


def _adjacency(cells, labels: np.ndarray) -> list[dict]:
    positions = {(cell.row, cell.column): (index, cell) for index, cell in enumerate(cells)}
    pairs: set[tuple[int, int]] = set()
    contacts: defaultdict[tuple[int, int], int] = defaultdict(int)
    for index, cell in enumerate(cells):
        for coordinate in ((cell.row + 1, cell.column), (cell.row, cell.column + 1)):
            neighbor = positions.get(coordinate)
            if neighbor is None:
                continue
            neighbor_index, _ = neighbor
            left, right = sorted((int(labels[index]), int(labels[neighbor_index])))
            if left != right:
                pairs.add((left, right))
                contacts[(left, right)] += 1
    return [
        {"zoneA": left, "zoneB": right, "sharedGridEdges": contacts[(left, right)]}
        for left, right in sorted(pairs)
    ]


def _run_id(request: ZoningRequest, included_features: list[str]) -> str:
    return f"zoning-{_input_fingerprint(request, included_features)[:20]}"


def _input_fingerprint(request: ZoningRequest, included_features: list[str]) -> str:
    payload = {
        "scenarioId": request.scenarioId,
        "gridRevision": request.gridRevision,
        "method": "fuzzy-c-means" if request.method in {"fcm", "fuzzy-c-means"} else "kmeans",
        "clusterCount": request.clusterCount,
        "seed": request.seed,
        "features": included_features,
        "cells": [cell.model_dump() for cell in request.cells],
        "fcm": request.fcm.model_dump() if request.method in {"fcm", "fuzzy-c-means"} else None,
    }
    digest = hashlib.sha256(json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    return digest


def _number(value: float | np.floating) -> float:
    return round(float(value), 8)


def _optional_number(value: float | None) -> float | None:
    return None if value is None else _number(value)


def _center_snapshots(history: list[np.ndarray], means: np.ndarray, std_devs: np.ndarray, features: list[str]) -> list[list[dict[str, float]]]:
    """Return actual center positions in original units for optional UI playback."""
    return [
        [
            {feature: _number(center[index] * std_devs[index] + means[index]) for index, feature in enumerate(features)}
            for center in snapshot
        ]
        for snapshot in history
    ]


def _frontend_feature_names(values: dict[str, float]) -> dict[str, float]:
    """The TypeScript field model uses `ph`; internal/doc contracts retain `pH`."""
    return {("ph" if feature == "pH" else feature): value for feature, value in values.items()}
