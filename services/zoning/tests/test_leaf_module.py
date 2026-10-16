from __future__ import annotations

import binascii
import io
import struct
from contextlib import contextmanager

import numpy as np
import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app.main import app
from services.leaf import inference
from services.leaf.classes import CLASS_IDS, CLASS_MAP, CLASS_MAP_VERSION, REVIEW_POLICY_VERSION
from services.leaf.dataset import LeafRecord, cross_split_groups, expected_calibration_error, record_group_ids, split_training_records
from services.leaf.download_dataset import _leaf_id, _split_paths
from services.leaf.inference import ModelBundle, ModelUnavailable
from services.leaf.preprocessing import ImageValidationError, preprocess_image_bytes
from services.leaf.train import _majority_baseline, _metrics
import services.leaf.router as leaf_router_module


client = TestClient(app)


def _image_bytes(image_format: str = "PNG", size: tuple[int, int] = (40, 32)) -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", size, color=(30, 150, 60)).save(buffer, format=image_format)
    return buffer.getvalue()


def _fake_bundle(scores: np.ndarray) -> tuple[ModelBundle, object]:
    class FakeModel:
        def predict(self, batch: np.ndarray, verbose: int = 0) -> np.ndarray:
            assert batch.shape == (1, 224, 224, 3)
            assert batch.dtype == np.float32
            return scores[np.newaxis, :]

    class FakeKeras:
        @staticmethod
        @contextmanager
        def device(_name: str):
            yield

    metadata = {
        "architecture": "MobileNetV3-Small",
        "weightsVersion": "test-model-v1",
        "classMapVersion": CLASS_MAP_VERSION,
        "preprocessingVersion": "rgb-exif-transpose-bilinear-224-pixel-0-255-v1",
    }
    bundle = ModelBundle(model=FakeModel(), metadata=metadata)
    return bundle, FakeKeras()


def test_class_map_is_the_frozen_seventeen_label_set_and_health_is_mapped():
    assert len(CLASS_IDS) == 17
    assert len(set(CLASS_IDS)) == 17
    assert sum(item.is_healthy for item in CLASS_MAP) == 3
    assert CLASS_MAP[0].class_name == "Apple___Apple_scab"
    assert CLASS_MAP[-1].class_name == "Tomato___healthy"


def test_preprocessing_matches_the_versioned_rgb_224_contract():
    pixels = preprocess_image_bytes(_image_bytes(), "image/png")
    assert pixels.shape == (224, 224, 3)
    assert pixels.dtype == np.float32
    assert float(pixels.min()) >= 0.0 and float(pixels.max()) <= 255.0


def test_preprocessing_rejects_mismatched_and_malformed_images():
    with pytest.raises(ImageValidationError) as mismatch:
        preprocess_image_bytes(_image_bytes("PNG"), "image/jpeg")
    assert mismatch.value.status_code == 415
    with pytest.raises(ImageValidationError) as malformed:
        preprocess_image_bytes(b"not an image", "image/png")
    assert malformed.value.status_code == 422


def test_preprocessing_rejects_excessive_decoded_dimensions_before_loading_pixels():
    header = struct.pack(">IIBBBBB", 5001, 5000, 8, 2, 0, 0, 0)
    ihdr = b"\x00\x00\x00\x0dIHDR" + header + struct.pack(">I", binascii.crc32(b"IHDR" + header) & 0xFFFFFFFF)
    png = b"\x89PNG\r\n\x1a\n" + ihdr + b"\x00\x00\x00\x00IEND\xaeB`\x82"
    with pytest.raises(ImageValidationError) as error:
        preprocess_image_bytes(png, "image/png")
    assert error.value.status_code == 422
    assert "dimensions" in str(error.value)


def test_prediction_returns_all_sorted_classes_with_mapped_semantics(monkeypatch: pytest.MonkeyPatch):
    scores = np.arange(1, len(CLASS_IDS) + 1, dtype=np.float64)
    scores /= scores.sum()
    bundle, fake_keras = _fake_bundle(scores)
    monkeypatch.setattr(inference, "_keras", lambda: fake_keras)
    monkeypatch.setattr(inference, "load_verified_model", lambda: bundle)

    response = client.post("/v1/leaf/predict", files={"file": ("leaf.png", _image_bytes(), "image/png")})

    assert response.status_code == 200, response.text
    result = response.json()
    assert result["topClass"] == CLASS_IDS[-1]
    assert result["crop"] == "Tomato"
    assert result["condition"] == "Healthy"
    assert result["isHealthy"] is True
    assert result["reviewRequired"] is True
    assert [item["className"] for item in result["rankedClasses"]] == list(reversed(CLASS_IDS))
    assert all(0.0 <= item["score"] <= 1.0 for item in result["rankedClasses"])
    assert result["modelMetadata"]["classesCount"] == 17
    assert result["modelMetadata"]["reviewPolicyVersion"] == REVIEW_POLICY_VERSION
    assert result["modelMetadata"]["inferenceLatencyMs"] >= 0


def test_prediction_rejects_non_multipart_unsupported_mime_and_bad_bytes(monkeypatch: pytest.MonkeyPatch):
    assert client.post("/v1/leaf/predict", json={"file": "not accepted"}).status_code == 415
    assert client.post("/v1/leaf/predict", files={"file": ("leaf.bin", b"data", "application/octet-stream")}).status_code == 415
    response = client.post("/v1/leaf/predict", files={"file": ("leaf.png", b"broken", "image/png")})
    assert response.status_code == 422


def test_prediction_rejects_context_fields_and_multiple_files():
    image = _image_bytes()
    with_context = client.post("/v1/leaf/predict", data={"zoneId": "zone-1"}, files={"file": ("leaf.png", image, "image/png")})
    multiple = client.post("/v1/leaf/predict", files=[("file", ("one.png", image, "image/png")), ("file", ("two.png", image, "image/png"))])
    assert with_context.status_code == 422
    assert multiple.status_code == 422


def test_prediction_enforces_ten_mib_upload_limit():
    response = client.post(
        "/v1/leaf/predict",
        files={"file": ("oversized.png", b"x" * (10 * 1024 * 1024 + 1), "image/png")},
    )
    assert response.status_code == 413


def test_prediction_returns_503_if_verified_weights_are_unavailable(monkeypatch: pytest.MonkeyPatch):
    def unavailable(_image: np.ndarray) -> tuple[np.ndarray, dict]:
        raise ModelUnavailable("missing or invalid")

    monkeypatch.setattr(leaf_router_module, "predict_probabilities", unavailable)
    response = client.post("/v1/leaf/predict", files={"file": ("leaf.png", _image_bytes(), "image/png")})
    assert response.status_code == 503
    assert response.json()["detail"] == "Verified leaf model weights are unavailable."


def test_dataset_leaf_id_resolves_upstream_group_and_filters_exact_split_paths():
    leaf_id = _leaf_id("raw/color/Tomato___Early_blight/ABC___sample.jpg", "Tomato___Early_blight", {"sample": ["Tomato___Early_blight:::12"]})
    assert leaf_id == "Tomato___Early_blight:::12"
    paths = _split_paths("raw/color/Apple___healthy/one.jpg\nraw/color/Other___healthy/two.jpg\n")
    assert paths == ["raw/color/Apple___healthy/one.jpg"]


def test_source_split_audit_links_leaf_ids_and_exact_duplicate_images():
    records = [
        LeafRecord("train-leaf", CLASS_IDS[0], "same-leaf", "train", "train-hash", 1),
        LeafRecord("test-leaf", CLASS_IDS[0], "same-leaf", "test", "test-hash", 1),
        LeafRecord("train-copy", CLASS_IDS[1], "train-copy", "train", "duplicate-hash", 1),
        LeafRecord("test-copy", CLASS_IDS[1], "test-copy", "test", "duplicate-hash", 1),
        LeafRecord("safe-train", CLASS_IDS[2], "safe-train", "train", "safe-hash", 1),
    ]
    groups = record_group_ids(records)
    assert len(cross_split_groups(records)) == 2
    assert groups[0] == groups[1]
    assert groups[2] == groups[3]
    assert groups[4] not in cross_split_groups(records)


def test_validation_split_keeps_leaf_groups_and_exact_duplicates_together():
    records = []
    for class_index, class_name in enumerate(CLASS_IDS):
        for group_index in range(5):
            group_id = f"{class_name}:leaf-{group_index}"
            for copy_index in range(2):
                digest_group = "same-image" if class_index == 0 and group_index < 2 else f"{class_index}-{group_index}-{copy_index}"
                records.append(LeafRecord(
                    path=f"raw/color/{class_name}/{group_index}-{copy_index}.jpg",
                    class_name=class_name,
                    leaf_id=group_id,
                    split="train",
                    sha256=digest_group,
                    size_bytes=1,
                ))
    train, validation = split_training_records(records)
    assert {record.class_name for record in train} == set(CLASS_IDS)
    assert {record.class_name for record in validation} == set(CLASS_IDS)
    assert {record.leaf_id for record in train}.isdisjoint({record.leaf_id for record in validation})
    assert {record.sha256 for record in train}.isdisjoint({record.sha256 for record in validation})


def test_expected_calibration_error_checks_inputs_and_measures_raw_scores():
    labels = np.array([0, 1])
    calibrated = np.array([[1.0, 0.0], [0.0, 1.0]])
    overconfident_wrong = np.array([[0.1, 0.9], [0.9, 0.1]])
    assert expected_calibration_error(labels, calibrated, bins=5) == 0.0
    assert expected_calibration_error(labels, overconfident_wrong, bins=5) == pytest.approx(0.9)
    with pytest.raises(ValueError):
        expected_calibration_error(labels, np.array([[np.nan, 0.0], [0.1, 0.9]]))


def test_majority_baseline_uses_training_labels_only():
    records = [
        LeafRecord("a.jpg", CLASS_IDS[0], "a", "train", "a", 1),
        LeafRecord("b.jpg", CLASS_IDS[0], "b", "train", "b", 1),
        LeafRecord("c.jpg", CLASS_IDS[1], "c", "train", "c", 1),
    ]
    result = _majority_baseline(records, np.array([0, 1]))
    assert result["className"] == CLASS_IDS[0]
    assert result["accuracy"] == 0.5


def test_negative_log_likelihood_uses_raw_softmax_scores_without_renormalizing():
    scores = np.zeros((2, len(CLASS_IDS)), dtype=np.float64)
    scores[0, :2] = [0.8, 0.2000001]
    scores[1, :2] = [0.1000001, 0.9]

    result = _metrics(np.array([0, 1]), scores)

    assert result["negativeLogLikelihood"] == pytest.approx(-np.log([0.8, 0.9]).mean())
