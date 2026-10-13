from pyproj import Transformer
from fastapi.testclient import TestClient
import pytest

from app.main import app


client = TestClient(app)


def _wgs84(utm_xy: tuple[float, float]) -> tuple[float, float]:
    return Transformer.from_crs("EPSG:32643", "EPSG:4326", always_xy=True).transform(*utm_xy)


def _payload() -> dict:
    ring = [
        _wgs84((500_000, 1_400_000)),
        _wgs84((500_100, 1_400_000)),
        _wgs84((500_100, 1_400_100)),
        _wgs84((500_000, 1_400_100)),
        _wgs84((500_000, 1_400_000)),
    ]
    measurements = [
        {"pH": 5.4, "ec": 0.5, "nitrogen": 25, "phosphorus": 10, "potassium": 80},
        {"pH": 5.6, "ec": 0.6, "nitrogen": 28, "phosphorus": 12, "potassium": 85},
        {"pH": 6.4, "ec": 1.1, "nitrogen": 55, "phosphorus": 25, "potassium": 135},
        {"pH": 7.1, "ec": 1.8, "nitrogen": 82, "phosphorus": 38, "potassium": 185},
        {"pH": 7.0, "ec": 1.7, "nitrogen": 78, "phosphorus": 36, "potassium": 180},
    ]
    positions = [(500_010, 1_400_010), (500_020, 1_400_080), (500_050, 1_400_050), (500_080, 1_400_020), (500_090, 1_400_090)]
    return {
        "boundary": {"type": "Polygon", "coordinates": [ring]},
        "samples": [
            {
                "id": f"sample-{index + 1}",
                "longitude": _wgs84(position)[0],
                "latitude": _wgs84(position)[1],
                "measurements": values,
                "depthCm": "0-15",
                "labMethod": "benchmark fixture",
            }
            for index, (position, values) in enumerate(zip(positions, measurements, strict=True))
        ],
        "cellSizeM": 10,
        "method": "fcm",
        "maxK": 3,
        "seed": 42,
        "perturbationRuns": 2,
    }


def test_full_pipeline_returns_interpolated_surfaces_contiguous_zones_and_site_candidates():
    response = client.post("/v2/zoning/run", json=_payload())

    assert response.status_code == 200, response.text
    result = response.json()
    assert result["processingDurationMs"] >= 0
    assert result["field"]["cellCount"] == 100
    assert len(result["cells"]) == 100
    assert all(set(cell["soilValues"]) == {"pH", "ec", "nitrogen", "phosphorus", "potassium"} for cell in result["cells"])
    assert all(0 <= cell["shi"] <= 100 for cell in result["cells"])
    assert all(sum(cell["clusterMemberships"]) == pytest.approx(1.0) for cell in result["cells"])
    assert sum(zone["cellCount"] for zone in result["zones"]) == 100
    assert all(zone["geometry"]["type"] in {"Polygon", "MultiPolygon"} for zone in result["zones"])
    assert len(result["wsnNodes"]) == len(result["zones"])
    assert result["clusterHead"]["radioCoverageValidated"] is False
    assert result["stability"]["perturbationRuns"] == 2
    assert len(result["stability"]["ariScores"]) == 2
    assert all("rmse" in result["interpolation"]["crossValidation"][feature] for feature in result["featureSchema"]["requested"])
    assert result["shi"]["officialUSDAIndex"] is False


def test_full_pipeline_kmeans_omits_fuzzy_memberships_and_can_skip_optional_stability():
    payload = _payload()
    payload["method"] = "kmeans"
    payload["perturbationRuns"] = 0

    response = client.post("/v2/zoning/run", json=payload)

    assert response.status_code == 200, response.text
    result = response.json()
    assert result["method"] == "kmeans"
    assert all("clusterMemberships" not in cell for cell in result["cells"])
    assert result["stability"]["meanARI"] is None


def test_full_pipeline_uses_interactive_default_for_sensitivity_runs():
    payload = _payload()
    payload.pop("perturbationRuns")

    response = client.post("/v2/zoning/run", json=payload)

    assert response.status_code == 200, response.text
    assert response.json()["stability"]["perturbationRuns"] == 10


def test_full_pipeline_rejects_samples_outside_the_field():
    payload = _payload()
    payload["samples"][0]["longitude"], payload["samples"][0]["latitude"] = _wgs84((500_150, 1_400_150))

    response = client.post("/v2/zoning/run", json=payload)

    assert response.status_code == 422
    assert "inside the field boundary" in response.json()["detail"]


def test_full_pipeline_rejects_two_samples_before_interpolation():
    payload = _payload()
    payload["samples"] = payload["samples"][:2]

    response = client.post("/v2/zoning/run", json=payload)

    assert response.status_code == 422


def test_full_pipeline_rejects_mixed_sampling_depths():
    payload = _payload()
    payload["samples"][0]["depthCm"] = "0-5"

    response = client.post("/v2/zoning/run", json=payload)

    assert response.status_code == 422
    assert "same sampling depth" in response.text


def test_full_pipeline_requires_explicit_sampling_depth():
    payload = _payload()
    del payload["samples"][0]["depthCm"]

    response = client.post("/v2/zoning/run", json=payload)

    assert response.status_code == 422
    assert "depthCm" in response.text


def test_full_pipeline_rejects_blank_sampling_depth():
    payload = _payload()
    for sample in payload["samples"]:
        sample["depthCm"] = "   "

    response = client.post("/v2/zoning/run", json=payload)

    assert response.status_code == 422
    assert "depthCm" in response.text
