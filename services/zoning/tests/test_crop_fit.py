from app.crop_fit import evaluate_crop_fit
from app.crop_profiles import PROFILE_VERSION
from app.schemas import CropFitRequest


def test_crop_report_shows_all_available_fields_without_a_crop_level_verdict():
    measurements = {"pH": 6.2, "ec": 3.4, "nitrogen": 18.0, "phosphorus": 9.0, "potassium": 42.0}
    result = evaluate_crop_fit(
        CropFitRequest(
            profileVersion=PROFILE_VERSION,
            measurements=measurements,
            measurementContext={"soilTestMethod": "Demo method", "sampleDepth": "0-15 cm", "ecMethod": "Not supplied"},
        )
    )

    assert [item["crop"] for item in result["assessments"]] == ["apple", "tomato", "potato"]
    assert all("assessmentState" not in item for item in result["assessments"])
    assert "does not determine whether a crop should be planted" in result["dataLimitations"][0]
    for assessment in result["assessments"]:
        factors = {factor["feature"]: factor for factor in assessment["factors"]}
        assert set(factors) == {"pH", "ec", "nitrogen", "phosphorus", "potassium", "soilTemperature", "moisture"}
        for feature, value in measurements.items():
            assert factors[feature]["observedValue"] == value
        assert factors["ec"]["state"] == "context_required"
        assert factors["nitrogen"]["state"] == "context_required"
        assert factors["phosphorus"]["state"] == "context_required"
        assert factors["potassium"]["state"] == "context_required"
        assert factors["moisture"]["state"] == "not_provided"
        assert factors["soilTemperature"]["state"] == "not_provided"


def test_pH_report_is_only_a_numeric_reference_comparison():
    result = evaluate_crop_fit(CropFitRequest(measurements={"pH": 5.7}))
    factors = {item["crop"]: {factor["feature"]: factor for factor in item["factors"]} for item in result["assessments"]}

    assert factors["apple"]["pH"]["state"] == "below_reference_range"
    assert factors["tomato"]["pH"]["state"] == "below_reference_range"
    assert factors["potato"]["pH"]["state"] == "within_reference_range"
    assert all(factors[crop]["ec"]["state"] == "not_provided" for crop in factors)


def test_crop_report_rejects_unknown_profile_versions():
    try:
        evaluate_crop_fit(CropFitRequest(profileVersion="unknown", measurements={"pH": 6.2}))
    except ValueError as error:
        assert "Unsupported profileVersion" in str(error)
    else:
        raise AssertionError("unknown crop reference profile version should be rejected")
