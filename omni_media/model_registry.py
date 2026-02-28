from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(slots=True)
class ModelProfile:
    key: str
    omni_model_id: str
    precision: str
    max_width: int
    max_height: int
    max_frames: int
    scheduler: dict[str, str] = field(default_factory=dict)
    lora_hooks: list[str] = field(default_factory=list)


class ModelRegistry:
    def __init__(self) -> None:
        self._profiles: dict[str, ModelProfile] = {
            "image_default": ModelProfile(
                key="image_default",
                omni_model_id="Qwen/Qwen-Image",
                precision="fp16",
                max_width=1536,
                max_height=1536,
                max_frames=1,
                scheduler={"name": "default"},
            ),
            "image_hd": ModelProfile(
                key="image_hd",
                omni_model_id="Qwen/Qwen-Image-2512",
                precision="fp16",
                max_width=2512,
                max_height=2512,
                max_frames=1,
                scheduler={"name": "quality"},
            ),
            # Default short-form video profile (root: omni-ai)
            "video_default": ModelProfile(
                key="video_default",
                omni_model_id="omni/video-default",  # must match your deployed video model id
                precision="fp16",
            ),
            # Longer clips / extended duration profile (root: omni-ai)
            "video_long": ModelProfile(
                key="video_long",
                omni_model_id="omni/video-long",  # must match your deployed long-form video model id
                precision="fp16",
            ),
            # 4K super-resolution profile (CogVideoX base + SVD-SR refinement)
            "video_4k": ModelProfile(
                key="video_4k",
                omni_model_id="omni/video-4k",
                precision="fp16",
                max_width=3840,
                max_height=2160,
                max_frames=64,
                scheduler={"name": "4k-sr"},
            ),
        }

    def get(self, key: str) -> ModelProfile:
        if key not in self._profiles:
            raise KeyError(f"Unknown model profile: {key}")
        return self._profiles[key]

    def select_for_request(self, modality: str, mode: str) -> ModelProfile:
        normalized_modality = modality.strip().lower()
        normalized_mode = mode.strip().lower()

        if normalized_modality == "image":
            return self.get("image_hd" if normalized_mode in {"hd", "quality"} else "image_default")

        if normalized_modality in {"video", "gif"}:
            if normalized_mode in {"4k", "ultra", "highres"}:
                return self.get("video_4k")
            return self.get("video_long" if normalized_mode in {"long", "extended"} else "video_default")

        raise ValueError(f"Unsupported modality: {modality}")
