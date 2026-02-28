from __future__ import annotations

import math
import re
from dataclasses import dataclass


_SCENE_SPLIT_PATTERN = re.compile(r"(?:\n\s*scene\s*\d+[:\-]|\n\s*\d+[\)\.]\s+|\n\s*[-*]\s+|\s+then\s+|\s+next\s+|\s+cut\s+to\s+)", re.IGNORECASE)
_SCENE_MARKER_PATTERN = re.compile(r"\bscene\s*\d+\s*[:\-]", re.IGNORECASE)


@dataclass(slots=True)
class SceneSpec:
    index: int
    text: str
    duration_sec: float
    shot_prompt: str
    start_sec: float = 0.0
    end_sec: float = 0.0
    frame_count: int = 0
    start_frame: int = 0
    end_frame: int = 0


@dataclass(slots=True)
class VideoPromptPlan:
    original_prompt: str
    normalized_prompt: str
    scene_count: int
    total_duration_sec: float
    fps: int
    total_frames: int
    style_preset: str
    motion_profile: str
    camera_profile: str
    scenes: list[SceneSpec]
    grounding_tokens: list[str]
    grounding_score: float

    def to_metadata(self) -> dict[str, object]:
        return {
            "prompt_aware": True,
            "scene_count": self.scene_count,
            "duration_sec": round(self.total_duration_sec, 2),
            "fps": self.fps,
            "frame_count": self.total_frames,
            "style_preset": self.style_preset,
            "motion_profile": self.motion_profile,
            "camera_profile": self.camera_profile,
            "grounding_tokens": self.grounding_tokens,
            "grounding_score": round(self.grounding_score, 3),
            "scene_plan": [
                {
                    "index": scene.index,
                    "text": scene.text,
                    "duration_sec": round(scene.duration_sec, 2),
                    "start_sec": round(scene.start_sec, 2),
                    "end_sec": round(scene.end_sec, 2),
                    "frame_count": int(scene.frame_count),
                    "start_frame": int(scene.start_frame),
                    "end_frame": int(scene.end_frame),
                    "shot_prompt": scene.shot_prompt,
                }
                for scene in self.scenes
            ],
        }


@dataclass(slots=True)
class VideoGenerationSpec:
    prompt: str
    fps: int
    num_frames: int
    style_preset: str
    motion_profile: str
    camera_profile: str
    metadata: dict[str, object]


def _normalize_prompt(prompt: str) -> str:
    text = str(prompt or "").strip()
    text = re.sub(r"\s+", " ", text)
    return text


def _infer_style_profile(prompt: str) -> tuple[str, str, str]:
    lower = prompt.lower()

    style = "natural"
    if re.search(r"\b(cinematic|film|movie|dramatic|epic|anamorphic)\b", lower):
        style = "cinematic"
    elif re.search(r"\b(anime|cartoon|pixar|stylized|illustrated)\b", lower):
        style = "stylized"
    elif re.search(r"\b(noir|monochrome|black\s*and\s*white|gritty)\b", lower):
        style = "noir"
    elif re.search(r"\b(neon|cyberpunk|sci[-\s]?fi|futuristic)\b", lower):
        style = "neon"

    motion = "normal"
    if re.search(r"\b(slow\s*motion|slow-mo|dramatic\s*slow)\b", lower):
        motion = "slow"
    elif re.search(r"\b(fast|action|chase|dynamic|high\s*energy)\b", lower):
        motion = "fast"

    camera = "standard"
    if re.search(r"\b(aerial|drone|overhead|bird'?s\s*eye)\b", lower):
        camera = "aerial"
    elif re.search(r"\b(close\s*up|macro|portrait)\b", lower):
        camera = "close-up"
    elif re.search(r"\b(wide|landscape|establishing\s*shot)\b", lower):
        camera = "wide"

    return style, motion, camera


def _extract_grounding_tokens(prompt: str) -> list[str]:
    candidates = re.findall(r"\b[a-zA-Z][a-zA-Z'-]{2,}\b", prompt.lower())
    stop = {
        "the", "and", "with", "into", "from", "that", "this", "then", "next", "scene", "video",
        "make", "create", "generate", "show", "shot", "shots", "camera", "style", "motion", "slow",
        "fast", "for", "of", "in", "on", "at", "to", "a", "an",
    }
    unique: list[str] = []
    for token in candidates:
        if token in stop:
            continue
        if token not in unique:
            unique.append(token)
        if len(unique) >= 12:
            break
    return unique


def _split_scenes(prompt: str) -> list[str]:
    markers = list(_SCENE_MARKER_PATTERN.finditer(prompt))
    if markers:
        parts: list[str] = []
        for index, marker in enumerate(markers):
            start = marker.end()
            end = markers[index + 1].start() if index + 1 < len(markers) else len(prompt)
            chunk = prompt[start:end].strip(" ,.-")
            if chunk:
                parts.append(chunk)
        if parts:
            return parts[:8]

    chunks = [part.strip(" ,.-") for part in _SCENE_SPLIT_PATTERN.split(prompt) if part and part.strip(" ,.-")]
    if not chunks:
        return [prompt]
    if len(chunks) == 1:
        return chunks

    merged: list[str] = []
    for chunk in chunks:
        if len(chunk.split()) < 4 and merged:
            merged[-1] = f"{merged[-1]}, {chunk}".strip()
        else:
            merged.append(chunk)
    return merged[:8]


def _estimate_duration_sec(prompt: str, scene_count: int) -> float:
    words = len(re.findall(r"\b\w+\b", prompt))
    if words <= 12:
        base = 5.0
    elif words <= 40:
        base = 10.0
    elif words <= 100:
        base = 18.0
    else:
        base = 28.0

    scene_factor = max(0, scene_count - 1) * 2.5
    duration = base + scene_factor
    return max(4.0, min(60.0, duration))


def _duration_distribution(total_duration_sec: float, scene_count: int) -> list[float]:
    if scene_count <= 1:
        return [total_duration_sec]

    base = total_duration_sec / scene_count
    values = [base for _ in range(scene_count)]

    emphasis = min(2.0, total_duration_sec * 0.1)
    values[0] += emphasis
    values[-1] += emphasis

    reduction = (2 * emphasis) / max(1, scene_count - 2)
    for i in range(1, scene_count - 1):
        values[i] = max(1.0, values[i] - reduction)

    total = sum(values)
    if total <= 0:
        return [total_duration_sec / scene_count for _ in range(scene_count)]

    scale = total_duration_sec / total
    return [max(1.0, value * scale) for value in values]


def _compile_shot_prompt(scene_text: str, style: str, motion: str, camera: str) -> str:
    return (
        f"{scene_text.strip()}. "
        f"Style: {style}. Motion: {motion}. Camera: {camera}. "
        "Keep subject and environment faithful to the scene description."
    )


def _allocate_scene_frames(per_scene_duration: list[float], fps: int, total_frames: int) -> list[int]:
    if not per_scene_duration:
        return []

    allocations = [max(1, int(round(duration * fps))) for duration in per_scene_duration]
    frame_delta = int(total_frames - sum(allocations))

    if frame_delta > 0:
        index = 0
        while frame_delta > 0:
            allocations[index % len(allocations)] += 1
            frame_delta -= 1
            index += 1
    elif frame_delta < 0:
        index = 0
        while frame_delta < 0 and any(value > 1 for value in allocations):
            slot = index % len(allocations)
            if allocations[slot] > 1:
                allocations[slot] -= 1
                frame_delta += 1
            index += 1

    return allocations


def build_video_prompt_plan(prompt: str) -> VideoPromptPlan:
    normalized = _normalize_prompt(prompt)
    if not normalized:
        raise ValueError("prompt is required")

    style, motion, camera = _infer_style_profile(normalized)
    scene_texts = _split_scenes(normalized)
    duration_sec = _estimate_duration_sec(normalized, len(scene_texts))
    per_scene = _duration_distribution(duration_sec, len(scene_texts))
    fps = 10 if motion == "slow" else 16 if motion == "fast" else 12
    total_frames = max(16, int(round(duration_sec * fps)))
    frame_allocations = _allocate_scene_frames(per_scene, fps, total_frames)

    scenes: list[SceneSpec] = []
    cursor_frame = 0
    for index, text in enumerate(scene_texts, start=1):
        frame_count = frame_allocations[index - 1]
        start_frame = cursor_frame
        end_frame = max(start_frame, start_frame + frame_count - 1)
        start_sec = start_frame / max(1, fps)
        end_sec = (end_frame + 1) / max(1, fps)

        scenes.append(
            SceneSpec(
                index=index,
                text=text,
                duration_sec=per_scene[index - 1],
                shot_prompt=_compile_shot_prompt(text, style, motion, camera),
                start_sec=start_sec,
                end_sec=end_sec,
                frame_count=frame_count,
                start_frame=start_frame,
                end_frame=end_frame,
            )
        )
        cursor_frame = end_frame + 1

    grounding_tokens = _extract_grounding_tokens(normalized)
    compiled_text = " ".join(scene.shot_prompt.lower() for scene in scenes)
    hits = sum(1 for token in grounding_tokens if token in compiled_text)
    grounding_score = (hits / len(grounding_tokens)) if grounding_tokens else 1.0

    return VideoPromptPlan(
        original_prompt=str(prompt),
        normalized_prompt=normalized,
        scene_count=len(scenes),
        total_duration_sec=duration_sec,
        fps=fps,
        total_frames=total_frames,
        style_preset=style,
        motion_profile=motion,
        camera_profile=camera,
        scenes=scenes,
        grounding_tokens=grounding_tokens,
        grounding_score=round(max(0.0, min(1.0, grounding_score)), 3),
    )


def compile_video_generation_spec(prompt: str) -> VideoGenerationSpec:
    plan = build_video_prompt_plan(prompt)
    scene_block = "\n".join([f"Scene {scene.index}: {scene.shot_prompt}" for scene in plan.scenes])
    compiled_prompt = (
        f"Create a video storyboard with {plan.scene_count} scenes. "
        f"Total duration target: {round(plan.total_duration_sec, 1)} seconds.\n"
        f"{scene_block}"
    )

    metadata = plan.to_metadata()
    metadata["compiled_prompt_preview"] = compiled_prompt[:700]

    return VideoGenerationSpec(
        prompt=compiled_prompt,
        fps=plan.fps,
        num_frames=plan.total_frames,
        style_preset=plan.style_preset,
        motion_profile=plan.motion_profile,
        camera_profile=plan.camera_profile,
        metadata=metadata,
    )
