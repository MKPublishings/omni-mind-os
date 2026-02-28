from __future__ import annotations

import io
import importlib
from dataclasses import asdict
from typing import Any

from .contracts import ImageObject, VideoObject
from .model_registry import ModelProfile


class OmniUnavailableError(RuntimeError):
    pass


class OmniMediaEngine:
    def __init__(self) -> None:
        self._clients: dict[str, Any] = {}

    def _load_omni_client(self, profile: ModelProfile) -> Any:
        if profile.key in self._clients:
            return self._clients[profile.key]

        try:
            omni_module = importlib.import_module("vllm_omni.entrypoints.omni")
            Omni = getattr(omni_module, "Omni")
        except Exception as exc:
            raise OmniUnavailableError(
                "vllm_omni is not installed or unavailable in this runtime."
            ) from exc

        client = Omni(model=profile.omni_model_id)
        self._clients[profile.key] = client
        return client

    def generate_image(
        self,
        profile: ModelProfile,
        prompt: str,
        negative_prompt: str | None = None,
        width: int = 1024,
        height: int = 1024,
        num_images: int = 1,
        seed: int | None = None,
        guidance_scale: float = 7.5,
        num_inference_steps: int = 30,
        extra: dict[str, Any] | None = None,
    ) -> list[ImageObject]:
        client = self._load_omni_client(profile)
        payload = {
            "prompt": prompt,
            "negative_prompt": negative_prompt,
            "width": min(width, profile.max_width),
            "height": min(height, profile.max_height),
            "num_images": max(1, num_images),
            "seed": seed,
            "guidance_scale": guidance_scale,
            "num_inference_steps": num_inference_steps,
            **(extra or {}),
        }

        result = client.generate(**payload)
        images: list[ImageObject] = []

        for output in result:
            for img in getattr(output, "images", []) or []:
                buffer = io.BytesIO()
                img.save(buffer, format="PNG")
                images.append(
                    ImageObject(
                        bytes_data=buffer.getvalue(),
                        mime_type="image/png",
                        width=payload["width"],
                        height=payload["height"],
                    )
                )

        return images

    def generate_video(
        self,
        profile: ModelProfile,
        prompt: str,
        negative_prompt: str | None = None,
        width: int = 768,
        height: int = 432,
        num_frames: int = 24,
        fps: int = 12,
        seed: int | None = None,
        guidance_scale: float = 7.5,
        num_inference_steps: int = 30,
        extra: dict[str, Any] | None = None,
    ) -> VideoObject:
        client = self._load_omni_client(profile)
        payload = {
            "prompt": prompt,
            "negative_prompt": negative_prompt,
            "width": min(width, profile.max_width),
            "height": min(height, profile.max_height),
            "num_frames": min(num_frames, profile.max_frames),
            "fps": fps,
            "seed": seed,
            "guidance_scale": guidance_scale,
            "num_inference_steps": num_inference_steps,
            **(extra or {}),
        }

        result = client.generate(**payload)
        frames: list[ImageObject] = []

        for output in result:
            for frame in getattr(output, "frames", []) or []:
                buffer = io.BytesIO()
                frame.save(buffer, format="PNG")
                frames.append(
                    ImageObject(
                        bytes_data=buffer.getvalue(),
                        mime_type="image/png",
                        width=payload["width"],
                        height=payload["height"],
                    )
                )

        duration = (payload["num_frames"] / max(1, payload["fps"])) if payload["num_frames"] else 0
        return VideoObject(
            frames=frames,
            fps=payload["fps"],
            duration_sec=float(duration),
            width=payload["width"],
            height=payload["height"],
            mp4_bytes=getattr(result, "mp4_bytes", None),
        )

    def assemble_video_scenes(self, scenes: list[VideoObject], fps: int | None = None) -> VideoObject:
        if not scenes:
            raise ValueError("at least one scene is required for video assembly")

        target_fps = int(fps or scenes[0].fps or 12)
        merged_frames: list[ImageObject] = []
        width = int(scenes[0].width)
        height = int(scenes[0].height)

        for scene in scenes:
            merged_frames.extend(scene.frames)

        if not merged_frames:
            raise ValueError("scene assembly produced no frames")

        duration = len(merged_frames) / max(1, target_fps)
        merged_mp4 = scenes[0].mp4_bytes if len(scenes) == 1 else None

        return VideoObject(
            frames=merged_frames,
            fps=target_fps,
            duration_sec=float(duration),
            width=width,
            height=height,
            mp4_bytes=merged_mp4,
        )

    def generate_gif_from_video(self, video: VideoObject, loop: int = 0) -> bytes:
        try:
            image_module = importlib.import_module("PIL.Image")
            Image = image_module
        except Exception as exc:
            raise RuntimeError("Pillow is required for GIF conversion") from exc

        if not video.frames:
            raise ValueError("VideoObject has no frames to convert")

        pil_frames = [Image.open(io.BytesIO(frame.bytes_data)).convert("RGB") for frame in video.frames]
        output = io.BytesIO()
        duration_ms = int(1000 / max(1, video.fps))

        pil_frames[0].save(
            output,
            format="GIF",
            save_all=True,
            append_images=pil_frames[1:],
            duration=duration_ms,
            loop=loop,
            optimize=True,
        )
        return output.getvalue()

    def debug_profile(self, profile: ModelProfile) -> dict[str, Any]:
        return asdict(profile)
