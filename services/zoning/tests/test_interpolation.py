import numpy as np
import pytest

from app.interpolation import InterpolationValidationError, idw_predict


def test_idw_returns_an_exact_sample_value_and_the_weighted_midpoint():
    sample_xy = np.array([[0.0, 0.0], [10.0, 0.0]])
    values = np.array([10.0, 20.0])

    predictions = idw_predict(np.array([[0.0, 0.0], [5.0, 0.0]]), sample_xy, values, power=2)

    assert predictions[0] == 10.0
    assert predictions[1] == 15.0


def test_idw_predictions_stay_within_the_observed_range():
    predictions = idw_predict(
        np.array([[1.0, 0.0], [9.0, 0.0]]),
        np.array([[0.0, 0.0], [10.0, 0.0]]),
        np.array([2.0, 8.0]),
        power=2,
    )

    assert np.all(predictions >= 2.0)
    assert np.all(predictions <= 8.0)


def test_idw_rejects_invalid_power_and_non_finite_inputs():
    with pytest.raises(InterpolationValidationError, match="power must be finite and positive"):
        idw_predict(np.array([[1.0, 0.0]]), np.array([[0.0, 0.0]]), np.array([1.0]), power=0)
    with pytest.raises(InterpolationValidationError, match="finite"):
        idw_predict(np.array([[np.nan, 0.0]]), np.array([[0.0, 0.0]]), np.array([1.0]), power=2)
