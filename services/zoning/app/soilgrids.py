"""Regional SoilGrids context backed by ISRIC's public WCS GeoTIFF service."""

from __future__ import annotations

from datetime import datetime, timezone
from io import BytesIO
import math
import os
from typing import Any

import httpx
import tifffile


SOILGRIDS_VERSION = "2.0"
SOILGRIDS_STATUS = "configured-via-isric-wcs"
SUPPORTED_PROPERTIES = ("phh2o", "nitrogen", "soc", "cec", "bdod", "clay", "sand", "silt")
SUPPORTED_DEPTHS = ("0-5cm", "5-15cm", "15-30cm", "30-60cm", "60-100cm", "100-200cm")

_WCS_URL = os.getenv("SOILGRIDS_WCS_URL", "https://maps.isric.org/mapserv")
_WGS84_CRS = "http://www.opengis.net/def/crs/EPSG/0/4326"
_QUERY_HALF_WIDTH = 0.005
_MAX_GEOTIFF_BYTES = 1024 * 1024
_MAX_GRID_CELLS = 256
_PROPERTY_INFO: dict[str, tuple[str, str, int]] = {
    # SoilGrids stores integer rasters; the last value is its documented scale factor.
    "phh2o": ("pH in water", "pH", 10),
    "nitrogen": ("Total nitrogen", "g/kg", 100),
    "soc": ("Soil organic carbon", "g/kg", 10),
    "cec": ("Cation exchange capacity at pH 7", "cmol(c)/kg", 10),
    "bdod": ("Bulk density", "kg/dm³", 100),
    "clay": ("Clay content", "%", 10),
    "sand": ("Sand content", "%", 10),
    "silt": ("Silt content", "%", 10),
}


class SoilGridsUnavailable(RuntimeError):
    """Raised when the public WCS cannot provide a validated cell value."""


def _bounded_interval(center: float, minimum: float, maximum: float) -> tuple[float, float]:
    return max(minimum, center - _QUERY_HALF_WIDTH), min(maximum, center + _QUERY_HALF_WIDTH)


def _coverage_params(
    latitude: float,
    longitude: float,
    property_key: str,
    depth_key: str,
    quantile: str,
) -> list[tuple[str, str]]:
    south, north = _bounded_interval(latitude, -90.0, 90.0)
    west, east = _bounded_interval(longitude, -180.0, 180.0)
    return [
        ("map", f"/map/{property_key}.map"),
        ("SERVICE", "WCS"),
        ("VERSION", "2.0.1"),
        ("REQUEST", "GetCoverage"),
        ("COVERAGEID", f"{property_key}_{depth_key}_{quantile}"),
        ("FORMAT", "GEOTIFF_INT16"),
        ("SUBSET", f"Lat({south:.6f},{north:.6f})"),
        ("SUBSET", f"Long({west:.6f},{east:.6f})"),
        ("SUBSETTINGCRS", _WGS84_CRS),
        ("OUTPUTCRS", _WGS84_CRS),
    ]


def _fetch_geotiff(params: list[tuple[str, str]]) -> bytes:
    try:
        with httpx.stream("GET", _WCS_URL, params=params, timeout=8.0, follow_redirects=False) as response:
            response.raise_for_status()
            content_type = response.headers.get("content-type", "").split(";", 1)[0].strip().lower()
            if content_type not in {"image/tiff", "application/tiff"}:
                raise SoilGridsUnavailable(
                    f"ISRIC SoilGrids WCS returned {content_type or 'an unknown content type'} instead of GeoTIFF."
                )

            payload = bytearray()
            for chunk in response.iter_bytes(8192):
                if len(payload) + len(chunk) > _MAX_GEOTIFF_BYTES:
                    raise SoilGridsUnavailable("ISRIC SoilGrids WCS returned an unexpectedly large raster subset.")
                payload.extend(chunk)
            return bytes(payload)
    except httpx.HTTPStatusError as error:
        raise SoilGridsUnavailable(f"ISRIC SoilGrids WCS returned HTTP {error.response.status_code}.") from error
    except httpx.RequestError as error:
        raise SoilGridsUnavailable("ISRIC SoilGrids WCS could not be reached; retry when the provider is available.") from error


def _sample_raw_cell(content: bytes, latitude: float, longitude: float) -> int:
    try:
        with tifffile.TiffFile(BytesIO(content)) as raster:
            if len(raster.pages) != 1:
                raise ValueError("Expected one raster page.")
            page = raster.pages[0]
            shape = page.shape
            if (
                len(shape) != 2
                or math.prod(shape) == 0
                or math.prod(shape) > _MAX_GRID_CELLS
                or page.samplesperpixel != 1
                or page.dtype.kind not in "iu"
            ):
                raise ValueError("The returned GeoTIFF is not a bounded, single-band integer grid.")
            pixel_scale_tag = page.tags.get("ModelPixelScaleTag")
            tiepoint_tag = page.tags.get("ModelTiepointTag")
            if (
                pixel_scale_tag is None
                or tiepoint_tag is None
            ):
                raise ValueError("The returned GeoTIFF is not a bounded, georeferenced, single-band integer grid.")

            values = page.asarray()
            if values.shape != shape:
                raise ValueError("The decoded GeoTIFF dimensions do not match its image directory.")

            scale_x, scale_y = float(pixel_scale_tag.value[0]), float(pixel_scale_tag.value[1])
            tiepoint = tiepoint_tag.value
            west, north = float(tiepoint[3]), float(tiepoint[4])
            height, width = values.shape
            if not all(math.isfinite(value) for value in (scale_x, scale_y, west, north)) or scale_x <= 0 or scale_y <= 0:
                raise ValueError("The returned GeoTIFF has invalid georeferencing.")

            east = west + width * scale_x
            south = north - height * scale_y
            tolerance = max(scale_x, scale_y) * 1e-6
            if not (west - tolerance <= longitude <= east + tolerance and south - tolerance <= latitude <= north + tolerance):
                raise ValueError("The requested coordinate is outside the returned raster subset.")

            row = min(height - 1, max(0, math.floor((north - latitude) / scale_y)))
            column = min(width - 1, max(0, math.floor((longitude - west) / scale_x)))
            return int(values[row, column])
    except (tifffile.TiffFileError, IndexError, KeyError, TypeError, ValueError, OverflowError) as error:
        raise SoilGridsUnavailable("ISRIC SoilGrids WCS returned an invalid or unusable GeoTIFF subset.") from error


def _query_quantile(
    latitude: float,
    longitude: float,
    property_key: str,
    depth_key: str,
    quantile: str,
) -> float:
    params = _coverage_params(latitude, longitude, property_key, depth_key, quantile)
    content = _fetch_geotiff(params)
    raw_value = _sample_raw_cell(content, latitude, longitude)
    if raw_value <= 0:
        # ISRIC's source VRTs use -32768 for NoData; WCS GeoTIFF subsets expose masked cells as zero.
        raise SoilGridsUnavailable(
            "No SoilGrids value is mapped at this coordinate and depth (the location may be masked or outside the land coverage)."
        )
    return raw_value / _PROPERTY_INFO[property_key][2]


def get_soilgrids_context(
    latitude: float,
    longitude: float,
    property_id: str,
    depth: str,
) -> dict[str, Any]:
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

    q05, q50, q95 = (
        _query_quantile(latitude, longitude, property_key, depth_key, quantile)
        for quantile in ("Q0.05", "Q0.5", "Q0.95")
    )
    if not q05 <= q50 <= q95:
        raise SoilGridsUnavailable("ISRIC SoilGrids returned inconsistent prediction quantiles for this cell.")

    property_name, unit, _ = _PROPERTY_INFO[property_key]
    return {
        "property": property_key,
        "propertyName": property_name,
        "depth": depth_key,
        "nativeResolution": "250 m nominal",
        "quantiles": {"Q0.05": q05, "Q0.50": q50, "Q0.95": q95},
        "unit": unit,
        "mappedValue": q50,
        "source": "ISRIC SoilGrids 2.0 WCS (CC BY 4.0)",
        "retrievalDate": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "modeledContextLabel": "SoilGrids regional model context · not a field measurement",
        "uncertaintyDisclosure": "Q0.05–Q0.95 are SoilGrids prediction quantiles for a nominal 250 m grid cell; they are not uncertainty bounds for a local laboratory result.",
        "disclaimer": "Use as broad regional context only. SoilGrids is not a field sample and is not passed into Soil Zoning or Crop Fit.",
        "latitude": latitude,
        "longitude": longitude,
    }
