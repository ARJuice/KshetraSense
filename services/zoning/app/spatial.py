from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Any

import numpy as np
from pyproj import Transformer
from shapely import contains_xy, transform
from shapely.geometry import Polygon, box

MAX_FIELD_CELLS = 5_000
MAX_GRID_CANDIDATES = 100_000


class SpatialValidationError(ValueError):
    """A field boundary cannot safely be converted to a local metric grid."""


@dataclass(frozen=True)
class GridCell:
    id: str
    row: int
    column: int
    center_utm: tuple[float, float]
    center_wgs84: tuple[float, float]
    area_m2: float


@dataclass(frozen=True)
class DiscretizedField:
    polygon_wgs84: list[list[list[float]]]
    polygon_utm: Polygon
    utm_crs: str
    cell_size_m: float
    area_hectares: float
    cells: list[GridCell]
    bounding_box_utm: dict[str, float]


def discretize_field(boundary: dict[str, Any], cell_size_m: float) -> DiscretizedField:
    """Project a WGS84 GeoJSON polygon and retain cells whose centers it covers."""
    if not math.isfinite(cell_size_m) or cell_size_m <= 0:
        raise SpatialValidationError("cell_size_m must be a finite positive number.")
    if not isinstance(boundary, dict) or boundary.get("type") != "Polygon":
        raise SpatialValidationError("boundary must be a GeoJSON Polygon.")
    if boundary.get("crs", "EPSG:4326").upper() not in {"EPSG:4326", "OGC:CRS84"}:
        raise SpatialValidationError("boundary coordinates must use WGS84 longitude/latitude (EPSG:4326).")

    rings = _validate_rings(boundary.get("coordinates"))
    polygon_wgs84 = Polygon(rings[0], rings[1:])
    if not polygon_wgs84.is_valid or polygon_wgs84.is_empty:
        raise SpatialValidationError("boundary must be a valid, non-self-intersecting polygon.")
    if polygon_wgs84.area <= 0:
        raise SpatialValidationError("boundary must enclose a non-zero area.")

    min_lon, min_lat, max_lon, max_lat = polygon_wgs84.bounds
    if max_lon - min_lon > 180:
        raise SpatialValidationError("boundaries crossing the antimeridian are not supported.")
    representative = polygon_wgs84.representative_point()
    if not -80 <= representative.y <= 84:
        raise SpatialValidationError("UTM projection is supported between 80°S and 84°N.")
    zone = min(60, max(1, int((representative.x + 180) // 6) + 1))
    epsg = (32600 if representative.y >= 0 else 32700) + zone
    utm_crs = f"EPSG:{epsg}"
    to_utm = Transformer.from_crs("EPSG:4326", utm_crs, always_xy=True)
    to_wgs84 = Transformer.from_crs(utm_crs, "EPSG:4326", always_xy=True)
    polygon_utm = transform(polygon_wgs84, to_utm.transform, interleaved=False)
    if not polygon_utm.is_valid or polygon_utm.area <= 0:
        raise SpatialValidationError("boundary could not be transformed into a valid UTM polygon.")

    min_x, min_y, max_x, max_y = polygon_utm.bounds
    columns = math.ceil((max_x - min_x) / cell_size_m)
    rows = math.ceil((max_y - min_y) / cell_size_m)
    candidates = rows * columns
    if candidates > MAX_GRID_CANDIDATES:
        raise SpatialValidationError(
            f"The boundary requires {candidates:,} candidate cells; reduce the field extent or use a larger cell size."
        )

    x_centers = min_x + (np.arange(columns, dtype=float) + 0.5) * cell_size_m
    y_centers = max_y - (np.arange(rows, dtype=float) + 0.5) * cell_size_m
    xx, yy = np.meshgrid(x_centers, y_centers)
    inside = contains_xy(polygon_utm, xx, yy)
    row_indices, column_indices = np.nonzero(inside)
    if len(row_indices) > MAX_FIELD_CELLS:
        raise SpatialValidationError(
            f"The field creates {len(row_indices):,} cells; the maximum supported by this API is {MAX_FIELD_CELLS:,}."
        )
    if not len(row_indices):
        raise SpatialValidationError("The boundary contains no cell centers at the requested cell size.")

    cells: list[GridCell] = []
    half_size = cell_size_m / 2
    for index, (row, column) in enumerate(zip(row_indices, column_indices, strict=True), start=1):
        x = float(xx[row, column])
        y = float(yy[row, column])
        clipped_area = polygon_utm.intersection(box(x - half_size, y - half_size, x + half_size, y + half_size)).area
        lon, lat = to_wgs84.transform(x, y)
        cells.append(
            GridCell(
                id=f"cell-{index:04d}",
                row=int(row),
                column=int(column),
                center_utm=(x, y),
                center_wgs84=(float(lon), float(lat)),
                area_m2=float(clipped_area),
            )
        )

    return DiscretizedField(
        polygon_wgs84=[[[float(x), float(y)] for x, y in ring] for ring in rings],
        polygon_utm=polygon_utm,
        utm_crs=utm_crs,
        cell_size_m=float(cell_size_m),
        area_hectares=float(polygon_utm.area / 10_000),
        cells=cells,
        bounding_box_utm={
            "minX": float(min_x),
            "minY": float(min_y),
            "maxX": float(max_x),
            "maxY": float(max_y),
        },
    )


def project_coordinate(latitude: float, longitude: float, utm_crs: str) -> tuple[float, float]:
    """Convert a WGS84 coordinate to the field's projected CRS."""
    if not math.isfinite(latitude) or not math.isfinite(longitude):
        raise SpatialValidationError("sample coordinates must be finite numbers.")
    if not -90 <= latitude <= 90 or not -180 <= longitude <= 180:
        raise SpatialValidationError("sample coordinates must be valid WGS84 latitude/longitude.")
    transformer = Transformer.from_crs("EPSG:4326", utm_crs, always_xy=True)
    easting, northing = transformer.transform(longitude, latitude)
    return float(easting), float(northing)


def _validate_rings(coordinates: Any) -> list[list[tuple[float, float]]]:
    if not isinstance(coordinates, list) or not coordinates:
        raise SpatialValidationError("boundary coordinates must contain an outer ring.")
    rings: list[list[tuple[float, float]]] = []
    for ring_index, ring in enumerate(coordinates):
        if not isinstance(ring, list) or len(ring) < 4:
            raise SpatialValidationError("each polygon ring must contain at least four coordinates including closure.")
        points: list[tuple[float, float]] = []
        for coordinate in ring:
            if not isinstance(coordinate, (list, tuple)) or len(coordinate) != 2:
                raise SpatialValidationError("boundary coordinates must be [longitude, latitude] pairs.")
            lon, lat = coordinate
            if not isinstance(lon, (int, float)) or not isinstance(lat, (int, float)):
                raise SpatialValidationError("boundary coordinates must be numeric.")
            lon, lat = float(lon), float(lat)
            if not math.isfinite(lon) or not math.isfinite(lat):
                raise SpatialValidationError("boundary coordinates must be finite.")
            if not -180 <= lon <= 180 or not -80 <= lat <= 84:
                raise SpatialValidationError("boundary coordinates must be valid UTM-supported WGS84 values.")
            points.append((lon, lat))
        if points[0] != points[-1]:
            raise SpatialValidationError("each GeoJSON polygon ring must be closed.")
        if len(set(points[:-1])) < 3:
            raise SpatialValidationError("each polygon ring must contain at least three distinct vertices.")
        if ring_index and not Polygon(rings[0]).contains(Polygon(points).representative_point()):
            raise SpatialValidationError("polygon holes must lie inside the outer boundary.")
        rings.append(points)
    return rings
