from typing import Dict, Any
from .field_init import build_field_trajectory
from .health_laws import compute_law_params
from .scheduler import build_frame_plan
from .engine import generate_video_from_prompt
from utils.storage import save_video
from utils.safety import check_video_safety

async def run_video_pipeline(prompt: str, params: Dict[str, Any]) -> Dict[str, Any]:
    width = params.get("width", 768)
    height = params.get("height", 432)
    duration = params.get("duration", 2.0)
    fps = params.get("fps", 12)
    seed = params.get("seed")

    physics_profile = params.get("physics_profile", {})

    trajectory = build_field_trajectory(prompt, duration, fps)
    law_params = compute_law_params(physics_profile)
    frame_plan = build_frame_plan(trajectory, law_params, fps)

    avg_tempo = sum(fp.tempo for fp in frame_plan) / len(frame_plan)
    avg_sharpness = sum(fp.sharpness for fp in frame_plan) / len(frame_plan)
    avg_warmth = sum(fp.warmth for fp in frame_plan) / len(frame_plan)

    video_result = generate_video_from_prompt(
        prompt=prompt,
        width=width,
        height=height,
        num_frames=len(frame_plan),
        fps=fps,
        tempo=avg_tempo,
        sharpness=avg_sharpness,
        warmth=avg_warmth,
        seed=seed,
    )

    frames = video_result.frames

    if not check_video_safety(frames):
        return {"status": "error", "error": "Video failed safety checks"}

    video_path = save_video(frames, fps=fps)

    return {
        "status": "success",
        "video_url": video_path,
        "meta": {
            **video_result.metadata,
            "duration": duration,
        },
    }
