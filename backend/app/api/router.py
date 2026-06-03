from fastapi import APIRouter

from app.api.endpoints import checkins, groups, gyms, plans, room, users

api_router = APIRouter()
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(gyms.router, prefix="/gyms", tags=["gyms"])
api_router.include_router(groups.router, prefix="/groups", tags=["groups"])
api_router.include_router(plans.router, prefix="/plans", tags=["plans"])
api_router.include_router(checkins.router, prefix="/checkins", tags=["checkins"])
api_router.include_router(room.router, prefix="/room", tags=["room"])
