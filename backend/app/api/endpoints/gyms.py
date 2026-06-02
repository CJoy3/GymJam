from fastapi import APIRouter

from app.core.supabase_client import get_supabase
from app.schemas.gym import Gym

router = APIRouter()


@router.get("", response_model=list[Gym])
def list_gyms() -> list[dict]:
    sb = get_supabase()
    res = sb.table("gyms").select("*").order("name", desc=False).execute()
    return res.data or []
