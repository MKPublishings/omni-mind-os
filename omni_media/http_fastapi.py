from __future__ import annotations

import importlib
import time
import uuid
from dataclasses import asdict
from typing import Any

from starlette.requests import Request

from .api_contracts import GenerateBody
from .audit import AuditLogger
from .security import (
    ApiKeyAuth,
    AuthError,
    RateLimitError,
    create_rate_limiter_from_env,
    load_rate_limits_from_env,
)
from .provider_video_pipeline import generate_prompt_video_export
from .service import OmniMediaService


def create_fastapi_app(service: OmniMediaService | None = None) -> Any:
    try:
        fastapi_module = importlib.import_module("fastapi")
    except Exception as exc:
        raise RuntimeError("fastapi is required to create the HTTP app") from exc

    FastAPI = getattr(fastapi_module, "FastAPI")
    HTTPException = getattr(fastapi_module, "HTTPException")
    StaticFiles = getattr(importlib.import_module("fastapi.staticfiles"), "StaticFiles")

    app = FastAPI(title="Omni Media API", version="1.0.0")
    app.mount("/omni_video_exports", StaticFiles(directory="omni_video_exports"), name="omni_video_exports")
    media_service = service or OmniMediaService()
    auth = ApiKeyAuth()
    limiter = create_rate_limiter_from_env()
    limits = load_rate_limits_from_env()
    audit = AuditLogger.from_env()

    def _headers_to_dict(request: Any) -> dict[str, str]:
        try:
            return {str(k).lower(): str(v) for k, v in dict(request.headers).items()}
        except Exception:
            return {}

    def enforce_access(request: Any, bucket: str) -> str:
        try:
            headers = _headers_to_dict(request)
            api_key = auth.verify(headers)
            requester = api_key or headers.get("x-forwarded-for") or headers.get("x-real-ip") or "anonymous"
            limit, window = limits.get(bucket, limits["default"])
            limiter.check(key=f"{bucket}:{requester}", limit=limit, window_sec=window)
            return requester
        except AuthError as exc:
            raise HTTPException(status_code=401, detail=str(exc))
        except RateLimitError as exc:
            raise HTTPException(status_code=429, detail=str(exc))

    def write_audit(
        *,
        request_id: str,
        route: str,
        bucket: str,
        requester: str | None,
        status_code: int,
        latency_ms: float,
        success: bool,
        error: str | None = None,
    ) -> None:
        audit.log(
            {
                "request_id": request_id,
                "route": route,
                "bucket": bucket,
                "requester": requester,
                "status_code": status_code,
                "latency_ms": round(latency_ms, 2),
                "success": success,
                "error": error,
            }
        )

    def parse_body(payload: dict[str, Any]) -> GenerateBody:
        try:
            return GenerateBody(
                prompt=str(payload.get("prompt", "")).strip(),
                negative_prompt=payload.get("negative_prompt"),
                mode=str(payload.get("mode", "default")),
                params=dict(payload.get("params") or {}),
                safety_level=str(payload.get("safety_level", "default")),
                watermark=bool(payload.get("watermark", True)),
                return_format=str(payload.get("return_format", "url")),
            )
        except Exception as exc:
            raise HTTPException(status_code=400, detail=f"Invalid request payload: {exc}")

    @app.post("/v1/generate/image")
    async def generate_image(payload: dict[str, Any], request: Request):
        request_id = str(uuid.uuid4())
        started = time.perf_counter()
        requester = None
        try:
            requester = enforce_access(request, "image")
            body = parse_body(payload)
            result = media_service.generate_sync("image", body)
            code = 200 if result.status == "completed" else 500
            write_audit(
                request_id=request_id,
                route="/v1/generate/image",
                bucket="image",
                requester=requester,
                status_code=code,
                latency_ms=(time.perf_counter() - started) * 1000,
                success=result.status == "completed",
                error=result.error,
            )
            return fastapi_module.responses.JSONResponse(content=asdict(result), status_code=code)
        except HTTPException as exc:
            write_audit(
                request_id=request_id,
                route="/v1/generate/image",
                bucket="image",
                requester=requester,
                status_code=int(getattr(exc, "status_code", 500)),
                latency_ms=(time.perf_counter() - started) * 1000,
                success=False,
                error=str(getattr(exc, "detail", exc)),
            )
            raise

    @app.post("/v1/generate/video")
    async def generate_video(payload: dict[str, Any], request: Request):
        request_id = str(uuid.uuid4())
        started = time.perf_counter()
        requester = None
        try:
            requester = enforce_access(request, "video")
            body = parse_body(payload)
            result = media_service.generate_sync("video", body)
            code = 200 if result.status == "completed" else 500
            write_audit(
                request_id=request_id,
                route="/v1/generate/video",
                bucket="video",
                requester=requester,
                status_code=code,
                latency_ms=(time.perf_counter() - started) * 1000,
                success=result.status == "completed",
                error=result.error,
            )
            return fastapi_module.responses.JSONResponse(content=asdict(result), status_code=code)
        except HTTPException as exc:
            write_audit(
                request_id=request_id,
                route="/v1/generate/video",
                bucket="video",
                requester=requester,
                status_code=int(getattr(exc, "status_code", 500)),
                latency_ms=(time.perf_counter() - started) * 1000,
                success=False,
                error=str(getattr(exc, "detail", exc)),
            )
            raise

    @app.post("/v1/generate/gif")
    async def generate_gif(payload: dict[str, Any], request: Request):
        request_id = str(uuid.uuid4())
        started = time.perf_counter()
        requester = None
        try:
            requester = enforce_access(request, "gif")
            body = parse_body(payload)
            result = media_service.generate_sync("gif", body)
            code = 200 if result.status == "completed" else 500
            write_audit(
                request_id=request_id,
                route="/v1/generate/gif",
                bucket="gif",
                requester=requester,
                status_code=code,
                latency_ms=(time.perf_counter() - started) * 1000,
                success=result.status == "completed",
                error=result.error,
            )
            return fastapi_module.responses.JSONResponse(content=asdict(result), status_code=code)
        except HTTPException as exc:
            write_audit(
                request_id=request_id,
                route="/v1/generate/gif",
                bucket="gif",
                requester=requester,
                status_code=int(getattr(exc, "status_code", 500)),
                latency_ms=(time.perf_counter() - started) * 1000,
                success=False,
                error=str(getattr(exc, "detail", exc)),
            )
            raise

    @app.post("/omni_video_exports")
    async def generate_provider_video(payload: dict[str, Any], request: Request):
        request_id = str(uuid.uuid4())
        started = time.perf_counter()
        requester = None
        try:
            requester = enforce_access(request, "video")
            prompt = str(payload.get("prompt", "")).strip()
            if not prompt:
                raise HTTPException(status_code=400, detail="Prompt is required")
            params = dict(payload.get("params") or {})
            result = generate_prompt_video_export(prompt, params)
            write_audit(
                request_id=request_id,
                route="/omni_video_exports",
                bucket="video",
                requester=requester,
                status_code=200,
                latency_ms=(time.perf_counter() - started) * 1000,
                success=True,
            )
            return result
        except HTTPException as exc:
            write_audit(
                request_id=request_id,
                route="/omni_video_exports",
                bucket="video",
                requester=requester,
                status_code=int(getattr(exc, "status_code", 500)),
                latency_ms=(time.perf_counter() - started) * 1000,
                success=False,
                error=str(getattr(exc, "detail", exc)),
            )
            raise
        except Exception as exc:
            write_audit(
                request_id=request_id,
                route="/omni_video_exports",
                bucket="video",
                requester=requester,
                status_code=500,
                latency_ms=(time.perf_counter() - started) * 1000,
                success=False,
                error=str(exc),
            )
            raise HTTPException(status_code=500, detail=f"Provider video generation failed: {exc}")

    @app.post("/v1/jobs/{modality}")
    async def enqueue_job(modality: str, payload: dict[str, Any], request: Request):
        request_id = str(uuid.uuid4())
        started = time.perf_counter()
        requester = None
        try:
            requester = enforce_access(request, "jobs")
            mod = modality.strip().lower()
            if mod not in {"image", "video", "gif"}:
                raise HTTPException(status_code=400, detail=f"Unsupported modality: {modality}")

            body = parse_body(payload)
            result = media_service.enqueue_job(mod, body)
            write_audit(
                request_id=request_id,
                route="/v1/jobs/{modality}",
                bucket="jobs",
                requester=requester,
                status_code=200,
                latency_ms=(time.perf_counter() - started) * 1000,
                success=True,
            )
            return result
        except HTTPException as exc:
            write_audit(
                request_id=request_id,
                route="/v1/jobs/{modality}",
                bucket="jobs",
                requester=requester,
                status_code=int(getattr(exc, "status_code", 500)),
                latency_ms=(time.perf_counter() - started) * 1000,
                success=False,
                error=str(getattr(exc, "detail", exc)),
            )
            raise

    @app.get("/v1/jobs/{job_id}")
    async def get_job(job_id: str, request: Request):
        request_id = str(uuid.uuid4())
        started = time.perf_counter()
        requester = None
        try:
            requester = enforce_access(request, "jobs")
            result = media_service.get_job(job_id)
            if result is None:
                raise HTTPException(status_code=404, detail="Job not found")
            write_audit(
                request_id=request_id,
                route="/v1/jobs/{job_id}",
                bucket="jobs",
                requester=requester,
                status_code=200,
                latency_ms=(time.perf_counter() - started) * 1000,
                success=True,
            )
            return result
        except HTTPException as exc:
            write_audit(
                request_id=request_id,
                route="/v1/jobs/{job_id}",
                bucket="jobs",
                requester=requester,
                status_code=int(getattr(exc, "status_code", 500)),
                latency_ms=(time.perf_counter() - started) * 1000,
                success=False,
                error=str(getattr(exc, "detail", exc)),
            )
            raise

    @app.get("/v1/health")
    async def health():
        health_probe = (
            media_service.get_video_backend_health()
            if hasattr(media_service, "get_video_backend_health")
            else {
                "real_video_backend_ready": False,
                "backend": "unknown",
                "placeholder_mode_enabled": False,
                "strict_prompt_generation": True,
            }
        )

        return {
            "ok": True,
            "service": "omni-media",
            "version": "1.0.0",
            "video_backend": health_probe,
        }

    @app.get("/v1/admin/security")
    async def admin_security(request: Request):
        request_id = str(uuid.uuid4())
        started = time.perf_counter()
        requester = None
        try:
            requester = enforce_access(request, "admin")
            payload = {
                "ok": True,
                "auth": {
                    "header_name": auth.header_name,
                    "keys_configured": bool(auth._configured_keys()),
                    "allow_without_keys": auth.allow_without_keys,
                },
                "rate_limiter": {
                    "backend": type(limiter).__name__,
                    "limits": limits,
                },
                "audit": {
                    "enabled": audit.enabled,
                    "path": audit.path,
                },
            }
            write_audit(
                request_id=request_id,
                route="/v1/admin/security",
                bucket="admin",
                requester=requester,
                status_code=200,
                latency_ms=(time.perf_counter() - started) * 1000,
                success=True,
            )
            return payload
        except HTTPException as exc:
            write_audit(
                request_id=request_id,
                route="/v1/admin/security",
                bucket="admin",
                requester=requester,
                status_code=int(getattr(exc, "status_code", 500)),
                latency_ms=(time.perf_counter() - started) * 1000,
                success=False,
                error=str(getattr(exc, "detail", exc)),
            )
            raise

    @app.get("/v1/admin/runtime")
    async def admin_runtime(request: Request):
        request_id = str(uuid.uuid4())
        started = time.perf_counter()
        requester = None
        try:
            requester = enforce_access(request, "admin")
            payload = {
                "ok": True,
                "runtime": media_service.get_runtime_diagnostics(),
            }
            write_audit(
                request_id=request_id,
                route="/v1/admin/runtime",
                bucket="admin",
                requester=requester,
                status_code=200,
                latency_ms=(time.perf_counter() - started) * 1000,
                success=True,
            )
            return payload
        except HTTPException as exc:
            write_audit(
                request_id=request_id,
                route="/v1/admin/runtime",
                bucket="admin",
                requester=requester,
                status_code=int(getattr(exc, "status_code", 500)),
                latency_ms=(time.perf_counter() - started) * 1000,
                success=False,
                error=str(getattr(exc, "detail", exc)),
            )
            raise


    return app

# Expose the FastAPI app for uvicorn
app = create_fastapi_app()
