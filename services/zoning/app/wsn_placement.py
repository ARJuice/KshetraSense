from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from pyproj import Transformer
from shapely.geometry import Point, Polygon
from shapely.ops import nearest_points

from app.spatial import GridCell


@dataclass(frozen=True)
class WsnNodePlacement:
    zone_id: int
    cell_id: str
    position_utm: tuple[float, float]
    position_wgs84: tuple[float, float]
    zone_mean_shi: float


@dataclass(frozen=True)
class ClusterHeadPlacement:
    position_utm: tuple[float, float]
    position_wgs84: tuple[float, float]
    total_distance_to_nodes_m: float
    algorithm: str
    radio_coverage_validated: bool


@dataclass(frozen=True)
class WsnPlacementResult:
    wsn_nodes: list[WsnNodePlacement]
    cluster_head: ClusterHeadPlacement


def place_wsn_nodes(
    cells: list[GridCell],
    zone_labels: np.ndarray,
    zone_mean_shi: dict[int, float],
    field_polygon_utm: Polygon,
    utm_crs: str,
) -> WsnPlacementResult:
    """Suggest one in-zone cell medoid per contiguous zone and a field gateway point."""
    labels = np.asarray(zone_labels, dtype=int)
    if labels.ndim != 1 or len(labels) != len(cells) or not len(cells):
        raise ValueError("zone_labels must contain one zone ID for each field cell.")
    if not field_polygon_utm.is_valid or field_polygon_utm.is_empty:
        raise ValueError("field_polygon_utm must be a valid non-empty polygon.")

    to_wgs84 = Transformer.from_crs(utm_crs, "EPSG:4326", always_xy=True)
    nodes: list[WsnNodePlacement] = []
    for zone_id in sorted(np.unique(labels).tolist()):
        member_indices = np.flatnonzero(labels == zone_id)
        coordinates = np.asarray([cells[index].center_utm for index in member_indices], dtype=float)
        medoid_local_index = _medoid_index(coordinates)
        cell_index = int(member_indices[medoid_local_index])
        cell = cells[cell_index]
        nodes.append(
            WsnNodePlacement(
                zone_id=int(zone_id),
                cell_id=cell.id,
                position_utm=cell.center_utm,
                position_wgs84=cell.center_wgs84,
                zone_mean_shi=float(zone_mean_shi[int(zone_id)]),
            )
        )

    medoids = np.asarray([node.position_utm for node in nodes], dtype=float)
    gateway = _geometric_median(medoids)
    gateway_point = Point(float(gateway[0]), float(gateway[1]))
    if not field_polygon_utm.covers(gateway_point):
        gateway_point = nearest_points(field_polygon_utm, gateway_point)[0]
    gateway_utm = (float(gateway_point.x), float(gateway_point.y))
    longitude, latitude = to_wgs84.transform(*gateway_utm)
    return WsnPlacementResult(
        wsn_nodes=nodes,
        cluster_head=ClusterHeadPlacement(
            position_utm=gateway_utm,
            position_wgs84=(float(longitude), float(latitude)),
            total_distance_to_nodes_m=float(np.linalg.norm(medoids - np.asarray(gateway_utm), axis=1).sum()),
            algorithm="weiszfeld_geometric_median_projected_to_field",
            radio_coverage_validated=False,
        ),
    )


def _medoid_index(coordinates: np.ndarray) -> int:
    if len(coordinates) == 1:
        return 0
    distance_sums = np.empty(len(coordinates), dtype=float)
    for start in range(0, len(coordinates), 128):
        end = min(start + 128, len(coordinates))
        distances = np.linalg.norm(coordinates[start:end, None, :] - coordinates[None, :, :], axis=2)
        distance_sums[start:end] = distances.sum(axis=1)
    return int(np.argmin(distance_sums))


def _geometric_median(points: np.ndarray, tolerance: float = 1e-5, max_iterations: int = 256) -> np.ndarray:
    if len(points) == 1:
        return points[0].copy()
    estimate = points.mean(axis=0)
    for _ in range(max_iterations):
        distances = np.linalg.norm(points - estimate, axis=1)
        coincident = np.flatnonzero(distances <= tolerance)
        if len(coincident):
            return points[int(coincident[0])].copy()
        weights = 1.0 / distances
        updated = np.sum(points * weights[:, None], axis=0) / weights.sum()
        if np.linalg.norm(updated - estimate) <= tolerance:
            return updated
        estimate = updated
    return estimate
