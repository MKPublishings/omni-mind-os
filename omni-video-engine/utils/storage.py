import os
import uuid
from pathlib import Path
from typing import List, Any

import imageio.v2 as imageio

EXPORT_DIR = "omni_video_exports"

def _normalize_frame(frame: Any):
    """
    Accept either PIL.Image, numpy array, or raw bytes already suitable for imageio.
    """
    try:
        from PIL import Image
        import numpy as np
    except Exception as exc:  # pragma: no cover
        raise RuntimeError("Pillow and numpy are required for video encoding") from exc

    if hasattr(frame, "convert"):  # PIL.Image
        return frame.convert("RGB")
    if isinstance(frame, bytes):
        # Let imageio handle bytes directly if supported
        return frame
    if isinstance(frame, np.ndarray):
        return frame

    raise TypeError(f"Unsupported frame type for video encoding: {type(frame)!r}")

def save_video(frames: List[Any], fps: int = 12) -> str:
    """
    Encode a sequence of frames into an MP4 file and return the relative URL path.
    """
    if not frames:
        raise ValueError("Cannot save video: no frames provided")

    Path(EXPORT_DIR).mkdir(parents=True, exist_ok=True)
    filename = f"omni_video_{uuid.uuid4().hex}.mp4"
    output_path = Path(EXPORT_DIR) / filename

    normalized_frames = [_normalize_frame(f) for f in frames]
    imageio.mimsave(output_path, normalized_frames, fps=fps)

    # This path is served by StaticFiles("/omni_video_exports") in omni_media.http_fastapi
    return f"/omni_video_exports/{filename}"
