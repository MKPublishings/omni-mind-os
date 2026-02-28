from fastapi import FastAPI
from routes.video import router as video_router

app = FastAPI()
app.include_router(video_router)
