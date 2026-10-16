from __future__ import annotations

import hashlib
import json
import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any

import numpy as np

from .classes import CLASS_IDS, CLASS_MAP_VERSION
from .preprocessing import INPUT_SIZE, PREPROCESSING_VERSION


MODEL_DIRECTORY = Path(__file__).resolve().parent / "models"
MODEL_PATH = MODEL_DIRECTORY / "leaf_mobilenetv3_small.keras"
METADATA_PATH = MODEL_DIRECTORY / "metadata.json"


class ModelUnavailable(RuntimeError):
    pass


@dataclass(frozen=True)
class ModelBundle:
    model: Any
    metadata: dict[str, Any]


def _keras() -> Any:
    os.environ.setdefault("KERAS_BACKEND", "torch")
    try:
        import keras
    except Exception as error:
        raise ModelUnavailable("The configured Keras runtime is unavailable.") from error
    if keras.backend.backend() != "torch":
        raise ModelUnavailable("The leaf model requires the configured Keras PyTorch backend.")
    return keras


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


@lru_cache(maxsize=1)
def load_verified_model() -> ModelBundle:
    if not MODEL_PATH.is_file() or not METADATA_PATH.is_file():
        raise ModelUnavailable("Verified leaf model weights are unavailable.")
    try:
        metadata = json.loads(METADATA_PATH.read_text(encoding="utf-8"))
        if (
            metadata.get("architecture") != "MobileNetV3-Small"
            or metadata.get("classesCount") != len(CLASS_IDS)
            or metadata.get("classIds") != list(CLASS_IDS)
            or metadata.get("classMapVersion") != CLASS_MAP_VERSION
            or metadata.get("preprocessingVersion") != PREPROCESSING_VERSION
            or metadata.get("artifactSha256") != _sha256(MODEL_PATH)
        ):
            raise ModelUnavailable("Leaf model metadata or artifact verification failed.")
        keras = _keras()
        model = keras.models.load_model(MODEL_PATH, compile=False, safe_mode=True)
        if tuple(model.input_shape[1:]) != (*INPUT_SIZE, 3) or model.output_shape[-1] != len(CLASS_IDS):
            raise ModelUnavailable("The verified leaf model has an incompatible input or class shape.")
        return ModelBundle(model=model, metadata=metadata)
    except ModelUnavailable:
        raise
    except Exception as error:
        raise ModelUnavailable("Verified leaf model weights are unavailable.") from error


def predict_probabilities(image: np.ndarray) -> tuple[np.ndarray, dict[str, Any]]:
    bundle = load_verified_model()
    keras = _keras()
    try:
        import torch

        device = "gpu:0" if torch.cuda.is_available() else "cpu:0"
        with keras.device(device):
            scores = np.asarray(bundle.model.predict(image[np.newaxis, ...], verbose=0)[0], dtype=np.float64)
    except Exception as error:
        raise ModelUnavailable("Leaf model inference could not be completed.") from error
    if (
        scores.shape != (len(CLASS_IDS),)
        or not np.isfinite(scores).all()
        or np.any(scores < 0.0)
        or np.any(scores > 1.0)
        or not np.isclose(scores.sum(), 1.0, rtol=0.0, atol=1e-3)
    ):
        raise ModelUnavailable("Leaf model produced invalid class scores.")
    return scores, bundle.metadata
