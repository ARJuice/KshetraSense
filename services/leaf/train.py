from __future__ import annotations

import hashlib
import json
import os
import platform
from datetime import datetime, timezone
from importlib.metadata import version
from pathlib import Path
from typing import Any

os.environ.setdefault("KERAS_BACKEND", "torch")

import numpy as np
from sklearn.metrics import accuracy_score, classification_report, f1_score, precision_score, recall_score

from .classes import CLASS_IDS, CLASS_MAP_VERSION, REVIEW_POLICY_VERSION
from .dataset import DATA_DIRECTORY, LeafRecord, expected_calibration_error, load_records, split_training_records
from .model_factory import FINE_TUNE_LAST_LAYERS, build_model, enable_fine_tuning
from .preprocessing import INPUT_SIZE, PREPROCESSING_VERSION, preprocess_image_path


MODEL_DIRECTORY = Path(__file__).resolve().parent / "models"
MODEL_PATH = MODEL_DIRECTORY / "leaf_mobilenetv3_small.keras"
METADATA_PATH = MODEL_DIRECTORY / "metadata.json"
WEIGHTS_VERSION = "plantvillage17-mobilenetv3-small-v1.0.0"
SEED = 42
BATCH_SIZE = 32
MAX_EPOCHS_PER_STAGE = 8


def _load_keras() -> tuple[Any, str, str]:
    import keras
    import torch

    if keras.backend.backend() != "torch":
        raise RuntimeError("Leaf training requires KERAS_BACKEND=torch.")
    keras.utils.set_random_seed(SEED)
    device = "gpu:0" if torch.cuda.is_available() else "cpu:0"
    if torch.cuda.is_available():
        device_name = torch.cuda.get_device_name(0)
        print(f"Training device: {device_name}", flush=True)
    else:
        device_name = "CPU"
        print("Training device: CPU (CUDA-enabled PyTorch is unavailable).", flush=True)
    return keras, device, device_name


def _batch_dataset(keras: Any, records: list[LeafRecord], data_directory: Path, *, training: bool):
    labels = np.asarray([CLASS_IDS.index(record.class_name) for record in records], dtype=np.int64)
    counts = np.bincount(labels, minlength=len(CLASS_IDS))
    sample_weights = labels.size / (len(CLASS_IDS) * counts[labels]) if training else np.ones(len(labels), dtype=np.float32)

    class ImageBatches(keras.utils.PyDataset):
        def __init__(self) -> None:
            super().__init__(workers=4, use_multiprocessing=False, max_queue_size=6)
            self.order = np.arange(len(records))
            self.epoch = 0
            if training:
                self._shuffle()

        def __len__(self) -> int:
            return int(np.ceil(len(records) / BATCH_SIZE))

        def __getitem__(self, batch_index: int) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
            indices = self.order[batch_index * BATCH_SIZE : (batch_index + 1) * BATCH_SIZE]
            images = np.stack([preprocess_image_path(records[int(index)].file_path(data_directory)) for index in indices])
            return images, labels[indices], sample_weights[indices].astype(np.float32)

        def on_epoch_end(self) -> None:
            if training:
                self.epoch += 1
                self._shuffle()

        def _shuffle(self) -> None:
            np.random.default_rng(SEED + self.epoch).shuffle(self.order)

    return ImageBatches()


def _callbacks(keras: Any, checkpoint_path: Path) -> list[Any]:
    return [
        keras.callbacks.ModelCheckpoint(
            filepath=checkpoint_path,
            monitor="val_loss",
            mode="min",
            save_best_only=True,
            verbose=1,
        ),
        keras.callbacks.EarlyStopping(monitor="val_loss", patience=2, restore_best_weights=True, verbose=1),
    ]


def _predictions(keras: Any, device: str, model: Any, records: list[LeafRecord], data_directory: Path) -> tuple[np.ndarray, np.ndarray]:
    labels = np.asarray([CLASS_IDS.index(record.class_name) for record in records], dtype=np.int64)
    dataset = _batch_dataset(keras, records, data_directory, training=False)
    with keras.device(device):
        scores = np.asarray(model.predict(dataset, verbose=0), dtype=np.float64)
    if (
        scores.shape != (len(records), len(CLASS_IDS))
        or not np.isfinite(scores).all()
        or np.any(scores < 0.0)
        or np.any(scores > 1.0)
        or not np.isclose(scores.sum(axis=1), 1.0, rtol=0.0, atol=1e-3).all()
    ):
        raise RuntimeError("The trained classifier returned an invalid evaluation score matrix.")
    return labels, scores


def _metrics(labels: np.ndarray, scores: np.ndarray) -> dict[str, Any]:
    predicted = scores.argmax(axis=1)
    report = classification_report(
        labels,
        predicted,
        labels=np.arange(len(CLASS_IDS)),
        target_names=CLASS_IDS,
        output_dict=True,
        zero_division=0,
    )
    one_hot = np.eye(len(CLASS_IDS), dtype=np.float64)[labels]
    return {
        "sampleCount": int(labels.size),
        "accuracy": float(accuracy_score(labels, predicted)),
        "macroPrecision": float(precision_score(labels, predicted, average="macro", zero_division=0)),
        "macroRecall": float(recall_score(labels, predicted, average="macro", zero_division=0)),
        "macroF1": float(f1_score(labels, predicted, average="macro", zero_division=0)),
        "negativeLogLikelihood": float(
            -np.log(np.clip(scores[np.arange(labels.size), labels], np.finfo(np.float64).tiny, 1.0)).mean()
        ),
        "multiclassBrierScore": float(np.mean(np.sum((scores - one_hot) ** 2, axis=1))),
        "expectedCalibrationError15Bins": expected_calibration_error(labels, scores),
        "perClass": {
            class_name: {
                "precision": float(report[class_name]["precision"]),
                "recall": float(report[class_name]["recall"]),
                "f1": float(report[class_name]["f1-score"]),
                "support": int(report[class_name]["support"]),
            }
            for class_name in CLASS_IDS
        },
    }


def _majority_baseline(training_records: list[LeafRecord], test_labels: np.ndarray) -> dict[str, Any]:
    training_labels = np.asarray([CLASS_IDS.index(record.class_name) for record in training_records], dtype=np.int64)
    majority_class = int(np.bincount(training_labels, minlength=len(CLASS_IDS)).argmax())
    predictions = np.full(test_labels.shape, majority_class, dtype=np.int64)
    return {
        "className": CLASS_IDS[majority_class],
        "accuracy": float(accuracy_score(test_labels, predictions)),
        "macroF1": float(f1_score(test_labels, predictions, average="macro", zero_division=0)),
    }


def _file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _pretrained_weight_hash(keras: Any) -> str:
    weights_path = keras.utils.get_file(
        fname="weights_mobilenet_v3_small_224_1.0_float_no_top_v2.h5",
        origin="https://storage.googleapis.com/tensorflow/keras-applications/mobilenet_v3/weights_mobilenet_v3_small_224_1.0_float_no_top_v2.h5",
        cache_subdir="models",
    )
    return _file_sha256(Path(weights_path))


def _split_summary(records: list[LeafRecord]) -> dict[str, Any]:
    return {
        "imageCount": len(records),
        "leafGroupCount": len({record.leaf_id for record in records}),
        "classCounts": {class_name: sum(record.class_name == class_name for record in records) for class_name in CLASS_IDS},
    }


def train_classifier() -> dict[str, Any]:
    keras, device, device_name = _load_keras()
    all_records, dataset_manifest = load_records(DATA_DIRECTORY, verify_hashes=True)
    official_train = [record for record in all_records if record.split == "train"]
    official_test = [record for record in all_records if record.split == "test"]
    train_records, validation_records = split_training_records(official_train, seed=SEED)
    if set(record.leaf_id for record in train_records) & set(record.leaf_id for record in validation_records):
        raise AssertionError("Training and validation share a physical-leaf group.")
    if set(record.sha256 for record in train_records) & set(record.sha256 for record in validation_records):
        raise AssertionError("Training and validation share an exact image.")

    MODEL_DIRECTORY.mkdir(parents=True, exist_ok=True)
    checkpoint_directory = MODEL_DIRECTORY / ".training"
    checkpoint_directory.mkdir(exist_ok=True)
    head_checkpoint = checkpoint_directory / "head_best.keras"
    fine_tune_checkpoint = checkpoint_directory / "fine_tune_best.keras"
    training_data = _batch_dataset(keras, train_records, DATA_DIRECTORY, training=True)
    validation_data = _batch_dataset(keras, validation_records, DATA_DIRECTORY, training=False)

    with keras.device(device):
        model = build_model(keras)
        model.compile(
            optimizer=keras.optimizers.Adam(learning_rate=1e-3),
            loss=keras.losses.SparseCategoricalCrossentropy(),
            metrics=[keras.metrics.SparseCategoricalAccuracy(name="accuracy")],
        )
        print(f"Training classifier head on {len(train_records):,} grouped images; validating on {len(validation_records):,}.", flush=True)
        head_history = model.fit(
            training_data,
            validation_data=validation_data,
            epochs=MAX_EPOCHS_PER_STAGE,
            callbacks=_callbacks(keras, head_checkpoint),
            verbose=2,
        )

        enable_fine_tuning(model, keras)
        model.compile(
            optimizer=keras.optimizers.Adam(learning_rate=1e-5),
            loss=keras.losses.SparseCategoricalCrossentropy(),
            metrics=[keras.metrics.SparseCategoricalAccuracy(name="accuracy")],
        )
        print(f"Fine-tuning the last {FINE_TUNE_LAST_LAYERS} non-BatchNorm backbone layers.", flush=True)
        fine_tune_history = model.fit(
            training_data,
            validation_data=validation_data,
            epochs=MAX_EPOCHS_PER_STAGE,
            callbacks=_callbacks(keras, fine_tune_checkpoint),
            verbose=2,
        )
        checkpoint_candidates = []
        for stage, history, checkpoint in (
            ("head", head_history, head_checkpoint),
            ("fine-tune", fine_tune_history, fine_tune_checkpoint),
        ):
            best_validation_loss = float(np.min(history.history["val_loss"]))
            if checkpoint.is_file() and np.isfinite(best_validation_loss):
                checkpoint_candidates.append((best_validation_loss, checkpoint, stage))
        if not checkpoint_candidates:
            raise RuntimeError("Training produced no finite validation checkpoint.")
        best_validation_loss, best_checkpoint, selected_checkpoint_stage = min(
            checkpoint_candidates, key=lambda candidate: candidate[0]
        )
        model = keras.models.load_model(best_checkpoint, compile=False, safe_mode=True)
        validation_labels, validation_scores = _predictions(keras, device, model, validation_records, DATA_DIRECTORY)
        test_labels, test_scores = _predictions(keras, device, model, official_test, DATA_DIRECTORY)
        model.save(MODEL_PATH)

    metadata = {
        "metadataVersion": 1,
        "architecture": "MobileNetV3-Small",
        "weightsVersion": WEIGHTS_VERSION,
        "classesCount": len(CLASS_IDS),
        "classIds": list(CLASS_IDS),
        "classMapVersion": CLASS_MAP_VERSION,
        "inputResolution": [*INPUT_SIZE, 3],
        "preprocessingVersion": PREPROCESSING_VERSION,
        "preprocessing": {
            "colorMode": "RGB",
            "exifOrientation": "transpose before pixel conversion",
            "resize": "Pillow bilinear resize to 224x224; no crop",
            "inputPixelRange": [0, 255],
            "normalization": "MobileNetV3Small include_preprocessing layer",
        },
        "trainingData": {
            "dataset": dataset_manifest["dataset"],
            "sourceRepository": dataset_manifest["sourceRepository"],
            "sourceMirror": dataset_manifest["sourceMirror"],
            "sourceRevision": dataset_manifest["sourceRevision"],
            "license": dataset_manifest["license"],
            "archiveSha256": dataset_manifest["archiveSha256"],
            "sourceSplitImageCounts": dataset_manifest["sourceSplitImageCounts"],
            "auditedSourceTrain": _split_summary(official_train),
            "training": _split_summary(train_records),
            "validation": _split_summary(validation_records),
            "auditedSourceTest": _split_summary(official_test),
            "validationSplitMethod": "5-fold StratifiedGroupKFold over official training images; physical leaf_id and exact-image hashes are grouped",
            "officialTestSplitUsed": True,
            "sourceSplitExcludedImageCount": dataset_manifest["excludedImageCount"],
            "sourceSplitExcludedOverlapGroupCount": dataset_manifest["excludedOverlapGroupCount"],
        },
        "initialWeights": {
            "source": "Keras MobileNetV3Small ImageNet weights, include_top=False",
            "sha256": _pretrained_weight_hash(keras),
        },
        "training": {
            "seed": SEED,
            "batchSize": BATCH_SIZE,
            "maximumEpochsPerStage": MAX_EPOCHS_PER_STAGE,
            "headLearningRate": 1e-3,
            "fineTuneLearningRate": 1e-5,
            "fineTuneLastLayers": FINE_TUNE_LAST_LAYERS,
            "batchNormalizationTrainingMode": "inference",
            "classWeighting": "inverse-frequency sample weights from training split",
            "headEpochsRun": len(head_history.epoch),
            "fineTuneEpochsRun": len(fine_tune_history.epoch),
            "selectionMetric": "validation loss",
            "selectedCheckpointStage": selected_checkpoint_stage,
            "selectedCheckpointValidationLoss": best_validation_loss,
        },
        "runtime": {
            "python": platform.python_version(),
            "keras": version("keras"),
            "torch": version("torch"),
            "device": device,
            "deviceName": device_name,
        },
        "validationMetrics": _metrics(validation_labels, validation_scores),
        "testMetrics": _metrics(test_labels, test_scores),
        "testMajorityClassBaseline": _majority_baseline(train_records, test_labels),
        "scoreSemantics": "Uncalibrated softmax output in [0,1]; not a correctness probability.",
        "reviewPolicy": {
            "version": REVIEW_POLICY_VERSION,
            "reviewRequiredForAllPredictions": True,
            "reason": "No validated rejection threshold is available; field-photo support has not been evaluated.",
        },
        "limitations": [
            "Single-label classification on the 17 supported PlantVillage classes.",
            "PlantVillage images have controlled backgrounds; field and phone-photo performance has not been measured.",
            "No disease severity, simultaneous-condition, treatment, or yield output is produced.",
            "Softmax scores are not calibrated probabilities; all results require manual review.",
        ],
        "artifactFile": MODEL_PATH.name,
        "artifactSha256": _file_sha256(MODEL_PATH),
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    METADATA_PATH.write_text(json.dumps(metadata, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    for checkpoint in (head_checkpoint, fine_tune_checkpoint):
        checkpoint.unlink(missing_ok=True)
    checkpoint_directory.rmdir()
    print(json.dumps({"weightsVersion": WEIGHTS_VERSION, "validationMetrics": metadata["validationMetrics"], "testMetrics": metadata["testMetrics"], "artifactSha256": metadata["artifactSha256"]}, indent=2), flush=True)
    return metadata


if __name__ == "__main__":
    train_classifier()
