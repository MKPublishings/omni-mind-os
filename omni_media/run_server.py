from __future__ import annotations

import importlib
import os

from .http_fastapi import create_fastapi_app


def main() -> None:
    try:
        uvicorn = importlib.import_module("uvicorn")
    except Exception as exc:
        raise RuntimeError("uvicorn is required to run the Omni Media API server") from exc

    app = create_fastapi_app()
    host = os.getenv("OMNI_MEDIA_HOST", "127.0.0.1")
    port = int(os.getenv("OMNI_MEDIA_PORT", "8788"))
    uvicorn.run(app, host=host, port=port)


if __name__ == "__main__":
    main()
