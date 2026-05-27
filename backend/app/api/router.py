from fastapi import APIRouter
from app.api.endpoints import health, pledges

api_router = APIRouter()
api_router.include_router(health.router, prefix="/health", tags=["health"])
api_router.include_router(pledges.router, prefix="/pledges", tags=["pledges"])
