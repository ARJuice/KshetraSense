from __future__ import annotations

import json
import os
from dataclasses import dataclass
from importlib.metadata import PackageNotFoundError, version
from pathlib import Path
from typing import Any

os.environ.setdefault("KERAS_BACKEND", "torch")

import numpy as np

from .dataset import FEATURE_KEYS, ReplayDataset

WINDOW_STEPS = 144
HORIZON_STEPS = (36, 72, 144)
HORIZON_HOURS = (6, 12, 24)
MODEL_VERSION = "soil-signal-gru-v1"
TRAINING_SEED = 42
TRAINING_STRIDE = 12
MODEL_DIR = Path(__file__).resolve().parents[1] / "models"
MODEL_PATH = MODEL_DIR / "soil_signal_gru.keras"
METADATA_PATH = MODEL_DIR / "soil_signal_gru_metadata.json"


@dataclass(frozen=True)
class SequenceSet:
    inputs: np.ndarray
    targets: np.ndarray
    origins: np.ndarray
    line_ids: np.ndarray


@dataclass(frozen=True)
class TemporalSplits:
    train: SequenceSet
    validation: SequenceSet
    test: SequenceSet
    train_end_index: int
    validation_end_index: int


def temporal_splits(dataset: ReplayDataset, stride: int = TRAINING_STRIDE) -> TemporalSplits:
    if stride < 1:
        raise ValueError("Sequence stride must be positive.")
    sample_count = len(dataset.timestamps_ms)
    train_end = int(sample_count * 0.70)
    validation_end = int(sample_count * 0.85)
    buckets: dict[str, list[tuple[np.ndarray, np.ndarray, int, int]]] = {
        "train": [],
        "validation": [],
        "test": [],
    }

    for line_id, line in dataset.lines.items():
        for origin in range(WINDOW_STEPS - 1, sample_count - HORIZON_STEPS[-1], stride):
            targets = origin + np.asarray(HORIZON_STEPS, dtype=np.int64)
            if not np.isfinite(line.features[origin - WINDOW_STEPS + 1 : origin + 1]).all():
                continue
            target_values = line.features[targets, 0]
            if not np.isfinite(target_values).all():
                continue
            if targets[-1] < train_end:
                split = "train"
            elif origin >= train_end and targets[-1] < validation_end:
                split = "validation"
            elif origin >= validation_end:
                split = "test"
            else:
                continue
            buckets[split].append(
                (
                    line.features[origin - WINDOW_STEPS + 1 : origin + 1],
                    target_values,
                    int(origin),
                    int(line_id),
                )
            )

    def make_set(rows: list[tuple[np.ndarray, np.ndarray, int, int]]) -> SequenceSet:
        if not rows:
            raise ValueError("The pinned dataset produced an empty temporal split.")
        return SequenceSet(
            inputs=np.asarray([row[0] for row in rows], dtype=np.float32),
            targets=np.asarray([row[1] for row in rows], dtype=np.float32),
            origins=np.asarray([row[2] for row in rows], dtype=np.int64),
            line_ids=np.asarray([row[3] for row in rows], dtype=np.int64),
        )

    return TemporalSplits(
        train=make_set(buckets["train"]),
        validation=make_set(buckets["validation"]),
        test=make_set(buckets["test"]),
        train_end_index=train_end,
        validation_end_index=validation_end,
    )


def _fit_minmax(dataset: ReplayDataset, train_end_index: int) -> tuple[np.ndarray, np.ndarray]:
    train_rows = np.concatenate(
        [line.features[:train_end_index] for line in dataset.lines.values()],
        axis=0,
    )
    train_rows = train_rows[np.isfinite(train_rows).all(axis=1)]
    if train_rows.size == 0:
        raise ValueError("No complete training-period feature rows are available.")
    feature_min = train_rows.min(axis=0)
    feature_max = train_rows.max(axis=0)
    return feature_min.astype(np.float32), feature_max.astype(np.float32)


def _scale(values: np.ndarray, feature_min: np.ndarray, feature_max: np.ndarray) -> np.ndarray:
    span = feature_max - feature_min
    safe_span = np.where(span == 0, 1.0, span)
    return ((values - feature_min) / safe_span).astype(np.float32)


def _create_model() -> Any:
    import keras

    inputs = keras.Input(shape=(WINDOW_STEPS, len(FEATURE_KEYS)), name="soil_signal_history")
    values = keras.layers.GRU(64, return_sequences=True, name="gru_64")(inputs)
    values = keras.layers.Dropout(0.1, seed=TRAINING_SEED, name="dropout_01")(values)
    values = keras.layers.GRU(32, name="gru_32")(values)
    outputs = keras.layers.Dense(
        len(HORIZON_HOURS),
        kernel_initializer="zeros",
        bias_initializer="zeros",
        name="soil_signal_forecast_residual",
    )(values)
    return keras.Model(inputs=inputs, outputs=outputs, name=MODEL_VERSION)


def _metrics(actual: np.ndarray, predicted: np.ndarray) -> dict[str, float | None]:
    residual = actual - predicted
    mae = float(np.mean(np.abs(residual)))
    rmse = float(np.sqrt(np.mean(residual**2)))
    total = float(np.sum((actual - np.mean(actual)) ** 2))
    r2 = None if total == 0 else float(1.0 - np.sum(residual**2) / total)
    return {"maePctRh": mae, "rmsePctRh": rmse, "r2": r2}


def _installed_version(package_name: str) -> str:
    try:
        return version(package_name)
    except PackageNotFoundError:
        return "not-installed"


def train_forecaster(dataset: ReplayDataset, model_path: Path = MODEL_PATH, metadata_path: Path = METADATA_PATH) -> dict[str, Any]:
    import keras

    keras.utils.set_random_seed(TRAINING_SEED)
    splits = temporal_splits(dataset)
    feature_min, feature_max = _fit_minmax(dataset, splits.train_end_index)
    target_min = feature_min[0]
    target_max = feature_max[0]

    train_x = _scale(splits.train.inputs, feature_min, feature_max)
    validation_x = _scale(splits.validation.inputs, feature_min, feature_max)
    test_x = _scale(splits.test.inputs, feature_min, feature_max)
    target_span = float(target_max - target_min) or 1.0
    train_persistence = splits.train.inputs[:, -1, 0, np.newaxis]
    validation_persistence = splits.validation.inputs[:, -1, 0, np.newaxis]
    train_y = (splits.train.targets - train_persistence) / target_span
    validation_y = (splits.validation.targets - validation_persistence) / target_span

    model = _create_model()
    model.compile(optimizer=keras.optimizers.Adam(learning_rate=0.001), loss=keras.losses.Huber(delta=1.0))
    early_stop = keras.callbacks.EarlyStopping(
        monitor="val_loss",
        mode="min",
        patience=10,
        restore_best_weights=True,
    )
    history = model.fit(
        train_x,
        train_y,
        validation_data=(validation_x, validation_y),
        epochs=40,
        batch_size=256,
        shuffle=True,
        callbacks=[early_stop],
        verbose=2,
    )

    predictions_scaled = np.asarray(model.predict(test_x, verbose=0), dtype=np.float32)
    output_span = target_max - target_min
    if output_span == 0:
        output_span = 1.0
    persistence = splits.test.inputs[:, -1, 0]
    predictions = predictions_scaled * output_span + persistence[:, np.newaxis]
    actual = splits.test.targets

    by_horizon: dict[str, Any] = {}
    for column, horizon in enumerate(HORIZON_HOURS):
        by_horizon[f"{horizon}h"] = {
            "sampleCount": int(actual.shape[0]),
            "gru": _metrics(actual[:, column], predictions[:, column]),
            "persistenceBaseline": _metrics(actual[:, column], persistence),
            "beatsPersistenceByMae": bool(
                np.mean(np.abs(actual[:, column] - predictions[:, column]))
                < np.mean(np.abs(actual[:, column] - persistence))
            ),
            "byLine": {},
        }
        for line_id in dataset.lines:
            mask = splits.test.line_ids == line_id
            by_horizon[f"{horizon}h"]["byLine"][str(line_id)] = {
                "sampleCount": int(mask.sum()),
                "gru": _metrics(actual[mask, column], predictions[mask, column]),
                "persistenceBaseline": _metrics(actual[mask, column], persistence[mask]),
            }

    split_times = {
        "trainEndExclusiveUtc": _utc(dataset.timestamps_ms[splits.train_end_index]),
        "validationEndExclusiveUtc": _utc(dataset.timestamps_ms[splits.validation_end_index]),
    }
    metadata: dict[str, Any] = {
        "modelVersion": MODEL_VERSION,
        "framework": "Keras 3 / PyTorch CPU backend",
        "kerasVersion": _installed_version("keras"),
        "torchVersion": _installed_version("torch"),
        "featureOrder": list(FEATURE_KEYS),
        "featureUnits": dataset.metadata["featureUnits"],
        "target": "soilHumiditySignalPctRh",
        "targetUnit": "%RH sensor signal; not VWC",
        "windowSteps": WINDOW_STEPS,
        "nominalStepMinutes": 10,
        "horizonsHours": list(HORIZON_HOURS),
        "architecture": ["GRU(64, return_sequences=True)", "Dropout(0.1)", "GRU(32)", "Dense(3) residual head, zero initialized"],
        "outputHead": "scaled future-minus-current sensor signal residual, added to persistence baseline",
        "loss": "Huber(delta=1.0)",
        "optimizer": "Adam(learning_rate=0.001)",
        "seed": TRAINING_SEED,
        "trainingStrideSteps": TRAINING_STRIDE,
        "trainingOriginIntervalMinutes": TRAINING_STRIDE * 10,
        "maximumEpochs": 40,
        "batchSize": 256,
        "earlyStopping": {"monitor": "val_loss", "patience": 10, "restoreBestWeights": True},
        "shuffleWithinTrainingSplit": True,
        "splitRatios": {"train": 0.70, "validation": 0.15, "test": 0.15},
        "splitBoundaries": split_times,
        "sampleCounts": {
            "train": int(splits.train.inputs.shape[0]),
            "validation": int(splits.validation.inputs.shape[0]),
            "test": int(splits.test.inputs.shape[0]),
        },
        "minMaxScaler": {
            "fitOn": "complete training-period feature rows only",
            "minimum": feature_min.tolist(),
            "maximum": feature_max.tolist(),
            "targetMinimum": float(target_min),
            "targetMaximum": float(target_max),
        },
        "holdoutMetrics": by_horizon,
        "qualityDisposition": {
            key: "beats_persistence" if value["beatsPersistenceByMae"] else "does_not_beat_persistence"
            for key, value in by_horizon.items()
        },
        "dataset": dataset.metadata["dataset"],
        "datasetSourceFiles": dataset.metadata["sourceFiles"],
        "createdUtc": _utc_now(),
        "limitations": [
            "Historical Parma trial only; no KshetraSense farm validation.",
            "Target is the sensor-reported soil humidity %RH signal, not volumetric water content.",
            "Point forecast only; no calibrated uncertainty interval or irrigation recommendation.",
        ],
        "bestValidationLoss": float(min(history.history["val_loss"])),
    }

    model_path.parent.mkdir(parents=True, exist_ok=True)
    model.save(model_path)
    metadata_path.write_text(json.dumps(metadata, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    return metadata


def _utc(timestamp_ms: int) -> str:
    from datetime import datetime, timezone

    return datetime.fromtimestamp(int(timestamp_ms) / 1000, tz=timezone.utc).isoformat().replace("+00:00", "Z")


def _utc_now() -> str:
    from datetime import datetime, timezone

    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


class SoilSignalForecaster:
    def __init__(self, model_path: Path = MODEL_PATH, metadata_path: Path = METADATA_PATH):
        import keras

        if not model_path.is_file() or not metadata_path.is_file():
            raise FileNotFoundError("The trained soil-signal GRU artifact or metadata is missing.")
        self.metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
        if self.metadata.get("modelVersion") != MODEL_VERSION or self.metadata.get("featureOrder") != list(FEATURE_KEYS):
            raise ValueError("The trained GRU artifact does not match the telemetry feature contract.")
        self.model = keras.models.load_model(model_path, compile=False, safe_mode=True)
        scaler = self.metadata["minMaxScaler"]
        self.feature_min = np.asarray(scaler["minimum"], dtype=np.float32)
        self.feature_max = np.asarray(scaler["maximum"], dtype=np.float32)
        if self.model.input_shape != (None, WINDOW_STEPS, len(FEATURE_KEYS)) or self.model.output_shape != (None, len(HORIZON_HOURS)):
            raise ValueError("The trained GRU tensor shape does not match the telemetry feature contract.")

    def predict(self, window: np.ndarray, interpolated_values: int) -> dict[str, Any]:
        if window.shape != (WINDOW_STEPS, len(FEATURE_KEYS)) or not np.isfinite(window).all():
            raise ValueError("Forecast input must be a complete 24-hour feature window.")
        scaled = _scale(window, self.feature_min, self.feature_max)[np.newaxis, ...]
        predicted_scaled = np.asarray(self.model.predict(scaled, verbose=0)[0], dtype=np.float64)
        target_min = float(self.metadata["minMaxScaler"]["targetMinimum"])
        target_span = float(self.metadata["minMaxScaler"]["targetMaximum"]) - target_min
        predicted = predicted_scaled * (target_span if target_span else 1.0) + float(window[-1, 0])
        return {
            "status": "exploratory_only",
            "modelVersion": MODEL_VERSION,
            "target": "soilHumiditySignalPctRh",
            "unit": "%RH sensor signal; not VWC",
            "inputWindowSteps": WINDOW_STEPS,
            "interpolatedInputValues": int(interpolated_values),
            "inputResamplingNote": "Count includes time-grid alignment and short-gap bridging; displayed sensor readings remain original observations.",
            "qualityDisposition": self.metadata["qualityDisposition"],
            "holdoutMetrics": self.metadata["holdoutMetrics"],
            "pointForecasts": [
                {"horizonHours": horizon, "value": float(value)}
                for horizon, value in zip(HORIZON_HOURS, predicted, strict=True)
            ],
            "limitations": self.metadata["limitations"],
        }
