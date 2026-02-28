from fastapi import APIRouter
from pydantic import BaseModel
from typing import Any, Dict
from core.pipeline import run_video_pipeline

router = APIRouter()

class VideoRequest(BaseModel):
    prompt: str
    params: Dict[str, Any] = {}

@router.post("/omni_video_exports")
async def generate_video(req: VideoRequest) -> Dict[str, Any]:
    """
    Provider-style endpoint that accepts a prompt and optional params and
    returns a JSON payload with status + video_url.
    """
    result = await run_video_pipeline(req.prompt, req.params or {})
    return result
