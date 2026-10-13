from __future__ import annotations

import hashlib
import json
from collections import defaultdict
from datetime import UTC, datetime
from time import perf_counter

import numpy as np
from pyproj import Transformer
from shapely import transform as transform_geometry
from shapely.geometry import Point, box, mapping
from shapely.ops import unary_union

from app.algorithms import fuzzy_c_means, kmeans_plus_plus, silhouette_score
from app.clustering import (
    ClusteringValidationError,
    auto_select_k,
    merge_adjacent_zones,
    split_disconnected_zones,
)
from app.interpolation import (
    InterpolatedField,
    InterpolationValidationError,
    ProjectedSoilSample,
    SOIL_PROPERTIES,
    interpolate_field,
)
from app.schemas import FieldZoningRequest, ZoningRequest
from app.shi import DEFAULT_WEIGHTS, ScoringValidationError, compute_shi
from app.spatial import DiscretizedField, SpatialValidationError, discretize_field, project_coordinate
from app.validation import (
    StabilityValidationError,
    adjusted_rand_index,
    align_cluster_labels,
    noise_model_summary,
    perturb_samples,
)
from app.wsn_placement import place_wsn_nodes

ALGORITHM_VERSION = "zoning-1.0.0"
NORMALIZATION_VERSION = "zscore-1"


class ZoningValidationError(ValueError):
    pass


def run_zoning(request: ZoningRequest) -> dict:
    prepared = _prepare_matrix(request)
    data = prepared["data"]
    means = data.mean(axis=0)
    std_devs = data.std(axis=0)
    normalized = (data - means) / std_devs

    is_fcm = request.method in {"fcm", "fuzzy-c-means"}
    if not is_fcm:
        result = kmeans_plus_plus(normalized, request.clusterCount, request.seed)
        labels = result.labels
        memberships = None
        algorithm_diagnostics = {
            "inertia": _number(result.inertia),
            "iterations": result.iterations,
            "converged": result.converged,
            "centerSnapshots": _center_snapshots(result.center_history, means, std_devs, prepared["features"]),
        }
        centers_normalized = result.centers
    else:
        result = fuzzy_c_means(
            normalized,
            request.clusterCount,
            request.seed,
            request.fcm.fuzziness,
            request.fcm.maxIterations,
            request.fcm.tolerance,
        )
        labels = result.labels
        memberships = result.memberships
        algorithm_diagnostics = {
            "objective": _number(result.objective),
            "fuzzyPartitionCoefficient": _number(result.fpc),
            "iterations": result.iterations,
            "converged": result.converged,
            "centerSnapshots": _center_snapshots(result.center_history, means, std_devs, prepared["features"]),
        }
        centers_normalized = result.centers

    centers_raw = centers_normalized * std_devs + means
    assignments = _assignments(prepared["cells"], labels, memberships)
    zones = _zone_summaries(
        prepared["cells"], data, labels, memberships, prepared["features"], centers_raw, std_devs
    )
    run_id = _run_id(request, prepared["features"])
    return {
        "runId": run_id,
        "scenarioId": request.scenarioId,
        "gridRevision": request.gridRevision,
        "method": "fuzzy-c-means" if is_fcm else "kmeans",
        "clusterCount": request.clusterCount,
        "parameters": {
            "clusterCount": request.clusterCount,
            "seed": request.seed,
            **({"fcm": request.fcm.model_dump()} if is_fcm else {}),
        },
        "versions": {"algorithm": ALGORITHM_VERSION, "normalization": NORMALIZATION_VERSION},
        "featureSchema": {
            "requested": request.features,
            "included": prepared["features"],
            "excluded": prepared["excludedFeatures"],
            "normalization": [
                {"feature": feature, "mean": _number(means[index]), "stdDev": _number(std_devs[index])}
                for index, feature in enumerate(prepared["features"])
            ],
        },
        "excludedCells": prepared["excludedCells"],
        "assignments": {item["cellId"]: item["zoneId"] for item in assignments},
        "assignmentDetails": assignments,
        **(
            {"memberships": {item["cellId"]: item["memberships"] for item in assignments}}
            if memberships is not None
            else {}
        ),
        "zones": zones,
        "adjacency": _adjacency(prepared["cells"], labels),
        "diagnostics": {
            **algorithm_diagnostics,
            "silhouette": _optional_number(silhouette_score(normalized, labels)),
            "includedCellCount": len(prepared["cells"]),
            "excludedCellCount": len(prepared["excludedCells"]),
            "clusterSizes": [int(np.sum(labels == zone_id)) for zone_id in range(request.clusterCount)],
        },
        "silhouetteScore": _optional_number(silhouette_score(normalized, labels)),
        "inputFingerprint": _input_fingerprint(request, prepared["features"]),
        "createdAt": datetime.now(UTC).isoformat(),
    }


def _prepare_matrix(request: ZoningRequest) -> dict:
    cells = []
    excluded_cells = []
    for cell in request.cells:
        missing = [feature for feature in request.features if cell.values.get(feature) is None]
        if missing:
            excluded_cells.append({"cellId": cell.id, "reason": f"Missing requested feature(s): {', '.join(missing)}"})
        else:
            cells.append(cell)
    if len(cells) < request.clusterCount:
        raise ZoningValidationError(
            f"At least {request.clusterCount} complete cells are required after exclusions; received {len(cells)}."
        )
    full_data = np.asarray([[cell.values[feature] for feature in request.features] for cell in cells], dtype=float)
    variable_indices = [index for index in range(len(request.features)) if not np.isclose(full_data[:, index].std(), 0.0)]
    excluded_features = [
        {"feature": feature, "reason": "No variation across complete cells; cannot distinguish zones."}
        for index, feature in enumerate(request.features)
        if index not in variable_indices
    ]
    if not variable_indices:
        raise ZoningValidationError("No requested feature has variation across complete cells.")
    variable_data = full_data[:, variable_indices]
    unique_profiles = len(np.unique(variable_data, axis=0))
    if unique_profiles < request.clusterCount:
        raise ZoningValidationError(
            f"At least {request.clusterCount} distinct complete soil profiles are required after exclusions; received {unique_profiles}."
        )
    return {
        "cells": cells,
        "data": variable_data,
        "features": [request.features[index] for index in variable_indices],
        "excludedFeatures": excluded_features,
        "excludedCells": excluded_cells,
    }


def _assignments(cells, labels: np.ndarray, memberships: np.ndarray | None) -> list[dict]:
    assignments = []
    for index, cell in enumerate(cells):
        item = {"cellId": cell.id, "row": cell.row, "column": cell.column, "zoneId": int(labels[index])}
        if memberships is not None:
            item["memberships"] = [_number(value) for value in memberships[index]]
        assignments.append(item)
    return assignments


def _zone_summaries(cells, data, labels, memberships, features, centers_raw, normalization_std_devs) -> list[dict]:
    zones = []
    for zone_id in range(len(centers_raw)):
        member_indices = np.where(labels == zone_id)[0]
        members = [cells[index] for index in member_indices]
        member_data = data[member_indices]
        zone = {
            "zoneId": zone_id,
            "cellIds": [cell.id for cell in members],
            "cellCount": len(members),
            "featureMeans": {feature: _number(member_data[:, index].mean()) for index, feature in enumerate(features)},
            "featureStdDevs": {feature: _number(member_data[:, index].std()) for index, feature in enumerate(features)},
            "mean": _frontend_feature_names(
                {feature: _number(member_data[:, index].mean()) for index, feature in enumerate(features)}
            ),
            # Numeric aggregate is the mean within-zone variance after each retained feature's
            # own standardization; raw-unit variances remain available per feature.
            "variance": _number(np.var(member_data / normalization_std_devs, axis=0).mean()),
            "varianceDefinition": "mean feature-wise variance in z-score feature space",
            "varianceByFeature": {feature: _number(member_data[:, index].var()) for index, feature in enumerate(features)},
            "centerRaw": {feature: _number(centers_raw[zone_id, index]) for index, feature in enumerate(features)},
            "spatialCenter": {
                "row": _number(np.mean([cell.row for cell in members])),
                "column": _number(np.mean([cell.column for cell in members])),
            },
        }
        if memberships is not None:
            zone["meanMembership"] = _number(memberships[member_indices, zone_id].mean())
        zones.append(zone)
    return zones


def _adjacency(cells, labels: np.ndarray) -> list[dict]:
    positions = {(cell.row, cell.column): (index, cell) for index, cell in enumerate(cells)}
    pairs: set[tuple[int, int]] = set()
    contacts: defaultdict[tuple[int, int], int] = defaultdict(int)
    for index, cell in enumerate(cells):
        for coordinate in ((cell.row + 1, cell.column), (cell.row, cell.column + 1)):
            neighbor = positions.get(coordinate)
            if neighbor is None:
                continue
            neighbor_index, _ = neighbor
            left, right = sorted((int(labels[index]), int(labels[neighbor_index])))
            if left != right:
                pairs.add((left, right))
                contacts[(left, right)] += 1
    return [
        {"zoneA": left, "zoneB": right, "sharedGridEdges": contacts[(left, right)]}
        for left, right in sorted(pairs)
    ]


def _run_id(request: ZoningRequest, included_features: list[str]) -> str:
    return f"zoning-{_input_fingerprint(request, included_features)[:20]}"


def _input_fingerprint(request: ZoningRequest, included_features: list[str]) -> str:
    payload = {
        "scenarioId": request.scenarioId,
        "gridRevision": request.gridRevision,
        "method": "fuzzy-c-means" if request.method in {"fcm", "fuzzy-c-means"} else "kmeans",
        "clusterCount": request.clusterCount,
        "seed": request.seed,
        "features": included_features,
        "cells": [cell.model_dump() for cell in request.cells],
        "fcm": request.fcm.model_dump() if request.method in {"fcm", "fuzzy-c-means"} else None,
    }
    digest = hashlib.sha256(json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    return digest


def _number(value: float | np.floating) -> float:
    return round(float(value), 8)


def _optional_number(value: float | None) -> float | None:
    return None if value is None else _number(value)


def _center_snapshots(history: list[np.ndarray], means: np.ndarray, std_devs: np.ndarray, features: list[str]) -> list[list[dict[str, float]]]:
    """Return actual center positions in original units for optional UI playback."""
    return [
        [
            {feature: _number(center[index] * std_devs[index] + means[index]) for index, feature in enumerate(features)}
            for center in snapshot
        ]
        for snapshot in history
    ]


def _frontend_feature_names(values: dict[str, float]) -> dict[str, float]:
    """The TypeScript field model uses `ph`; internal/doc contracts retain `pH`."""
    return {("ph" if feature == "pH" else feature): value for feature, value in values.items()}


FIELD_PIPELINE_VERSIONS = {
    "spatial": "utm-grid-v1",
    "interpolation": "idw-p2-v1",
    "shi": "kshetrasense-shi-v1",
    "clustering": "standardized-profiles-autok-v1",
    "stability": "sample-perturbation-v1",
    "placement": "medoid-geometric-median-v1",
}


def run_field_zoning(request: FieldZoningRequest) -> dict:
    """Run the complete sparse-sample → field-grid → contiguous-zone pipeline."""
    started_at = perf_counter()
    try:
        field = discretize_field(request.boundary.model_dump(), request.cellSizeM)
        samples = _project_request_samples(request, field)
        interpolated = interpolate_field(samples, field)
        raw_data = np.asarray([[cell.values[feature] for feature in SOIL_PROPERTIES] for cell in interpolated.cells], dtype=float)
        normalized, included_features, means, std_devs, excluded_features = _standardize_profiles(raw_data)
        auto_k = auto_select_k(
            normalized,
            method=request.method,
            seed=request.seed,
            max_k=request.maxK,
            fuzziness=request.fcm.fuzziness,
            max_iterations=request.fcm.maxIterations,
            tolerance=request.fcm.tolerance,
        )
        cluster_result = auto_k.selected_result
        cluster_labels = cluster_result.labels.copy()
        row_values = np.asarray([cell.row for cell in field.cells], dtype=int)
        column_values = np.asarray([cell.column for cell in field.cells], dtype=int)
        merged = merge_adjacent_zones(
            normalized,
            cluster_labels,
            row_values,
            column_values,
            merge_threshold_z=request.mergeThresholdZ,
        )
        components = split_disconnected_zones(merged.labels, row_values, column_values)
        memberships = getattr(cluster_result, "memberships", None)
        shi_details = [compute_shi(cell.values) for cell in interpolated.cells]
        zone_summaries, zone_mean_shi = _field_zone_summaries(
            field,
            interpolated,
            shi_details,
            cluster_labels,
            components.labels,
            components.zone_to_cluster,
            memberships,
        )
        placement = place_wsn_nodes(
            field.cells,
            components.labels,
            zone_mean_shi,
            field.polygon_utm,
            field.utm_crs,
        )
        stability = _field_stability_report(
            request,
            field,
            samples,
            auto_k.optimal_k,
            included_features,
            std_devs,
            cluster_labels,
            components.labels,
            [detail["shi"] for detail in shi_details],
        )
    except (
        SpatialValidationError,
        InterpolationValidationError,
        ClusteringValidationError,
        ScoringValidationError,
        StabilityValidationError,
    ) as error:
        raise ZoningValidationError(str(error)) from error

    cluster_head = placement.cluster_head
    grid_area = float(sum(cell.area_m2 for cell in field.cells))
    fingerprint_payload = request.model_dump(mode="json")
    input_fingerprint = hashlib.sha256(
        json.dumps(fingerprint_payload, sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()
    warnings = []
    if len(samples) < 5:
        warnings.append("Fewer than five sample points provide limited spatial coverage; inspect cross-validation and sample distances.")
    if request.samples[0].depthCm.strip().casefold() in {"unknown", "unspecified", "not recorded"}:
        warnings.append("Sampling depth is unknown; measurements may not represent a comparable soil stratum.")
    if len({sample.collectionDate for sample in request.samples if sample.collectionDate is not None}) > 1 or any(
        sample.collectionDate is None for sample in request.samples
    ):
        warnings.append("Collection dates are mixed or incomplete; confirm that samples represent one comparable field survey.")
    if len({sample.labMethod.strip().casefold() for sample in request.samples if sample.labMethod and sample.labMethod.strip()}) > 1 or any(
        not sample.labMethod or not sample.labMethod.strip() for sample in request.samples
    ):
        warnings.append("Laboratory methods are mixed or incomplete; confirm that reported values are comparable.")
    warnings.append("Interpolated cell estimates do not have laboratory-measurement accuracy at the grid spacing.")
    return {
        "runId": f"field-zoning-{input_fingerprint[:20]}",
        "inputFingerprint": input_fingerprint,
        "createdAt": datetime.now(UTC).isoformat(),
        "processingDurationMs": round((perf_counter() - started_at) * 1_000, 3),
        "method": request.method,
        "selectedK": auto_k.optimal_k,
        "zoneCount": len(zone_summaries),
        "parameters": {
            "cellSizeM": request.cellSizeM,
            "maxK": request.maxK,
            "seed": request.seed,
            "mergeThresholdZ": request.mergeThresholdZ,
            "perturbationRuns": request.perturbationRuns,
            "fcm": request.fcm.model_dump(),
        },
        "versions": FIELD_PIPELINE_VERSIONS,
        "field": {
            "boundary": {"type": "Polygon", "coordinates": field.polygon_wgs84},
            "utmCrs": field.utm_crs,
            "cellSizeM": field.cell_size_m,
            "areaHectares": field.area_hectares,
            "cellCount": len(field.cells),
            "representedGridAreaM2": grid_area,
            "gridCoveragePercent": 100.0 * grid_area / (field.area_hectares * 10_000),
            "boundingBoxUtm": field.bounding_box_utm,
        },
        "samples": interpolated.sample_locations,
        "sampleWarnings": warnings,
        "interpolation": {
            "method": interpolated.interpolation_method,
            "power": interpolated.power_parameter,
            "distanceMetric": "Euclidean distance in the field UTM CRS, metres",
            "crossValidation": interpolated.cross_validation,
        },
        "featureSchema": {
            "requested": list(SOIL_PROPERTIES),
            "included": included_features,
            "excluded": excluded_features,
            "units": {"pH": "dimensionless", "ec": "dS/m", "nitrogen": "mg/kg", "phosphorus": "mg/kg", "potassium": "mg/kg"},
            "normalization": [
                {"feature": feature, "mean": _number(means[index]), "stdDev": _number(std_devs[index])}
                for index, feature in enumerate(included_features)
            ],
            "clusteringBasis": "z-score standardized pH, EC, nitrogen, phosphorus, and potassium; constant features excluded",
        },
        "shi": {
            "name": "KshetraSense Soil Health Index (SHI)",
            "version": "kshetrasense-shi-v1",
            "officialUSDAIndex": False,
            "scoreRange": [0, 100],
            "weights": DEFAULT_WEIGHTS,
            "scoringFunctions": {
                "pH": {"kind": "bell_curve", "optimum": 6.5, "sigma": 0.8},
                "ec": {"kind": "less_is_better_logistic", "midpoint_dS_m": 2.0, "slope": 2.5},
                "nitrogen": {"kind": "more_is_better_logistic", "midpoint_mg_kg": 60, "slope": 0.06},
                "phosphorus": {"kind": "more_is_better_logistic", "midpoint_mg_kg": 25, "slope": 0.12},
                "potassium": {"kind": "more_is_better_logistic", "midpoint_mg_kg": 150, "slope": 0.03},
            },
            "limitations": "Project-defined screening assumptions; not locally calibrated soil-health thresholds, crop suitability, yield probability, or a fertilizer prescription. Laboratory method and sampling depth affect comparability.",
        },
        "cells": [
            {
                "cellId": cell.cell_id,
                "row": cell.row,
                "column": cell.column,
                "centerUtm": {"eastingM": cell.center_utm[0], "northingM": cell.center_utm[1]},
                "centerWgs84": {"longitude": cell.center_wgs84[0], "latitude": cell.center_wgs84[1]},
                "geometry": cell.geometry_wgs84,
                "areaM2": cell.area_m2,
                "nearestSampleDistanceM": cell.nearest_sample_distance_m,
                "soilValues": cell.values,
                "valueKind": "idw_interpolated_estimate",
                "shi": _number(shi_details[index]["shi"]),
                "shiComponents": shi_details[index]["scores"],
                "clusterId": int(cluster_labels[index]),
                "zoneId": int(components.labels[index]),
                **({"clusterMemberships": [_number(value) for value in memberships[index]]} if memberships is not None else {}),
            }
            for index, cell in enumerate(interpolated.cells)
        ],
        "zones": zone_summaries,
        "autoK": {
            "optimalK": auto_k.optimal_k,
            "selectionCriterion": auto_k.selection_criterion,
            "sweep": [
                {
                    "k": entry.k,
                    "silhouette": _optional_number(entry.silhouette),
                    "fpc": _optional_number(entry.fpc),
                    "inertia": _optional_number(entry.inertia),
                    "iterations": entry.iterations,
                }
                for entry in auto_k.sweep
            ],
            "selectedAlgorithmConverged": cluster_result.converged,
            "silhouetteInterpretation": "Computed on interpolated grid-cell profiles; it is a clustering diagnostic, not agronomic validation.",
        },
        "mergeLog": merged.merge_log,
        "wsnNodes": [
            {
                "zoneId": node.zone_id,
                "cellId": node.cell_id,
                "positionUtm": {"eastingM": node.position_utm[0], "northingM": node.position_utm[1]},
                "positionWgs84": {"longitude": node.position_wgs84[0], "latitude": node.position_wgs84[1]},
                "zoneMeanShi": node.zone_mean_shi,
                "placementStatus": "suggested_medoid_not_field_verified",
            }
            for node in placement.wsn_nodes
        ],
        "clusterHead": {
            "positionUtm": {"eastingM": cluster_head.position_utm[0], "northingM": cluster_head.position_utm[1]},
            "positionWgs84": {"longitude": cluster_head.position_wgs84[0], "latitude": cluster_head.position_wgs84[1]},
            "totalDistanceToNodesM": cluster_head.total_distance_to_nodes_m,
            "algorithm": cluster_head.algorithm,
            "radioCoverageValidated": cluster_head.radio_coverage_validated,
            "placementStatus": "geometric_candidate_only_radio_and_accessibility_not_evaluated",
        },
        "stability": stability,
    }


def _project_request_samples(request: FieldZoningRequest, field: DiscretizedField) -> list[ProjectedSoilSample]:
    samples = []
    for sample in request.samples:
        easting, northing = project_coordinate(sample.latitude, sample.longitude, field.utm_crs)
        if not field.polygon_utm.covers(Point(easting, northing)):
            raise ZoningValidationError(f"Sample {sample.id} must be inside the field boundary and outside any hole.")
        samples.append(
            ProjectedSoilSample(
                id=sample.id,
                latitude=sample.latitude,
                longitude=sample.longitude,
                easting_m=easting,
                northing_m=northing,
                measurements=dict(sample.measurements),
                standard_uncertainty=dict(sample.standardUncertainty),
                depth_cm=sample.depthCm,
                collection_date=sample.collectionDate.isoformat() if sample.collectionDate else None,
                lab_method=sample.labMethod,
            )
        )
    return samples


def _standardize_profiles(data: np.ndarray) -> tuple[np.ndarray, list[str], np.ndarray, np.ndarray, list[dict]]:
    means = data.mean(axis=0)
    std_devs = data.std(axis=0)
    included_indices = np.flatnonzero(std_devs > 1e-12)
    if not len(included_indices):
        raise ZoningValidationError("No soil property varies across the interpolated field, so zones cannot be distinguished.")
    included_features = [SOIL_PROPERTIES[index] for index in included_indices]
    included_means = means[included_indices]
    included_std_devs = std_devs[included_indices]
    normalized = (data[:, included_indices] - included_means) / included_std_devs
    excluded = [
        {"feature": SOIL_PROPERTIES[index], "reason": "No variation across the interpolated field; omitted from clustering."}
        for index in range(len(SOIL_PROPERTIES))
        if index not in included_indices
    ]
    return normalized, included_features, included_means, included_std_devs, excluded


def _fixed_k_labels(
    data: np.ndarray,
    request: FieldZoningRequest,
    cluster_count: int,
) -> tuple[np.ndarray, np.ndarray | None]:
    if request.method == "kmeans":
        result = kmeans_plus_plus(data, cluster_count, request.seed)
        return result.labels, None
    result = fuzzy_c_means(
        data,
        cluster_count,
        request.seed,
        request.fcm.fuzziness,
        request.fcm.maxIterations,
        request.fcm.tolerance,
    )
    return result.labels, result.memberships


def _field_zone_summaries(
    field: DiscretizedField,
    interpolated: InterpolatedField,
    shi_details: list[dict],
    cluster_labels: np.ndarray,
    zone_labels: np.ndarray,
    zone_to_cluster: dict[int, int],
    memberships: np.ndarray | None,
) -> tuple[list[dict], dict[int, float]]:
    areas = np.asarray([cell.area_m2 for cell in interpolated.cells], dtype=float)
    centers = np.asarray([cell.center_utm for cell in interpolated.cells], dtype=float)
    values = np.asarray([[cell.values[feature] for feature in SOIL_PROPERTIES] for cell in interpolated.cells], dtype=float)
    shi_values = np.asarray([item["shi"] for item in shi_details], dtype=float)
    shi_component_values = {feature: np.asarray([item["scores"][feature] for item in shi_details]) for feature in SOIL_PROPERTIES}
    to_wgs84 = Transformer.from_crs(field.utm_crs, "EPSG:4326", always_xy=True)
    summaries = []
    zone_mean_shi: dict[int, float] = {}
    for zone_id in sorted(np.unique(zone_labels).tolist()):
        indices = np.flatnonzero(zone_labels == zone_id)
        weights = areas[indices]
        if not weights.sum() > 0:
            weights = np.ones(len(indices), dtype=float)
        mean_values = np.average(values[indices], axis=0, weights=weights)
        variance = np.average((values[indices] - mean_values) ** 2, axis=0, weights=weights)
        mean_shi = float(np.average(shi_values[indices], weights=weights))
        zone_mean_shi[int(zone_id)] = mean_shi
        center = np.average(centers[indices], axis=0, weights=weights)
        longitude, latitude = to_wgs84.transform(*center)
        half_size = field.cell_size_m / 2
        zone_shape = unary_union(
            [
                box(
                    interpolated.cells[index].center_utm[0] - half_size,
                    interpolated.cells[index].center_utm[1] - half_size,
                    interpolated.cells[index].center_utm[0] + half_size,
                    interpolated.cells[index].center_utm[1] + half_size,
                )
                for index in indices
            ]
        ).intersection(field.polygon_utm)
        zone_shape_wgs84 = transform_geometry(zone_shape, to_wgs84.transform, interleaved=False)
        component_scores = {
            feature: float(np.average(shi_component_values[feature][indices], weights=weights))
            for feature in SOIL_PROPERTIES
        }
        source_cluster_ids = sorted(set(int(cluster_labels[index]) for index in indices))
        summary = {
            "zoneId": int(zone_id),
            "mergedClusterId": int(zone_to_cluster[int(zone_id)]),
            "sourceClusterIds": source_cluster_ids,
            "cellCount": int(len(indices)),
            "cellIds": [interpolated.cells[index].cell_id for index in indices],
            "areaM2": float(weights.sum()),
            "meanSoilValues": {feature: float(mean_values[index]) for index, feature in enumerate(SOIL_PROPERTIES)},
            "stdSoilValues": {feature: float(np.sqrt(variance[index])) for index, feature in enumerate(SOIL_PROPERTIES)},
            "meanShi": mean_shi,
            "meanShiComponents": component_scores,
            "centroidUtm": {"eastingM": float(center[0]), "northingM": float(center[1])},
            "centroidWgs84": {"longitude": float(longitude), "latitude": float(latitude)},
            "geometry": mapping(zone_shape_wgs84),
        }
        if memberships is not None:
            summary["meanClusterMemberships"] = {
                str(cluster): float(np.average(memberships[indices, cluster], weights=weights))
                for cluster in range(memberships.shape[1])
            }
        summaries.append(summary)
    return summaries, zone_mean_shi


def _field_stability_report(
    request: FieldZoningRequest,
    field: DiscretizedField,
    samples: list[ProjectedSoilSample],
    selected_k: int,
    included_features: list[str],
    baseline_std_devs: np.ndarray,
    baseline_cluster_labels: np.ndarray,
    baseline_zone_labels: np.ndarray,
    baseline_shi: list[float],
) -> dict:
    runs = request.perturbationRuns
    empty_result = {
        "perturbationRuns": runs,
        "referenceK": None,
        "conditionalOnSelectedK": True,
        "ariScores": [],
        "meanARI": None,
        "stdARI": None,
        "minARI": None,
        "perCellClusterFlipRate": None,
        "perCellShiStdDev": None,
        "noiseModel": noise_model_summary(samples),
        "limitations": "ARI describes zone partition sensitivity under the stated sample-noise scenario; it is not a calibrated confidence interval.",
    }
    if not runs:
        empty_result["limitations"] += " Stability was not run because perturbationRuns was zero."
        return empty_result

    rng = np.random.default_rng(request.seed)
    ari_scores: list[float] = []
    flips = np.zeros(len(field.cells), dtype=float)
    shi_results = [np.asarray(baseline_shi, dtype=float)]
    for _ in range(runs):
        perturbed_samples = perturb_samples(samples, rng)
        perturbed_field = interpolate_field(perturbed_samples, field)
        perturbed_shi = [compute_shi(cell.values)["shi"] for cell in perturbed_field.cells]
        shi_results.append(np.asarray(perturbed_shi, dtype=float))
        raw = np.asarray([[cell.values[feature] for feature in included_features] for cell in perturbed_field.cells], dtype=float)
        means = raw.mean(axis=0)
        std_devs = raw.std(axis=0)
        safe_std_devs = np.where(std_devs > 1e-12, std_devs, baseline_std_devs)
        normalized = (raw - means) / safe_std_devs
        cluster_labels, _ = _fixed_k_labels(normalized, request, selected_k)
        merged = merge_adjacent_zones(
            normalized,
            cluster_labels,
            [cell.row for cell in field.cells],
            [cell.column for cell in field.cells],
            merge_threshold_z=request.mergeThresholdZ,
        )
        components = split_disconnected_zones(
            merged.labels,
            [cell.row for cell in field.cells],
            [cell.column for cell in field.cells],
        )
        ari_scores.append(adjusted_rand_index(baseline_zone_labels, components.labels))
        aligned_labels = align_cluster_labels(baseline_cluster_labels, cluster_labels, selected_k)
        flips += aligned_labels != baseline_cluster_labels
    shi_matrix = np.asarray(shi_results, dtype=float)
    return {
        "perturbationRuns": runs,
        "referenceK": selected_k,
        "conditionalOnSelectedK": True,
        "ariScores": [_number(value) for value in ari_scores],
        "meanARI": _number(np.mean(ari_scores)),
        "stdARI": _number(np.std(ari_scores)),
        "minARI": _number(np.min(ari_scores)),
        "perCellClusterFlipRate": {
            cell.id: _number(flips[index] / runs) for index, cell in enumerate(field.cells)
        },
        "perCellShiStdDev": {
            cell.id: _number(value) for cell, value in zip(field.cells, shi_matrix.std(axis=0), strict=True)
        },
        "noiseModel": noise_model_summary(samples),
        "limitations": "ARI compares final contiguous zones with K fixed to the selected value and the same clustering seed. SHI spread and cluster-label flips are scenario sensitivity, not calibrated confidence intervals.",
    }
