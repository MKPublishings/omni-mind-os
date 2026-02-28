from __future__ import annotations

import hashlib
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def _clamp_int(value: Any, default: int, minimum: int, maximum: int) -> int:
    try:
        parsed = int(float(value))
    except Exception:
        return default
    return max(minimum, min(maximum, parsed))


def _palette_from_prompt(prompt: str) -> tuple[tuple[int, int, int], tuple[int, int, int], tuple[int, int, int]]:
    digest = hashlib.sha256(prompt.encode("utf-8", errors="ignore")).digest()
    c1 = (40 + digest[0] % 160, 40 + digest[1] % 160, 40 + digest[2] % 160)
    c2 = (40 + digest[3] % 160, 40 + digest[4] % 160, 40 + digest[5] % 160)
    c3 = (40 + digest[6] % 160, 40 + digest[7] % 160, 40 + digest[8] % 160)
    return c1, c2, c3


def _create_frame(prompt: str, width: int, height: int, frame_index: int, num_frames: int):
    try:
        import numpy as np
        from PIL import Image, ImageDraw
    except Exception as exc:
        raise RuntimeError("Pillow and numpy are required for provider video generation") from exc

    c1, c2, c3 = _palette_from_prompt(prompt)
    t = frame_index / max(1, num_frames - 1)

    grad = np.linspace(0.0, 1.0, height, dtype=np.float32).reshape(height, 1)
    col_r = (c1[0] * (1.0 - grad) + c2[0] * grad).astype(np.uint8)
    col_g = (c1[1] * (1.0 - grad) + c2[1] * grad).astype(np.uint8)
    col_b = (c1[2] * (1.0 - grad) + c2[2] * grad).astype(np.uint8)

    frame = np.empty((height, width, 3), dtype=np.uint8)
    frame[:, :, 0] = col_r
    frame[:, :, 1] = col_g
    frame[:, :, 2] = col_b

    image = Image.fromarray(frame, mode="RGB")
    draw = ImageDraw.Draw(image)

    pulse = 0.5 + 0.5 * (1 if (frame_index % 10) < 5 else -1)
    radius = int((min(width, height) * 0.08) + pulse * min(width, height) * 0.04)
    center_x = int((0.15 + 0.7 * t) * width)
    center_y = int((0.25 + 0.5 * (1 - t)) * height)
    draw.ellipse(
        [center_x - radius, center_y - radius, center_x + radius, center_y + radius],
        fill=(c3[0], c3[1], c3[2]),
    )

    label = prompt.strip()[:120] or "omni video"
    draw.rectangle([16, height - 80, width - 16, height - 20], fill=(0, 0, 0, 140))
    draw.text((24, height - 64), label, fill=(255, 255, 255))

    return np.array(image)


def generate_prompt_video_export(prompt: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
    try:
        import imageio.v2 as imageio
    except Exception as exc:
        raise RuntimeError("imageio is required for provider video generation") from exc

    params = dict(params or {})
    width = _clamp_int(params.get("width"), 768, 256, 640)
    height = _clamp_int(params.get("height"), 432, 256, 360)
    num_frames = _clamp_int(params.get("num_frames"), 24, 12, 20)
    fps = _clamp_int(params.get("fps"), 12, 8, 30)

    export_dir = Path("omni_video_exports")
    export_dir.mkdir(parents=True, exist_ok=True)

    slug = datetime.now(timezone.utc).strftime("%Y-%m-%d_%H-%M-%S")
    filename = f"omni_video_{slug}_{uuid.uuid4().hex[:8]}.mp4"
    output_path = export_dir / filename

    frames = [_create_frame(prompt, width, height, i, num_frames) for i in range(num_frames)]
    imageio.mimsave(output_path.as_posix(), frames, fps=fps)

    host = str(os.getenv("OMNI_MEDIA_HOST", "127.0.0.1")).strip() or "127.0.0.1"
    port = str(os.getenv("OMNI_MEDIA_PORT", "8788")).strip() or "8788"
    public_url = f"http://{host}:{port}/omni_video_exports/{filename}"

    return {
        "status": "success",
        "video_url": public_url,
        "frames": num_frames,
        "resolution": f"{width}x{height}",
        "fps": fps,
        "provider": "omni-local-prompt-video",
        "prompt_aware": True,
    }
