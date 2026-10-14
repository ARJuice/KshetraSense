from __future__ import annotations

from dataclasses import dataclass


PROFILE_VERSION = "2026.10-crop-reference-report-v2"


@dataclass(frozen=True)
class CropProfile:
    crop: str
    ph_min: float
    ph_max: float
    source_label: str
    source_url: str
    context: str
    ec_reference: str
    ec_source_label: str
    ec_source_url: str


# pH intervals are crop-specific published context, not universal planting criteria.
# EC entries are saturation-extract/root-zone references, not comparable to an
# unspecified single-depth EC result. Other factors need local lab calibration.
PROFILES: tuple[CropProfile, ...] = (
    CropProfile(
        crop="apple",
        ph_min=6.0,
        ph_max=7.0,
        source_label="University of Minnesota Extension: Growing apples",
        source_url="https://extension.umn.edu/garden-and-home/yard-and-garden/gardening-in-minnesota/growing-apples",
        context="Home-orchard soil pH guidance; drainage and standing-water limitations remain unassessed.",
        ec_reference="FAO classifies apple as salt-sensitive but reports no numeric ECe yield threshold for apple in this table.",
        ec_source_label="FAO Annex 1: Crop salt tolerance data",
        ec_source_url="https://www.fao.org/4/Y4263E/y4263e0e.htm",
    ),
    CropProfile(
        crop="tomato",
        ph_min=5.8,
        ph_max=6.6,
        source_label="Penn State Extension: Tomato production",
        source_url="https://extension.psu.edu/tomato-production",
        context="Commercial tomato production guidance; crop system, climate, water, and nutrient management remain unassessed.",
        ec_reference="Yield reduction begins at 2.5 dS/m ECe in the cited FAO table; the reported slope above that threshold is 9.9% per dS/m. This is a root-zone salinity response reference, not a target interval.",
        ec_source_label="FAO Annex 1: Crop salt tolerance data",
        ec_source_url="https://www.fao.org/4/Y4263E/y4263e0e.htm",
    ),
    CropProfile(
        crop="potato",
        ph_min=5.5,
        ph_max=6.5,
        source_label="Penn State Extension: Potato production",
        source_url="https://extension.psu.edu/potato-production",
        context="Potato production guidance; variety, disease, soil texture, water, and nutrient management remain unassessed.",
        ec_reference="Yield reduction begins at 1.7 dS/m ECe in the cited FAO table; the reported slope above that threshold is 12% per dS/m. This is a root-zone salinity response reference, not a target interval.",
        ec_source_label="FAO Annex 1: Crop salt tolerance data",
        ec_source_url="https://www.fao.org/4/Y4263E/y4263e0e.htm",
    ),
)

UNASSESSED_FEATURES: tuple[tuple[str, str], ...] = (
    ("nitrogen", "mg/kg alone is not a calibrated crop-available nitrogen interpretation; analyte, extraction method, target region, and crop management are required."),
    ("phosphorus", "mg/kg alone does not identify the soil-test extraction method; a locally calibrated crop interpretation is required."),
    ("potassium", "mg/kg alone does not identify the soil-test extraction method; a locally calibrated crop interpretation is required."),
    ("soilTemperature", "This field workflow does not supply soil temperature; a single point reading would not establish a seasonal thermal regime."),
    ("moisture", "This field workflow does not supply soil moisture; a point reading also needs units, depth, texture, and crop-stage context."),
)
