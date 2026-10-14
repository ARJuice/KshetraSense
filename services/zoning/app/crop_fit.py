from __future__ import annotations

from app.crop_profiles import PROFILE_VERSION, PROFILES, UNASSESSED_FEATURES
from app.schemas import CropFitRequest


def evaluate_crop_fit(request: CropFitRequest) -> dict:
    """Return factor-level reference comparisons without a crop-level verdict."""

    if request.profileVersion != PROFILE_VERSION:
        raise ValueError(
            f"Unsupported profileVersion '{request.profileVersion}'. Available: {PROFILE_VERSION}"
        )

    p_h = request.measurements.get("pH")
    ec = request.measurements.get("ec")
    assessments = []
    for profile in PROFILES:
        factors = [
            _ph_factor(p_h, profile.ph_min, profile.ph_max, profile.source_label, profile.source_url, profile.context),
            _ec_factor(ec, profile.ec_reference, profile.ec_source_label, profile.ec_source_url),
        ]
        factors.extend(_context_factor(name, request.measurements.get(name), reason) for name, reason in UNASSESSED_FEATURES)
        assessments.append(
            {
                "crop": profile.crop,
                "factors": factors,
                "limitations": [
                    "This report compares individual soil values with the cited context where possible; it does not decide whether the crop should be planted.",
                    "Climate, drainage, texture, rooting depth, cultivar, management, and seasonal water availability are not assessed.",
                ],
            }
        )
    return {
        "profileVersion": PROFILE_VERSION,
        "measurementContext": request.measurementContext,
        "assessments": assessments,
        "dataLimitations": [
            "This factor-by-factor reference report does not determine whether a crop should be planted or classify any crop as fit/suitable; it is not a recommendation, ranking, yield forecast, prescription, or crop-success probability.",
            "Zone means are area-weighted summaries of IDW cell estimates, not additional laboratory measurements; cell values are also estimates.",
            "Only pH is numerically compared with a cited interval, and that comparison is contextual rather than a planting decision. EC response context is shown but not thresholded because this workflow does not verify root-zone ECe method/context; N/P/K require method- and region-specific lab interpretation.",
            "Moisture and soil temperature are not collected by this field-zoning input, so no values or crop ranges are assessed for them.",
            "Each crop is displayed independently. No overall crop verdict or percentage split is calculated.",
        ],
    }


def _ph_factor(value: float | None, low: float, high: float, source_label: str, source_url: str, context: str) -> dict:
    if value is None:
        state = "not_provided"
        reason = "No pH value was supplied for this selected profile."
    elif value < low:
        state = "below_reference_range"
        reason = "The number is below this cited pH interval; source region, production system, depth, and test-method comparability are not validated. This is not a planting decision."
    elif value > high:
        state = "above_reference_range"
        reason = "The number is above this cited pH interval; source region, production system, depth, and test-method comparability are not validated. This is not a planting decision."
    else:
        state = "within_reference_range"
        reason = "The number falls inside this cited pH interval; source region, production system, depth, and test-method comparability are not validated. This single-factor comparison does not decide whether to plant."
    return {
        "feature": "pH",
        "observedValue": value,
        "unit": "pH",
        "state": state,
        "reason": reason,
        "supportedRange": {"min": low, "max": high, "unit": "pH"},
        "source": {"label": source_label, "url": source_url, "context": context},
    }


def _ec_factor(value: float | None, reference: str, source_label: str, source_url: str) -> dict:
    return {
        "feature": "ec",
        "observedValue": value,
        "unit": "dS/m",
        "state": "not_provided" if value is None else "context_required",
        "reason": (
            "No EC value was supplied for this selected profile."
            if value is None
            else "The published salinity response is for mean root-zone ECe from a saturation-paste extract; this single-depth field EC estimate and method are not verified as comparable. No threshold status is assigned."
        ),
        "referenceText": reference,
        "supportedRange": None,
        "source": {"label": source_label, "url": source_url, "context": "General FAO salinity reference; cultivar, climate, soil, and management can change crop response."},
    }


def _context_factor(feature: str, value: float | None, reason: str) -> dict:
    units = {
        "nitrogen": "mg/kg",
        "phosphorus": "mg/kg",
        "potassium": "mg/kg",
        "soilTemperature": "°C",
        "moisture": "Not supplied",
    }
    has_value = value is not None
    return {
        "feature": feature,
        "observedValue": value,
        "unit": units[feature],
        "state": "context_required" if has_value else "not_provided",
        "reason": reason if has_value else "This field-zoning run did not supply this value.",
        "referenceText": (
            "No validated numeric band configured; use a method-, region-, and crop-specific lab reference."
            if feature in {"nitrogen", "phosphorus", "potassium"}
            else "Not supplied by the field-zoning input."
        ),
        "supportedRange": None,
        "source": None,
    }
