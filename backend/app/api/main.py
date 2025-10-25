from fastapi import APIRouter

from app.api.routes import  legal, audio_models
from app.core.config import settings

api_router = APIRouter()
api_router.include_router(audio_models.router)