from __future__ import annotations

import importlib
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path


class StorageAdapter:
    def put_bytes(
        self,
        request_id: str,
        media_type: str,
        index: int,
        data: bytes,
        extension: str,
        signed_ttl_sec: int | None = None,
    ) -> str:
        raise NotImplementedError


@dataclass(slots=True)
class LocalFileStorageAdapter(StorageAdapter):
    base_dir: str = "media_outputs"

    def put_bytes(
        self,
        request_id: str,
        media_type: str,
        index: int,
        data: bytes,
        extension: str,
        signed_ttl_sec: int | None = None,
    ) -> str:
        now = datetime.now(timezone.utc)
        folder = Path(self.base_dir) / media_type / now.strftime("%Y") / now.strftime("%m") / now.strftime("%d") / request_id
        folder.mkdir(parents=True, exist_ok=True)

        filename = f"{media_type}_{index}.{extension.strip('.').lower() or 'bin'}"
        path = folder / filename
        path.write_bytes(data)
        return str(path.as_posix())


@dataclass(slots=True)
class S3LikeStorageAdapter(StorageAdapter):
    bucket: str
    prefix: str = "omni-media"
    endpoint_url: str | None = None
    region_name: str | None = None

    def _client(self):
        try:
            boto3 = importlib.import_module("boto3")
        except Exception as exc:
            raise RuntimeError("boto3 is required for S3LikeStorageAdapter") from exc

        return boto3.client(
            "s3",
            endpoint_url=self.endpoint_url,
            region_name=self.region_name,
        )

    def put_bytes(
        self,
        request_id: str,
        media_type: str,
        index: int,
        data: bytes,
        extension: str,
        signed_ttl_sec: int | None = 3600,
    ) -> str:
        now = datetime.now(timezone.utc)
        key = (
            f"{self.prefix}/{media_type}/{now.strftime('%Y/%m/%d')}/"
            f"{request_id}/{media_type}_{index}.{extension.strip('.').lower() or 'bin'}"
        )

        client = self._client()
        client.put_object(Bucket=self.bucket, Key=key, Body=data)

        if signed_ttl_sec and signed_ttl_sec > 0:
            try:
                return client.generate_presigned_url(
                    "get_object",
                    Params={"Bucket": self.bucket, "Key": key},
                    ExpiresIn=int(signed_ttl_sec),
                )
            except Exception:
                return f"s3://{self.bucket}/{key}"

        return f"s3://{self.bucket}/{key}"
