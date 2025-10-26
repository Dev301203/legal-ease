from fastapi import APIRouter

from app.api.routes import audio_models, legal, tree_generation, web_app
from app.api.routes.utils import router as utils_router
from app.core.config import settings

api_router = APIRouter()

api_router.include_router(utils_router, prefix="/utils", tags=["utils"])
api_router.include_router(audio_models.router)
api_router.include_router(tree_generation.router)
api_router.include_router(web_app.router)
api_router.include_router(legal.router)
