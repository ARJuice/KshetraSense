from __future__ import annotations

import io
import warnings
from pathlib import Path

import numpy as np
from PIL import Image, ImageOps, UnidentifiedImageError


INPUT_SIZE = (224, 224)
PREPROCESSING_VERSION = "rgb-exif-transpose-bilinear-224-pixel-0-255-v1"
MAX_UPLOAD_BYTES = 10 * 1024 * 1024
MAX_IMAGE_DIMENSION = 8192
MAX_IMAGE_PIXELS = 25_000_000
MEDIA_FORMATS = {"image/jpeg": "JPEG", "image/png": "PNG"}


class ImageValidationError(ValueError):
    def __init__(self, status_code: int, message: str):
        super().__init__(message)
        self.status_code = status_code


def preprocess_image_bytes(image_bytes: bytes, media_type: str | None = None) -> np.ndarray:
    if not image_bytes:
        raise ImageValidationError(422, "The uploaded image is empty or malformed.")
    expected_format = None
    if media_type is not None:
        expected_format = MEDIA_FORMATS.get(media_type.lower())
        if expected_format is None:
            raise ImageValidationError(415, "Upload a JPEG or PNG image.")

    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(image_bytes)) as source:
                actual_format = (source.format or "").upper()
                if actual_format not in {"JPEG", "PNG"} or (expected_format and actual_format != expected_format):
                    raise ImageValidationError(415, "The image content must match its JPEG or PNG media type.")
                width, height = source.size
                if width > MAX_IMAGE_DIMENSION or height > MAX_IMAGE_DIMENSION or width * height > MAX_IMAGE_PIXELS:
                    raise ImageValidationError(422, "Image dimensions exceed the supported decoding limit.")
                source.load()
                rgb = ImageOps.exif_transpose(source).convert("RGB")
                resized = rgb.resize(INPUT_SIZE, resample=Image.Resampling.BILINEAR)
                pixels = np.asarray(resized, dtype=np.float32)
    except ImageValidationError:
        raise
    except (UnidentifiedImageError, OSError, SyntaxError, ValueError, Image.DecompressionBombError, Image.DecompressionBombWarning) as error:
        raise ImageValidationError(422, "The uploaded file is not a decodable JPEG or PNG image.") from error

    if pixels.shape != (224, 224, 3) or not np.isfinite(pixels).all():
        raise ImageValidationError(422, "The uploaded image could not be prepared for classification.")
    return pixels


def preprocess_image_path(path: str | Path) -> np.ndarray:
    return preprocess_image_bytes(Path(path).read_bytes())
