import numpy as np

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


def test_fcm_memberships_sum_to_one_and_are_deterministic():
    data = np.array([[0.0], [0.1], [9.9], [10.0]])
    first = fuzzy_c_means(data, 2, seed=7, fuzziness=2.0, max_iterations=200, tolerance=1e-8)
    second = fuzzy_c_means(data, 2, seed=7, fuzziness=2.0, max_iterations=200, tolerance=1e-8)

    assert np.allclose(first.memberships.sum(axis=1), 1.0)
    assert np.allclose(first.memberships, second.memberships)
    assert 0.5 <= first.fpc <= 1.0


def test_silhouette_is_undefined_when_each_sample_is_own_cluster():
    assert silhouette_score(np.array([[0.0], [1.0]]), np.array([0, 1])) is None
