from app.main import app  # noqa: F401 — imports the repository root for the telemetry namespace.
from services.telemetry.app.playback import PlaybackController, PlaybackRangeError
import numpy as np
import pytest


def test_playback_speed_pause_and_end_are_deterministic():
    clock = [0.0]
    timeline = np.arange(0, 5 * 600_000, 600_000, dtype=np.int64)
    playback = PlaybackController(timeline, clock=lambda: clock[0])

    assert playback.control("play")["isPlaying"] is True
    clock[0] = 2.0
    assert playback.state()["index"] == 0
    playback.control("set_speed", speed=60)
    clock[0] = 12.0
    assert playback.state()["index"] == 1
    paused = playback.control("pause")
    clock[0] = 20.0
    assert playback.state()["index"] == paused["index"]
    assert playback.state()["isPlaying"] is False

    playback.control("seek", timestamp_ms=int(timeline[-1]))
    assert playback.control("play")["isPlaying"] is False


def test_seek_rejects_out_of_range_and_invalid_speed():
    playback = PlaybackController(np.arange(0, 3 * 600_000, 600_000, dtype=np.int64), clock=lambda: 0.0)
    with pytest.raises(PlaybackRangeError):
        playback.control("seek", timestamp_ms=3 * 600_000)
    with pytest.raises(ValueError):
        playback.control("set_speed", speed=5)
