import pytest

from app.shi import DEFAULT_WEIGHTS, ScoringValidationError, compute_shi, score_property


def test_project_shi_uses_bell_shaped_ph_and_normalized_weights():
    left = score_property("pH", 5.7)
    right = score_property("pH", 7.3)
    scored = compute_shi(
        {"pH": 6.5, "ec": 0.5, "nitrogen": 100, "phosphorus": 40, "potassium": 200},
        {"pH": 0.5, "ec": 0.5, "nitrogen": 0.0, "phosphorus": 0.0, "potassium": 0.0},
    )

    assert left == pytest.approx(right)
    assert scored["scores"]["pH"] == 1.0
    assert scored["shi"] == pytest.approx(98.8511315045)
    assert sum(scored["weights"].values()) == pytest.approx(1.0)


def test_project_shi_defaults_are_non_crop_specific_and_rank_salinity_lower():
    normal = compute_shi({"pH": 6.5, "ec": 0.5, "nitrogen": 100, "phosphorus": 40, "potassium": 200})
    saline = compute_shi({"pH": 6.5, "ec": 4.5, "nitrogen": 100, "phosphorus": 40, "potassium": 200})

    assert sum(DEFAULT_WEIGHTS.values()) == pytest.approx(1.0)
    assert 0 <= saline["shi"] < normal["shi"] <= 100
    assert saline["scores"]["ec"] < normal["scores"]["ec"]


def test_project_shi_rejects_invalid_values_and_weights():
    with pytest.raises(ScoringValidationError, match="finite"):
        compute_shi({"pH": float("nan"), "ec": 0.5, "nitrogen": 100, "phosphorus": 40, "potassium": 200})
    with pytest.raises(ScoringValidationError, match="non-negative"):
        compute_shi({"pH": 6.5, "ec": -1, "nitrogen": 100, "phosphorus": 40, "potassium": 200})
    with pytest.raises(ScoringValidationError, match="positive total weight"):
        compute_shi(
            {"pH": 6.5, "ec": 0.5, "nitrogen": 100, "phosphorus": 40, "potassium": 200},
            {key: 0.0 for key in DEFAULT_WEIGHTS},
        )
