from app.main import app  # noqa: F401 — imports the repository root for the telemetry namespace.
import numpy as np

from services.telemetry.app.dataset import load_replay_dataset
from services.telemetry.app.dataset import _interpolate_to_grid


def test_pinned_dataset_integrity_and_units_are_visible():
    dataset = load_replay_dataset()
    quality = dataset.metadata["dataQuality"]

    assert quality["sha256Verified"] is True
    assert len(dataset.metadata["sourceFiles"]) == 5
    assert quality["environmentRows"] == 10_964
    assert quality["soilExcludedRows"] == 2
    assert quality["meterExcludedRows"] == 2
    assert quality["environmentBatteryMissingRows"] == 10_889
    assert quality["lineStats"]["3"]["meterNegativeRegisterChanges"] == 3
    assert dataset.metadata["featureUnits"]["soilHumiditySignalPctRh"] == "%RH sensor signal; not VWC"
    assert "not live telemetry" in dataset.metadata["replayLabel"]
    assert [line["lineId"] for line in dataset.metadata["lines"]] == [1, 2, 3]
    assert dataset.lines[1].features.shape[1] == 5
    assert dataset.lines[3].interpolated_features.any()


def test_time_alignment_interpolates_only_short_bracketed_gaps():
    times = np.asarray([0, 10 * 60_000, 50 * 60_000, 60 * 60_000], dtype=np.int64)
    values = np.asarray([0.0, 10.0, 50.0, 60.0])
    grid = np.asarray([-10 * 60_000, 5 * 60_000, 30 * 60_000, 55 * 60_000, 70 * 60_000], dtype=np.int64)

    aligned, interpolated = _interpolate_to_grid(times, values, grid)

    assert np.isnan(aligned[0])  # no leading extrapolation
    assert aligned[1] == 5.0
    assert interpolated[1]
    assert np.isnan(aligned[2])  # the 40-minute gap is deliberately not bridged
    assert aligned[3] == 55.0
    assert np.isnan(aligned[4])  # no trailing extrapolation
