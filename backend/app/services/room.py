from typing import Optional

from fastapi import HTTPException

from app.core.supabase_client import get_supabase


def list_items(user_id: str) -> list[dict]:
    sb = get_supabase()
    res = (
        sb.table("user_room_items")
        .select("item_id, slot")
        .eq("user_id", user_id)
        .execute()
    )
    return res.data or []


def place_item(user_id: str, item_id: str, slot: Optional[int]) -> list[dict]:
    """Place or remove an item. slot=None unplaces it. Slot collisions are rejected."""
    sb = get_supabase()
    if slot is None:
        sb.table("user_room_items").delete().eq("user_id", user_id).eq("item_id", item_id).execute()
        return list_items(user_id)

    if not 0 <= slot <= 8:
        raise HTTPException(status_code=400, detail="slot must be 0..8")

    # Reject if another item already occupies that slot.
    clash = (
        sb.table("user_room_items")
        .select("item_id")
        .eq("user_id", user_id)
        .eq("slot", slot)
        .neq("item_id", item_id)
        .limit(1)
        .execute()
    )
    if clash.data:
        raise HTTPException(status_code=409, detail="Slot is already occupied")

    sb.table("user_room_items").upsert(
        {"user_id": user_id, "item_id": item_id, "slot": slot},
        on_conflict="user_id,item_id",
    ).execute()
    return list_items(user_id)
