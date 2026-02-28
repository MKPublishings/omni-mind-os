
from typing import Dict, Any
from .field_init import build_field_trajectory
from .health_laws import compute_law_params
from .scheduler import build_frame_plan
from .engine import generate_video_from_prompt
from utils.storage import save_video
from utils.safety import check_video_safety
from sr import SvdSrEngine, SvdSrConfig

svd_sr_engine = SvdSrEngine()

async def run_video_pipeline(prompt: str, params: Dict[str, Any]) -> Dict[str, Any]:
    width = params.get("width", 768)
    height = params.get("height", 432)
    duration = params.get("duration", 2.0)
    fps = params.get("fps", 12)
    seed = params.get("seed")
    mode = str(params.get("mode") or "").lower()

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

    # Optional 4K super-resolution path (SVD-SR style)
    is_4k = mode in {"4k", "ultra", "highres"}
    if is_4k:
        sr_config = SvdSrConfig(
            target_width=3840,
            target_height=2160,
            tile_size=int(params.get("tile_size", 512)),
            overlap=int(params.get("overlap", 32)),
            steps=int(params.get("sr_steps", 25)),
            strength=float(params.get("sr_strength", 0.7)),
        )
        frames = svd_sr_engine.upscale(frames, sr_config)
        video_result.metadata.update(
            {
                "profile": "video_4k_svd_sr",
                "base_width": width,
                "base_height": height,
                "width": 3840,
                "height": 2160,
            }
        )

    if not check_video_safety(frames):
        return {"status": "error", "error": "Video failed safety checks"}

    video_path = save_video(frames, fps=fps)

    return {
        "status": "success",
        "video_url": video_path,
        "meta": {
            **video_result.metadata,
            "duration": duration,
            "fps": fps,
            "frame_count": len(frames),
        },
    }
