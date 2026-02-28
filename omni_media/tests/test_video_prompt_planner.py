from __future__ import annotations

import unittest

from omni_media.video_prompt_planner import build_video_prompt_plan, compile_video_generation_spec


class TestVideoPromptPlanner(unittest.TestCase):
    def test_short_prompt_creates_short_plan(self) -> None:
        plan = build_video_prompt_plan("a video of a forest in the rain")

        self.assertGreaterEqual(plan.total_duration_sec, 4.0)
        self.assertLessEqual(plan.total_duration_sec, 12.0)
        self.assertGreaterEqual(plan.scene_count, 1)
        self.assertGreaterEqual(plan.grounding_score, 0.5)

    def test_scene_prompt_creates_multi_scene_plan(self) -> None:
        prompt = (
            "Scene 1: establish a rainy forest at dawn. "
            "Scene 2: close-up of raindrops on pine needles. "
            "Scene 3: wide shot with mist moving through trees."
        )
        plan = build_video_prompt_plan(prompt)

        self.assertGreaterEqual(plan.scene_count, 3)
        self.assertGreater(plan.total_duration_sec, 10.0)
        self.assertTrue(any("raindrops" in scene.shot_prompt.lower() for scene in plan.scenes))

    def test_long_prompt_increases_duration(self) -> None:
        short_plan = build_video_prompt_plan("forest in rain")
        long_prompt = (
            "Create a structured cinematic sequence set in a dense forest during heavy rain, "
            "starting with a wide overhead shot, then moving through tree-level tracking shots, "
            "close-ups of dripping leaves, mist layers, puddle reflections, and a final dusk reveal "
            "with lightning in the background while maintaining continuity across all scenes."
        )
        long_plan = build_video_prompt_plan(long_prompt)

        self.assertGreater(long_plan.total_duration_sec, short_plan.total_duration_sec)
        self.assertGreaterEqual(long_plan.scene_count, short_plan.scene_count)

    def test_generation_spec_contains_storyboard_metadata(self) -> None:
        spec = compile_video_generation_spec("cinematic drone shot over a rainy forest")

        self.assertGreater(spec.num_frames, 0)
        self.assertIn("scene_plan", spec.metadata)
        self.assertTrue(spec.metadata.get("prompt_aware"))
        self.assertIn("Scene 1:", spec.prompt)

    def test_scene_timeline_is_contiguous(self) -> None:
        plan = build_video_prompt_plan(
            "Scene 1: forest in rain. Scene 2: close-up of wet leaves. Scene 3: fog moving through pines."
        )

        self.assertGreaterEqual(plan.scene_count, 3)
        self.assertGreater(plan.total_frames, 0)

        cursor = 0
        for scene in plan.scenes:
            self.assertEqual(scene.start_frame, cursor)
            self.assertGreaterEqual(scene.end_frame, scene.start_frame)
            self.assertGreaterEqual(scene.end_sec, scene.start_sec)
            cursor = scene.end_frame + 1

        self.assertEqual(cursor, plan.total_frames)


if __name__ == "__main__":
    unittest.main()
