from __future__ import annotations

import json
import os
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


@dataclass(slots=True)
class AuditLogger:
    enabled: bool = True
    path: str = "logs/omni_media_audit.log"

    @classmethod
    def from_env(cls) -> "AuditLogger":
        enabled_raw = str(os.getenv("OMNI_MEDIA_AUDIT_ENABLED", "true")).strip().lower()
        enabled = enabled_raw in {"1", "true", "yes", "on"}
        path = str(os.getenv("OMNI_MEDIA_AUDIT_LOG_PATH", "logs/omni_media_audit.log")).strip()
        return cls(enabled=enabled, path=path)

    def log(self, event: dict[str, Any]) -> None:
        if not self.enabled:
            return

        payload = {
            "ts": datetime.now(timezone.utc).isoformat(),
            **event,
        }

        file_path = Path(self.path)
        file_path.parent.mkdir(parents=True, exist_ok=True)
        with file_path.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(payload, ensure_ascii=False) + "\n")
