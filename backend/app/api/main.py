from fastapi import APIRouter

from app.api.routes import audio_models, legal, tree_generation
from app.core.config import settings

api_router = APIRouter()

api_router.include_router(audio_models.router)
api_router.include_router(legal.router)
api_router.include_router(tree_generation.router)
