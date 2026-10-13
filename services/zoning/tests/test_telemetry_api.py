from datetime import datetime, timedelta, timezone

from app.main import app
from fastapi.testclient import TestClient
from services.telemetry.app.forecast import WINDOW_STEPS
from services.telemetry.app.service import get_telemetry_service
import numpy as np

client = TestClient(app)


def test_telemetry_metadata_and_stream_are_historical_and_not_zone_bound():
    metadata = client.get("/v1/telemetry/metadata")
    assert metadata.status_code == 200
    details = metadata.json()
    assert details["capabilities"]["liveTelemetry"] is False
    assert details["capabilities"]["zoneBinding"] is False
    assert details["forecastModel"]["featureOrder"][0] == "soilHumiditySignalPctRh"

    response = client.get("/v1/telemetry/stream")
    assert response.status_code == 200
    result = response.json()
    assert len(result["lines"]) == 3
    assert "not live telemetry" in result["replayLabel"]
    assert all("zoneId" not in line for line in result["lines"])
    assert all("deviceIdentifier" not in line for line in result["lines"])
    assert all(line["waterMeter"]["sourceUnit"].startswith("m³") for line in result["lines"])


def test_playback_control_seek_and_history_contract():
    metadata = client.get("/v1/telemetry/metadata").json()
    start = datetime.fromisoformat(metadata["timeline"]["startUtc"].replace("Z", "+00:00"))
    seek_time = start + timedelta(hours=36)
    seek = client.post("/v1/telemetry/control", json={"action": "seek", "timestamp": seek_time.isoformat()})
    assert seek.status_code == 200
    assert seek.json()["timestamp"] <= seek_time.isoformat().replace("+00:00", "Z")

    speed = client.post("/v1/telemetry/control", json={"action": "set_speed", "speed": 60})
    assert speed.status_code == 200
    assert speed.json()["speed"] == 60
    assert client.post("/v1/telemetry/control", json={"action": "set_speed", "speed": 5}).status_code == 422

    end_time = seek_time + timedelta(hours=2)
    history = client.get(
        "/v1/telemetry/history",
        params={"line_id": 1, "start": seek_time.isoformat(), "end": end_time.isoformat(), "limit": 10},
    )
    assert history.status_code == 200
    assert history.json()["lineId"] == 1
    assert len(history.json()["samples"]) <= 10


def test_gru_forecast_is_labeled_as_sensor_signal_not_vwc():
    service = get_telemetry_service()
    line = service.dataset.lines[1]
    valid_origins = [
        index
        for index in range(WINDOW_STEPS - 1, len(service.dataset.timestamps_ms))
        if np.isfinite(line.features[index - WINDOW_STEPS + 1 : index + 1]).all()
    ]
    assert valid_origins
    seek_time = datetime.fromtimestamp(
        service.dataset.timestamps_ms[valid_origins[0]] / 1000,
        tz=timezone.utc,
    )
    assert client.post(
        "/v1/telemetry/control",
        json={"action": "seek", "timestamp": seek_time.isoformat()},
    ).status_code == 200

    response = client.get("/v1/telemetry/stream?line_id=1")
    assert response.status_code == 200
    forecast = response.json()["lines"][0]["forecast"]
    assert forecast["status"] == "exploratory_only"
    assert forecast["target"] == "soilHumiditySignalPctRh"
    assert forecast["unit"] == "%RH sensor signal; not VWC"
    assert [point["horizonHours"] for point in forecast["pointForecasts"]] == [6, 12, 24]
    assert set(forecast["qualityDisposition"].values()) == {"does_not_beat_persistence"}
    assert "confidence" not in forecast
    anomaly = response.json()["lines"][0]["anomalyReview"]
    assert anomaly["status"] in {"review_candidate", "no_candidate"}
    assert "score" in anomaly
    assert "confidence" not in anomaly
    assert "sensorFault" not in response.json()["lines"][0]


def test_fao56_api_is_independent_of_replay_and_rejects_vwc_as_percent():
    response = client.post(
        "/v1/telemetry/water-balance/advisory",
        json={
            "currentVwcFraction": 0.22,
            "forecastVwcFractions": [0.2],
            "fieldCapacityVwcFraction": 0.32,
            "wiltingPointVwcFraction": 0.14,
            "rootingDepthM": 0.7,
            "depletionFraction": 0.4,
            "calibrationSource": "measured site profile",
        },
    )
    assert response.status_code == 200
    assert response.json()["actuation"] == "none"

    invalid = client.post(
        "/v1/telemetry/water-balance/advisory",
        json={
            "currentVwcFraction": 22,
            "forecastVwcFractions": [],
            "fieldCapacityVwcFraction": 32,
            "wiltingPointVwcFraction": 14,
            "rootingDepthM": 0.7,
            "depletionFraction": 0.4,
            "calibrationSource": "measured site profile",
        },
    )
    assert invalid.status_code == 422

    assert client.post("/v1/telemetry/water-balance/advisory", json=[]).status_code == 422


def test_websocket_streams_read_only_historical_snapshots():
    with client.websocket_connect("/v1/telemetry/ws") as websocket:
        snapshot = websocket.receive_json()
    assert "not live telemetry" in snapshot["replayLabel"]
    assert len(snapshot["lines"]) == 3
