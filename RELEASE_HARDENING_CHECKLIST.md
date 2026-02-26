# Omni Ai Release Hardening Checklist

## 1) Wrangler Bindings
- Ensure `AI`, `ASSETS`, `MIND`, and `MEMORY` bindings are configured.
- Enable `OMNI_DB` (D1) and `OMNI_SESSION` (Durable Object) for full state behavior.
- Configure cron trigger for scheduled maintenance.

## 2) Required Production Vars
- `OMNI_ENV=production`
- `OMNI_ADMIN_KEY=<strong secret (16+ chars)>`
- `OMNI_AUTONOMY_LEVEL=balanced` (or `conservative` / `aggressive`)
- Optionally tune:
  - `OMNI_MEMORY_RETENTION_DAYS`
  - `OMNI_SESSION_MAX_AGE_HOURS`
  - response/token caps

## 3) Security Validation
- Confirm maintenance endpoints require `x-omni-admin-key` in production:
  - `GET /api/maintenance/status`
  - `POST /api/maintenance/run`
  - `GET /api/release/readiness`
- Verify unauthorized requests return `401`.

## 4) Release Readiness API
- Call `GET /api/release/readiness` with admin key.
- Proceed only when `ready: true` and all checks are `ok: true`.

## 5) Functional Smoke
- Chat route (`/api/omni`) works with streaming.
- Image generation works (`/api/image` and multimodal `/api/omni` route=image).
- Maintenance run updates status telemetry and autonomy fields.

## 6) Post-Deploy Observe
- Check logs for `release_hardening_warning` and resolve any failed checks.
- Confirm `/api/maintenance/status` shows healthy drift/autonomy metrics over time.
