from fastapi import APIRouter
from app.api.endpoints import pledges

api_router = APIRouter()
api_router.include_router(pledges.router, prefix="/pledges", tags=["pledges"])
