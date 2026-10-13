from __future__ import annotations

from dataclasses import dataclass

import numpy as np


@dataclass(frozen=True)
class KMeansResult:
    labels: np.ndarray
    centers: np.ndarray
    inertia: float
    iterations: int
    converged: bool
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
    converged = False
    # Retain a bounded, factual convergence trace for the UI. It is not used by
    # the algorithm and never fabricates intermediate positions.
    center_history = [centers.copy()]
    for iteration in range(1, max_iterations + 1):
        squared_distances = _squared_distances(data, centers)
        next_labels = np.argmin(squared_distances, axis=1)
        min_distances = squared_distances[np.arange(sample_count), next_labels]
        cluster_sizes = np.bincount(next_labels, minlength=cluster_count)
        for cluster in range(cluster_count):
            if cluster_sizes[cluster] == 0:
                # Move the farthest point from a cluster that can spare a member.
                candidates = np.argsort(-min_distances, kind="stable")
                replacement = next(
                    (int(index) for index in candidates if cluster_sizes[next_labels[index]] > 1),
                    None,
                )
                if replacement is None:
                    raise ValueError("K-means needs at least cluster_count distinct profiles to fill every cluster.")
                donor = next_labels[replacement]
                next_labels[replacement] = cluster
                cluster_sizes[donor] -= 1
                cluster_sizes[cluster] += 1
                min_distances[replacement] = 0.0
        next_centers = np.vstack([data[next_labels == cluster].mean(axis=0) for cluster in range(cluster_count)])
        if np.array_equal(next_labels, labels) and np.allclose(next_centers, centers, rtol=0.0, atol=1e-12):
            centers = next_centers
            labels = next_labels
            converged = True
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
    return KMeansResult(
        labels=labels,
        centers=centers,
        inertia=inertia,
        iterations=iteration,
        converged=converged,
        center_history=center_history,
    )


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
        zero_distance = distances <= np.finfo(float).eps
        safe_distances = np.maximum(distances, np.finfo(float).eps)
        ratios = (safe_distances[:, :, None] / safe_distances[:, None, :]) ** exponent
        next_memberships = 1.0 / ratios.sum(axis=2)
        exact_rows = zero_distance.any(axis=1)
        if np.any(exact_rows):
            exact = zero_distance[exact_rows]
            next_memberships[exact_rows] = exact / exact.sum(axis=1, keepdims=True)
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
    """Compute exact Euclidean silhouettes in bounded-memory row chunks."""
    features = np.asarray(data, dtype=float)
    cluster_labels = np.asarray(labels)
    if features.ndim != 2 or cluster_labels.ndim != 1 or len(features) != len(cluster_labels):
        raise ValueError("silhouette data and labels must have matching sample counts.")
    if not np.isfinite(features).all():
        raise ValueError("silhouette data must be finite.")
    distinct = np.unique(cluster_labels)
    sample_count = len(cluster_labels)
    if len(distinct) < 2 or len(distinct) >= sample_count:
        return None

    cluster_masks = {label: cluster_labels == label for label in distinct}
    cluster_sizes = {label: int(mask.sum()) for label, mask in cluster_masks.items()}
    total = 0.0
    chunk_size = 256
    for start in range(0, sample_count, chunk_size):
        end = min(start + chunk_size, sample_count)
        block_labels = cluster_labels[start:end]
        distances = np.sqrt(_squared_distances(features[start:end], features))
        intra = np.zeros(end - start, dtype=float)
        nearest_other = np.full(end - start, np.inf, dtype=float)
        for label, mask in cluster_masks.items():
            sums = distances[:, mask].sum(axis=1)
            counts = np.full(end - start, cluster_sizes[label], dtype=int)
            same_cluster = block_labels == label
            counts[same_cluster] -= 1
            means = np.divide(sums, counts, out=np.zeros_like(sums), where=counts > 0)
            intra[same_cluster] = means[same_cluster]
            nearest_other[~same_cluster] = np.minimum(nearest_other[~same_cluster], means[~same_cluster])
        denominator = np.maximum(intra, nearest_other)
        scores = np.divide(
            nearest_other - intra,
            denominator,
            out=np.zeros_like(intra),
            where=np.isfinite(denominator) & (denominator > 0),
        )
        singleton = np.fromiter((cluster_sizes[label] == 1 for label in block_labels), dtype=bool)
        scores[singleton] = 0.0
        total += float(scores.sum())
    return total / sample_count


def _squared_distances(left: np.ndarray, right: np.ndarray) -> np.ndarray:
    return np.maximum(
        np.sum(left**2, axis=1)[:, None] + np.sum(right**2, axis=1)[None, :] - 2 * left @ right.T,
        0.0,
    )
