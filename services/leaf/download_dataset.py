from __future__ import annotations

import hashlib
import json
import shutil
import urllib.request
import zipfile
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath
from typing import Any

from PIL import Image

from .classes import CLASS_IDS
from .dataset import DATA_DIRECTORY, DATASET_REVISION, LeafRecord, cross_split_groups, load_records, record_group_ids


DATASET_URL = "https://huggingface.co/datasets/mohanty/PlantVillage"
ARCHIVE_SIZE = 2_184_723_441
ARCHIVE_SHA256 = "fba30c6a7965e49be94b47a62f8aff6cfb1c35c27f475f22092b56db41745e84"
LICENSE = "CC BY-SA 3.0"


def _url(relative_path: str) -> str:
    return f"{DATASET_URL}/resolve/{DATASET_REVISION}/{relative_path}"


def _download_bytes(relative_path: str) -> bytes:
    request = urllib.request.Request(_url(relative_path), headers={"User-Agent": "KshetraSense/leaf-data-audit"})
    with urllib.request.urlopen(request, timeout=90) as response:
        return response.read()


def _file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(4 * 1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _download_archive(destination: Path) -> str:
    partial = destination.with_suffix(destination.suffix + ".part")
    if partial.exists() and partial.stat().st_size > ARCHIVE_SIZE:
        partial.unlink()
    existing = partial.stat().st_size if partial.exists() else 0
    headers = {"User-Agent": "KshetraSense/leaf-data-audit"}
    if existing:
        headers["Range"] = f"bytes={existing}-"
    request = urllib.request.Request(_url("data.zip"), headers=headers)
    with urllib.request.urlopen(request, timeout=90) as response:
        append = existing > 0 and response.status == 206
        if not append:
            existing = 0
        total = ARCHIVE_SIZE
        received = existing
        with partial.open("ab" if append else "wb") as output:
            while chunk := response.read(4 * 1024 * 1024):
                output.write(chunk)
                received += len(chunk)
                progress = received * 100 // total
                if progress >= _download_archive.last_progress + 5:
                    _download_archive.last_progress = progress
                    print(f"PlantVillage archive: {progress}% ({received:,}/{total:,} bytes)", flush=True)
    if partial.stat().st_size != ARCHIVE_SIZE:
        raise ValueError(f"PlantVillage archive size mismatch: got {partial.stat().st_size:,} bytes.")
    digest = _file_sha256(partial)
    if digest != ARCHIVE_SHA256:
        partial.unlink(missing_ok=True)
        raise ValueError("PlantVillage archive SHA-256 does not match the pinned upstream artifact.")
    partial.replace(destination)
    return digest


_download_archive.last_progress = -5


def _leaf_id(path: str, class_name: str, leaf_map: dict[str, list[str]]) -> str:
    image_identifier = PurePosixPath(path).name.replace("_final_masked", "")
    if "___" in image_identifier:
        image_identifier = image_identifier.split("___")[-1]
    image_identifier = image_identifier.split("copy")[0]
    for extension in (".jpg", ".JPG", ".png", ".PNG"):
        image_identifier = image_identifier.replace(extension, "")
    image_identifier = image_identifier.strip()
    suggestions = leaf_map.get(image_identifier.lower().strip(), [])
    if len(suggestions) == 1:
        identifier = suggestions[0]
    else:
        identifier = next((suggestion for suggestion in suggestions if class_name in suggestion), f"fallback_{image_identifier}")
    return identifier


def _split_paths(text: str) -> list[str]:
    result = []
    seen = set()
    for line in text.splitlines():
        path = PurePosixPath(line.strip())
        parts = path.parts
        if not line.strip() or len(parts) != 4 or parts[:2] != ("raw", "color") or parts[2] not in CLASS_IDS:
            continue
        if any(part in {".", ".."} for part in parts):
            raise ValueError("PlantVillage split contains an unsafe image path.")
        normalized = path.as_posix()
        if normalized in seen:
            raise ValueError(f"PlantVillage split repeats an image path: {normalized}")
        seen.add(normalized)
        result.append(normalized)
    return result


def _image_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _extract_audited_images(archive_path: Path, data_directory: Path) -> tuple[list[LeafRecord], str]:
    train_paths = _split_paths((data_directory / "splits" / "color_train.txt").read_text(encoding="utf-8"))
    test_paths = _split_paths((data_directory / "splits" / "color_test.txt").read_text(encoding="utf-8"))
    if set(train_paths) & set(test_paths):
        raise ValueError("PlantVillage official split files repeat image paths across train/test.")
    assignments = {path: "train" for path in train_paths} | {path: "test" for path in test_paths}
    leaf_map = json.loads((data_directory / "leaf_grouping" / "leaf-map.json").read_text(encoding="utf-8"))
    destination_root = data_directory.resolve()
    records: list[LeafRecord] = []
    archive_hash = _file_sha256(archive_path)

    with zipfile.ZipFile(archive_path) as archive:
        available = {item.filename.replace("\\", "/"): item for item in archive.infolist() if not item.is_dir()}
        missing = set(assignments) - set(available)
        if missing:
            raise ValueError(f"PlantVillage archive is missing split image {sorted(missing)[0]}.")
        for index, relative_path in enumerate(sorted(assignments)):
            parts = PurePosixPath(relative_path).parts
            destination = data_directory.joinpath(*parts)
            if not destination.resolve().is_relative_to(destination_root):
                raise ValueError("PlantVillage image path escaped the dataset directory.")
            destination.parent.mkdir(parents=True, exist_ok=True)
            with archive.open(available[relative_path]) as source, destination.open("wb") as output:
                shutil.copyfileobj(source, output, length=1024 * 1024)
            try:
                with Image.open(destination) as image:
                    image.verify()
            except Exception as error:
                raise ValueError(f"PlantVillage image failed decoding during audit: {relative_path}") from error
            class_name = parts[2]
            records.append(LeafRecord(
                path=relative_path,
                class_name=class_name,
                leaf_id=_leaf_id(relative_path, class_name, leaf_map),
                split=assignments[relative_path],
                sha256=_image_sha256(destination),
                size_bytes=destination.stat().st_size,
            ))
            if (index + 1) % 1000 == 0:
                print(f"Verified {index + 1:,}/{len(assignments):,} target images", flush=True)

    group_ids = record_group_ids(records)
    overlapping_groups = cross_split_groups(records)
    excluded_records = [
        {
            "path": record.path,
            "className": record.class_name,
            "split": record.split,
            "leafId": record.leaf_id,
            "sha256": record.sha256,
            "reason": "leaf_id or exact-image group also occurs in the other source split",
        }
        for group_id, record in zip(group_ids, records)
        if str(group_id) in overlapping_groups
    ]
    if excluded_records:
        print(
            f"Excluding {len(excluded_records)} images from {len(overlapping_groups)} cross-split leaf/image groups.",
            flush=True,
        )
        records = [
            record for group_id, record in zip(group_ids, records)
            if str(group_id) not in overlapping_groups
        ]
    if cross_split_groups(records):
        raise AssertionError("PlantVillage source split still has a cross-split leaf or exact-image group.")
    for split in ("train", "test"):
        counts = Counter(item.class_name for item in records if item.split == split)
        if set(counts) != set(CLASS_IDS):
            raise ValueError(f"The PlantVillage {split} split does not contain all 17 supported class folders.")

    duplicate_counts = Counter(item.sha256 for item in records)
    manifest: dict[str, Any] = {
        "dataset": "PlantVillage",
        "sourceRepository": "https://github.com/spMohanty/PlantVillage-Dataset",
        "sourceMirror": DATASET_URL,
        "sourceRevision": DATASET_REVISION,
        "license": LICENSE,
        "paper": "Mohanty, Hughes & Salathé (2016), DOI 10.3389/fpls.2016.01419",
        "archiveSha256": archive_hash,
        "classIds": list(CLASS_IDS),
        "downloadedAt": datetime.now(timezone.utc).isoformat(),
        "sourceSplitImageCounts": {"train": len(train_paths), "test": len(test_paths)},
        "excludedImageCount": len(excluded_records),
        "excludedOverlapGroupCount": len(overlapping_groups),
        "excludedRecords": excluded_records,
        "splitAuditPolicy": "Keep source split assignment; exclude every leaf_id/exact-image group present in both source splits.",
        "splitImageCounts": dict(Counter(item.split for item in records)),
        "leafGroupCounts": {split: len({item.leaf_id for item in records if item.split == split}) for split in ("train", "test")},
        "classCounts": {
            split: {class_name: sum(item.split == split and item.class_name == class_name for item in records) for class_name in CLASS_IDS}
            for split in ("train", "test")
        },
        "duplicateImageSha256Count": sum(count > 1 for count in duplicate_counts.values()),
        "records": [item.__dict__ for item in records],
    }
    return records, manifest


def download_dataset(data_directory: Path = DATA_DIRECTORY) -> dict[str, Any]:
    data_directory.mkdir(parents=True, exist_ok=True)
    manifest_path = data_directory / "manifest.json"
    if manifest_path.is_file():
        _, manifest = load_records(data_directory)
        print("PlantVillage dataset is already downloaded and verified.")
        return manifest

    for relative_path in ("splits/color_train.txt", "splits/color_test.txt", "leaf_grouping/leaf-map.json"):
        destination = data_directory / relative_path
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(_download_bytes(relative_path))
    archive_path = data_directory / "plantvillage-data.zip"
    if archive_path.is_file():
        if archive_path.stat().st_size != ARCHIVE_SIZE or _file_sha256(archive_path) != ARCHIVE_SHA256:
            archive_path.unlink()
            _download_archive(archive_path)
    else:
        _download_archive(archive_path)
    _, manifest = _extract_audited_images(archive_path, data_directory)
    manifest_path.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    archive_path.unlink(missing_ok=True)
    return manifest


if __name__ == "__main__":
    result = download_dataset()
    print(json.dumps({
        "dataset": result["dataset"],
        "sourceRevision": result["sourceRevision"],
        "splitImageCounts": result["splitImageCounts"],
        "leafGroupCounts": result["leafGroupCounts"],
        "duplicateImageSha256Count": result["duplicateImageSha256Count"],
        "archiveSha256": result["archiveSha256"],
    }, indent=2))
