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
            "video_default": ModelProfile(
                key="video_default",
                omni_model_id="omni/video-default",
                precision="fp16",
                max_width=1024,
                max_height=576,
                max_frames=64,
                scheduler={"name": "balanced"},
            ),
            "video_long": ModelProfile(
                key="video_long",
                omni_model_id="omni/video-long",
                precision="fp16",
                max_width=768,
                max_height=432,
                max_frames=120,
                scheduler={"name": "long"},
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
            return self.get("video_long" if normalized_mode in {"long", "extended"} else "video_default")

        raise ValueError(f"Unsupported modality: {modality}")
