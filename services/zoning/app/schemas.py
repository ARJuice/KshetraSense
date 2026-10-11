from __future__ import annotations

from typing import Annotated, Any, Literal

from pydantic import AliasChoices, BaseModel, ConfigDict, Field, field_validator, model_validator


SUPPORTED_FEATURES = frozenset(
    {"pH", "nitrogen", "phosphorus", "potassium", "ec", "soilTemperature", "moisture"}
)


class SoilCell(BaseModel):
    """One spatially-addressable soil observation used for a zoning request."""

    model_config = ConfigDict(extra="forbid")

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
            result["values"] = measurements
            return result
        result = dict(value)
        result["values"] = {feature: result.pop(feature, None) for feature in SUPPORTED_FEATURES if feature in result}
        if "ph" in result:
            result["values"]["pH"] = result.pop("ph")
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


class FcmOptions(BaseModel):
    model_config = ConfigDict(extra="forbid")

    fuzziness: Annotated[float, Field(gt=1.0, le=5.0)] = 2.0
    maxIterations: Annotated[int, Field(ge=1, le=1000)] = 150
    tolerance: Annotated[float, Field(gt=0.0, le=0.1)] = 1e-5


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
    """A selected zone's pre-computed mean measurements, not raw cluster state."""

    model_config = ConfigDict(extra="forbid")

    profileVersion: str = Field(default="2026.10-pH-screen-v1", min_length=1, max_length=128)
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


class CropFitResponse(BaseModel):
    model_config = ConfigDict(extra="allow")

    profileVersion: str
    assessments: list[dict[str, Any]]
    dataLimitations: list[str]
