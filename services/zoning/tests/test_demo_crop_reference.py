import csv
import json
from pathlib import Path

from app.crop_fit import evaluate_crop_fit
from app.crop_profiles import PROFILE_VERSION
from app.schemas import CropFitRequest, FieldZoningRequest
from app.service import run_field_zoning


DEMO_DATA = Path(__file__).resolve().parents[3] / "data" / "demo" / "soil-zoning"
OFFSET_SCENARIOS = {"balanced-reference", "high-nutrient-mixed-ec", "mixed-nutrient-field"}


def _request(csv_path: Path, p_h_adjustment: float = 0.0, perturbation_runs: int = 0) -> FieldZoningRequest:
    geojson = json.loads(csv_path.with_suffix(".geojson").read_text(encoding="utf-8"))
    with csv_path.open(newline="", encoding="utf-8") as handle:
        samples = []
        for row in csv.DictReader(handle):
            samples.append(
                {
                    "id": row["id"],
                    "latitude": float(row["latitude"]),
                    "longitude": float(row["longitude"]),
                    "measurements": {
                        "pH": float(row["ph"]) + p_h_adjustment,
                        "ec": float(row["ec"]),
                        "nitrogen": float(row["nitrogen"]),
                        "phosphorus": float(row["phosphorus"]),
                        "potassium": float(row["potassium"]),
                    },
                    "standardUncertainty": {
                        "pH": float(row["uncertainty_ph"]),
                        "ec": float(row["uncertainty_ec"]),
                        "nitrogen": float(row["uncertainty_nitrogen"]),
                        "phosphorus": float(row["uncertainty_phosphorus"]),
                        "potassium": float(row["uncertainty_potassium"]),
                    },
                    "depthCm": row["depth_cm"],
                    "collectionDate": row["collection_date"],
                    "labMethod": row["lab_method"],
                }
            )
    return FieldZoningRequest(
        boundary=geojson["geometry"],
        samples=samples,
        cellSizeM=10,
        method="fcm",
        maxK=6,
        seed=42,
        mergeThresholdZ=0.5,
        perturbationRuns=perturbation_runs,
    )


def test_each_demo_zone_has_at_least_one_crop_pH_context_outside_its_interval():
    for csv_path in DEMO_DATA.glob("*.csv"):
        result = run_field_zoning(_request(csv_path))
        for zone in result["zones"]:
            report = evaluate_crop_fit(
                CropFitRequest(
                    profileVersion=PROFILE_VERSION,
                    measurements={"pH": zone["meanSoilValues"]["pH"]},
                )
            )
            p_h_states = [
                next(factor["state"] for factor in assessment["factors"] if factor["feature"] == "pH")
                for assessment in report["assessments"]
            ]
            assert any(state != "within_reference_range" for state in p_h_states), (
                f"{csv_path.stem}, zone {zone['zoneId']}: all three cited pH intervals overlap; "
                "this is only a pH-reference display check, not a crop-suitability test"
            )


def test_uniform_demo_pH_offsets_do_not_change_standardized_zone_assignments():
    for scenario in OFFSET_SCENARIOS:
        csv_path = DEMO_DATA / f"{scenario}.csv"
        prior_values = run_field_zoning(_request(csv_path, p_h_adjustment=0.1, perturbation_runs=2))
        adjusted_values = run_field_zoning(_request(csv_path, perturbation_runs=2))

        assert adjusted_values["selectedK"] == prior_values["selectedK"]
        assert adjusted_values["stability"]["ariScores"] == prior_values["stability"]["ariScores"]
        assert [
            (cell["clusterId"], cell["zoneId"]) for cell in adjusted_values["cells"]
        ] == [
            (cell["clusterId"], cell["zoneId"]) for cell in prior_values["cells"]
        ]
