from __future__ import annotations

from typing import Any

from .preprocessing import MAX_UPLOAD_BYTES


MAX_MULTIPART_OVERHEAD_BYTES = 64 * 1024
MAX_REQUEST_BODY_BYTES = MAX_UPLOAD_BYTES + MAX_MULTIPART_OVERHEAD_BYTES


class _UploadTooLarge(Exception):
    pass


class LeafUploadLimitMiddleware:
    def __init__(self, app: Any):
        self.app = app

    async def __call__(self, scope: dict[str, Any], receive: Any, send: Any) -> None:
        if scope.get("type") != "http" or scope.get("path") != "/v1/leaf/predict" or scope.get("method") != "POST":
            await self.app(scope, receive, send)
            return

        content_length = next((value for name, value in scope.get("headers", []) if name.lower() == b"content-length"), None)
        if content_length is not None:
            try:
                if int(content_length) > MAX_REQUEST_BODY_BYTES:
                    await self._send_too_large(send)
                    return
            except ValueError:
                pass

        received_bytes = 0

        async def limited_receive() -> dict[str, Any]:
            nonlocal received_bytes
            message = await receive()
            if message.get("type") == "http.request":
                received_bytes += len(message.get("body", b""))
                if received_bytes > MAX_REQUEST_BODY_BYTES:
                    raise _UploadTooLarge
            return message

        try:
            await self.app(scope, limited_receive, send)
        except _UploadTooLarge:
            await self._send_too_large(send)

    @staticmethod
    async def _send_too_large(send: Any) -> None:
        body = b'{"detail":"The image upload exceeds the 10 MiB limit."}'
        await send({
            "type": "http.response.start",
            "status": 413,
            "headers": [(b"content-type", b"application/json"), (b"content-length", str(len(body)).encode("ascii"))],
        })
        await send({"type": "http.response.body", "body": body})
