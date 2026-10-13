from __future__ import annotations

import math

SOIL_PROPERTIES = ("pH", "ec", "nitrogen", "phosphorus", "potassium")
DEFAULT_WEIGHTS = {"pH": 0.25, "ec": 0.20, "nitrogen": 0.20, "phosphorus": 0.15, "potassium": 0.20}


class ScoringValidationError(ValueError):
    """A soil value or score weight is outside the supported domain."""


def score_property(property_name: str, raw_value: float) -> float:
    """Map a soil reading to the project's provisional 0–1 screening scale."""
    if property_name not in SOIL_PROPERTIES:
        raise ScoringValidationError(f"Unsupported SHI property: {property_name}.")
    value = float(raw_value)
    if not math.isfinite(value):
        raise ScoringValidationError(f"{property_name} must be finite.")
    if property_name == "pH":
        if not 0 <= value <= 14:
            raise ScoringValidationError("pH must be between 0 and 14.")
        return math.exp(-((value - 6.5) ** 2) / (2 * 0.8**2))
    if value < 0:
        raise ScoringValidationError(f"{property_name} must be non-negative.")
    if property_name == "ec":
        return _logistic(-2.5 * (value - 2.0))
    midpoint, slope = {
        "nitrogen": (60.0, 0.06),
        "phosphorus": (25.0, 0.12),
        "potassium": (150.0, 0.03),
    }[property_name]
    return _logistic(slope * (value - midpoint))


def compute_shi(values: dict[str, float], weights: dict[str, float] | None = None) -> dict:
    """Return a project-defined composite screening score and its components."""
    if set(values) != set(SOIL_PROPERTIES):
        missing = sorted(set(SOIL_PROPERTIES) - set(values))
        extra = sorted(set(values) - set(SOIL_PROPERTIES))
        raise ScoringValidationError(f"SHI requires exactly pH, ec, nitrogen, phosphorus, and potassium; missing={missing}, extra={extra}.")
    raw_weights = dict(DEFAULT_WEIGHTS if weights is None else weights)
    if set(raw_weights) != set(SOIL_PROPERTIES):
        raise ScoringValidationError("weights must contain every supported SHI property exactly once.")
    normalized_weights = {name: float(weight) for name, weight in raw_weights.items()}
    if any(not math.isfinite(weight) or weight < 0 for weight in normalized_weights.values()):
        raise ScoringValidationError("weights must be finite and non-negative.")
    total_weight = sum(normalized_weights.values())
    if total_weight <= 0:
        raise ScoringValidationError("weights must have a positive total weight.")
    normalized_weights = {name: weight / total_weight for name, weight in normalized_weights.items()}
    scores = {name: score_property(name, values[name]) for name in SOIL_PROPERTIES}
    score = 100.0 * sum(normalized_weights[name] * scores[name] for name in SOIL_PROPERTIES)
    return {
        "scores": scores,
        "shi": score,
        "weights": normalized_weights,
        "indexName": "KshetraSense Soil Health Index (SHI)",
        "interpretation": "Project-defined screening score; not an official USDA/NRCS index or crop-specific suitability result.",
    }


def _logistic(value: float) -> float:
    # Clipping keeps extreme but valid lab readings away from exp overflow.
    return 1.0 / (1.0 + math.exp(-max(-60.0, min(60.0, value))))
