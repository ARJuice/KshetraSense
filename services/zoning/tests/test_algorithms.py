import numpy as np
import pytest

from app.algorithms import fuzzy_c_means, kmeans_plus_plus, silhouette_score


def test_kmeans_is_deterministic_and_separates_simple_clusters():
    data = np.array([[0.0, 0.0], [0.1, 0.2], [9.9, 10.1], [10.0, 9.8]])
    first = kmeans_plus_plus(data, cluster_count=2, seed=42)
    second = kmeans_plus_plus(data, cluster_count=2, seed=42)

    assert np.array_equal(first.labels, second.labels)
    assert first.labels[0] == first.labels[1]
    assert first.labels[2] == first.labels[3]
    assert first.labels[0] != first.labels[2]
    assert first.inertia < 0.2


def test_kmeans_reports_iteration_cap_without_claiming_convergence():
    data = np.array([[0.0], [1.0], [9.0], [10.0]])

    limited = kmeans_plus_plus(data, cluster_count=2, seed=42, max_iterations=1)
    converged = kmeans_plus_plus(data, cluster_count=2, seed=42)

    assert limited.iterations == 1
    assert limited.converged is False
    assert converged.converged is True


def test_kmeans_recovers_empty_clusters_from_farthest_eligible_points():
    data = np.array(
        [
            [2, -2, 1], [-2, -1, 2], [-3, -1, -3], [1, 2, 2], [-2, 0, -2],
            [-3, -3, 3], [0, -1, 2], [0, 3, 0], [3, 1, -2],
        ],
        dtype=float,
    )

    result = kmeans_plus_plus(data, cluster_count=4, seed=195)

    assert len(np.unique(result.labels)) == 4


def test_fcm_memberships_sum_to_one_and_are_deterministic():
    data = np.array([[0.0], [0.1], [9.9], [10.0]])
    first = fuzzy_c_means(data, 2, seed=7, fuzziness=2.0, max_iterations=200, tolerance=1e-8)
    second = fuzzy_c_means(data, 2, seed=7, fuzziness=2.0, max_iterations=200, tolerance=1e-8)

    assert np.allclose(first.memberships.sum(axis=1), 1.0)
    assert np.allclose(first.memberships, second.memberships)
    assert 0.5 <= first.fpc <= 1.0


def test_fcm_vectorized_membership_update_preserves_reference_result():
    result = fuzzy_c_means(
        np.array([[0.0], [0.1], [9.9], [10.0]]),
        2,
        seed=7,
        fuzziness=2.0,
        max_iterations=200,
        tolerance=1e-8,
    )

    assert result.memberships == pytest.approx(
        np.array(
            [
                [0.999974748769442, 0.000025251230558],
                [0.999974233425415, 0.000025766574585],
                [0.000025766574814, 0.999974233425186],
                [0.000025251230334, 0.999974748769666],
            ]
        ),
        abs=1e-10,
    )


def test_silhouette_is_undefined_when_each_sample_is_own_cluster():
    assert silhouette_score(np.array([[0.0], [1.0]]), np.array([0, 1])) is None


def test_silhouette_matches_known_two_group_score():
    data = np.array([[0.0], [1.0], [5.0], [6.0]])

    score = silhouette_score(data, np.array([0, 0, 1, 1]))

    expected = ((1 - 1 / 5.5) + (1 - 1 / 4.5) + (1 - 1 / 4.5) + (1 - 1 / 5.5)) / 4
    assert score == pytest.approx(expected)


def test_silhouette_handles_a_field_sized_batch_without_changing_the_metric():
    data = np.concatenate([np.arange(600, dtype=float)[:, None], (np.arange(600, dtype=float) + 100_000)[:, None]])
    labels = np.repeat([0, 1], 600)

    score = silhouette_score(data, labels)

    assert score is not None
    assert 0.99 < score <= 1.0
