from fastapi import APIRouter
from pydantic import BaseModel
from typing import Any, Dict
from core.pipeline import run_video_pipeline

router = APIRouter()

class VideoRequest(BaseModel):
    prompt: str
    params: Dict[str, Any] = {}

@router.post("/omni_video_exports")
async def generate_video(req: VideoRequest):
    result = await run_video_pipeline(req.prompt, req.params)
    return result
