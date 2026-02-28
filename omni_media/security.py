from __future__ import annotations

import os
import time
import importlib
from collections import defaultdict, deque
from dataclasses import dataclass, field
from typing import Protocol


class AuthError(PermissionError):
    pass


class RateLimitError(PermissionError):
    pass


class RateLimiter(Protocol):
    def check(self, key: str, limit: int | None = None, window_sec: int | None = None) -> None:
        ...


@dataclass(slots=True)
class ApiKeyAuth:
    header_name: str = "x-api-key"
    env_var_name: str = "OMNI_MEDIA_API_KEYS"
    allow_without_keys: bool = True

    def _configured_keys(self) -> set[str]:
        raw = os.getenv(self.env_var_name, "")
        keys = {item.strip() for item in raw.split(",") if item.strip()}
        return keys

    def verify(self, request_headers: dict[str, str]) -> str | None:
        keys = self._configured_keys()
        candidate = request_headers.get(self.header_name) or request_headers.get(self.header_name.lower())

        if not keys:
            if self.allow_without_keys:
                return None
            raise AuthError("API key auth is required but no keys are configured")

        if not candidate:
            raise AuthError("Missing API key")

        if candidate not in keys:
            raise AuthError("Invalid API key")

        return candidate


@dataclass(slots=True)
class InMemoryRateLimiter:
    default_limit: int = 60
    default_window_sec: int = 60
    _events: dict[str, deque[float]] = field(init=False)

    def __post_init__(self) -> None:
        self._events: dict[str, deque[float]] = defaultdict(deque)

    def _trim(self, q: deque[float], window_sec: int, now: float) -> None:
        threshold = now - window_sec
        while q and q[0] < threshold:
            q.popleft()

    def check(self, key: str, limit: int | None = None, window_sec: int | None = None) -> None:
        use_limit = int(limit or self.default_limit)
        use_window = int(window_sec or self.default_window_sec)
        now = time.monotonic()

        q = self._events[key]
        self._trim(q, use_window, now)
        if len(q) >= use_limit:
            raise RateLimitError(f"Rate limit exceeded ({use_limit}/{use_window}s)")

        q.append(now)


@dataclass(slots=True)
class RedisRateLimiter:
    redis_url: str
    default_limit: int = 60
    default_window_sec: int = 60
    key_prefix: str = "omni-media:ratelimit"
    _client: object = field(init=False)

    def __post_init__(self) -> None:
        try:
            redis_module = importlib.import_module("redis")
        except Exception as exc:
            raise RuntimeError("redis package is required for RedisRateLimiter") from exc

        self._client = redis_module.from_url(self.redis_url)

    def check(self, key: str, limit: int | None = None, window_sec: int | None = None) -> None:
        use_limit = int(limit or self.default_limit)
        use_window = int(window_sec or self.default_window_sec)
        namespaced_key = f"{self.key_prefix}:{key}"

        current = self._client.incr(namespaced_key)
        if current == 1:
            self._client.expire(namespaced_key, use_window)

        if int(current) > use_limit:
            raise RateLimitError(f"Rate limit exceeded ({use_limit}/{use_window}s)")


def load_rate_limits_from_env() -> dict[str, tuple[int, int]]:
    default_limit = int(os.getenv("OMNI_MEDIA_RATE_LIMIT_DEFAULT", "60"))
    default_window = int(os.getenv("OMNI_MEDIA_RATE_LIMIT_WINDOW_DEFAULT", "60"))

    image_limit = int(os.getenv("OMNI_MEDIA_RATE_LIMIT_IMAGE", str(default_limit)))
    image_window = int(os.getenv("OMNI_MEDIA_RATE_LIMIT_WINDOW_IMAGE", str(default_window)))

    video_limit = int(os.getenv("OMNI_MEDIA_RATE_LIMIT_VIDEO", "10"))
    video_window = int(os.getenv("OMNI_MEDIA_RATE_LIMIT_WINDOW_VIDEO", "60"))

    gif_limit = int(os.getenv("OMNI_MEDIA_RATE_LIMIT_GIF", "20"))
    gif_window = int(os.getenv("OMNI_MEDIA_RATE_LIMIT_WINDOW_GIF", "60"))

    jobs_limit = int(os.getenv("OMNI_MEDIA_RATE_LIMIT_JOBS", "30"))
    jobs_window = int(os.getenv("OMNI_MEDIA_RATE_LIMIT_WINDOW_JOBS", "60"))

    admin_limit = int(os.getenv("OMNI_MEDIA_RATE_LIMIT_ADMIN", "30"))
    admin_window = int(os.getenv("OMNI_MEDIA_RATE_LIMIT_WINDOW_ADMIN", "60"))

    return {
        "image": (image_limit, image_window),
        "video": (video_limit, video_window),
        "gif": (gif_limit, gif_window),
        "jobs": (jobs_limit, jobs_window),
        "admin": (admin_limit, admin_window),
        "default": (default_limit, default_window),
    }


def create_rate_limiter_from_env() -> RateLimiter:
    backend = str(os.getenv("OMNI_MEDIA_RATE_LIMIT_BACKEND", "memory")).strip().lower()
    default_limit = int(os.getenv("OMNI_MEDIA_RATE_LIMIT_DEFAULT", "60"))
    default_window = int(os.getenv("OMNI_MEDIA_RATE_LIMIT_WINDOW_DEFAULT", "60"))

    if backend == "redis":
        redis_url = str(os.getenv("OMNI_MEDIA_REDIS_URL", "")).strip()
        if not redis_url:
            raise RuntimeError("OMNI_MEDIA_REDIS_URL must be set when OMNI_MEDIA_RATE_LIMIT_BACKEND=redis")
        return RedisRateLimiter(
            redis_url=redis_url,
            default_limit=default_limit,
            default_window_sec=default_window,
        )

    return InMemoryRateLimiter(default_limit=default_limit, default_window_sec=default_window)
