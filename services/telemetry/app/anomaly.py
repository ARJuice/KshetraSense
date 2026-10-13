from __future__ import annotations

from dataclasses import replace

import numpy as np
from sklearn.ensemble import IsolationForest

from .dataset import ReplayDataset

CONTAMINATION = 0.02
RANDOM_STATE = 42


def _features(values: np.ndarray) -> np.ndarray:
    changes = np.full((values.shape[0], 2), np.nan, dtype=np.float64)
    if values.shape[0] > 1:
        changes[1:] = np.abs(np.diff(values[:, [0, 2]], axis=0))
    return np.column_stack([values[:, :3], changes])


def apply_anomaly_screen(dataset: ReplayDataset) -> ReplayDataset:
    train_end = int(len(dataset.timestamps_ms) * 0.70)
    matrices = {line_id: _features(line.features) for line_id, line in dataset.lines.items()}
    training_rows = np.concatenate(
        [matrix[:train_end] for matrix in matrices.values()],
        axis=0,
    )
    training_rows = training_rows[np.isfinite(training_rows).all(axis=1)]
    if training_rows.shape[0] < 100:
        raise ValueError("The telemetry replay does not contain enough valid rows for anomaly screening.")

    model = IsolationForest(
        n_estimators=100,
        contamination=CONTAMINATION,
        random_state=RANDOM_STATE,
        n_jobs=1,
    )
    model.fit(training_rows)
    screened_lines = {}
    for line_id, line in dataset.lines.items():
        matrix = matrices[line_id]
        valid = np.isfinite(matrix).all(axis=1)
        candidates = np.zeros(matrix.shape[0], dtype=bool)
        scores = np.full(matrix.shape[0], np.nan, dtype=np.float64)
        if valid.any():
            candidates[valid] = model.predict(matrix[valid]) == -1
            scores[valid] = model.decision_function(matrix[valid])
        screened_lines[line_id] = replace(
            line,
            anomaly_candidates=candidates,
            anomaly_scores=scores,
        )
    metadata = {
        **dataset.metadata,
        "anomalyScreenFit": {
            "algorithm": "IsolationForest",
            "features": [
                "soilHumiditySignalPctRh",
                "soilTemperatureC",
                "soilElectricalConductivityUsCm",
                "absoluteHumiditySignalChange",
                "absoluteEcChangeUsCm",
            ],
            "trainingRows": int(training_rows.shape[0]),
            "trainingPeriod": "first 70% of the timeline",
            "contaminationThreshold": CONTAMINATION,
            "randomState": RANDOM_STATE,
        },
    }
    return replace(dataset, lines=screened_lines, metadata=metadata)
