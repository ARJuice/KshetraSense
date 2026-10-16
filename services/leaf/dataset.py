from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np
from sklearn.model_selection import StratifiedGroupKFold

from .classes import CLASS_IDS


DATA_DIRECTORY = Path(__file__).resolve().parent / "data" / "plantvillage"
DATASET_REVISION = "9e97599868962bd0079b8db4b7f1efa9185fa1e7"


@dataclass(frozen=True)
class LeafRecord:
    path: str
    class_name: str
    leaf_id: str
    split: str
    sha256: str
    size_bytes: int

    def file_path(self, data_directory: Path = DATA_DIRECTORY) -> Path:
        return data_directory.joinpath(*Path(self.path).parts)


def _file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_records(data_directory: Path = DATA_DIRECTORY, verify_hashes: bool = True) -> tuple[list[LeafRecord], dict[str, Any]]:
    manifest_path = data_directory / "manifest.json"
    if not manifest_path.is_file():
        raise FileNotFoundError("PlantVillage data is not prepared; run services.leaf.download_dataset first.")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if manifest.get("sourceRevision") != DATASET_REVISION or manifest.get("classIds") != list(CLASS_IDS):
        raise ValueError("PlantVillage manifest revision or class map does not match this training code.")
    records = [LeafRecord(**item) for item in manifest["records"]]
    missing = [item.path for item in records if not item.file_path(data_directory).is_file()]
    if missing:
        raise FileNotFoundError(f"PlantVillage manifest references missing images: {missing[0]}")
    if verify_hashes:
        for record in records:
            if _file_sha256(record.file_path(data_directory)) != record.sha256:
                raise ValueError(f"PlantVillage image changed after audit: {record.path}")

    if cross_split_groups(records):
        raise ValueError("PlantVillage official train/test files are not disjoint by leaf or exact image.")
    for split in ("train", "test"):
        if {record.class_name for record in records if record.split == split} != set(CLASS_IDS):
            raise ValueError(f"PlantVillage {split} split does not contain all 17 supported classes.")
    return records, manifest


def record_group_ids(records: list[LeafRecord]) -> np.ndarray:
    parents: dict[str, str] = {}

    def find(value: str) -> str:
        parents.setdefault(value, value)
        if parents[value] != value:
            parents[value] = find(parents[value])
        return parents[value]

    def union(left: str, right: str) -> None:
        left_root, right_root = find(left), find(right)
        if left_root != right_root:
            parents[right_root] = left_root

    for record in records:
        leaf_group = f"leaf:{record.leaf_id}"
        image_group = f"image:{record.sha256}"
        union(leaf_group, image_group)
    return np.asarray([find(f"leaf:{record.leaf_id}") for record in records], dtype=object)


def cross_split_groups(records: list[LeafRecord]) -> set[str]:
    group_splits: dict[str, set[str]] = {}
    for group_id, record in zip(record_group_ids(records), records):
        group_splits.setdefault(str(group_id), set()).add(record.split)
    return {group_id for group_id, splits in group_splits.items() if len(splits) > 1}


def split_training_records(records: list[LeafRecord], seed: int = 42) -> tuple[list[LeafRecord], list[LeafRecord]]:
    if any(record.split != "train" for record in records):
        raise ValueError("Validation must be selected from PlantVillage's official training split only.")
    labels = np.asarray([CLASS_IDS.index(record.class_name) for record in records], dtype=np.int64)
    groups = record_group_ids(records)
    all_classes = set(range(len(CLASS_IDS)))
    group_counts = [len(set(groups[labels == class_index])) for class_index in all_classes]
    folds = min(5, min(group_counts))
    if folds < 2:
        raise ValueError("Each supported class needs at least two distinct leaf groups for validation.")
    splitter = StratifiedGroupKFold(n_splits=folds, shuffle=True, random_state=seed)
    selected: tuple[np.ndarray, np.ndarray] | None = None
    for train_indices, validation_indices in splitter.split(np.zeros((len(records), 1)), labels, groups):
        if set(labels[train_indices]) == all_classes and set(labels[validation_indices]) == all_classes:
            selected = train_indices, validation_indices
            break
    if selected is None:
        raise ValueError("Could not form a group-disjoint validation split containing all 17 classes.")
    train_indices, validation_indices = selected
    train, validation = [records[int(index)] for index in train_indices], [records[int(index)] for index in validation_indices]
    if set(record_group_ids(train)) & set(record_group_ids(validation)):
        raise AssertionError("Physical-leaf or exact-image groups crossed the validation split.")
    return train, validation


def expected_calibration_error(labels: np.ndarray, scores: np.ndarray, bins: int = 15) -> float:
    labels = np.asarray(labels, dtype=np.int64)
    scores = np.asarray(scores, dtype=np.float64)
    if scores.ndim != 2 or labels.shape != (scores.shape[0],) or bins < 1:
        raise ValueError("Calibration inputs must be matching labels and a two-dimensional score matrix.")
    if not np.isfinite(scores).all() or np.any(scores < 0.0) or np.any(scores > 1.0):
        raise ValueError("Calibration scores must be finite values in [0, 1].")
    confidence = scores.max(axis=1)
    correct = (scores.argmax(axis=1) == labels).astype(np.float64)
    edges = np.linspace(0.0, 1.0, bins + 1)
    error = 0.0
    for index in range(bins):
        mask = (confidence >= edges[index]) & (confidence <= edges[index + 1] if index == bins - 1 else confidence < edges[index + 1])
        if mask.any():
            error += mask.mean() * abs(correct[mask].mean() - confidence[mask].mean())
    return float(error)
