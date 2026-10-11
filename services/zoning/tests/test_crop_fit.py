from app.crop_fit import evaluate_crop_fit
from app.crop_profiles import PROFILE_VERSION
from app.schemas import CropFitRequest


def test_crop_fit_is_independent_and_does_not_return_probabilities_or_ranking():
    result = evaluate_crop_fit(
        CropFitRequest(profileVersion=PROFILE_VERSION, measurements={"pH": 6.2, "nitrogen": 40.0})
    )

    assert [item["crop"] for item in result["assessments"]] == ["apple", "tomato", "potato"]
    assert "probability" in result["dataLimitations"][0].lower()
    for assessment in result["assessments"]:
        assert assessment["factors"][0]["state"] == "within_contextual_range"
        nitrogen = next(factor for factor in assessment["factors"] if factor["feature"] == "nitrogen")
        assert nitrogen["state"] == "not_assessed"


def test_crop_fit_without_ph_is_not_assessed():
    result = evaluate_crop_fit(CropFitRequest(measurements={"nitrogen": 40.0}))
    assert {item["assessmentState"] for item in result["assessments"]} == {"not_assessed"}
