from __future__ import annotations

from time import perf_counter
from typing import Any

import numpy as np
from fastapi import APIRouter, HTTPException, Request
from starlette.datastructures import UploadFile
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.formparsers import MultiPartException

from .classes import CLASS_BY_ID, CLASS_IDS, LIMITATIONS, REVIEW_POLICY_VERSION
from .inference import ModelUnavailable, predict_probabilities
from .preprocessing import MAX_UPLOAD_BYTES, ImageValidationError, preprocess_image_bytes


router = APIRouter(prefix="/v1/leaf", tags=["leaf diagnosis"])


@router.post("/predict")
async def predict(request: Request) -> dict[str, Any]:
    if request.headers.get("content-type", "").split(";", 1)[0].strip().lower() != "multipart/form-data":
        raise HTTPException(status_code=415, detail="Upload one JPEG or PNG image as multipart form data.")
    try:
        form = await request.form(max_files=1, max_fields=0)
    except (MultiPartException, ValueError) as error:
        raise HTTPException(status_code=422, detail="The multipart image upload is malformed.") from error
    except StarletteHTTPException as error:
        raise HTTPException(status_code=422, detail="Provide exactly one image file in the 'file' field.") from error

    try:
        entries = form.multi_items()
        if len(entries) != 1 or entries[0][0] != "file" or not isinstance(entries[0][1], UploadFile):
            raise HTTPException(status_code=422, detail="Provide exactly one image file in the 'file' field.")
        upload = entries[0][1]
        if upload.content_type not in {"image/jpeg", "image/png"}:
            raise HTTPException(status_code=415, detail="Upload a JPEG or PNG image.")
        image_bytes = await upload.read(MAX_UPLOAD_BYTES + 1)
        if len(image_bytes) > MAX_UPLOAD_BYTES:
            raise HTTPException(status_code=413, detail="The image upload exceeds the 10 MiB limit.")

        started_at = perf_counter()
        try:
            image = preprocess_image_bytes(image_bytes, upload.content_type)
        except ImageValidationError as error:
            raise HTTPException(status_code=error.status_code, detail=str(error)) from error
        try:
            scores, metadata = predict_probabilities(image)
        except ModelUnavailable as error:
            raise HTTPException(status_code=503, detail="Verified leaf model weights are unavailable.") from error

        ranked = np.argsort(-scores, kind="stable")
        top = CLASS_BY_ID[CLASS_IDS[int(ranked[0])]]
        latency_ms = round((perf_counter() - started_at) * 1000.0, 2)
        return {
            "topClass": top.class_name,
            "reviewRequired": True,
            "crop": top.crop,
            "condition": top.condition,
            "isHealthy": top.is_healthy,
            "rankedClasses": [
                {"className": CLASS_IDS[int(index)], "score": float(scores[index])}
                for index in ranked
            ],
            "modelMetadata": {
                "architecture": metadata["architecture"],
                "weightsVersion": metadata["weightsVersion"],
                "classesCount": len(CLASS_IDS),
                "inputResolution": [224, 224, 3],
                "preprocessingVersion": metadata["preprocessingVersion"],
                "classMapVersion": metadata["classMapVersion"],
                "reviewPolicyVersion": REVIEW_POLICY_VERSION,
                "inferenceLatencyMs": latency_ms,
            },
            "limitations": LIMITATIONS,
        }
    finally:
        await form.close()
