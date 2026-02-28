from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal


@dataclass(slots=True)
class GenerateBody:
    prompt: str
    negative_prompt: str | None = None
    mode: str = "default"
    params: dict[str, Any] = field(default_factory=dict)
    safety_level: str = "default"
    watermark: bool = True
    return_format: Literal["url", "base64", "bytes"] = "url"


@dataclass(slots=True)
class OutputItem:
    type: Literal["image", "video", "gif"]
    url: str | None = None
    data: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class GenerateApiResponse:
    id: str
    status: Literal["completed", "failed"]
    outputs: list[OutputItem] = field(default_factory=list)
    error: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)
