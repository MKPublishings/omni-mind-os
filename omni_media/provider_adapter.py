from __future__ import annotations

import json
import os
import urllib.request
from dataclasses import dataclass
from typing import Any
from urllib.parse import urlparse


@dataclass(slots=True)
class ExternalVideoProviderAdapter:
    video_url: str
    api_key: str = ""
    api_key_header: str = "x-api-key"
    timeout_sec: float = 90.0
    health_url: str = ""

    @classmethod
    def from_env(cls) -> "ExternalVideoProviderAdapter":
        return cls(
            video_url=str(os.getenv("OMNI_MEDIA_PROVIDER_VIDEO_URL", "")).strip(),
            api_key=str(os.getenv("OMNI_MEDIA_PROVIDER_API_KEY", "")).strip(),
            api_key_header=str(os.getenv("OMNI_MEDIA_PROVIDER_API_KEY_HEADER", "x-api-key")).strip() or "x-api-key",
            timeout_sec=float(os.getenv("OMNI_MEDIA_PROVIDER_TIMEOUT_SEC", "90") or 90),
            health_url=str(os.getenv("OMNI_MEDIA_PROVIDER_HEALTH_URL", "")).strip(),
        )

    def is_configured(self) -> bool:
        return bool(self.video_url)

    def _headers(self) -> dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers[self.api_key_header] = self.api_key
        return headers

    def probe(self) -> dict[str, Any]:
        if not self.is_configured():
            return {
                "provider_configured": False,
                "provider_ready": False,
                "provider_health_ok": False,
                "provider_health_status": None,
            }

        video_target = self.video_url
        target = self.health_url or video_target
        try:
            method = "GET"
            headers = self._headers()
            if not self.health_url:
                parsed = urlparse(video_target)
                if parsed.path.strip() in {"", "/"}:
                    return {
                        "provider_configured": True,
                        "provider_ready": False,
                        "provider_health_ok": False,
                        "provider_health_status": None,
                        "provider_target": target,
                        "provider_error": "Provider URL points to a base/root path. Configure OMNI_MEDIA_PROVIDER_VIDEO_URL with the provider generate endpoint.",
                    }
                method = "OPTIONS"

            request = urllib.request.Request(target, method=method, headers=headers)
            with urllib.request.urlopen(request, timeout=self.timeout_sec) as response:
                status = int(getattr(response, "status", 0) or 0)
                response_headers = getattr(response, "headers", {})
                allow_header = str(response_headers.get("Allow", "")).upper()
                cors_allow_methods = str(response_headers.get("Access-Control-Allow-Methods", "")).upper()
                supported_methods = f"{allow_header},{cors_allow_methods}".strip(",")
                supports_post = "POST" in supported_methods if supported_methods else False
                health_ok = 200 <= status < 300
                ready = health_ok and (supports_post if not self.health_url else True)
                return {
                    "provider_configured": True,
                    "provider_ready": ready,
                    "provider_health_ok": health_ok,
                    "provider_health_status": status,
                    "provider_target": target,
                    "provider_probe_method": method,
                    "provider_supports_post": supports_post,
                }
        except Exception as exc:
            return {
                "provider_configured": True,
                "provider_ready": False,
                "provider_health_ok": False,
                "provider_health_status": None,
                "provider_target": target,
                "provider_error": str(exc),
            }

    def generate_video_url(
        self,
        *,
        prompt: str,
        mode: str,
        params: dict[str, Any],
        negative_prompt: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        if not self.is_configured():
            raise RuntimeError("External video provider is not configured")

        payload = {
            "prompt": prompt,
            "mode": mode,
            "params": params,
            "negative_prompt": negative_prompt,
            "metadata": metadata or {},
        }

        req = urllib.request.Request(
            self.video_url,
            data=json.dumps(payload).encode("utf-8"),
            method="POST",
            headers=self._headers(),
        )

        with urllib.request.urlopen(req, timeout=self.timeout_sec) as response:
            raw = response.read().decode("utf-8", errors="replace")
            data = json.loads(raw) if raw.strip() else {}

        output_url = ""
        if isinstance(data, dict):
            output_url = str(
                data.get("video_url")
                or data.get("output_url")
                or data.get("url")
                or (data.get("outputs") or [{}])[0].get("url")
                or ""
            ).strip()

        if not output_url:
            raise RuntimeError("External provider did not return a usable video URL")

        return {
            "url": output_url,
            "raw": data,
        }
