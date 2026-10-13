from __future__ import annotations

import threading
import time
from datetime import datetime, timezone
from typing import Callable

import numpy as np

ALLOWED_SPEEDS = (1, 10, 60, 360)


class PlaybackRangeError(ValueError):
    """Raised when a seek is outside the pinned dataset's time range."""


class PlaybackController:
    def __init__(self, timestamps_ms: np.ndarray, clock: Callable[[], float] = time.monotonic):
        if timestamps_ms.ndim != 1 or timestamps_ms.size < 2 or np.any(np.diff(timestamps_ms) <= 0):
            raise ValueError("Playback requires a sorted one-dimensional timeline with at least two points.")
        self._timestamps_ms = timestamps_ms
        self._clock = clock
        self._lock = threading.RLock()
        self._index = 0
        self._anchor_index = 0
        self._anchor_clock = clock()
        self._playing = False
        self._speed = 1

    def _effective_index(self, now: float) -> int:
        if not self._playing:
            return self._index
        elapsed_ms = max(0.0, now - self._anchor_clock) * 1000.0 * self._speed
        simulated_ms = self._timestamps_ms[self._anchor_index] + elapsed_ms
        index = int(np.searchsorted(self._timestamps_ms, simulated_ms, side="right") - 1)
        if index >= self._timestamps_ms.size - 1:
            self._index = self._timestamps_ms.size - 1
            self._anchor_index = self._index
            self._playing = False
            return self._index
        return max(0, index)

    def state(self) -> dict[str, int | bool | str]:
        with self._lock:
            self._index = self._effective_index(self._clock())
            return {
                "index": self._index,
                "timestamp": _iso_utc(int(self._timestamps_ms[self._index])),
                "timestampMs": int(self._timestamps_ms[self._index]),
                "speed": self._speed,
                "isPlaying": self._playing,
                "startUtc": _iso_utc(int(self._timestamps_ms[0])),
                "endUtc": _iso_utc(int(self._timestamps_ms[-1])),
            }

    def control(
        self,
        action: str,
        *,
        speed: int | None = None,
        timestamp_ms: int | None = None,
    ) -> dict[str, int | bool | str]:
        with self._lock:
            now = self._clock()
            current_index = self._effective_index(now)
            if action == "play":
                self._index = current_index
                self._anchor_index = current_index
                self._anchor_clock = now
                self._playing = current_index < self._timestamps_ms.size - 1
            elif action == "pause":
                self._index = current_index
                self._anchor_index = current_index
                self._anchor_clock = now
                self._playing = False
            elif action == "seek":
                if timestamp_ms is None:
                    raise ValueError("A timestamp is required for seek.")
                if timestamp_ms < self._timestamps_ms[0] or timestamp_ms > self._timestamps_ms[-1]:
                    raise PlaybackRangeError("Seek timestamp is outside the available historical replay range.")
                self._index = int(np.searchsorted(self._timestamps_ms, timestamp_ms, side="right") - 1)
                self._anchor_index = self._index
                self._anchor_clock = now
            elif action == "set_speed":
                if speed not in ALLOWED_SPEEDS:
                    raise ValueError(f"Speed must be one of {', '.join(map(str, ALLOWED_SPEEDS))}.")
                self._index = current_index
                self._anchor_index = current_index
                self._anchor_clock = now
                self._speed = speed
            else:
                raise ValueError("Unsupported playback action.")
            return self.state()


def datetime_to_epoch_ms(value: datetime) -> int:
    if value.tzinfo is None or value.utcoffset() is None:
        raise ValueError("Timestamps must include a timezone.")
    return int(value.astimezone(timezone.utc).timestamp() * 1000)


def _iso_utc(timestamp_ms: int) -> str:
    return datetime.fromtimestamp(timestamp_ms / 1000, tz=timezone.utc).isoformat().replace("+00:00", "Z")
