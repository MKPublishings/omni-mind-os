from __future__ import annotations

import importlib
import io
from dataclasses import dataclass
from typing import Any


class MediaPolicyError(PermissionError):
    pass


@dataclass(slots=True)
class DefaultMediaHooks:
    max_output_bytes: int = 64 * 1024 * 1024

    def validate_output(
        self,
        media_type: str,
        data: bytes,
        metadata: dict[str, Any],
        safety_level: str,
    ) -> None:
        if not data:
            raise MediaPolicyError(f"{media_type} output is empty")

        if len(data) > self.max_output_bytes:
            raise MediaPolicyError(
                f"{media_type} output exceeds max bytes ({self.max_output_bytes})"
            )

        strict = str(safety_level or "default").lower() in {"strict", "high"}
        if strict and media_type == "video" and len(data) > 32 * 1024 * 1024:
            raise MediaPolicyError("video output blocked by strict safety size policy")

    def apply_watermark(
        self,
        media_type: str,
        data: bytes,
        metadata: dict[str, Any],
        enabled: bool,
    ) -> tuple[bytes, dict[str, Any]]:
        if not enabled:
            metadata["watermark_applied"] = False
            return data, metadata

        if media_type in {"image", "gif"}:
            watermarked = self._overlay_text_watermark(data)
            if watermarked is not None:
                metadata["watermark_applied"] = True
                metadata["watermark_mode"] = "visible"
                return watermarked, metadata

        metadata["watermark_applied"] = True
        metadata["watermark_mode"] = "logical"
        return data, metadata

    def _overlay_text_watermark(self, data: bytes) -> bytes | None:
        try:
            image_module = importlib.import_module("PIL.Image")
            draw_module = importlib.import_module("PIL.ImageDraw")
        except Exception:
            return None

        try:
            image = image_module.open(io.BytesIO(data)).convert("RGBA")
            drawer = draw_module.Draw(image)
            text = "Omni Ai"
            width, height = image.size
            x = max(8, width - 88)
            y = max(8, height - 20)
            drawer.rectangle((x - 4, y - 2, x + 72, y + 14), fill=(0, 0, 0, 96))
            drawer.text((x, y), text, fill=(255, 255, 255, 220))

            output = io.BytesIO()
            image.save(output, format="PNG")
            return output.getvalue()
        except Exception:
            return None
