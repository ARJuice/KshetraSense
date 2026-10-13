"""Tests for Field Monitoring endpoints (SoilGrids regional context & CropSight sub-application)."""

from fastapi.testclient import TestClient
from app.main import app


client = TestClient(app)


def test_health_reports_monitoring_status():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["service"] == "kshetrasense-zoning-and-monitoring"
    assert data["soilGridsVersion"] == "2.0"
    assert "cropsightMounted" in data
    assert data["cropsightMounted"] is True


def test_soilgrids_endpoint_valid_request():
    response = client.get("/v1/monitoring/soilgrids?latitude=12.9716&longitude=77.5946&property=phh2o&depth=0-5cm")
    assert response.status_code == 200
    data = response.json()
    assert data["property"] == "phh2o"
    assert data["propertyName"] == "Soil pH (in H2O)"
    assert data["depth"] == "0-5cm"
    assert data["nativeResolution"] == "250 m"
    assert "Q0.05" in data["quantiles"]
    assert "Q0.50" in data["quantiles"]
    assert "Q0.95" in data["quantiles"]
    assert data["quantiles"]["Q0.05"] <= data["quantiles"]["Q0.50"] <= data["quantiles"]["Q0.95"]
    assert data["modeledContextLabel"] == "Modeled regional context — not a field measurement"
    assert "ISRIC" in data["source"]
    assert "not a field measurement" in data["modeledContextLabel"]


def test_soilgrids_endpoint_invalid_property():
    response = client.get("/v1/monitoring/soilgrids?latitude=12.9716&longitude=77.5946&property=invalid_prop&depth=0-5cm")
    assert response.status_code == 422
    assert "Unsupported property" in response.json()["detail"]


def test_soilgrids_endpoint_invalid_depth():
    response = client.get("/v1/monitoring/soilgrids?latitude=12.9716&longitude=77.5946&property=phh2o&depth=999cm")
    assert response.status_code == 422
    assert "Unsupported depth" in response.json()["detail"]


def test_cropsight_mounted_subapp_endpoints():
    # CropSight root endpoint
    root_res = client.get("/cropsight/")
    assert root_res.status_code == 200
    assert "NDVI" in root_res.json()["message"]

    # CropSight health endpoint
    health_res = client.get("/cropsight/health")
    assert health_res.status_code == 200
    assert health_res.json()["status"] == "healthy"

    # CropSight crop-info endpoint
    crop_res = client.get("/cropsight/crop-info/Wheat")
    assert crop_res.status_code == 200
    assert "0.4-0.9" in crop_res.json()["ndvi_range"]
    assert crop_res.json()["optimal_rainfall"] == 80


def test_soilgrids_endpoint_out_of_bounds_coordinates():
    # Latitude > 90
    res_lat = client.get("/v1/monitoring/soilgrids?latitude=95.0&longitude=77.5946&property=phh2o&depth=0-5cm")
    assert res_lat.status_code == 422

    # Longitude < -180
    res_lon = client.get("/v1/monitoring/soilgrids?latitude=12.9716&longitude=-185.0&property=phh2o&depth=0-5cm")
    assert res_lon.status_code == 422


def test_cropsight_analyze_field_uninitialized_ee():
    # Calling analyze-field without GCP/Earth Engine authentication returns HTTP 500
    # with honest Earth Engine initialization error (FM-07)
    payload = {
        "latitude": 30.9015,
        "longitude": 75.8524,
        "buffer_size": 250,
        "start_date": "2026-01-01",
        "end_date": "2026-03-31",
        "clustering_method": "K-Means",
        "num_zones": 3,
    }
    response = client.post("/cropsight/analyze-field", json=payload)
    assert response.status_code == 500
    detail = response.json()["detail"].lower()
    assert "earth engine" in detail or "ee-auth" in detail or "not initialized" in detail


def test_cropsight_analyze_field_validation_error():
    # Missing required latitude/longitude returns 422 Unprocessable Entity
    response = client.post("/cropsight/analyze-field", json={"buffer_size": 250})
    assert response.status_code == 422

