import re
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


def register_or_get_by_auth(auth_user_id: str, email: Optional[str] = None) -> dict:
    """Upsert a user by Supabase auth_user_id. Creates on first call, returns existing thereafter."""
    sb = get_supabase()
    existing = (
        sb.table("users")
        .select("*")
        .eq("auth_user_id", auth_user_id)
        .limit(1)
        .execute()
    )
    if existing.data:
        return existing.data[0]

    row: dict = {"auth_user_id": auth_user_id}
    if email:
        local = email.split("@")[0]
        safe = re.sub(r"[^a-zA-Z0-9 ]", "", local).strip() or "Athlete"
        row["display_name"] = safe[:64]

    inserted = sb.table("users").insert(row).execute()
    if not inserted.data:
        raise HTTPException(status_code=500, detail="Failed to create user")
    return inserted.data[0]


def get_by_auth_token(token: str) -> dict:
    """Validate a Supabase JWT and return the linked app user. 401 if invalid or not registered."""
    sb = get_supabase()
    try:
        response = sb.auth.get_user(token)
        if not response or not response.user:
            raise HTTPException(status_code=401, detail="Invalid token")
        auth_user_id = str(response.user.id)
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

    res = (
        sb.table("users")
        .select("*")
        .eq("auth_user_id", auth_user_id)
        .limit(1)
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=401, detail="Account not set up")
    return res.data[0]


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
    # Stamp when a fresh location fix lands so the squad map can age out stale ones.
    if "latitude" in patch or "longitude" in patch:
        from datetime import datetime, timezone
        patch = {**patch, "location_updated_at": datetime.now(timezone.utc).isoformat()}
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


def check_tag_available(tag: str, exclude_user_id: Optional[str] = None) -> bool:
    """Return True if the tag is not yet taken by any other user."""
    sb = get_supabase()
    q = sb.table("users").select("id").eq("tag", tag.lower())
    if exclude_user_id:
        q = q.neq("id", exclude_user_id)
    res = q.limit(1).execute()
    return len(res.data) == 0


def set_tag(user_id: str, tag: str) -> dict:
    """Set or change a user's tag. Initial set is free; thereafter limited to 1 change."""
    clean = tag.strip().lower()
    if not re.match(r'^[a-z0-9_-]{3,20}$', clean):
        raise HTTPException(status_code=422, detail="Tag must be 3–20 chars: letters, numbers, _ or -")

    user = get_by_id(user_id)
    current_tag = user.get("tag")
    tag_changes = user.get("tag_changes", 0)

    # Allow setting a tag for the first time (tag_changes=0, no current tag),
    # or one change if they already have a tag.
    if current_tag and tag_changes >= 1:
        raise HTTPException(status_code=400, detail="Tag can only be changed once after initial setup")

    if not check_tag_available(clean, user_id):
        raise HTTPException(status_code=409, detail="Tag is already taken")

    new_changes = (tag_changes + 1) if current_tag else 0
    sb = get_supabase()
    res = sb.table("users").update({"tag": clean, "tag_changes": new_changes}).eq("id", user_id).execute()
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to set tag")
    return res.data[0]


def add_elo(user_id: str, delta: int) -> dict:
    """Atomically add delta to user.elo via Postgres RPC, returning updated row."""
    sb = get_supabase()
    res = sb.rpc("add_elo", {"p_user_id": user_id, "p_delta": delta}).execute()
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to award ELO")
    return res.data[0] if isinstance(res.data, list) else res.data


def add_money(user_id: str, delta: int) -> dict:
    """Atomically add delta (pence) to user.money via Postgres RPC. Clamps at 0."""
    sb = get_supabase()
    res = sb.rpc("add_money", {"p_user_id": user_id, "p_delta": delta}).execute()
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to update money")
    return res.data[0] if isinstance(res.data, list) else res.data
