from __future__ import annotations

from typing import Any


def evaluate_fao56_advisory(
    *,
    current_vwc_fraction: float,
    forecast_vwc_fractions: list[float],
    field_capacity_vwc_fraction: float,
    wilting_point_vwc_fraction: float,
    rooting_depth_m: float,
    depletion_fraction: float,
    calibration_source: str,
) -> dict[str, Any]:
    values = [
        current_vwc_fraction,
        field_capacity_vwc_fraction,
        wilting_point_vwc_fraction,
        *forecast_vwc_fractions,
    ]
    if any(not 0.0 <= value <= 1.0 for value in values):
        raise ValueError("VWC inputs must be fractions in the range 0 to 1 m³/m³.")
    if wilting_point_vwc_fraction >= field_capacity_vwc_fraction:
        raise ValueError("Wilting point must be below field capacity.")
    if rooting_depth_m <= 0.0 or rooting_depth_m > 5.0:
        raise ValueError("Effective rooting depth must be greater than 0 and at most 5 m.")
    if not 0.1 <= depletion_fraction <= 0.8:
        raise ValueError("FAO-56 depletion fraction p must be within 0.1 to 0.8.")
    if not calibration_source.strip():
        raise ValueError("A calibration/source note is required.")

    total_available_water_mm = 1000.0 * (
        field_capacity_vwc_fraction - wilting_point_vwc_fraction
    ) * rooting_depth_m
    readily_available_water_mm = depletion_fraction * total_available_water_mm
    threshold = field_capacity_vwc_fraction - depletion_fraction * (
        field_capacity_vwc_fraction - wilting_point_vwc_fraction
    )
    crossing_values = [current_vwc_fraction, *forecast_vwc_fractions]
    crossed = any(value <= threshold for value in crossing_values)
    return {
        "basis": "FAO-56 total/readily available water screening",
        "calibrationSource": calibration_source.strip(),
        "calibrationIndependentlyVerified": False,
        "units": {"vwc": "m³/m³", "rootingDepth": "m", "waterDepth": "mm"},
        "totalAvailableWaterMm": total_available_water_mm,
        "readilyAvailableWaterMm": readily_available_water_mm,
        "thresholdVwcFraction": threshold,
        "currentVwcFraction": current_vwc_fraction,
        "forecastVwcFractions": forecast_vwc_fractions,
        "thresholdCrossed": crossed,
        "advisory": "human_review_recommended" if crossed else "no_threshold_crossing_in_supplied_values",
        "actuation": "none",
        "limitations": [
            "Inputs are range-checked but the source note and site calibration are not independently verified.",
            "This screening does not calculate crop ET, effective rainfall, irrigation efficiency, or delivery volume.",
            "Do not pass the historical replay's soil humidity %RH signal as VWC.",
        ],
    }
