from __future__ import annotations

import math
from datetime import date
from typing import Annotated, Any, Literal

from pydantic import AliasChoices, BaseModel, ConfigDict, Field, field_validator, model_validator


SUPPORTED_FEATURES = frozenset(
    {"pH", "nitrogen", "phosphorus", "potassium", "ec", "soilTemperature", "moisture"}
)
PIPELINE_FEATURES = ("pH", "ec", "nitrogen", "phosphorus", "potassium")


class FcmOptions(BaseModel):
    model_config = ConfigDict(extra="forbid")

    fuzziness: Annotated[float, Field(gt=1.0, le=5.0)] = 2.0
    maxIterations: Annotated[int, Field(ge=1, le=1000)] = 150
    tolerance: Annotated[float, Field(gt=0.0, le=0.1)] = 1e-5


class FieldBoundaryInput(BaseModel):
    """A GeoJSON WGS84 field polygon; coordinates are longitude/latitude pairs."""

    model_config = ConfigDict(extra="forbid")

    type: Literal["Polygon"] = "Polygon"
    coordinates: list[list[list[float]]] = Field(min_length=1)
    crs: Literal["EPSG:4326", "OGC:CRS84"] = "EPSG:4326"


class SoilSampleInput(BaseModel):
    """A measured laboratory sample in the fixed Phase 1 property units."""

    model_config = ConfigDict(extra="forbid")

    id: Annotated[str, Field(min_length=1, max_length=128)]
    latitude: Annotated[float, Field(ge=-80, le=84)]
    longitude: Annotated[float, Field(ge=-180, le=180)]
    measurements: dict[str, float]
    standardUncertainty: dict[str, float] = Field(default_factory=dict)
    depthCm: Annotated[str, Field(min_length=1, max_length=32)]
    collectionDate: date | None = None
    labMethod: Annotated[str, Field(max_length=128)] | None = None

    @field_validator("depthCm")
    @classmethod
    def non_blank_depth(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("depthCm must not be blank")
        return value.strip()

    @field_validator("measurements")
    @classmethod
    def valid_soil_measurements(cls, measurements: dict[str, float]) -> dict[str, float]:
        if set(measurements) != set(PIPELINE_FEATURES):
            raise ValueError("measurements must include exactly pH, ec, nitrogen, phosphorus, and potassium")
        for feature, value in measurements.items():
            if not math.isfinite(value):
                raise ValueError(f"{feature} must be finite")
            if feature == "pH" and not 0 <= value <= 14:
                raise ValueError("pH must be between 0 and 14")
            if feature != "pH" and value < 0:
                raise ValueError(f"{feature} must be non-negative")
        return measurements

    @field_validator("standardUncertainty")
    @classmethod
    def valid_measurement_uncertainties(cls, values: dict[str, float]) -> dict[str, float]:
        unknown = set(values) - set(PIPELINE_FEATURES)
        if unknown:
            raise ValueError(f"unsupported uncertainty features: {', '.join(sorted(unknown))}")
        if any(not math.isfinite(value) or value < 0 for value in values.values()):
            raise ValueError("standardUncertainty values must be finite and non-negative")
        return values


class FieldZoningRequest(BaseModel):
    """Complete spatial zoning request built from a boundary and sparse samples."""

    model_config = ConfigDict(extra="forbid")

    boundary: FieldBoundaryInput
    samples: list[SoilSampleInput] = Field(min_length=3, max_length=50)
    cellSizeM: Literal[5.0, 10.0] = 10.0
    method: Literal["kmeans", "fcm"] = "fcm"
    maxK: Annotated[int, Field(ge=2, le=6)] = 6
    seed: Annotated[int, Field(ge=0, le=4_294_967_295)] = 42
    mergeThresholdZ: Annotated[float, Field(ge=0, le=2)] = 0.5
    perturbationRuns: Annotated[int, Field(ge=0, le=50)] = 10
    fcm: FcmOptions = Field(default_factory=FcmOptions)

    @model_validator(mode="after")
    def unique_sample_ids(self) -> "FieldZoningRequest":
        ids = [sample.id for sample in self.samples]
        if len(ids) != len(set(ids)):
            raise ValueError("sample IDs must be unique")
        depths = {sample.depthCm.strip().casefold() for sample in self.samples}
        if len(depths) != 1:
            raise ValueError("all samples in a zoning run must use the same sampling depth")
        return self


class SoilCell(BaseModel):
    """One spatially-addressable soil observation used for a zoning request."""

    model_config = ConfigDict(extra="ignore")

    id: Annotated[str, Field(min_length=1, max_length=128)]
    row: Annotated[int, Field(ge=0)]
    column: Annotated[int, Field(ge=0)]
    values: dict[str, float | None]

    @model_validator(mode="before")
    @classmethod
    def accept_flat_frontend_cell(cls, value):
        """Accept the host UI's flat cell shape while retaining one internal contract."""
        if not isinstance(value, dict):
            return value
        if "values" in value:
            result = dict(value)
            measurements = dict(result["values"])
            if "ph" in measurements and "pH" not in measurements:
                measurements["pH"] = measurements.pop("ph")
            if "soil_temperature" in measurements and "soilTemperature" not in measurements:
                measurements["soilTemperature"] = measurements.pop("soil_temperature")
            result["values"] = measurements
            return result
        result = dict(value)
        result["values"] = {feature: result.pop(feature, None) for feature in SUPPORTED_FEATURES if feature in result}
        if "ph" in result:
            result["values"]["pH"] = result.pop("ph")
        if "soil_temperature" in result:
            result["values"]["soilTemperature"] = result.pop("soil_temperature")
        return result

    @field_validator("values")
    @classmethod
    def finite_values(cls, values: dict[str, float | None]) -> dict[str, float | None]:
        import math

        for feature, value in values.items():
            if feature not in SUPPORTED_FEATURES:
                raise ValueError(f"Unsupported soil feature: {feature}")
            if value is not None and not math.isfinite(value):
                raise ValueError(f"{feature} must be a finite number or null")
        return values


class ZoningRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    scenarioId: Annotated[str, Field(min_length=1, max_length=128)] = "local-field"
    gridRevision: Annotated[int, Field(ge=0)] = 0
    method: Literal["kmeans", "fcm", "fuzzy-c-means"]
    clusterCount: Annotated[int, Field(ge=2, le=12, validation_alias=AliasChoices("clusterCount", "cluster_count"))]
    seed: int
    features: list[str] = Field(
        default_factory=lambda: ["pH", "nitrogen", "phosphorus", "potassium", "ec", "soilTemperature"],
        min_length=1,
        max_length=len(SUPPORTED_FEATURES),
    )
    cells: list[SoilCell] = Field(min_length=2, max_length=5000)
    fcm: FcmOptions = Field(default_factory=FcmOptions)

    @field_validator("features")
    @classmethod
    def unique_supported_features(cls, features: list[str]) -> list[str]:
        if len(features) != len(set(features)):
            raise ValueError("features must not contain duplicates")
        unsupported = sorted(set(features) - SUPPORTED_FEATURES)
        if unsupported:
            raise ValueError(f"Unsupported requested features: {', '.join(unsupported)}")
        return features

    @model_validator(mode="after")
    def unique_cell_ids_and_coordinates(self) -> "ZoningRequest":
        ids = [cell.id for cell in self.cells]
        if len(ids) != len(set(ids)):
            raise ValueError("cell IDs must be unique")
        coordinates = [(cell.row, cell.column) for cell in self.cells]
        if len(coordinates) != len(set(coordinates)):
            raise ValueError("cell row/column coordinates must be unique")
        return self


class CropFitRequest(BaseModel):
    """A selected cell profile or zone mean, separate from clustering state."""

    model_config = ConfigDict(extra="forbid")

    profileVersion: str = Field(default="2026.10-crop-reference-report-v3", min_length=1, max_length=128)
    measurements: dict[str, float | None]
    measurementContext: dict[str, str] = Field(default_factory=dict)

    @model_validator(mode="before")
    @classmethod
    def accept_lowercase_ph(cls, value):
        if not isinstance(value, dict) or "measurements" not in value:
            return value
        result = dict(value)
        measurements = dict(result["measurements"])
        if "ph" in measurements and "pH" not in measurements:
            measurements["pH"] = measurements.pop("ph")
        result["measurements"] = measurements
        return result

    @field_validator("measurements")
    @classmethod
    def known_finite_measurements(cls, measurements: dict[str, float | None]) -> dict[str, float | None]:
        import math

        for name, value in measurements.items():
            if name not in SUPPORTED_FEATURES:
                raise ValueError(f"Unsupported soil feature: {name}")
            if value is not None and not math.isfinite(value):
                raise ValueError(f"{name} must be a finite number or null")
        return measurements


class ZoneSummaryResponse(BaseModel):
    """Stable fields for a returned zone; extension fields retain detailed diagnostics."""

    model_config = ConfigDict(extra="allow")

    zoneId: int
    cellCount: int
    mean: dict[str, float]
    variance: float


class ZoningRunResponse(BaseModel):
    """Top-level contract shared by the host UI and service consumers."""

    model_config = ConfigDict(extra="allow")

    runId: str
    method: Literal["kmeans", "fuzzy-c-means"]
    clusterCount: int
    assignments: dict[str, int]
    memberships: dict[str, list[float]] | None = None
    zones: list[ZoneSummaryResponse]
    silhouetteScore: float | None
    inputFingerprint: str
    createdAt: str


class FieldZoningResponse(BaseModel):
    """Versioned field-scale result; nested fields retain algorithm diagnostics."""

    model_config = ConfigDict(extra="allow")

    runId: str
    inputFingerprint: str
    createdAt: str
    processingDurationMs: Annotated[float, Field(ge=0)]
    method: Literal["kmeans", "fcm"]
    selectedK: int
    zoneCount: int
    parameters: dict[str, Any]
    versions: dict[str, str]
    field: dict[str, Any]
    samples: list[dict[str, Any]]
    sampleWarnings: list[str]
    interpolation: dict[str, Any]
    featureSchema: dict[str, Any]
    shi: dict[str, Any]
    cells: list[dict[str, Any]]
    zones: list[dict[str, Any]]
    autoK: dict[str, Any]
    mergeLog: list[dict[str, Any]]
    stability: dict[str, Any]
    wsnNodes: list[dict[str, Any]]
    clusterHead: dict[str, Any]


class CropFitResponse(BaseModel):
    model_config = ConfigDict(extra="allow")

    profileVersion: str
    assessments: list[dict[str, Any]]
    dataLimitations: list[str]
