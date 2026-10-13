from __future__ import annotations

from collections import defaultdict, deque
from dataclasses import dataclass
import math
from typing import Literal

import numpy as np

from app.algorithms import FcmResult, KMeansResult, fuzzy_c_means, kmeans_plus_plus, silhouette_score

ClusterResult = KMeansResult | FcmResult


class ClusteringValidationError(ValueError):
    """The field does not contain enough valid variation for clustering."""


@dataclass(frozen=True)
class KSweepEntry:
    k: int
    silhouette: float | None
    fpc: float | None
    inertia: float | None
    iterations: int


@dataclass(frozen=True)
class AutoKResult:
    optimal_k: int
    sweep: list[KSweepEntry]
    selection_criterion: str
    selected_result: ClusterResult


@dataclass(frozen=True)
class ZoneMergeResult:
    labels: np.ndarray
    original_cluster_count: int
    final_cluster_count: int
    merge_log: list[dict]


@dataclass(frozen=True)
class ZoneComponents:
    labels: np.ndarray
    zone_to_cluster: dict[int, int]


def auto_select_k(
    data: np.ndarray,
    method: Literal["kmeans", "fcm", "fuzzy-c-means"],
    seed: int,
    max_k: int = 6,
    fuzziness: float = 2.0,
    max_iterations: int = 150,
    tolerance: float = 1e-5,
) -> AutoKResult:
    """Choose K by the highest silhouette on standardized soil profiles."""
    features = np.asarray(data, dtype=float)
    if features.ndim != 2 or features.shape[1] == 0 or features.shape[0] < 3:
        raise ClusteringValidationError("Auto-K requires at least three rows and one feature.")
    if not np.isfinite(features).all():
        raise ClusteringValidationError("Auto-K features must be finite.")
    if max_k < 2:
        raise ClusteringValidationError("max_k must be at least 2.")
    if method not in {"kmeans", "fcm", "fuzzy-c-means"}:
        raise ClusteringValidationError("method must be kmeans or fcm.")
    unique_profiles = len(np.unique(features, axis=0))
    if unique_profiles < 2:
        raise ClusteringValidationError("Auto-K requires at least two distinct soil profiles.")

    sweep: list[KSweepEntry] = []
    results: dict[int, ClusterResult] = {}
    upper_k = min(max_k, len(features) - 1, unique_profiles)
    for cluster_count in range(2, upper_k + 1):
        if method == "kmeans":
            result: ClusterResult = kmeans_plus_plus(features, cluster_count, seed)
            labels = result.labels
            inertia = result.inertia
            fpc = None
        else:
            result = fuzzy_c_means(features, cluster_count, seed, fuzziness, max_iterations, tolerance)
            labels = result.labels
            inertia = None
            fpc = result.fpc
        score = silhouette_score(features, labels)
        sweep.append(
            KSweepEntry(
                k=cluster_count,
                silhouette=score,
                fpc=fpc,
                inertia=inertia,
                iterations=result.iterations,
            )
        )
        if score is not None:
            results[cluster_count] = result
    if not results:
        raise ClusteringValidationError("No tested K produced a defined silhouette score.")
    optimal_k = max(results, key=lambda k: (next(item.silhouette for item in sweep if item.k == k), -k))
    return AutoKResult(
        optimal_k=optimal_k,
        sweep=sweep,
        selection_criterion="maximum silhouette; ties choose the smaller K",
        selected_result=results[optimal_k],
    )


def merge_adjacent_zones(
    data: np.ndarray,
    labels: np.ndarray,
    rows: np.ndarray | list[int],
    columns: np.ndarray | list[int],
    merge_threshold_z: float = 0.5,
) -> ZoneMergeResult:
    """Merge only touching clusters with similar standardized feature centroids."""
    features = np.asarray(data, dtype=float)
    current = np.asarray(labels, dtype=int).copy()
    row_values = np.asarray(rows, dtype=int)
    column_values = np.asarray(columns, dtype=int)
    if features.ndim != 2 or not np.isfinite(features).all():
        raise ClusteringValidationError("merge data must be a finite matrix.")
    if not math.isfinite(merge_threshold_z) or merge_threshold_z < 0:
        raise ClusteringValidationError("merge_threshold_z must be finite and non-negative.")
    if len(current) != len(features) or len(row_values) != len(current) or len(column_values) != len(current):
        raise ClusteringValidationError("labels, rows, columns, and data must have the same length.")
    if len(set(zip(row_values.tolist(), column_values.tolist(), strict=True))) != len(current):
        raise ClusteringValidationError("row/column coordinates must be unique.")

    original_count = len(np.unique(current))
    merge_log: list[dict] = []
    while True:
        contacts = _cluster_contacts(current, row_values, column_values)
        if not contacts:
            break
        centroids = {label: features[current == label].mean(axis=0) for label in np.unique(current)}
        candidates = [
            (float(np.linalg.norm(centroids[left] - centroids[right])), left, right, shared_edges)
            for (left, right), shared_edges in contacts.items()
        ]
        distance, left, right, shared_edges = min(candidates)
        if distance > merge_threshold_z:
            break
        merge_log.append(
            {
                "mergedClusters": [int(left), int(right)],
                "profileDistanceZ": distance,
                "sharedGridEdges": shared_edges,
            }
        )
        current[current == right] = left
        remap = {old: new for new, old in enumerate(sorted(np.unique(current).tolist()))}
        current = np.asarray([remap[int(label)] for label in current], dtype=int)
    return ZoneMergeResult(
        labels=current,
        original_cluster_count=original_count,
        final_cluster_count=len(np.unique(current)),
        merge_log=merge_log,
    )


def split_disconnected_zones(
    labels: np.ndarray,
    rows: np.ndarray | list[int],
    columns: np.ndarray | list[int],
) -> ZoneComponents:
    """Give each four-connected component its own deterministic zone ID."""
    original = np.asarray(labels, dtype=int)
    row_values = np.asarray(rows, dtype=int)
    column_values = np.asarray(columns, dtype=int)
    if original.ndim != 1 or len(row_values) != len(original) or len(column_values) != len(original):
        raise ClusteringValidationError("labels, rows, and columns must be one-dimensional arrays of equal length.")
    if len(set(zip(row_values.tolist(), column_values.tolist(), strict=True))) != len(original):
        raise ClusteringValidationError("row/column coordinates must be unique.")

    index_by_position = {(int(row), int(column)): index for index, (row, column) in enumerate(zip(row_values, column_values, strict=True))}
    order = sorted(range(len(original)), key=lambda index: (row_values[index], column_values[index]))
    visited: set[int] = set()
    zones = np.full(len(original), -1, dtype=int)
    zone_to_cluster: dict[int, int] = {}
    for start in order:
        if start in visited:
            continue
        zone_id = len(zone_to_cluster)
        cluster_id = int(original[start])
        zone_to_cluster[zone_id] = cluster_id
        queue = deque([start])
        visited.add(start)
        while queue:
            index = queue.popleft()
            zones[index] = zone_id
            row, column = int(row_values[index]), int(column_values[index])
            for position in ((row - 1, column), (row + 1, column), (row, column - 1), (row, column + 1)):
                neighbor = index_by_position.get(position)
                if neighbor is None or neighbor in visited or original[neighbor] != cluster_id:
                    continue
                visited.add(neighbor)
                queue.append(neighbor)
    return ZoneComponents(labels=zones, zone_to_cluster=zone_to_cluster)


def _cluster_contacts(labels: np.ndarray, rows: np.ndarray, columns: np.ndarray) -> dict[tuple[int, int], int]:
    position_to_index = {(int(row), int(column)): index for index, (row, column) in enumerate(zip(rows, columns, strict=True))}
    contacts: defaultdict[tuple[int, int], int] = defaultdict(int)
    for index, (row, column) in enumerate(zip(rows, columns, strict=True)):
        for position in ((int(row) + 1, int(column)), (int(row), int(column) + 1)):
            neighbor = position_to_index.get(position)
            if neighbor is None:
                continue
            left, right = int(labels[index]), int(labels[neighbor])
            if left != right:
                contacts[tuple(sorted((left, right)))] += 1
    return dict(contacts)

