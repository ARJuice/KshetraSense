import numpy as np
import pytest

from app.interpolation import ProjectedSoilSample
from app.validation import adjusted_rand_index, perturb_samples


def _sample(uncertainty: dict[str, float] | None = None) -> ProjectedSoilSample:
    return ProjectedSoilSample(
        id="sample-1",
        latitude=13.0,
        longitude=77.0,
        easting_m=500_000,
        northing_m=1_400_000,
        measurements={"pH": 6.5, "ec": 1.0, "nitrogen": 80, "phosphorus": 30, "potassium": 160},
        standard_uncertainty=uncertainty or {},
    )


def test_adjusted_rand_index_is_label_permutation_invariant():
    assert adjusted_rand_index([0, 0, 1, 1], [7, 7, 3, 3]) == pytest.approx(1.0)
    assert adjusted_rand_index([0, 0, 1, 1], [0, 1, 0, 1]) == pytest.approx(-0.5)


def test_sample_perturbation_is_deterministic_and_preserves_input():
    original = _sample()
    first = perturb_samples([original], np.random.default_rng(11))
    second = perturb_samples([original], np.random.default_rng(11))

    assert original.measurements["pH"] == 6.5
    assert first[0].measurements == second[0].measurements
    assert first[0].measurements != original.measurements
    assert all(value >= 0 for key, value in first[0].measurements.items() if key != "pH")


def test_sample_specific_uncertainty_overrides_default_noise():
    original = _sample({"pH": 0.0, "ec": 0.0, "nitrogen": 0.0, "phosphorus": 0.0, "potassium": 0.0})

    perturbed = perturb_samples([original], np.random.default_rng(11))

    assert perturbed[0].measurements == original.measurements
