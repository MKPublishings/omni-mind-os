# Omni Media (Omni-Native Scaffold)

This package provides a greenfield Omni-native media generation scaffold with:

- offline engine interfaces for image/video/GIF
- model registry and profile routing
- stage-based pipeline orchestration
- queue/worker skeleton
- unified API contracts

## Modules

- `contracts.py` -> request/response and media types
- `model_registry.py` -> canonical model profile map
- `engine.py` -> Omni generation wrappers (`Omni(model=...)`)
- `pipeline.py` -> normalization, routing, generation, safety, packaging
- `video_prompt_planner.py` -> prompt-to-scene storyboard planning and duration policies
- `worker.py` -> in-memory queue and worker loop
- `api_contracts.py` -> request/response DTOs for HTTP service layer
- `storage.py` -> local and S3-like output persistence adapters
- `service.py` -> sync generation + async queue orchestration
- `provider_adapter.py` -> optional external video provider integration
- `http_fastapi.py` -> `/v1/generate/*` and `/v1/jobs/*` endpoint scaffold
- `run_server.py` -> local server entrypoint using uvicorn
- `hooks.py` -> output safety validation and watermark hooks
- `security.py` -> API key auth and in-memory rate limiting
- `audit.py` -> structured JSONL audit logging

## Notes

- This is intentionally framework-light and can be wrapped by FastAPI/gRPC.
- `vllm_omni` and `Pillow` are expected in runtime for actual generation and GIF conversion.
- Replace placeholder video model ids with real Omni-compatible model ids in `model_registry.py`.
- `S3LikeStorageAdapter` returns pre-signed read URLs by default (`signed_ttl_sec=3600`).
- `OmniMediaService` applies output safety checks and watermark hooks before persistence.

## Run HTTP server

```bash
python -m omni_media.run_server
```

Default host/port:

- `127.0.0.1:8788`

Config overrides:

- `OMNI_MEDIA_HOST`
- `OMNI_MEDIA_PORT`

Security configuration:

- `OMNI_MEDIA_API_KEYS` (comma-separated keys; when set, all routes require `x-api-key`)
- `OMNI_MEDIA_RATE_LIMIT_DEFAULT`
- `OMNI_MEDIA_RATE_LIMIT_WINDOW_DEFAULT`
- `OMNI_MEDIA_RATE_LIMIT_IMAGE`
- `OMNI_MEDIA_RATE_LIMIT_WINDOW_IMAGE`
- `OMNI_MEDIA_RATE_LIMIT_VIDEO`
- `OMNI_MEDIA_RATE_LIMIT_WINDOW_VIDEO`
- `OMNI_MEDIA_RATE_LIMIT_GIF`
- `OMNI_MEDIA_RATE_LIMIT_WINDOW_GIF`
- `OMNI_MEDIA_RATE_LIMIT_JOBS`
- `OMNI_MEDIA_RATE_LIMIT_WINDOW_JOBS`
- `OMNI_MEDIA_RATE_LIMIT_ADMIN`
- `OMNI_MEDIA_RATE_LIMIT_WINDOW_ADMIN`
- `OMNI_MEDIA_RATE_LIMIT_BACKEND` (`memory` or `redis`)
- `OMNI_MEDIA_REDIS_URL` (required when backend is `redis`)

Audit configuration:

- `OMNI_MEDIA_AUDIT_ENABLED`
- `OMNI_MEDIA_AUDIT_LOG_PATH`

Audit events include request id, route, requester identity, status code, latency, success flag, and error (if any).

Worker proxy integration (for `POST /api/video/generate` in the Cloudflare worker):

- `OMNI_MEDIA_API_BASE_URL` (worker var; required)
- `OMNI_MEDIA_API_KEY` (worker var; optional, forwarded as `x-api-key`)
- `OMNI_MEDIA_API_TIMEOUT_MS` (worker var; optional timeout in milliseconds)

## Endpoints

- `POST /v1/generate/image`
- `POST /v1/generate/video`
- `POST /v1/generate/gif`
- `POST /v1/jobs/{modality}`
- `GET /v1/jobs/{job_id}`
- `GET /v1/health`
- `GET /v1/admin/security` (auth-protected)
- `GET /v1/admin/runtime` (auth-protected)

## Integration tests

Run the lightweight HTTP integration suite:

```bash
python -m unittest discover -s omni_media/tests -p "test_*.py"
```

The suite validates:

- API key enforcement
- Per-modality rate limiting behavior
- Response shape for generation endpoints
- Admin diagnostics endpoint responses

`GET /v1/health` includes `video_backend.real_video_backend_ready` and placeholder mode flags so you can quickly verify whether true prompt-grounded video generation is active.
