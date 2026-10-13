import numpy as np
import pytest

from app.clustering import (
    ClusteringValidationError,
    auto_select_k,
    merge_adjacent_zones,
    split_disconnected_zones,
)


def test_auto_select_k_finds_three_well_separated_feature_groups():
    data = np.array(
        [
            [-5.1, -4.9], [-5.0, -5.0], [-4.9, -5.1],
            [0.0, 5.0], [0.1, 5.1], [-0.1, 4.9],
            [5.0, -5.0], [5.1, -4.9], [4.9, -5.1],
        ]
    )

    result = auto_select_k(data, method="kmeans", seed=42, max_k=5)

    assert result.optimal_k == 3
    assert len(result.sweep) == 4
    assert result.sweep[0].silhouette < result.sweep[1].silhouette
    assert result.selected_result.labels.shape == (9,)


def test_auto_select_k_supports_fuzzy_memberships():
    data = np.array([[0.0], [0.1], [0.2], [9.8], [9.9], [10.0]])

    result = auto_select_k(data, method="fcm", seed=7, max_k=3)

    assert result.optimal_k == 2
    assert result.sweep[0].fpc is not None
    assert np.allclose(result.selected_result.memberships.sum(axis=1), 1.0)


def test_adjacent_clusters_merge_only_when_their_multivariate_profiles_are_close():
    data = np.array([[0.0, 0.0], [0.1, 0.0], [0.2, 0.0], [0.3, 0.0]])
    labels = np.array([0, 0, 1, 1])

    merged = merge_adjacent_zones(data, labels, [0, 0, 0, 0], [0, 1, 2, 3], merge_threshold_z=0.5)

    assert len(np.unique(merged.labels)) == 1
    assert merged.merge_log[0]["profileDistanceZ"] == pytest.approx(0.2)


def test_adjacent_clusters_with_different_profiles_are_not_merged():
    data = np.array([[0.0], [0.1], [5.0], [5.1]])
    labels = np.array([0, 0, 1, 1])

    merged = merge_adjacent_zones(data, labels, [0, 0, 0, 0], [0, 1, 2, 3], merge_threshold_z=0.5)

    assert len(np.unique(merged.labels)) == 2
    assert merged.merge_log == []


def test_zone_components_use_four_neighbor_connectivity_and_split_disconnected_patches():
    components = split_disconnected_zones(
        np.array([4, 4, 4]),
        np.array([0, 1, 2]),
        np.array([0, 1, 1]),
    )

    assert len(np.unique(components.labels)) == 2
    assert components.labels[0] != components.labels[1]
    assert components.labels[1] == components.labels[2]
    assert components.zone_to_cluster == {0: 4, 1: 4}


def test_auto_select_k_rejects_one_unique_profile():
    with pytest.raises(ClusteringValidationError, match="at least two distinct"):
        auto_select_k(np.ones((5, 2)), method="kmeans", seed=42)
