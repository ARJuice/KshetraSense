from __future__ import annotations

from dataclasses import dataclass

import numpy as np


@dataclass(frozen=True)
class KMeansResult:
    labels: np.ndarray
    centers: np.ndarray
    inertia: float
    iterations: int
    center_history: list[np.ndarray]


@dataclass(frozen=True)
class FcmResult:
    memberships: np.ndarray
    labels: np.ndarray
    centers: np.ndarray
    objective: float
    iterations: int
    converged: bool
    fpc: float
    center_history: list[np.ndarray]


def kmeans_plus_plus(data: np.ndarray, cluster_count: int, seed: int, max_iterations: int = 300) -> KMeansResult:
    """Deterministic K-means++ / Lloyd implementation over samples × features."""

    sample_count = data.shape[0]
    rng = np.random.default_rng(seed)
    centers = np.empty((cluster_count, data.shape[1]), dtype=float)
    first_index = int(rng.integers(sample_count))
    centers[0] = data[first_index]
    closest_squared = np.sum((data - centers[0]) ** 2, axis=1)

    for index in range(1, cluster_count):
        total = float(closest_squared.sum())
        if total <= np.finfo(float).eps:
            candidate = next(row for row in range(sample_count) if not np.any(np.all(data[row] == centers[:index], axis=1)))
        else:
            candidate = int(rng.choice(sample_count, p=closest_squared / total))
        centers[index] = data[candidate]
        closest_squared = np.minimum(closest_squared, np.sum((data - centers[index]) ** 2, axis=1))

    labels = np.full(sample_count, -1, dtype=int)
    # Retain a bounded, factual convergence trace for the UI. It is not used by
    # the algorithm and never fabricates intermediate positions.
    center_history = [centers.copy()]
    for iteration in range(1, max_iterations + 1):
        squared_distances = _squared_distances(data, centers)
        next_labels = np.argmin(squared_distances, axis=1)
        next_centers = centers.copy()
        min_distances = squared_distances[np.arange(sample_count), next_labels]
        occupied: set[int] = set()
        for cluster in range(cluster_count):
            members = data[next_labels == cluster]
            if len(members):
                next_centers[cluster] = members.mean(axis=0)
                occupied.update(np.where(next_labels == cluster)[0].tolist())
            else:
                # Empty clusters get the farthest available assigned sample, deterministically.
                candidates = np.argsort(-min_distances, kind="stable")
                replacement = next(index for index in candidates if int(index) not in occupied)
                next_centers[cluster] = data[replacement]
                occupied.add(int(replacement))
        if np.array_equal(next_labels, labels) and np.allclose(next_centers, centers, rtol=0.0, atol=1e-12):
            centers = next_centers
            labels = next_labels
            break
        centers = next_centers
        labels = next_labels
        if len(center_history) < 16:
            center_history.append(centers.copy())

    final_distances = _squared_distances(data, centers)
    labels = np.argmin(final_distances, axis=1)
    inertia = float(final_distances[np.arange(sample_count), labels].sum())
    if not np.array_equal(center_history[-1], centers):
        center_history.append(centers.copy())
    return KMeansResult(labels=labels, centers=centers, inertia=inertia, iterations=iteration, center_history=center_history)


def fuzzy_c_means(
    data: np.ndarray,
    cluster_count: int,
    seed: int,
    fuzziness: float,
    max_iterations: int,
    tolerance: float,
) -> FcmResult:
    """Real Bezdek FCM over samples × features; memberships are samples × clusters."""

    sample_count = data.shape[0]
    rng = np.random.default_rng(seed)
    memberships = rng.random((sample_count, cluster_count))
    memberships /= memberships.sum(axis=1, keepdims=True)
    exponent = 2.0 / (fuzziness - 1.0)
    converged = False
    center_history: list[np.ndarray] = []

    for iteration in range(1, max_iterations + 1):
        weighted = memberships**fuzziness
        centers = (weighted.T @ data) / weighted.sum(axis=0)[:, None]
        if len(center_history) < 16:
            center_history.append(centers.copy())
        distances = np.sqrt(_squared_distances(data, centers))
        next_memberships = np.zeros_like(memberships)
        zero_distance = distances <= np.finfo(float).eps
        for sample_index in range(sample_count):
            exact = np.where(zero_distance[sample_index])[0]
            if len(exact):
                next_memberships[sample_index, exact] = 1.0 / len(exact)
                continue
            ratios = (distances[sample_index, :, None] / distances[sample_index, None, :]) ** exponent
            next_memberships[sample_index] = 1.0 / ratios.sum(axis=1)
        delta = float(np.max(np.abs(next_memberships - memberships)))
        memberships = next_memberships
        if delta < tolerance:
            converged = True
            break

    weighted = memberships**fuzziness
    centers = (weighted.T @ data) / weighted.sum(axis=0)[:, None]
    if not center_history or not np.array_equal(center_history[-1], centers):
        center_history.append(centers.copy())
    distances_squared = _squared_distances(data, centers)
    objective = float((weighted * distances_squared).sum())
    labels = np.argmax(memberships, axis=1)
    fpc = float(np.sum(memberships**2) / sample_count)
    return FcmResult(
        memberships=memberships,
        labels=labels,
        centers=centers,
        objective=objective,
        iterations=iteration,
        converged=converged,
        fpc=fpc,
        center_history=center_history,
    )


def silhouette_score(data: np.ndarray, labels: np.ndarray) -> float | None:
    """Mean silhouette with Euclidean distances; undefined for one or n clusters."""

    distinct = np.unique(labels)
    sample_count = len(labels)
    if len(distinct) < 2 or len(distinct) >= sample_count:
        return None
    distances = np.sqrt(_squared_distances(data, data))
    scores: list[float] = []
    for index, label in enumerate(labels):
        same = np.where(labels == label)[0]
        same = same[same != index]
        a = float(distances[index, same].mean()) if len(same) else 0.0
        b = min(float(distances[index, labels == other].mean()) for other in distinct if other != label)
        denominator = max(a, b)
        scores.append(0.0 if denominator == 0 else (b - a) / denominator)
    return float(np.mean(scores))


def _squared_distances(left: np.ndarray, right: np.ndarray) -> np.ndarray:
    return np.maximum(
        np.sum(left**2, axis=1)[:, None] + np.sum(right**2, axis=1)[None, :] - 2 * left @ right.T,
        0.0,
    )
