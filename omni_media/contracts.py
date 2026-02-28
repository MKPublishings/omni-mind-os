from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal

MediaType = Literal["image", "video", "gif"]
StatusType = Literal["completed", "failed"]


@dataclass(slots=True)
class GenerationParams:
    width: int | None = None
    height: int | None = None
    num_frames: int | None = None
    fps: int | None = None
    seed: int | None = None
    guidance_scale: float | None = None
    num_inference_steps: int | None = None
    num_images: int | None = None
    extra: dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class GenerateRequest:
    id: str
    modality: MediaType
    mode: str
    prompt: str
    negative_prompt: str | None = None
    params: GenerationParams = field(default_factory=GenerationParams)
    safety_level: str = "default"
    watermark: bool = True
    return_format: Literal["url", "base64", "bytes"] = "url"


@dataclass(slots=True)
class ImageObject:
    bytes_data: bytes
    mime_type: str = "image/png"
    width: int | None = None
    height: int | None = None


@dataclass(slots=True)
class VideoObject:
    frames: list[ImageObject]
    fps: int
    duration_sec: float
    width: int
    height: int
    mp4_bytes: bytes | None = None


@dataclass(slots=True)
class MediaOutput:
    type: MediaType
    url: str | None = None
    data: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class GenerateResponse:
    id: str
    status: StatusType
    outputs: list[MediaOutput] = field(default_factory=list)
    error: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)
