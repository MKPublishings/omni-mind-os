from __future__ import annotations

import unittest

from omni_media.contracts import GenerateRequest, GenerationParams, ImageObject, VideoObject
from omni_media.model_registry import ModelProfile
from omni_media.pipeline import OmniMediaPipeline


class FakeRegistry:
    def select_for_request(self, modality: str, _mode: str):
        if modality not in {"video", "gif", "image"}:
            raise ValueError("unsupported")
        return ModelProfile(
            key="video_default",
            omni_model_id="fake/video",
            precision="fp16",
            max_width=1024,
            max_height=576,
            max_frames=180,
            scheduler={"name": "balanced"},
        )


class FakeEngine:
    def __init__(self) -> None:
        self.video_calls: list[dict[str, object]] = []

    def generate_image(self, *args, **kwargs):
        _ = args, kwargs
        return []

    def generate_video(
        self,
        profile,
        prompt,
        negative_prompt=None,
        width=768,
        height=432,
        num_frames=24,
        fps=12,
        seed=None,
        guidance_scale=7.5,
        num_inference_steps=30,
        extra=None,
    ):
        _ = profile, negative_prompt, seed, guidance_scale, num_inference_steps
        self.video_calls.append(
            {
                "prompt": str(prompt),
                "width": int(width),
                "height": int(height),
                "num_frames": int(num_frames),
                "fps": int(fps),
                "extra": dict(extra or {}),
            }
        )

        frames = [
            ImageObject(bytes_data=b"x", mime_type="image/png", width=int(width), height=int(height))
            for _ in range(max(1, int(num_frames)))
        ]
        duration = len(frames) / max(1, int(fps))
        return VideoObject(
            frames=frames,
            fps=int(fps),
            duration_sec=float(duration),
            width=int(width),
            height=int(height),
            mp4_bytes=b"scene-clip",
        )

    def assemble_video_scenes(self, scenes, fps=None):
        target_fps = int(fps or scenes[0].fps or 12)
        merged_frames = []
        for scene in scenes:
            merged_frames.extend(scene.frames)

        return VideoObject(
            frames=merged_frames,
            fps=target_fps,
            duration_sec=len(merged_frames) / max(1, target_fps),
            width=scenes[0].width,
            height=scenes[0].height,
            mp4_bytes=None,
        )


class TestPipelineSceneAssembly(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = FakeEngine()
        self.pipeline = OmniMediaPipeline(registry=FakeRegistry(), engine=self.engine)

    def test_single_scene_prompt_generates_single_shot(self) -> None:
        request = GenerateRequest(
            id="req-single",
            modality="video",
            mode="default",
            prompt="a video of a forest in the rain",
            params=GenerationParams(width=768, height=432),
            return_format="url",
        )

        response = self.pipeline.run(request)

        self.assertEqual(response.status, "completed")
        self.assertEqual(len(self.engine.video_calls), 1)
        video_meta = response.outputs[0].metadata
        self.assertTrue(video_meta.get("prompt_aware"))
        self.assertEqual(video_meta.get("scene_count"), 1)
        self.assertFalse(bool(video_meta.get("assembled_from_scenes")))

    def test_multi_scene_prompt_generates_multiple_shots_and_assembles(self) -> None:
        request = GenerateRequest(
            id="req-multi",
            modality="video",
            mode="default",
            prompt=(
                "Scene 1: forest in rain at dawn. "
                "Scene 2: close-up of rain on leaves. "
                "Scene 3: wide shot of mist through trees."
            ),
            params=GenerationParams(width=768, height=432),
            return_format="url",
        )

        response = self.pipeline.run(request)

        self.assertEqual(response.status, "completed")
        self.assertGreaterEqual(len(self.engine.video_calls), 3)

        video_meta = response.outputs[0].metadata
        self.assertTrue(bool(video_meta.get("assembled_from_scenes")))
        self.assertGreaterEqual(int(video_meta.get("scene_count") or 0), 3)

        total_requested_frames = sum(int(call["num_frames"]) for call in self.engine.video_calls)
        self.assertEqual(int(video_meta.get("frame_count") or 0), total_requested_frames)


if __name__ == "__main__":
    unittest.main()
