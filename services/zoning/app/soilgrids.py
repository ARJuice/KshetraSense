"""SoilGrids provider boundary.

No verified ISRIC data adapter is configured in this build. Keep this endpoint unavailable
instead of generating values that resemble SoilGrids output.
"""

from __future__ import annotations

from typing import NoReturn


SOILGRIDS_VERSION = "2.0"
SUPPORTED_PROPERTIES = ("phh2o", "nitrogen", "soc", "cec", "bdod", "clay", "sand", "silt")
SUPPORTED_DEPTHS = ("0-5cm", "5-15cm", "15-30cm", "30-60cm", "60-100cm", "100-200cm")


class SoilGridsUnavailable(RuntimeError):
    """Raised until a verified ISRIC query or raster-backed adapter is configured."""


def get_soilgrids_context(
    latitude: float,
    longitude: float,
    property_id: str,
    depth: str,
) -> NoReturn:
    if not (-90.0 <= latitude <= 90.0):
        raise ValueError(f"Latitude {latitude} must be between -90 and 90.")
    if not (-180.0 <= longitude <= 180.0):
        raise ValueError(f"Longitude {longitude} must be between -180 and 180.")

    property_key = property_id.lower().strip()
    if property_key not in SUPPORTED_PROPERTIES:
        raise ValueError(f"Unsupported property '{property_id}'. Supported properties: {', '.join(SUPPORTED_PROPERTIES)}.")
    depth_key = depth.lower().strip()
    if depth_key not in SUPPORTED_DEPTHS:
        raise ValueError(f"Unsupported depth '{depth}'. Supported depths: {', '.join(SUPPORTED_DEPTHS)}.")

    raise SoilGridsUnavailable(
        "No verified ISRIC data adapter is configured. The SoilGrids beta REST API is currently paused; "
        "configure and validate a real WCS/WebDAV-backed query before enabling estimates."
    )
