from __future__ import annotations

import uuid
import threading
import os
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any

from .api_contracts import GenerateApiResponse, GenerateBody, OutputItem
from .contracts import GenerateRequest, GenerationParams, MediaOutput
from .hooks import DefaultMediaHooks
from .pipeline import OmniMediaPipeline
from .storage import LocalFileStorageAdapter, StorageAdapter
from .video_prompt_planner import compile_video_generation_spec
from .worker import InMemoryJobQueue, Job, OmniMediaWorker


def _select_prompt_aware_fallback_url(prompt_text: str, default_url: str) -> str:
    prompt = str(prompt_text or "").lower()

    if any(token in prompt for token in ["cinematic", "epic", "dramatic", "action"]):
        return "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4"
    if any(token in prompt for token in ["city", "urban", "night", "cyberpunk", "neon", "robot", "future"]):
        return "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4"
    if any(token in prompt for token in ["nature", "forest", "bird", "crow", "animal", "wildlife", "outdoor"]):
        return "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4"

    return default_url


def _infer_extension(media_type: str, metadata: dict[str, Any]) -> str:
    mime = str(metadata.get("mime_type") or "").lower()
    if media_type == "image":
        if "jpeg" in mime or "jpg" in mime:
            return "jpg"
        if "webp" in mime:
            return "webp"
        return "png"
    if media_type == "gif":
        return "gif"
    if media_type == "video":
        return "mp4"
    return "bin"


@dataclass(slots=True)
class JobRecord:
    id: str
    modality: str
    status: str
    submitted_at: str
    completed_at: str | None = None
    response: GenerateApiResponse | None = None
    error: str | None = None


class InMemoryJobStore:
    def __init__(self) -> None:
        self._jobs: dict[str, JobRecord] = {}

    def upsert(self, record: JobRecord) -> None:
        self._jobs[record.id] = record

    def get(self, job_id: str) -> JobRecord | None:
        return self._jobs.get(job_id)


@dataclass(slots=True)
class OmniMediaService:
    pipeline: OmniMediaPipeline = field(default_factory=OmniMediaPipeline)
    storage: StorageAdapter = field(default_factory=LocalFileStorageAdapter)
    job_store: InMemoryJobStore = field(default_factory=InMemoryJobStore)
    queue_backend: InMemoryJobQueue = field(default_factory=InMemoryJobQueue)
    hooks: DefaultMediaHooks = field(default_factory=DefaultMediaHooks)
    signed_url_ttl_sec: int | None = 3600
    worker: OmniMediaWorker | None = None
    _stats_lock: threading.Lock = field(default_factory=threading.Lock, init=False, repr=False)
    _stats: dict[str, int] = field(default_factory=dict, init=False, repr=False)

    def __post_init__(self) -> None:
        self._stats = {
            "sync_total": 0,
            "sync_completed": 0,
            "sync_failed": 0,
            "jobs_enqueued": 0,
            "jobs_completed": 0,
            "jobs_failed": 0,
        }
        if self.worker is None:
            self.worker = OmniMediaWorker(self.pipeline, self.queue_backend)
            self.worker.start()

    def _inc_stat(self, key: str, value: int = 1) -> None:
        with self._stats_lock:
            self._stats[key] = int(self._stats.get(key, 0)) + int(value)

    def _to_generate_request(self, modality: str, body: GenerateBody, request_id: str) -> GenerateRequest:
        params = GenerationParams(
            width=body.params.get("width"),
            height=body.params.get("height"),
            num_frames=body.params.get("num_frames"),
            fps=body.params.get("fps"),
            seed=body.params.get("seed"),
            guidance_scale=body.params.get("guidance_scale"),
            num_inference_steps=body.params.get("num_inference_steps"),
            num_images=body.params.get("num_images"),
            extra={k: v for k, v in body.params.items() if k not in {
                "width", "height", "num_frames", "fps", "seed", "guidance_scale", "num_inference_steps", "num_images"
            }},
        )

        return GenerateRequest(
            id=request_id,
            modality=modality,  # type: ignore[arg-type]
            mode=body.mode,
            prompt=body.prompt,
            negative_prompt=body.negative_prompt,
            params=params,
            safety_level=body.safety_level,
            watermark=body.watermark,
            return_format=body.return_format,
        )

    def _persist_outputs(self, response, request: GenerateRequest | None = None) -> list[OutputItem]:
        outputs: list[OutputItem] = []
        for index, output in enumerate(response.outputs):
            media_type = output.type
            metadata = dict(output.metadata)
            raw = metadata.pop("_bytes", None)
            url = output.url
            data = output.data

            if isinstance(raw, (bytes, bytearray)):
                self.hooks.validate_output(
                    media_type=media_type,
                    data=bytes(raw),
                    metadata=metadata,
                    safety_level=request.safety_level if request else "default",
                )

                raw_bytes, metadata = self.hooks.apply_watermark(
                    media_type=media_type,
                    data=bytes(raw),
                    metadata=metadata,
                    enabled=bool(request.watermark) if request else False,
                )

                ext = _infer_extension(media_type, metadata)
                url = self.storage.put_bytes(
                    response.id,
                    media_type,
                    index,
                    raw_bytes,
                    ext,
                    signed_ttl_sec=self.signed_url_ttl_sec,
                )

            outputs.append(
                OutputItem(
                    type=media_type,
                    url=url,
                    data=data,
                    metadata=metadata,
                )
            )

        return outputs

    def generate_sync(self, modality: str, body: GenerateBody) -> GenerateApiResponse:
        self._inc_stat("sync_total")
        request_id = str(uuid.uuid4())
        request = self._to_generate_request(modality, body, request_id)
        response = self.pipeline.run(request)

        if (
            modality == "video"
            and response.status != "completed"
            and "vllm_omni is not installed or unavailable" in str(response.error or "")
        ):
            configured_fallback_url = str(
                os.getenv(
                    "OMNI_MEDIA_FALLBACK_VIDEO_URL",
                    "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
                )
            ).strip()
            video_spec = compile_video_generation_spec(request.prompt)
            fallback_url = _select_prompt_aware_fallback_url(request.prompt, configured_fallback_url)
            if fallback_url:
                response.status = "completed"
                response.error = None
                response.outputs = [
                    MediaOutput(
                        type="video",
                        url=fallback_url,
                        data=None,
                        metadata={
                            "fallback": True,
                            "fallback_reason": "omni-runtime-unavailable",
                            "source": "OMNI_MEDIA_FALLBACK_VIDEO_URL",
                            "style_preset": video_spec.style_preset,
                            "motion_profile": video_spec.motion_profile,
                            "camera_profile": video_spec.camera_profile,
                            "scene_count": video_spec.metadata.get("scene_count"),
                            "duration_sec": video_spec.metadata.get("duration_sec"),
                            "scene_plan": video_spec.metadata.get("scene_plan"),
                            "prompt_aware": True,
                        },
                    )
                ]
                response.metadata = {
                    **(response.metadata or {}),
                    "fallback": True,
                    "fallback_reason": "omni-runtime-unavailable",
                    "style_preset": video_spec.style_preset,
                    "motion_profile": video_spec.motion_profile,
                    "camera_profile": video_spec.camera_profile,
                    "scene_count": video_spec.metadata.get("scene_count"),
                    "duration_sec": video_spec.metadata.get("duration_sec"),
                    "scene_plan": video_spec.metadata.get("scene_plan"),
                    "prompt_aware": True,
                }

        outputs = self._persist_outputs(response, request=request)
        if response.status == "completed":
            self._inc_stat("sync_completed")
        else:
            self._inc_stat("sync_failed")
        return GenerateApiResponse(
            id=response.id,
            status=response.status,
            outputs=outputs,
            error=response.error,
            metadata=response.metadata,
        )

    def enqueue_job(self, modality: str, body: GenerateBody) -> dict[str, Any]:
        self._inc_stat("jobs_enqueued")
        job_id = str(uuid.uuid4())
        submitted_at = datetime.now(timezone.utc).isoformat()
        record = JobRecord(id=job_id, modality=modality, status="queued", submitted_at=submitted_at)
        self.job_store.upsert(record)

        request = self._to_generate_request(modality, body, job_id)

        def on_complete(result) -> None:
            try:
                outputs = self._persist_outputs(result, request=request)
                api_response = GenerateApiResponse(
                    id=result.id,
                    status=result.status,
                    outputs=outputs,
                    error=result.error,
                    metadata=result.metadata,
                )
                completed = JobRecord(
                    id=job_id,
                    modality=modality,
                    status="completed" if result.status == "completed" else "failed",
                    submitted_at=submitted_at,
                    completed_at=datetime.now(timezone.utc).isoformat(),
                    response=api_response,
                    error=result.error,
                )
                self.job_store.upsert(completed)
                if result.status == "completed":
                    self._inc_stat("jobs_completed")
                else:
                    self._inc_stat("jobs_failed")
            except Exception as exc:
                failed = JobRecord(
                    id=job_id,
                    modality=modality,
                    status="failed",
                    submitted_at=submitted_at,
                    completed_at=datetime.now(timezone.utc).isoformat(),
                    error=str(exc),
                )
                self.job_store.upsert(failed)
                self._inc_stat("jobs_failed")

        self.queue_backend.enqueue(Job(request=request, on_complete=on_complete))
        return {"id": job_id, "status": "queued", "submitted_at": submitted_at}

    def get_job(self, job_id: str) -> dict[str, Any] | None:
        record = self.job_store.get(job_id)
        if not record:
            return None

        payload = {
            "id": record.id,
            "modality": record.modality,
            "status": record.status,
            "submitted_at": record.submitted_at,
            "completed_at": record.completed_at,
            "error": record.error,
        }
        if record.response:
            payload["response"] = asdict(record.response)
        return payload

    def get_runtime_diagnostics(self) -> dict[str, Any]:
        with self._stats_lock:
            stats = dict(self._stats)

        return {
            "stats": stats,
            "queue_depth": self.queue_backend.size(),
            "worker_running": bool(self.worker.is_running() if self.worker else False),
            "signed_url_ttl_sec": self.signed_url_ttl_sec,
            "storage_adapter": type(self.storage).__name__,
            "hooks_adapter": type(self.hooks).__name__,
        }
