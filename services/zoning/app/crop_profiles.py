from __future__ import annotations

from dataclasses import dataclass


PROFILE_VERSION = "2026.10-crop-reference-report-v3"


@dataclass(frozen=True)
class CropProfile:
    crop: str
    name: str
    scientific_name: str
    ph_min: float
    ph_max: float
    source_label: str
    source_url: str
    context: str
    ec_reference: str
    ec_source_label: str
    ec_source_url: str
    ec_context: str


# pH intervals are crop-specific published context, not universal planting criteria.
# EC entries are saturation-extract/root-zone references, not comparable to an
# unspecified single-depth EC result. Other factors need local lab calibration.
PROFILES: tuple[CropProfile, ...] = (
    CropProfile(
        crop="finger_millet",
        name="Finger Millet (Ragi)",
        scientific_name="Eleusine coracana",
        ph_min=4.5,
        ph_max=8.0,
        source_label="NIFTEM-T: Millet processing and value addition technical report",
        source_url="https://niftem-t.ac.in/pmfme/maltdpr.pdf",
        context="Broad, method-unspecified pH context reported for finger millet; not a locally calibrated planting threshold.",
        ec_reference="The FAO crop table does not report a finger-millet-specific root-zone ECe yield threshold.",
        ec_source_label="FAO: Water quality for agriculture, Annex 1",
        ec_source_url="https://www.fao.org/4/y4263e/y4263e0e.htm",
        ec_context="No finger-millet-specific ECe threshold is listed; values for other millet species are not substituted.",
    ),
    CropProfile(
        crop="tomato",
        name="Tomato",
        scientific_name="Solanum lycopersicum",
        ph_min=6.5,
        ph_max=7.5,
        source_label="Tamil Nadu Agricultural University: Tomato soil guidance",
        source_url="https://agritech.tnau.ac.in/horticulture/horti_vegetables_tomato_Soil.html",
        context="TNAU guidance for well-drained loamy soil rich in organic matter; not calibrated to this sample method or to Karnataka fields.",
        ec_reference="FAO reports a tomato fruit-yield ECe threshold of 2.5 dS/m and a 9.9% per dS/m yield-response slope above it. This is not a generic EC target.",
        ec_source_label="FAO: Water quality for agriculture, Annex 1",
        ec_source_url="https://www.fao.org/4/y4263e/y4263e0e.htm",
        ec_context="FAO salinity response uses mean root-zone ECe from a saturation-paste extract; this field EC method and root-zone context are unverified.",
    ),
    CropProfile(
        crop="groundnut",
        name="Groundnut",
        scientific_name="Arachis hypogaea",
        ph_min=5.3,
        ph_max=6.6,
        source_label="Tamil Nadu Agricultural University: Relative crop tolerance to soil acidity",
        source_url="https://www.agritech.tnau.ac.in/pdf/3.pdf",
        context="TNAU's crop-group table lists an optimum pH range; test method and local cultivar calibration are unspecified.",
        ec_reference="FAO reports a groundnut seed-yield ECe threshold of 3.2 dS/m and a 29% per dS/m yield-response slope above it. This is not a generic EC target.",
        ec_source_label="FAO: Water quality for agriculture, Annex 1",
        ec_source_url="https://www.fao.org/4/y4263e/y4263e0e.htm",
        ec_context="FAO salinity response uses mean root-zone ECe from a saturation-paste extract; this field EC method and root-zone context are unverified.",
    ),
)

UNASSESSED_FEATURES: tuple[tuple[str, str], ...] = (
    ("nitrogen", "mg/kg alone is not a calibrated crop-available nitrogen interpretation; analyte, extraction method, target region, and crop management are required."),
    ("phosphorus", "mg/kg alone does not identify the soil-test extraction method; a locally calibrated crop interpretation is required."),
    ("potassium", "mg/kg alone does not identify the soil-test extraction method; a locally calibrated crop interpretation is required."),
    ("soilTemperature", "This field workflow does not supply soil temperature; a single point reading would not establish a seasonal thermal regime."),
    ("moisture", "This field workflow does not supply soil moisture; a point reading also needs units, depth, texture, and crop-stage context."),
)
