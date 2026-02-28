from __future__ import annotations

import importlib.util
import importlib
import os
import unittest

from omni_media.api_contracts import GenerateApiResponse, OutputItem
from omni_media.http_fastapi import create_fastapi_app


def _has_fastapi_testclient() -> bool:
    return bool(importlib.util.find_spec("fastapi") and importlib.util.find_spec("starlette"))


class FakeService:
    def generate_sync(self, modality: str, _body):
        return GenerateApiResponse(
            id="req_123",
            status="completed",
            outputs=[
                OutputItem(
                    type=modality if modality in {"image", "video", "gif"} else "image",
                    url="https://example.test/media",
                    metadata={"model_profile": "test"},
                )
            ],
            metadata={"latency_ms": 1.2},
        )

    def enqueue_job(self, modality: str, _body):
        return {"id": "job_123", "status": "queued", "modality": modality}

    def get_job(self, job_id: str):
        if job_id == "missing":
            return None
        return {"id": job_id, "status": "queued", "modality": "image"}

    def get_runtime_diagnostics(self):
        return {
            "stats": {"sync_total": 2, "sync_completed": 2, "sync_failed": 0},
            "queue_depth": 0,
            "worker_running": True,
            "storage_adapter": "LocalFileStorageAdapter",
            "hooks_adapter": "DefaultMediaHooks",
        }


@unittest.skipUnless(_has_fastapi_testclient(), "fastapi/starlette test client not installed")
class TestHttpIntegration(unittest.TestCase):
    def setUp(self) -> None:
        self._env_backup = dict(os.environ)
        os.environ["OMNI_MEDIA_API_KEYS"] = "test-key"
        os.environ["OMNI_MEDIA_RATE_LIMIT_IMAGE"] = "2"
        os.environ["OMNI_MEDIA_RATE_LIMIT_WINDOW_IMAGE"] = "60"
        os.environ["OMNI_MEDIA_AUDIT_ENABLED"] = "false"

        fastapi_testclient = importlib.import_module("fastapi.testclient")
        TestClient = getattr(fastapi_testclient, "TestClient")

        app = create_fastapi_app(service=FakeService())
        self.client = TestClient(app)
        self.headers = {"x-api-key": "test-key"}

    def tearDown(self) -> None:
        os.environ.clear()
        os.environ.update(self._env_backup)

    def test_generate_image_requires_api_key(self) -> None:
        res = self.client.post("/v1/generate/image", json={"prompt": "hello"})
        self.assertEqual(res.status_code, 401)

    def test_generate_image_success_shape(self) -> None:
        res = self.client.post(
            "/v1/generate/image",
            headers=self.headers,
            json={"prompt": "hello world", "mode": "default", "params": {"width": 512, "height": 512}},
        )
        self.assertEqual(res.status_code, 200)
        payload = res.json()
        self.assertEqual(payload["status"], "completed")
        self.assertTrue(isinstance(payload.get("outputs"), list))
        self.assertEqual(payload["outputs"][0]["type"], "image")

    def test_generate_image_rate_limited(self) -> None:
        first = self.client.post("/v1/generate/image", headers=self.headers, json={"prompt": "p1"})
        second = self.client.post("/v1/generate/image", headers=self.headers, json={"prompt": "p2"})
        third = self.client.post("/v1/generate/image", headers=self.headers, json={"prompt": "p3"})

        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(third.status_code, 429)

    def test_admin_endpoints(self) -> None:
        security = self.client.get("/v1/admin/security", headers=self.headers)
        runtime = self.client.get("/v1/admin/runtime", headers=self.headers)

        self.assertEqual(security.status_code, 200)
        self.assertEqual(runtime.status_code, 200)

        security_body = security.json()
        runtime_body = runtime.json()

        self.assertTrue(security_body.get("ok"))
        self.assertIn("rate_limiter", security_body)
        self.assertTrue(runtime_body.get("ok"))
        self.assertIn("runtime", runtime_body)


if __name__ == "__main__":
    unittest.main()
