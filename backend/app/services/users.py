from typing import Optional

from fastapi import HTTPException

from app.core.supabase_client import get_supabase


def register_or_get(device_id: str, display_name: Optional[str]) -> dict:
    """Upsert a user by device_id. On first registration, set display_name (or default)."""
    sb = get_supabase()
    existing = (
        sb.table("users")
        .select("*")
        .eq("device_id", device_id)
        .limit(1)
        .execute()
    )
    if existing.data:
        return existing.data[0]

    row = {"device_id": device_id}
    if display_name:
        row["display_name"] = display_name
    inserted = sb.table("users").insert(row).execute()
    if not inserted.data:
        raise HTTPException(status_code=500, detail="Failed to create user")
    return inserted.data[0]


def get_by_device_id(device_id: str) -> dict:
    sb = get_supabase()
    res = (
        sb.table("users")
        .select("*")
        .eq("device_id", device_id)
        .limit(1)
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=401, detail="Unknown device")
    return res.data[0]


def update_profile(user_id: str, patch: dict) -> dict:
    if not patch:
        return get_by_id(user_id)
    sb = get_supabase()
    res = sb.table("users").update(patch).eq("id", user_id).execute()
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to update user")
    return res.data[0]


def get_by_id(user_id: str) -> dict:
    sb = get_supabase()
    res = sb.table("users").select("*").eq("id", user_id).limit(1).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="User not found")
    return res.data[0]


def add_elo(user_id: str, delta: int) -> dict:
    """Atomically add delta to user.elo via Postgres RPC, returning updated row."""
    sb = get_supabase()
    # We rely on the `add_elo` SQL function in schema.sql.
    res = sb.rpc("add_elo", {"p_user_id": user_id, "p_delta": delta}).execute()
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to award ELO")
    # rpc returns the updated row as a single record
    return res.data[0] if isinstance(res.data, list) else res.data
