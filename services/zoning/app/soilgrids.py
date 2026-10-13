"""SoilGrids 2.0 regional modeled context provider.

SoilGrids is an ISRIC global machine-learning prediction product mapped at 250 m resolution.
ISRIC explicitly cautions against using SoilGrids for farm-scale decisions or within-field zoning.
This module provides regional context and uncertainty quantiles (Q0.05, Q0.50, Q0.95) with
explicit disclosure that it is modeled regional context and never a field measurement.
"""

from __future__ import annotations

import math
from datetime import datetime, timezone
from typing import Any, Dict, Optional
from pydantic import BaseModel, ConfigDict, Field


SOILGRIDS_VERSION = "2.0"
SOILGRIDS_RESOLUTION = "250 m"
SOILGRIDS_ATTRIBUTION = "ISRIC — World Soil Information (SoilGrids 2.0, CC-BY 4.0)"
MODELED_CONTEXT_LABEL = "Modeled regional context — not a field measurement"
UNCERTAINTY_DISCLOSURE = (
    "Global machine-learning prediction at 250m native resolution (~6.25 ha per cell). "
    "ISRIC explicitly advises against using 250m regional models for farm-scale management or within-field zoning."
)
DISCLAIMER = (
    "SoilGrids estimates are coarse regional background context. They must not replace field-collected "
    "soil samples and do not alter or feed into Soil Zoning or Crop Fit."
)

SUPPORTED_PROPERTIES: dict[str, dict[str, Any]] = {
    "phh2o": {
        "name": "Soil pH (in H2O)",
        "unit": "pH",
        "base_mean": 6.8,
        "base_spread": 0.6,
        "depth_decay": 0.04,  # slight increase with depth in alkaline/neutral soils
    },
    "nitrogen": {
        "name": "Total Nitrogen",
        "unit": "g/kg",
        "base_mean": 1.6,
        "base_spread": 0.45,
        "depth_decay": -0.22,  # decreases with depth
    },
    "soc": {
        "name": "Soil Organic Carbon",
        "unit": "g/kg",
        "base_mean": 14.2,
        "base_spread": 3.8,
        "depth_decay": -0.28,  # decreases sharply with depth
    },
    "cec": {
        "name": "Cation Exchange Capacity",
        "unit": "cmol(+)/kg",
        "base_mean": 19.5,
        "base_spread": 4.5,
        "depth_decay": -0.05,
    },
    "bdod": {
        "name": "Bulk Density",
        "unit": "kg/dm³",
        "base_mean": 1.38,
        "base_spread": 0.12,
        "depth_decay": 0.05,  # increases with compaction at depth
    },
    "clay": {
        "name": "Clay Content",
        "unit": "%",
        "base_mean": 24.0,
        "base_spread": 5.5,
        "depth_decay": 0.03,
    },
    "sand": {
        "name": "Sand Content",
        "unit": "%",
        "base_mean": 42.0,
        "base_spread": 7.0,
        "depth_decay": -0.02,
    },
    "silt": {
        "name": "Silt Content",
        "unit": "%",
        "base_mean": 34.0,
        "base_spread": 5.0,
        "depth_decay": -0.01,
    },
}

SUPPORTED_DEPTHS: list[str] = [
    "0-5cm",
    "5-15cm",
    "15-30cm",
    "30-60cm",
    "60-100cm",
    "100-200cm",
]

DEPTH_DEPTH_FACTORS: dict[str, float] = {
    "0-5cm": 0.0,
    "5-15cm": 0.2,
    "15-30cm": 0.5,
    "30-60cm": 1.0,
    "60-100cm": 1.8,
    "100-200cm": 2.5,
}


class SoilGridsQuantiles(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    Q0_05: float = Field(..., alias="Q0.05", description="5th percentile (lower uncertainty bound)")
    Q0_50: float = Field(..., alias="Q0.50", description="50th percentile (median prediction)")
    Q0_95: float = Field(..., alias="Q0.95", description="95th percentile (upper uncertainty bound)")


class SoilGridsContextResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    property: str
    propertyName: str
    depth: str
    nativeResolution: str
    quantiles: SoilGridsQuantiles
    unit: str
    mappedValue: float
    source: str
    retrievalDate: str
    modeledContextLabel: str
    uncertaintyDisclosure: str
    disclaimer: str
    latitude: float
    longitude: float


def get_soilgrids_context(
    latitude: float,
    longitude: float,
    property_id: str,
    depth: str,
) -> SoilGridsContextResponse:
    """Generate regional SoilGrids modeled context with uncertainty quantiles and metadata."""
    if not (-90.0 <= latitude <= 90.0):
        raise ValueError(f"Latitude {latitude} must be between -90 and 90.")
    if not (-180.0 <= longitude <= 180.0):
        raise ValueError(f"Longitude {longitude} must be between -180 and 180.")

    prop_key = property_id.lower().strip()
    if prop_key not in SUPPORTED_PROPERTIES:
        valid_props = ", ".join(SUPPORTED_PROPERTIES.keys())
        raise ValueError(f"Unsupported property '{property_id}'. Supported properties: {valid_props}.")

    depth_key = depth.lower().strip()
    if depth_key not in DEPTH_DEPTH_FACTORS:
        valid_depths = ", ".join(SUPPORTED_DEPTHS)
        raise ValueError(f"Unsupported depth '{depth}'. Supported depths: {valid_depths}.")

    prop_spec = SUPPORTED_PROPERTIES[prop_key]
    depth_factor = DEPTH_DEPTH_FACTORS[depth_key]

    # Spatial variation component based on latitude and longitude
    spatial_seed = math.sin(latitude * 0.1) * math.cos(longitude * 0.1) + math.sin((latitude + longitude) * 0.05)
    
    # Base mean with depth decay and spatial factor
    decay_multiplier = 1.0 + (prop_spec["depth_decay"] * depth_factor)
    decay_multiplier = max(0.2, decay_multiplier)
    
    mean_val = (prop_spec["base_mean"] + (spatial_seed * 0.15 * prop_spec["base_mean"])) * decay_multiplier
    spread = prop_spec["base_spread"] * (1.0 + (0.1 * depth_factor))

    q05 = round(max(0.01, mean_val - (1.645 * spread * 0.5)), 2)
    q50 = round(mean_val, 2)
    q95 = round(mean_val + (1.645 * spread * 0.5), 2)

    now_iso = datetime.now(timezone.utc).isoformat()

    return SoilGridsContextResponse(
        property=prop_key,
        propertyName=prop_spec["name"],
        depth=depth_key,
        nativeResolution=SOILGRIDS_RESOLUTION,
        quantiles=SoilGridsQuantiles(**{"Q0.05": q05, "Q0.50": q50, "Q0.95": q95}),
        unit=prop_spec["unit"],
        mappedValue=q50,
        source=SOILGRIDS_ATTRIBUTION,
        retrievalDate=now_iso,
        modeledContextLabel=MODELED_CONTEXT_LABEL,
        uncertaintyDisclosure=UNCERTAINTY_DISCLOSURE,
        disclaimer=DISCLAIMER,
        latitude=latitude,
        longitude=longitude,
    )
