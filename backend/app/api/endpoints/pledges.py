from fastapi import APIRouter, HTTPException, Query
from app.core.supabase_client import get_supabase
from app.schemas.pledge import Pledge, PledgeCreate

router = APIRouter()


@router.get("", response_model=list[Pledge])
def list_pledges(user_id: str = Query(min_length=1, max_length=128)):
    sb = get_supabase()
    res = (
        sb.table("pledges")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )
    return res.data or []


@router.post("", response_model=Pledge, status_code=201)
def create_pledge(payload: PledgeCreate):
    sb = get_supabase()
    res = (
        sb.table("pledges")
        .insert({"user_id": payload.user_id, "amount": payload.amount})
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to create pledge")
    return res.data[0]
