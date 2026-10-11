from __future__ import annotations

from dataclasses import dataclass


PROFILE_VERSION = "2026.10-pH-screen-v1"


@dataclass(frozen=True)
class CropProfile:
    crop: str
    ph_min: float
    ph_max: float
    source_label: str
    source_url: str
    context: str


# These contextual ranges are intentionally only pH screening rules. They do not
# turn incomplete soil observations into a full crop-suitability classification.
PROFILES: tuple[CropProfile, ...] = (
    CropProfile(
        crop="apple",
        ph_min=6.0,
        ph_max=7.0,
        source_label="University of Minnesota Extension: Growing apples",
        source_url="https://extension.umn.edu/garden-and-home/yard-and-garden/gardening-in-minnesota/growing-apples",
        context="Home-orchard soil pH guidance; drainage and standing-water limitations remain unassessed.",
    ),
    CropProfile(
        crop="tomato",
        ph_min=5.8,
        ph_max=6.6,
        source_label="Penn State Extension: Tomato production",
        source_url="https://extension.psu.edu/tomato-production",
        context="Commercial tomato production guidance; crop system, climate, water, and nutrient management remain unassessed.",
    ),
    CropProfile(
        crop="potato",
        ph_min=5.5,
        ph_max=6.5,
        source_label="Penn State Extension: Potato production",
        source_url="https://extension.psu.edu/potato-production",
        context="Potato production guidance; variety, disease, soil texture, water, and nutrient management remain unassessed.",
    ),
)

UNASSESSED_FEATURES: tuple[tuple[str, str], ...] = (
    ("nitrogen", "No source-backed threshold is configured in this limited profile."),
    ("phosphorus", "No source-backed threshold is configured in this limited profile."),
    ("potassium", "No source-backed threshold is configured in this limited profile."),
    ("ec", "Salinity interpretation requires crop and measurement context not configured in this limited profile."),
    ("soilTemperature", "A point soil-temperature reading is not a seasonal thermal-regime assessment."),
    ("moisture", "A point moisture reading is not a crop-season water-availability assessment."),
)
