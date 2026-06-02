from datetime import datetime, timezone

from fastapi import HTTPException

from app.core.supabase_client import get_supabase
from app.schemas.group import JoinType


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def list_at_gym(gym_id: str, current_user_id: str) -> list[dict]:
    """Return groups at a gym, enriched with member_count + my membership state."""
    sb = get_supabase()
    groups = (
        sb.table("groups")
        .select("*")
        .eq("gym_id", gym_id)
        .order("created_at", desc=True)
        .execute()
    ).data or []
    if not groups:
        return []

    group_ids = [g["id"] for g in groups]

    members = (
        sb.table("group_memberships")
        .select("group_id, user_id, role")
        .in_("group_id", group_ids)
        .execute()
    ).data or []
    pending = (
        sb.table("join_requests")
        .select("group_id, user_id")
        .in_("group_id", group_ids)
        .eq("status", "pending")
        .execute()
    ).data or []

    by_group_members: dict[str, list[dict]] = {}
    for m in members:
        by_group_members.setdefault(m["group_id"], []).append(m)
    my_pending = {p["group_id"] for p in pending if p["user_id"] == current_user_id}

    enriched: list[dict] = []
    for g in groups:
        gm = by_group_members.get(g["id"], [])
        mine = next((m for m in gm if m["user_id"] == current_user_id), None)
        enriched.append({
            **g,
            "member_count": len(gm),
            "is_member": mine is not None,
            "is_leader": mine is not None and mine["role"] == "leader",
            "join_request_pending": g["id"] in my_pending,
        })
    return enriched


def get_group(group_id: str) -> dict:
    sb = get_supabase()
    res = sb.table("groups").select("*").eq("id", group_id).limit(1).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Group not found")
    return res.data[0]


def current_membership(user_id: str) -> dict | None:
    sb = get_supabase()
    res = (
        sb.table("group_memberships")
        .select("*")
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    return res.data[0] if res.data else None


def create_group(
    creator_id: str,
    gym_id: str,
    name: str,
    weekly_stake_elo: int,
    join_type: JoinType,
) -> dict:
    if current_membership(creator_id):
        raise HTTPException(status_code=409, detail="Leave your current group first")
    sb = get_supabase()
    grp = (
        sb.table("groups")
        .insert({
            "gym_id": gym_id,
            "name": name,
            "weekly_stake_elo": weekly_stake_elo,
            "join_type": join_type,
            "leader_id": creator_id,
        })
        .execute()
    )
    if not grp.data:
        raise HTTPException(status_code=500, detail="Failed to create group")
    group = grp.data[0]
    sb.table("group_memberships").insert({
        "group_id": group["id"],
        "user_id": creator_id,
        "role": "leader",
    }).execute()
    return group


def join_or_request(group_id: str, user_id: str) -> dict:
    """Returns { action: 'joined' | 'requested', group }."""
    if current_membership(user_id):
        raise HTTPException(status_code=409, detail="Leave your current group first")
    group = get_group(group_id)

    sb = get_supabase()
    if group["join_type"] == "open":
        sb.table("group_memberships").insert({
            "group_id": group_id,
            "user_id": user_id,
            "role": "member",
        }).execute()
        return {"action": "joined", "group": group}

    existing = (
        sb.table("join_requests")
        .select("id")
        .eq("group_id", group_id)
        .eq("user_id", user_id)
        .eq("status", "pending")
        .limit(1)
        .execute()
    )
    if existing.data:
        return {"action": "requested", "group": group}

    sb.table("join_requests").insert({
        "group_id": group_id,
        "user_id": user_id,
        "status": "pending",
    }).execute()
    return {"action": "requested", "group": group}


def leave_group(group_id: str, user_id: str) -> None:
    sb = get_supabase()
    sb.table("group_memberships").delete().eq("group_id", group_id).eq("user_id", user_id).execute()
    # If the leader leaves, clear leader_id (next leader assignment is a future feature).
    grp = get_group(group_id)
    if grp.get("leader_id") == user_id:
        sb.table("groups").update({"leader_id": None}).eq("id", group_id).execute()


def list_pending_requests(group_id: str, leader_id: str) -> list[dict]:
    group = get_group(group_id)
    if group.get("leader_id") != leader_id:
        raise HTTPException(status_code=403, detail="Only the leader can view requests")
    sb = get_supabase()
    res = (
        sb.table("join_requests")
        .select("id, group_id, user_id, status, created_at, users(display_name)")
        .eq("group_id", group_id)
        .eq("status", "pending")
        .order("created_at", desc=False)
        .execute()
    )
    rows = res.data or []
    return [
        {
            "id": r["id"],
            "group_id": r["group_id"],
            "user_id": r["user_id"],
            "status": r["status"],
            "created_at": r["created_at"],
            "display_name": (r.get("users") or {}).get("display_name", "Anonymous"),
        }
        for r in rows
    ]


def _get_request(request_id: str) -> dict:
    sb = get_supabase()
    res = sb.table("join_requests").select("*").eq("id", request_id).limit(1).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Request not found")
    return res.data[0]


def _assert_leader(group_id: str, user_id: str) -> None:
    group = get_group(group_id)
    if group.get("leader_id") != user_id:
        raise HTTPException(status_code=403, detail="Only the leader can resolve requests")


def approve_request(request_id: str, leader_id: str) -> dict:
    req = _get_request(request_id)
    if req["status"] != "pending":
        raise HTTPException(status_code=409, detail="Request already resolved")
    _assert_leader(req["group_id"], leader_id)
    if current_membership(req["user_id"]):
        raise HTTPException(status_code=409, detail="User already in a group")
    sb = get_supabase()
    sb.table("group_memberships").insert({
        "group_id": req["group_id"],
        "user_id": req["user_id"],
        "role": "member",
    }).execute()
    sb.table("join_requests").update({
        "status": "approved",
        "resolved_at": _utc_now_iso(),
    }).eq("id", request_id).execute()
    return {"id": request_id, "status": "approved"}


def reject_request(request_id: str, leader_id: str) -> dict:
    req = _get_request(request_id)
    if req["status"] != "pending":
        raise HTTPException(status_code=409, detail="Request already resolved")
    _assert_leader(req["group_id"], leader_id)
    sb = get_supabase()
    sb.table("join_requests").update({
        "status": "rejected",
        "resolved_at": _utc_now_iso(),
    }).eq("id", request_id).execute()
    return {"id": request_id, "status": "rejected"}
