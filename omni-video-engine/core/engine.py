from __future__ import annotations
from dataclasses import dataclass
from typing import Any, List

try:
    from omni import Omni
except ImportError:
    class Omni:
        def __init__(self, model=None):
            self.model = model or "stub-model"
        def generate(self, *args, **kwargs):
            # Return a fake video result for development
            return [{"frames": [b"fake_frame_data" for _ in range(kwargs.get("num_frames", 8))]}]

@dataclass
class VideoResult:
    frames: List[Any]
    metadata: dict

# NOTE:
# This MUST be a real video-capable model. The previous Qwen/Qwen2-VL-7B-Instruct
# stub cannot produce video frames and will always break the pipeline.
# Replace "omni/video-default" with your actual deployed video model id.
omni_video_model = Omni(model="omni/video-default")

def build_enriched_prompt(base_prompt: str, tempo: float, sharpness: float, warmth: float) -> str:
    control = (
        f"cinematic, temporal rhythm {tempo:.2f}, image sharpness {sharpness:.2f}, "
        f"color warmth {warmth:.2f}"
    )
    return f"{base_prompt}, {control}"

def _extract_frames_from_output(outputs: Any) -> List[Any]:
    """
    Normalize various possible output structures into a list of frames.
    Frames are expected to be PIL Images or numpy arrays compatible with imageio.
    """
    if not outputs:
        raise RuntimeError("Video model returned no outputs")
    first = outputs[0]
    if hasattr(first, "video_frames"):
        frames = first.video_frames
    elif hasattr(first, "frames"):
        frames = first.frames
    elif isinstance(first, dict) and "video_frames" in first:
        frames = first["video_frames"]
    elif isinstance(first, dict) and "frames" in first:
        frames = first["frames"]
    else:
        raise RuntimeError("Unknown video output structure from Omni model")
    if not frames:
        raise RuntimeError("Video model returned an empty frame sequence")
    return frames

def generate_video_from_prompt(
    prompt: str,
    width: int,
    height: int,
    num_frames: int,
    fps: int,
    tempo: float,
    sharpness: float,
    warmth: float,
    seed: int | None = None,
) -> VideoResult:
    enriched_prompt = build_enriched_prompt(prompt, tempo, sharpness, warmth)
    generate_kwargs = {
        "height": height,
        "width": width,
        "num_frames": num_frames,
        "fps": fps,
    }
    if seed is not None:
        generate_kwargs["seed"] = seed

    outputs = omni_video_model.generate(enriched_prompt, **generate_kwargs)
    frames = _extract_frames_from_output(outputs)

    metadata = {
        "model": getattr(omni_video_model, "model", "unknown"),
        "prompt": enriched_prompt,
        "width": width,
        "height": height,
        "num_frames": num_frames,
        "fps": fps,
        "tempo": tempo,
        "sharpness": sharpness,
        "warmth": warmth,
        "seed": seed,
    }
    return VideoResult(frames=frames, metadata=metadata)

# Local defaults for media integration (used by omni_media provider adapter)
OMNI_MEDIA_API_BASE_URL = "http://127.0.0.1:8787"
OMNI_MEDIA_PROVIDER_VIDEO_URL = "http://127.0.0.1:8787/omni_video_exports"
OMNI_MEDIA_PLACEHOLDER_ONLY = "false"
