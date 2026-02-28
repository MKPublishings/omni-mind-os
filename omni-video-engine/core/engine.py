
# Try to import the real Omni class, otherwise use a stub for development.
try:
    from omni import Omni
except ImportError:
    class Omni:
        def __init__(self, model=None):
            self.model = model or "stub-model"
        def __call__(self, *args, **kwargs):
            # Return a fake video result for development
            return {
                "frames": [b"fake_frame_data" for _ in range(kwargs.get("num_frames", 8))],
                "metadata": {"stub": True, "model": self.model}
            }

# Set your real model here
omni_video_model = Omni(model="Qwen/Qwen2-VL-7B-Instruct")  # <-- replace with your model

class VideoResult:
    def __init__(self, frames, metadata: dict):
        self.frames = frames
        self.metadata = metadata

def build_enriched_prompt(base_prompt: str, tempo: float, sharpness: float, warmth: float) -> str:
    control = (
        f"cinematic, temporal rhythm {tempo:.2f}, image sharpness {sharpness:.2f}, "
        f"color warmth {warmth:.2f}"
    )
    return f"{base_prompt}, {control}"

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
    first = outputs[0]
    if hasattr(first, "video_frames"):
        frames = first.video_frames
    elif hasattr(first, "frames"):
        frames = first.frames
    elif isinstance(first, dict) and "video_frames" in first:
        frames = first["video_frames"]
    else:
        raise RuntimeError("Unknown video output structure from Omni model")

    metadata = {
        "model": omni_video_model.model,
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

OMNI_MEDIA_API_BASE_URL="http://127.0.0.1:8787"
OMNI_MEDIA_PROVIDER_VIDEO_URL="http://127.0.0.1:8787/omni_video_exports"
OMNI_MEDIA_PLACEHOLDER_ONLY="false"
