from contextlib import contextmanager
from io import BytesIO

import httpx
import numpy as np
import pytest
import tifffile
from fastapi.testclient import TestClient

from app import soilgrids
from app.main import app


client = TestClient(app)
LATITUDE = 31.1
LONGITUDE = 75.4


def _geotiff(raw_value: int) -> bytes:
    pixels = np.zeros((4, 4), dtype=np.int16)
    pixels[2, 2] = raw_value
    pixels[0, 0] = 222  # A different neighbor verifies the queried coordinate is sampled.
    buffer = BytesIO()
    tifffile.imwrite(
        buffer,
        pixels,
        photometric="minisblack",
        extratags=[
            (33550, "d", 3, (0.0022, 0.0022, 0.0), False),
            (33922, "d", 6, (0.0, 0.0, 0.0, LONGITUDE - 0.005, LATITUDE + 0.005, 0.0), False),
        ],
    )
    return buffer.getvalue()


@pytest.mark.parametrize(
    ("property_id", "expected_unit", "factor"),
    [
        ("phh2o", "pH", 10),
        ("nitrogen", "g/kg", 100),
        ("soc", "g/kg", 10),
        ("cec", "cmol(c)/kg", 10),
        ("bdod", "kg/dm³", 100),
        ("clay", "%", 10),
        ("sand", "%", 10),
        ("silt", "%", 10),
    ],
)
def test_soilgrids_wcs_quantiles_are_scaled_and_sampled_for_requested_cell(
    monkeypatch: pytest.MonkeyPatch,
    property_id: str,
    expected_unit: str,
    factor: int,
):
    coverages: list[str] = []

    def fake_fetch(params: list[tuple[str, str]]) -> bytes:
        coverage = next(value for key, value in params if key == "COVERAGEID")
        coverages.append(coverage)
        assert ("SUBSETTINGCRS", soilgrids._WGS84_CRS) in params
        assert ("OUTPUTCRS", soilgrids._WGS84_CRS) in params
        assert ("FORMAT", "GEOTIFF_INT16") in params
        raw_value = {"Q0.05": 60, "Q0.5": 70, "Q0.95": 80}[coverage.rsplit("_", 1)[1]]
        return _geotiff(raw_value)

    monkeypatch.setattr(soilgrids, "_fetch_geotiff", fake_fetch)
    result = soilgrids.get_soilgrids_context(LATITUDE, LONGITUDE, property_id, "5-15cm")

    assert coverages == [
        f"{property_id}_5-15cm_Q0.05",
        f"{property_id}_5-15cm_Q0.5",
        f"{property_id}_5-15cm_Q0.95",
    ]
    assert result["unit"] == expected_unit
    assert result["quantiles"] == {
        "Q0.05": 60 / factor,
        "Q0.50": 70 / factor,
        "Q0.95": 80 / factor,
    }
    assert result["mappedValue"] == 70 / factor
    assert result["nativeResolution"] == "250 m nominal"
    assert result["latitude"] == LATITUDE
    assert result["longitude"] == LONGITUDE
    assert "ISRIC SoilGrids 2.0 WCS" in result["source"]


def test_soilgrids_endpoint_returns_real_provider_contract(monkeypatch: pytest.MonkeyPatch):
    def fake_fetch(params: list[tuple[str, str]]) -> bytes:
        quantile = next(value for key, value in params if key == "COVERAGEID").rsplit("_", 1)[1]
        return _geotiff({"Q0.05": 60, "Q0.5": 70, "Q0.95": 80}[quantile])

    monkeypatch.setattr(soilgrids, "_fetch_geotiff", fake_fetch)
    response = client.get(
        "/v1/monitoring/soilgrids?latitude=31.1&longitude=75.4&property=phh2o&depth=0-5cm"
    )

    assert response.status_code == 200
    assert response.json()["mappedValue"] == 7.0
    assert response.json()["quantiles"] == {"Q0.05": 6.0, "Q0.50": 7.0, "Q0.95": 8.0}


def test_soilgrids_rejects_masked_zero_cells(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(soilgrids, "_fetch_geotiff", lambda _params: _geotiff(0))

    with pytest.raises(soilgrids.SoilGridsUnavailable, match="No SoilGrids value is mapped"):
        soilgrids.get_soilgrids_context(LATITUDE, LONGITUDE, "phh2o", "0-5cm")


def test_soilgrids_rejects_oversized_raster_before_decoding(monkeypatch: pytest.MonkeyPatch):
    class OversizedPage:
        shape = (1, soilgrids._MAX_GRID_CELLS + 1)
        samplesperpixel = 1
        dtype = np.dtype(np.int16)
        tags = {}

        def asarray(self):
            pytest.fail("Oversized remote raster should be rejected before decoding.")

    class FakeTiff:
        pages = [OversizedPage()]

        def __init__(self, *_args, **_kwargs):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return False

    monkeypatch.setattr(soilgrids.tifffile, "TiffFile", FakeTiff)

    with pytest.raises(soilgrids.SoilGridsUnavailable, match="invalid or unusable GeoTIFF"):
        soilgrids._sample_raw_cell(b"remote-raster", LATITUDE, LONGITUDE)


def test_soilgrids_rejects_crossed_prediction_quantiles(monkeypatch: pytest.MonkeyPatch):
    def fake_fetch(params: list[tuple[str, str]]) -> bytes:
        quantile = next(value for key, value in params if key == "COVERAGEID").rsplit("_", 1)[1]
        return _geotiff({"Q0.05": 75, "Q0.5": 70, "Q0.95": 80}[quantile])

    monkeypatch.setattr(soilgrids, "_fetch_geotiff", fake_fetch)

    with pytest.raises(soilgrids.SoilGridsUnavailable, match="inconsistent prediction quantiles"):
        soilgrids.get_soilgrids_context(LATITUDE, LONGITUDE, "phh2o", "0-5cm")


def test_wcs_transport_rejects_non_geotiff_response(monkeypatch: pytest.MonkeyPatch):
    response = httpx.Response(
        200,
        headers={"content-type": "text/html"},
        content=b"MapServer exception",
        request=httpx.Request("GET", soilgrids._WCS_URL),
    )

    @contextmanager
    def fake_stream(*_args, **_kwargs):
        yield response

    monkeypatch.setattr(soilgrids.httpx, "stream", fake_stream)

    with pytest.raises(soilgrids.SoilGridsUnavailable, match="instead of GeoTIFF"):
        soilgrids._fetch_geotiff([])


def test_wcs_transport_reports_provider_http_errors(monkeypatch: pytest.MonkeyPatch):
    response = httpx.Response(
        503,
        headers={"content-type": "text/plain"},
        content=b"maintenance",
        request=httpx.Request("GET", soilgrids._WCS_URL),
    )

    @contextmanager
    def fake_stream(*_args, **_kwargs):
        yield response

    monkeypatch.setattr(soilgrids.httpx, "stream", fake_stream)

    with pytest.raises(soilgrids.SoilGridsUnavailable, match="returned HTTP 503"):
        soilgrids._fetch_geotiff([])
