from __future__ import annotations

from app.crop_profiles import PROFILE_VERSION, PROFILES, UNASSESSED_FEATURES
from app.schemas import CropFitRequest


def evaluate_crop_fit(request: CropFitRequest) -> dict:
    """Evaluate source-backed factors only; do not create a composite or ranking."""

    if request.profileVersion != PROFILE_VERSION:
        raise ValueError(
            f"Unsupported profileVersion '{request.profileVersion}'. Available: {PROFILE_VERSION}"
        )

    p_h = request.measurements.get("pH")
    assessments = []
    for profile in PROFILES:
        factors = [
            _ph_factor(p_h, profile.ph_min, profile.ph_max, profile.source_label, profile.source_url, profile.context)
        ]
        factors.extend(_unassessed_factor(name, request.measurements.get(name), reason) for name, reason in UNASSESSED_FEATURES)
        assessments.append(
            {
                "crop": profile.crop,
                "assessmentState": _assessment_state(factors),
                "factors": factors,
                "limitations": [
                    "This is a limited soil-profile screen, not a crop-success probability, yield forecast, prescription, or full land-suitability class.",
                    "Climate, drainage, texture, rooting depth, cultivar, management, and seasonal water availability are not assessed.",
                ],
            }
        )
    return {
        "profileVersion": PROFILE_VERSION,
        "measurementContext": request.measurementContext,
        "assessments": assessments,
        "dataLimitations": [
            "Each crop is evaluated independently. A result is not a probability, is not ranked, and does not sum to 100% with the other crops.",
            "Only pH has a configured source-backed range in this service version; all other supplied values remain visible but unassessed.",
        ],
    }


def _ph_factor(value: float | None, low: float, high: float, source_label: str, source_url: str, context: str) -> dict:
    if value is None:
        state = "not_assessed"
        reason = "No pH measurement was supplied."
    elif low <= value <= high:
        state = "within_contextual_range"
        reason = "Observed mean is within this profile's contextual pH range."
    else:
        state = "outside_contextual_range"
        direction = "below" if value < low else "above"
        reason = f"Observed mean is {direction} this profile's contextual pH range."
    return {
        "feature": "pH",
        "observedValue": value,
        "unit": "pH",
        "state": state,
        "reason": reason,
        "supportedRange": {"min": low, "max": high, "unit": "pH"},
        "source": {"label": source_label, "url": source_url, "context": context},
    }


def _unassessed_factor(feature: str, value: float | None, reason: str) -> dict:
    units = {
        "nitrogen": "mg/kg",
        "phosphorus": "mg/kg",
        "potassium": "mg/kg",
        "ec": "dS/m",
        "soilTemperature": "°C",
        "moisture": "unspecified",
    }
    return {
        "feature": feature,
        "observedValue": value,
        "unit": units[feature],
        "state": "not_assessed",
        "reason": reason,
        "supportedRange": None,
        "source": None,
    }


def _assessment_state(factors: list[dict]) -> str:
    ph = factors[0]
    if ph["state"] == "not_assessed":
        return "not_assessed"
    return "limited_screen_complete"
