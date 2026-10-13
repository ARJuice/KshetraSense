from app.main import app  # noqa: F401 — imports the repository root for the telemetry namespace.
from services.telemetry.app.water_balance import evaluate_fao56_advisory
import pytest


def test_fao56_taw_raw_and_threshold_match_hand_calculation():
    result = evaluate_fao56_advisory(
        current_vwc_fraction=0.26,
        forecast_vwc_fractions=[0.24],
        field_capacity_vwc_fraction=0.32,
        wilting_point_vwc_fraction=0.14,
        rooting_depth_m=0.7,
        depletion_fraction=0.4,
        calibration_source="measured plot profile, 2026-10-01",
    )

    assert result["totalAvailableWaterMm"] == pytest.approx(126.0)
    assert result["readilyAvailableWaterMm"] == pytest.approx(50.4)
    assert result["thresholdVwcFraction"] == pytest.approx(0.248)
    assert result["thresholdCrossed"] is True
    assert result["actuation"] == "none"
    assert result["calibrationIndependentlyVerified"] is False


def test_fao56_calculator_rejects_invalid_site_parameters():
    with pytest.raises(ValueError, match="Wilting point"):
        evaluate_fao56_advisory(
            current_vwc_fraction=0.2,
            forecast_vwc_fractions=[],
            field_capacity_vwc_fraction=0.2,
            wilting_point_vwc_fraction=0.2,
            rooting_depth_m=0.7,
            depletion_fraction=0.4,
            calibration_source="lab",
        )
