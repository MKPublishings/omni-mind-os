import imageio
import uuid
import os
from typing import List

EXPORT_DIR = "omni_video_exports"

def save_video(frames: List, fps: int = 12) -> str:
    os.makedirs(EXPORT_DIR, exist_ok=True)
    filename = f"{uuid.uuid4()}.mp4"
    path = os.path.join(EXPORT_DIR, filename)
    imageio.mimsave(path, frames, fps=fps)
    return f"/{path}"
