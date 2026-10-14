from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def _payload(method: str = "kmeans") -> dict:
    return {
        "scenarioId": "garden-east",
        "gridRevision": 4,
        "method": method,
        "clusterCount": 2,
        "seed": 42,
        "features": ["pH", "nitrogen", "ec"],
        "cells": [
            {"id": "r0c0", "row": 0, "column": 0, "values": {"pH": 5.5, "nitrogen": 20, "phosphorus": 10, "potassium": 80, "ec": 0.4, "soilTemperature": 18}},
            {"id": "r0c1", "row": 0, "column": 1, "values": {"pH": 5.6, "nitrogen": 22, "phosphorus": 11, "potassium": 82, "ec": 0.5, "soilTemperature": 18.5}},
            {"id": "r1c0", "row": 1, "column": 0, "values": {"pH": 7.0, "nitrogen": 80, "phosphorus": 35, "potassium": 180, "ec": 1.8, "soilTemperature": 25}},
            {"id": "r1c1", "row": 1, "column": 1, "values": {"pH": 7.1, "nitrogen": 82, "phosphorus": 36, "potassium": 182, "ec": 1.9, "soilTemperature": 25.5}},
            {"id": "missing", "row": 2, "column": 1, "values": {"pH": None, "nitrogen": 30, "phosphorus": 15, "potassium": 90, "ec": 0.8, "soilTemperature": 20}},
        ],
    }


def test_health_and_kmeans_run_are_available():
    assert client.get("/health").status_code == 200
    response = client.post("/v1/zoning/run", json=_payload())
    assert response.status_code == 200
    result = response.json()
    assert result["method"] == "kmeans"
    assert len(result["assignments"]) == 4
    assert len(result["assignmentDetails"]) == 4
    assert result["excludedCells"] == [{"cellId": "missing", "reason": "Missing requested feature(s): pH"}]
    assert len(result["zones"]) == 2


def test_fcm_run_exposes_memberships_that_sum_to_one():
    response = client.post("/v1/zoning/run", json=_payload("fcm"))
    assert response.status_code == 200
    assignments = response.json()["assignmentDetails"]
    assert all(abs(sum(item["memberships"]) - 1.0) < 1e-6 for item in assignments)


def test_frontend_compatibility_alias_accepts_flat_cells_and_snake_case_cluster_count():
    payload = _payload()
    payload.pop("scenarioId")
    payload.pop("gridRevision")
    payload.pop("features")
    payload["method"] = "fuzzy-c-means"
    payload["cluster_count"] = payload.pop("clusterCount")
    for cell in payload["cells"]:
        cell.update(cell.pop("values"))
        cell["ph"] = cell.pop("pH")
    response = client.post("/api/v1/zoning/run", json=payload)
    assert response.status_code == 200
    result = response.json()
    assert result["method"] == "fuzzy-c-means"
    assert result["clusterCount"] == 2
    assert isinstance(result["assignments"], dict)
    assert isinstance(result["memberships"], dict)
    assert isinstance(result["zones"][0]["variance"], float)
    assert "ph" in result["zones"][0]["mean"]
    assert "createdAt" in result


def test_constant_features_are_excluded_but_variable_feature_runs():
    payload = _payload()
    payload["features"] = ["pH", "ec"]
    for cell in payload["cells"]:
        cell["values"]["ec"] = 1.0
    response = client.post("/v1/zoning/run", json=payload)
    assert response.status_code == 200
    assert response.json()["featureSchema"]["excluded"] == [
        {"feature": "ec", "reason": "No variation across complete cells; cannot distinguish zones."}
    ]


def test_crop_fit_endpoint_rejects_unknown_profile():
    response = client.post("/v1/crop-fit/evaluate", json={"profileVersion": "unknown", "measurements": {"pH": 6.2}})
    assert response.status_code == 422


def test_crop_fit_endpoint_returns_factor_values_without_a_crop_level_verdict():
    measurements = {"pH": 5.7, "ec": 1.8, "nitrogen": 24, "phosphorus": 12, "potassium": 85}
    response = client.post("/v1/crop-fit/evaluate", json={"measurements": measurements})

    assert response.status_code == 200, response.text
    result = response.json()
    assert result["profileVersion"]
    assert len(result["assessments"]) == 3
    assert all("assessmentState" not in assessment for assessment in result["assessments"])
    for assessment in result["assessments"]:
        factors = {factor["feature"]: factor for factor in assessment["factors"]}
        for feature, value in measurements.items():
            assert factors[feature]["observedValue"] == value
    apple_factors = {factor["feature"]: factor for factor in result["assessments"][0]["factors"]}
    assert apple_factors["pH"]["state"] == "below_reference_range"
    assert apple_factors["ec"]["state"] == "context_required"
