from __future__ import annotations

import base64
import hashlib
import time
from dataclasses import asdict
from typing import Any

from .contracts import GenerateRequest, GenerateResponse, MediaOutput
from .engine import OmniMediaEngine
from .model_registry import ModelRegistry
from .video_prompt_planner import compile_video_generation_spec


class OmniMediaPipeline:
    def __init__(
        self,
        registry: ModelRegistry | None = None,
        engine: OmniMediaEngine | None = None,
    ) -> None:
        self.registry = registry or ModelRegistry()
        self.engine = engine or OmniMediaEngine()

    def _normalize_input(self, request: GenerateRequest) -> GenerateRequest:
        prompt = request.prompt.strip()
        if not prompt:
            raise ValueError("prompt is required")
        request.prompt = prompt
        return request

    def _route_model(self, request: GenerateRequest):
        return self.registry.select_for_request(request.modality, request.mode)

    def _pre_safety_check(self, request: GenerateRequest) -> None:
        blocked_terms = {"csam", "child sexual", "exploitative sexual"}
        lower_prompt = request.prompt.lower()
        if any(term in lower_prompt for term in blocked_terms):
            raise PermissionError("prompt blocked by safety pre-filter")

    def _post_safety_check(self, _request: GenerateRequest, _outputs: list[MediaOutput]) -> None:
        return

    def _package_data(self, request: GenerateRequest, outputs: list[MediaOutput]) -> list[MediaOutput]:
        if request.return_format == "url":
            return outputs
        if request.return_format == "base64":
            for output in outputs:
                raw = output.metadata.pop("_bytes", None)
                if raw is not None:
                    output.data = base64.b64encode(raw).decode("ascii")
            return outputs
        if request.return_format == "bytes":
            return outputs
        raise ValueError(f"Unsupported return format: {request.return_format}")

    def run(self, request: GenerateRequest) -> GenerateResponse:
        started = time.perf_counter()

        try:
            request = self._normalize_input(request)
            self._pre_safety_check(request)
            profile = self._route_model(request)

            outputs: list[MediaOutput] = []
            if request.modality == "image":
                images = self.engine.generate_image(
                    profile=profile,
                    prompt=request.prompt,
                    negative_prompt=request.negative_prompt,
                    width=request.params.width or 1024,
                    height=request.params.height or 1024,
                    num_images=request.params.num_images or 1,
                    seed=request.params.seed,
                    guidance_scale=request.params.guidance_scale or 7.5,
                    num_inference_steps=request.params.num_inference_steps or 30,
                    extra=request.params.extra,
                )
                for img in images:
                    outputs.append(
                        MediaOutput(
                            type="image",
                            metadata={
                                "mime_type": img.mime_type,
                                "width": img.width,
                                "height": img.height,
                                "_bytes": img.bytes_data,
                            },
                        )
                    )

            elif request.modality == "video":
                video_spec = compile_video_generation_spec(request.prompt)
                if float(video_spec.metadata.get("grounding_score", 0)) < 0.35:
                    raise ValueError("prompt grounding score too low; unable to build a reliable video plan")

                request.params.fps = request.params.fps or video_spec.fps
                request.params.num_frames = request.params.num_frames or video_spec.num_frames
                request.params.extra = {
                    **(request.params.extra or {}),
                    "style_preset": str(request.params.extra.get("style_preset") if request.params.extra else "")
                    or video_spec.style_preset,
                    "motion_profile": str(request.params.extra.get("motion_profile") if request.params.extra else "")
                    or video_spec.motion_profile,
                    "camera_profile": str(request.params.extra.get("camera_profile") if request.params.extra else "")
                    or video_spec.camera_profile,
                    "scene_plan": video_spec.metadata.get("scene_plan"),
                    "grounding_tokens": video_spec.metadata.get("grounding_tokens"),
                }

                scene_specs = list(video_spec.metadata.get("scene_plan") or [])
                scene_videos = []
                for index, scene in enumerate(scene_specs, start=1):
                    scene_text = str(scene.get("text") or "").strip()
                    scene_shot_prompt = str(scene.get("shot_prompt") or scene_text or request.prompt).strip()
                    scene_frames = int(scene.get("frame_count") or max(1, request.params.num_frames or video_spec.num_frames))

                    scene_extra = {
                        **(request.params.extra or {}),
                        "style_preset": request.params.extra.get("style_preset") if request.params.extra else video_spec.style_preset,
                        "motion_profile": request.params.extra.get("motion_profile") if request.params.extra else video_spec.motion_profile,
                        "camera_profile": request.params.extra.get("camera_profile") if request.params.extra else video_spec.camera_profile,
                        "scene_index": index,
                        "scene_text": scene_text,
                        "scene_start_sec": scene.get("start_sec"),
                        "scene_end_sec": scene.get("end_sec"),
                    }

                    scene_video = self.engine.generate_video(
                        profile=profile,
                        prompt=scene_shot_prompt,
                        negative_prompt=request.negative_prompt,
                        width=request.params.width or 768,
                        height=request.params.height or 432,
                        num_frames=scene_frames,
                        fps=request.params.fps or video_spec.fps,
                        seed=request.params.seed,
                        guidance_scale=request.params.guidance_scale or 7.5,
                        num_inference_steps=request.params.num_inference_steps or 30,
                        extra=scene_extra,
                    )
                    scene_videos.append(scene_video)

                video = self.engine.assemble_video_scenes(scene_videos, fps=request.params.fps or video_spec.fps)
                outputs.append(
                    MediaOutput(
                        type="video",
                        metadata={
                            "fps": video.fps,
                            "duration_sec": video.duration_sec,
                            "width": video.width,
                            "height": video.height,
                            "frame_count": len(video.frames),
                            "assembled_from_scenes": len(scene_specs) > 1,
                            "prompt_aware": True,
                            "style_preset": video_spec.style_preset,
                            "motion_profile": video_spec.motion_profile,
                            "camera_profile": video_spec.camera_profile,
                            "scene_count": video_spec.metadata.get("scene_count"),
                            "grounding_score": video_spec.metadata.get("grounding_score"),
                            "scene_plan": video_spec.metadata.get("scene_plan"),
                            "_bytes": video.mp4_bytes,
                        },
                    )
                )

            elif request.modality == "gif":
                video_spec = compile_video_generation_spec(request.prompt)
                video = self.engine.generate_video(
                    profile=profile,
                    prompt=video_spec.prompt,
                    negative_prompt=request.negative_prompt,
                    width=request.params.width or 512,
                    height=request.params.height or 512,
                    num_frames=request.params.num_frames or video_spec.num_frames,
                    fps=request.params.fps or video_spec.fps,
                    seed=request.params.seed,
                    guidance_scale=request.params.guidance_scale or 7.5,
                    num_inference_steps=request.params.num_inference_steps or 30,
                    extra=request.params.extra,
                )
                gif_bytes = self.engine.generate_gif_from_video(video)
                outputs.append(
                    MediaOutput(
                        type="gif",
                        metadata={
                            "fps": video.fps,
                            "duration_sec": video.duration_sec,
                            "width": video.width,
                            "height": video.height,
                            "frame_count": len(video.frames),
                            "prompt_aware": True,
                            "style_preset": video_spec.style_preset,
                            "motion_profile": video_spec.motion_profile,
                            "camera_profile": video_spec.camera_profile,
                            "scene_count": video_spec.metadata.get("scene_count"),
                            "grounding_score": video_spec.metadata.get("grounding_score"),
                            "scene_plan": video_spec.metadata.get("scene_plan"),
                            "_bytes": gif_bytes,
                        },
                    )
                )

            else:
                raise ValueError(f"Unsupported modality: {request.modality}")

            self._post_safety_check(request, outputs)
            outputs = self._package_data(request, outputs)

            latency_ms = (time.perf_counter() - started) * 1000
            return GenerateResponse(
                id=request.id,
                status="completed",
                outputs=outputs,
                metadata={
                    "latency_ms": round(latency_ms, 2),
                    "prompt_hash": hashlib.sha256(request.prompt.encode("utf-8")).hexdigest(),
                    "model_profile": profile.key,
                    "model_config": asdict(profile),
                },
            )

        except Exception as exc:
            latency_ms = (time.perf_counter() - started) * 1000
            return GenerateResponse(
                id=request.id,
                status="failed",
                error=str(exc),
                metadata={"latency_ms": round(latency_ms, 2)},
            )
